'use strict';
// ─── vi_importar.js — importação dos ZIPs de Válvulas & Instrumentos ──

function viParseCSV(texto) {
  texto = texto.replace(/^\uFEFF/, '');
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i+1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else {
      if (c === '"') aspas = true;
      else if (c === ';') { linha.push(campo); campo = ''; }
      else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
      else if (c !== '\r') campo += c;
    }
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter(l => l.length > 1 || (l.length === 1 && l[0] !== ''));
}

function viGet(headers, valores, nome) {
  const idx = headers.findIndex(h => h.trim().toLowerCase() === nome.toLowerCase());
  return idx >= 0 ? (valores[idx] || '').trim() : '';
}
function viNum(v) { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }

function viMapInstrumento(h, v, importacao_id) {
  return {
    importacao_id, dominio: 'instrumento',
    tag: viGet(h,v,'TAG'),
    ex: viGet(h,v,'EX').toUpperCase() === 'SIM',
    tipo: viGet(h,v,'Tipo'),
    area: viGet(h,v,'Área'),
    localizacao: viGet(h,v,'Localização'),
    fabricante: viGet(h,v,'Fabricante'),
    modelo: viGet(h,v,'Modelo'),
    serie: viGet(h,v,'Nº Série'),
    ano_fabricacao: viGet(h,v,'Ano Fabricação'),
    codigo_fabricante: viGet(h,v,'Código Fabricante'),
    criticidade: viGet(h,v,'Criticidade'),
    dim_alt: viNum(viGet(h,v,'Altura (cm)')),
    dim_lar: viNum(viGet(h,v,'Largura (cm)')),
    dim_comp: viNum(viGet(h,v,'Comprimento (cm)')),
    anotacoes_coleta: viGet(h,v,'Anotações')
  };
}

function viMapValvula(h, v, importacao_id) {
  return {
    importacao_id, dominio: 'valvula',
    tag: viGet(h,v,'TAG'),
    area: viGet(h,v,'Área'),
    localizacao: viGet(h,v,'Localização'),
    tipo: viGet(h,v,'Tipo'),
    dn: viGet(h,v,'DN'),
    fabricante: viGet(h,v,'Fabricante'),
    modelo: viGet(h,v,'Modelo'),
    serie: viGet(h,v,'Nº Série'),
    classe: viGet(h,v,'Classe'),
    atuador: viGet(h,v,'Atuador'),
    condicao: viGet(h,v,'Condição') || 'ok',
    dim_alt: viNum(viGet(h,v,'Altura (cm)')),
    dim_lar: viNum(viGet(h,v,'Largura (cm)')),
    dim_comp: viNum(viGet(h,v,'Comprimento (cm)')),
    anotacoes_coleta: viGet(h,v,'Anotações')
  };
}

async function viProcessarZip(file) {
  const zip = await JSZip.loadAsync(file);
  let csvInst = null, csvValv = null;
  zip.forEach((path, f) => {
    const p = path.toLowerCase();
    if (p.endsWith('instrumentos.csv') && !f.dir) csvInst = f;
    if (p.endsWith('valvulas.csv') && !f.dir) csvValv = f;
  });
  if (!csvInst && !csvValv)
    throw new Error('Nenhum instrumentos.csv ou valvulas.csv encontrado no ZIP');

  const ler = async f => {
    if (!f) return { headers: [], registros: [] };
    const linhas = viParseCSV(await f.async('string'));
    return { headers: linhas[0] || [], registros: linhas.slice(1) };
  };
  const inst = await ler(csvInst);
  const valv = await ler(csvValv);

  // Fotos por TAG
  const fotosPorTag = {};
  zip.forEach((path, f) => {
    if (f.dir) return;
    const m = path.match(/fotos\/([^\/]+)\/([^\/]+)$/i);
    if (m) {
      if (!fotosPorTag[m[1]]) fotosPorTag[m[1]] = [];
      fotosPorTag[m[1]].push({ nome: m[2], file: f });
    }
  });

  return { inst, valv, fotosPorTag };
}

async function viExecutarImportacao(nomeZip, dados, onProgress) {
  const { inst, valv, fotosPorTag } = dados;
  const tecnico = nomeZip.split('_')[0] || '';

  onProgress('Criando importação...');
  const imp = await viCriarImportacao(nomeZip, tecnico, inst.registros.length, valv.registros.length);

  let okCount = 0, fotosOk = 0, erros = [];

  async function importarLista(lista, mapFn, headers) {
    for (let i = 0; i < lista.length; i++) {
      const eq = mapFn(headers, lista[i], imp.id);
      if (!eq.tag) continue;
      onProgress(`${eq.dominio === 'valvula' ? 'Válvula' : 'Instrumento'}: ${eq.tag}`);
      try {
        const inserido = await viInserirEquipamento(eq);
        okCount++;
        const tagSafe = eq.tag.replace(/[^a-zA-Z0-9_-]/g, '_');
        const flist = fotosPorTag[tagSafe] || fotosPorTag[eq.tag] || [];
        for (let j = 0; j < flist.length; j++) {
          onProgress(`${eq.tag} — foto ${j+1}/${flist.length}`);
          try {
            const blob = await flist[j].file.async('blob');
            const caminho = `vi/${inserido.id}/${flist[j].nome}`;
            await dbUploadFoto(caminho, blob);
            await viRegistrarFoto(inserido.id, caminho, 'coleta');
            fotosOk++;
          } catch (e) { erros.push(`Foto ${flist[j].nome}: ${e.message}`); }
        }
      } catch (e) { erros.push(`${eq.tag}: ${e.message}`); }
    }
  }

  await importarLista(inst.registros, viMapInstrumento, inst.headers);
  await importarLista(valv.registros, viMapValvula, valv.headers);

  return { okCount, fotosOk, erros, inst: inst.registros.length, valv: valv.registros.length };
}

// ─── Tela ──────────────────────────────────────────────────────────────
function viTelaImportar() {
  window._ajudaChave = 'vi_importar';
  setConteudo(`
    <div class="page-head">
      <h2>Importar ZIP — Válvulas & Instrumentos</h2>
      <p class="page-sub">Selecione o arquivo ZIP gerado pelo coletor de Válvulas & Instrumentos</p>
    </div>
    <div class="import-box" id="vi-import-box">
      <input type="file" id="vi-zip-input" accept=".zip" style="display:none" onchange="viAoSelecionarZip(this)" />
      <div class="import-drop" onclick="document.getElementById('vi-zip-input').click()">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p><strong>Toque para selecionar o ZIP</strong></p>
        <p class="import-hint">Contém instrumentos.csv e/ou valvulas.csv</p>
      </div>
    </div>
    <div id="vi-import-status" style="display:none">
      <div class="import-progress"><div class="spinner"></div><span id="vi-import-msg">Lendo arquivo...</span></div>
    </div>
    <div id="vi-import-resultado"></div>
  `);
}

async function viAoSelecionarZip(input) {
  const file = input.files[0];
  if (!file) return;
  const box = document.getElementById('vi-import-box');
  const status = document.getElementById('vi-import-status');
  const msg = document.getElementById('vi-import-msg');
  const res = document.getElementById('vi-import-resultado');
  box.style.display = 'none'; status.style.display = 'block'; res.innerHTML = '';
  const onProgress = m => { msg.textContent = m; };
  try {
    onProgress('Lendo o ZIP...');
    const dados = await viProcessarZip(file);
    const r = await viExecutarImportacao(file.name, dados, onProgress);
    status.style.display = 'none';
    res.innerHTML = `
      <div class="result-card ${r.erros.length ? 'warn' : 'ok'}">
        <h3>${r.erros.length ? '⚠️ Importação concluída com avisos' : '✅ Importação concluída'}</h3>
        <p><strong>${r.inst}</strong> instrumentos · <strong>${r.valv}</strong> válvulas · <strong>${r.fotosOk}</strong> fotos</p>
        ${r.erros.length ? `<details><summary>${r.erros.length} avisos</summary><ul>${r.erros.map(e=>`<li>${e}</li>`).join('')}</ul></details>` : ''}
        <div class="result-actions">
          <button class="btn" onclick="navegar('vi_equip')">Ver equipamentos</button>
          <button class="btn btn-sec" onclick="viTelaImportar()">Importar outro</button>
        </div>
      </div>`;
  } catch (e) {
    status.style.display = 'none'; box.style.display = 'block';
    res.innerHTML = `<div class="result-card erro"><h3>❌ Erro na importação</h3><p>${e.message}</p></div>`;
  }
  input.value = '';
}
