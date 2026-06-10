'use strict';
// ─── importar.js — importação dos ZIPs do coletor ─────────────────────

// Parser de CSV com ; e aspas duplas
function parseCSV(texto) {
  texto = texto.replace(/^\uFEFF/, '');
  const linhas = [];
  let linha = [], campo = '', dentroAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroAspas) {
      if (c === '"') {
        if (texto[i+1] === '"') { campo += '"'; i++; }
        else dentroAspas = false;
      } else campo += c;
    } else {
      if (c === '"') dentroAspas = true;
      else if (c === ';') { linha.push(campo); campo = ''; }
      else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
      else if (c !== '\r') campo += c;
    }
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter(l => l.length > 1 || (l.length === 1 && l[0] !== ''));
}

// Mapeia uma linha do CSV para o formato da tabela maquinas
function mapearMaquina(headers, valores, importacao_id) {
  const get = nome => {
    const idx = headers.findIndex(h => h.trim().toLowerCase() === nome.toLowerCase());
    return idx >= 0 ? (valores[idx] || '').trim() : '';
  };
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  const int = v => { const n = parseInt(v); return isNaN(n) ? null : n; };

  return {
    importacao_id,
    tag:          get('TAG'),
    ex:           get('EX').toUpperCase() === 'SIM',
    tipo:         get('Tipo') || 'motor_eletrico',
    area:         get('Área'),
    localizacao:  get('Localização'),
    potencia:     num(get('Potência')),
    unidade_pot:  get('Unidade') || 'kW',
    tensao:       get('Tensão (V)'),
    ligacao:      get('Ligação') || 'trifasico',
    corrente:     num(get('Corrente (A)')),
    rpm:          int(get('RPM')),
    fp:           num(get('FP')),
    ip:           get('IP'),
    classe:       get('Classe'),
    freq:         get('Freq (Hz)') || '60',
    fabricante:   get('Fabricante'),
    serie:        get('Nº Série'),
    modelo:       get('Modelo'),
    status_coleta: get('Status') || 'ok',
    servicos_previstos: get('Serviços (checks)'),
    anotacoes_coleta:   get('Anotações'),
    dim_alt:      num(get('Altura (cm)')),
    dim_lar:      num(get('Largura (cm)')),
    dim_comp:     num(get('Comprimento (cm)'))
  };
}

// Processa o arquivo ZIP selecionado
async function processarZip(file, onProgress) {
  const zip = await JSZip.loadAsync(file);

  // Localiza o dados.csv (pode estar dentro de uma pasta)
  let csvFile = null;
  zip.forEach((path, f) => {
    if (path.toLowerCase().endsWith('dados.csv') && !f.dir) csvFile = f;
  });
  if (!csvFile) throw new Error('dados.csv não encontrado no ZIP');

  const csvTexto = await csvFile.async('string');
  const linhas = parseCSV(csvTexto);
  if (linhas.length < 2) throw new Error('CSV vazio ou inválido');
  const headers = linhas[0];
  const registros = linhas.slice(1);

  // Mapeia fotos por TAG: fotos/<TAG>/<arquivo>
  const fotosPorTag = {};
  zip.forEach((path, f) => {
    if (f.dir) return;
    const m = path.match(/fotos\/([^\/]+)\/([^\/]+)$/i);
    if (m) {
      const tag = m[1];
      if (!fotosPorTag[tag]) fotosPorTag[tag] = [];
      fotosPorTag[tag].push({ path, nome: m[2], file: f });
    }
  });

  return { headers, registros, fotosPorTag, totalFotos: Object.values(fotosPorTag).reduce((s,a)=>s+a.length,0) };
}

// Executa a importação completa
async function executarImportacao(nomeZip, dados, onProgress) {
  const { headers, registros, fotosPorTag } = dados;

  // Extrai técnico do nome do arquivo (5 primeiros chars antes do _)
  const tecnico = nomeZip.split('_')[0] || '';

  onProgress(`Criando importação...`);
  const imp = await dbCriarImportacao(nomeZip, tecnico, registros.length);

  let maqOk = 0, fotosOk = 0, erros = [];

  for (let i = 0; i < registros.length; i++) {
    const m = mapearMaquina(headers, registros[i], imp.id);
    if (!m.tag) continue;
    onProgress(`Máquina ${i+1}/${registros.length}: ${m.tag}`);
    try {
      const inserida = await dbInserirMaquina(m);
      maqOk++;

      // Fotos da TAG — o nome da pasta usa tag sanitizada (- vira _ ou mantém)
      const tagSafe = m.tag.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fotosDaTag = fotosPorTag[tagSafe] || fotosPorTag[m.tag] || [];

      for (let j = 0; j < fotosDaTag.length; j++) {
        onProgress(`${m.tag} — foto ${j+1}/${fotosDaTag.length}`);
        try {
          const blob = await fotosDaTag[j].file.async('blob');
          const caminho = `maquinas/${inserida.id}/${fotosDaTag[j].nome}`;
          await dbUploadFoto(caminho, blob);
          await dbRegistrarFoto(inserida.id, caminho, 'coleta');
          fotosOk++;
        } catch (e) {
          erros.push(`Foto ${fotosDaTag[j].nome}: ${e.message}`);
        }
      }
    } catch (e) {
      erros.push(`Máquina ${m.tag}: ${e.message}`);
    }
  }

  return { maqOk, fotosOk, erros, importacao: imp };
}

// ─── Tela de importação ────────────────────────────────────────────────
function telaImportar() {
  setConteudo(`
    <div class="page-head">
      <h2>Importar ZIP</h2>
      <p class="page-sub">Selecione o arquivo ZIP gerado pelo aplicativo de coleta de campo</p>
    </div>

    <div class="import-box" id="import-box">
      <input type="file" id="zip-input" accept=".zip" style="display:none" onchange="aoSelecionarZip(this)" />
      <div class="import-drop" onclick="document.getElementById('zip-input').click()">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p><strong>Toque para selecionar o ZIP</strong></p>
        <p class="import-hint">Padrão: TTTTT_EEEEE_LLLLL_AAAAMMDD.zip</p>
      </div>
    </div>

    <div id="import-status" style="display:none">
      <div class="import-progress">
        <div class="spinner"></div>
        <span id="import-msg">Lendo arquivo...</span>
      </div>
    </div>

    <div id="import-resultado"></div>
  `);
}

async function aoSelecionarZip(input) {
  const file = input.files[0];
  if (!file) return;

  const box = document.getElementById('import-box');
  const status = document.getElementById('import-status');
  const msgEl = document.getElementById('import-msg');
  const resultado = document.getElementById('import-resultado');

  box.style.display = 'none';
  status.style.display = 'block';
  resultado.innerHTML = '';

  const onProgress = msg => { msgEl.textContent = msg; };

  try {
    onProgress('Lendo o ZIP...');
    const dados = await processarZip(file, onProgress);

    onProgress(`${dados.registros.length} máquinas e ${dados.totalFotos} fotos encontradas. Importando...`);
    const r = await executarImportacao(file.name, dados, onProgress);

    status.style.display = 'none';
    resultado.innerHTML = `
      <div class="result-card ${r.erros.length ? 'warn' : 'ok'}">
        <h3>${r.erros.length ? '⚠️ Importação concluída com avisos' : '✅ Importação concluída'}</h3>
        <p><strong>${r.maqOk}</strong> máquinas importadas · <strong>${r.fotosOk}</strong> fotos enviadas</p>
        ${r.erros.length ? `<details><summary>${r.erros.length} avisos</summary><ul>${r.erros.map(e=>`<li>${e}</li>`).join('')}</ul></details>` : ''}
        <div class="result-actions">
          <button class="btn" onclick="navegar('biblioteca')">Ver biblioteca</button>
          <button class="btn btn-sec" onclick="telaImportar()">Importar outro ZIP</button>
        </div>
      </div>
    `;
  } catch (e) {
    status.style.display = 'none';
    box.style.display = 'block';
    resultado.innerHTML = `<div class="result-card erro"><h3>❌ Erro na importação</h3><p>${e.message}</p></div>`;
  }
  input.value = '';
}
