'use strict';
// ─── exportar.js — exportação de dados (Excel + PDF) ───────────────────

// Campos disponíveis por domínio: { chave: { rotulo, valor(m) } }
const EXP_CAMPOS_MAQUINA = {
  tag:         { rotulo: 'TAG', valor: m => m.tag },
  tipo:        { rotulo: 'Tipo', valor: m => TIPOS_NOMES[m.tipo] || m.tipo },
  ex:          { rotulo: 'EX', valor: m => m.ex ? 'SIM' : 'NÃO' },
  area:        { rotulo: 'Área', valor: m => m.area },
  localizacao: { rotulo: 'Localização', valor: m => m.localizacao },
  potencia:    { rotulo: 'Potência', valor: m => m.potencia ?? '' },
  unidade_pot: { rotulo: 'Unidade pot.', valor: m => m.unidade_pot || '' },
  tensao:      { rotulo: 'Tensão (V)', valor: m => m.tensao },
  ligacao:     { rotulo: 'Ligação', valor: m => m.ligacao },
  corrente:    { rotulo: 'Corrente (A)', valor: m => m.corrente ?? '' },
  rpm:         { rotulo: 'RPM', valor: m => m.rpm ?? '' },
  fp:          { rotulo: 'FP', valor: m => m.fp ?? '' },
  ip:          { rotulo: 'IP', valor: m => m.ip },
  classe:      { rotulo: 'Classe isol.', valor: m => m.classe },
  freq:        { rotulo: 'Frequência', valor: m => m.freq },
  fabricante:  { rotulo: 'Fabricante', valor: m => m.fabricante },
  modelo:      { rotulo: 'Modelo', valor: m => m.modelo },
  serie:       { rotulo: 'Nº série', valor: m => m.serie },
  rolamento_dianteiro: { rotulo: 'Rolamento dianteiro', valor: m => m.rolamento_dianteiro },
  rolamento_traseiro:  { rotulo: 'Rolamento traseiro', valor: m => m.rolamento_traseiro },
  dim_alt:     { rotulo: 'Altura (cm)', valor: m => m.dim_alt ?? '' },
  dim_lar:     { rotulo: 'Largura (cm)', valor: m => m.dim_lar ?? '' },
  dim_comp:    { rotulo: 'Comprimento (cm)', valor: m => m.dim_comp ?? '' },
  status_coleta: { rotulo: 'Estado', valor: m => ({ok:'OK',atencao:'Atenção',critico:'Crítico'})[m.status_coleta] || m.status_coleta },
  anotacoes_coleta: { rotulo: 'Anotações', valor: m => m.anotacoes_coleta }
};

const EXP_CAMPOS_VI = {
  tag:         { rotulo: 'TAG', valor: m => m.tag },
  dominio:     { rotulo: 'Domínio', valor: m => m.dominio === 'valvula' ? 'Válvula' : 'Instrumento' },
  tipo:        { rotulo: 'Tipo', valor: m => m.tipo },
  area:        { rotulo: 'Área', valor: m => m.area },
  localizacao: { rotulo: 'Localização', valor: m => m.localizacao },
  fabricante:  { rotulo: 'Fabricante', valor: m => m.fabricante },
  modelo:      { rotulo: 'Modelo', valor: m => m.modelo },
  serie:       { rotulo: 'Nº série', valor: m => m.serie },
  ex:          { rotulo: 'EX', valor: m => m.ex ? 'SIM' : 'NÃO' },
  ano_fabricacao:    { rotulo: 'Ano fabricação', valor: m => m.ano_fabricacao },
  codigo_fabricante: { rotulo: 'Cód. fabricante', valor: m => m.codigo_fabricante },
  criticidade: { rotulo: 'Criticidade', valor: m => m.criticidade },
  dn:          { rotulo: 'DN', valor: m => m.dn },
  classe:      { rotulo: 'Classe', valor: m => m.classe },
  atuador:     { rotulo: 'Atuador', valor: m => m.atuador },
  condicao:    { rotulo: 'Condição', valor: m => ({ok:'OK',atencao:'Atenção',critico:'Crítico'})[m.condicao] || m.condicao },
  dim_alt:     { rotulo: 'Altura (cm)', valor: m => m.dim_alt ?? '' },
  dim_lar:     { rotulo: 'Largura (cm)', valor: m => m.dim_lar ?? '' },
  dim_comp:    { rotulo: 'Comprimento (cm)', valor: m => m.dim_comp ?? '' },
  anotacoes_coleta: { rotulo: 'Anotações', valor: m => m.anotacoes_coleta }
};

// Campos marcados por padrão
const EXP_PADRAO_MAQ = ['tag','tipo','area','localizacao','potencia','unidade_pot','fabricante','rolamento_dianteiro','rolamento_traseiro'];
const EXP_PADRAO_VI  = ['tag','dominio','tipo','area','localizacao','fabricante','modelo','criticidade'];

let expFonte = 'maquinas';        // 'maquinas' | 'vi'
let expFiltroArea = '';
let expFiltroTipo = '';
let expDados = [];                 // equipamentos carregados (ativos)
let expSelecao = {};              // { id: true }
let expCampos = {};              // { chave: true }

function telaExportar() {
  window._ajudaChave = 'exportar';
  setConteudo(`
    <div class="page-head"><h2>Exportar dados</h2>
      <p class="page-sub">Gere planilha Excel ou relatório PDF dos equipamentos ativos</p>
    </div>

    <div class="cat-tabs">
      <button class="cat-tab ${expFonte==='maquinas'?'ativo':''}" onclick="expTrocarFonte('maquinas')">Máquinas</button>
      <button class="cat-tab ${expFonte==='vi'?'ativo':''}" onclick="expTrocarFonte('vi')">Válvulas & Instrumentos</button>
    </div>

    <div id="exp-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  expCarregar();
}

function expTrocarFonte(f) {
  expFonte = f; expFiltroArea = ''; expFiltroTipo = '';
  expSelecao = {}; expCampos = {};
  telaExportar();
}

async function expCarregar() {
  const el = document.getElementById('exp-area');
  try {
    if (expFonte === 'maquinas') {
      expDados = await dbListarMaquinas({ status: 'ativa' });
      const fotos = await dbTodasFotosMaquinas();
      const mapa = {};
      fotos.forEach(f => { (mapa[f.maquina_id] = mapa[f.maquina_id] || []).push(f); });
      expDados.forEach(m => { m.fotos = mapa[m.id] || []; });
    } else {
      expDados = await viListarEquipamentos({ status: 'ativa' });
      const fotos = await viTodasFotos();
      const mapa = {};
      fotos.forEach(f => { (mapa[f.equipamento_id] = mapa[f.equipamento_id] || []).push(f); });
      expDados.forEach(m => { m.vi_fotos = mapa[m.id] || []; });
    }
    // seleção inicial: todos marcados
    expSelecao = {};
    expDados.forEach(m => expSelecao[m.id] = true);
    // campos padrão
    const padrao = expFonte === 'maquinas' ? EXP_PADRAO_MAQ : EXP_PADRAO_VI;
    expCampos = {};
    padrao.forEach(k => expCampos[k] = true);
    expRender();
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function expCamposDef() { return expFonte === 'maquinas' ? EXP_CAMPOS_MAQUINA : EXP_CAMPOS_VI; }

function expTipoNome(m) {
  if (expFonte === 'maquinas') return TIPOS_NOMES[m.tipo] || m.tipo || '—';
  return m.tipo || '—';
}

function expListaFiltrada() {
  return expDados.filter(m =>
    (!expFiltroArea || (m.area || '') === expFiltroArea) &&
    (!expFiltroTipo || expTipoNome(m) === expFiltroTipo)
  );
}

function expRender() {
  const el = document.getElementById('exp-area');
  const campos = expCamposDef();
  const areas = [...new Set(expDados.map(m => m.area || '').filter(Boolean))].sort();
  const tipos = [...new Set(expDados.map(m => expTipoNome(m)))].sort();
  const lista = expListaFiltrada();
  const nSel = lista.filter(m => expSelecao[m.id]).length;

  el.innerHTML = `
    <div class="exp-grid">
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">1. Colunas a exportar</h3>
          <div class="exp-campos">
            ${Object.entries(campos).map(([k, def]) => `
              <label class="exp-campo-item ${expCampos[k] ? 'on' : ''}">
                <input type="checkbox" ${expCampos[k] ? 'checked' : ''} onchange="expToggleCampo('${k}')" />
                <span>${def.rotulo}</span>
              </label>`).join('')}
          </div>
          <div class="exp-mini-acoes">
            <button class="btn-mini" onclick="expTodosCampos(true)">Marcar todos</button>
            <button class="btn-mini" onclick="expTodosCampos(false)">Limpar</button>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">2. Filtros</h3>
          <div class="row2">
            <div class="field"><label>Área</label>
              <select onchange="expFiltroArea=this.value;expRender()">
                <option value="">Todas</option>
                ${areas.map(a => `<option value="${escHtml(a)}"${expFiltroArea===a?' selected':''}>${escHtml(a)}</option>`).join('')}
              </select></div>
            <div class="field"><label>Tipo</label>
              <select onchange="expFiltroTipo=this.value;expRender()">
                <option value="">Todos</option>
                ${tipos.map(t => `<option value="${escHtml(t)}"${expFiltroTipo===t?' selected':''}>${escHtml(t)}</option>`).join('')}
              </select></div>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">3. Exportar</h3>
          <p class="page-sub" style="margin-bottom:12px"><strong id="exp-cont">${nSel}</strong> de ${lista.length} selecionado(s)</p>
          <div class="conf-acoes">
            <button class="btn" onclick="expGerarExcel()">📊 Baixar Excel (.xlsx)</button>
            <button class="btn btn-sec" onclick="expGerarPDF()">📄 Relatório PDF</button>
          </div>
          <p class="page-sub" style="margin-top:10px">O PDF gera 4 equipamentos por folha A4, com TAG e foto favorita.</p>
        </div>
      </div>

      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Seleção de equipamentos</h3>
          <div class="exp-sel-acoes">
            <button class="btn-mini" onclick="expSelTodos(true)">Selecionar todos</button>
            <button class="btn-mini" onclick="expSelTodos(false)">Desmarcar todos</button>
          </div>
          <div class="exp-lista">
            ${lista.length ? lista.map(m => `
              <label class="exp-eq-item">
                <input type="checkbox" ${expSelecao[m.id] ? 'checked' : ''} onchange="expToggleEq('${m.id}')" />
                <span class="td-mono">${escHtml(m.tag)}</span>
                <span class="exp-eq-sub">${escHtml(expTipoNome(m))}${m.area ? ' · ' + escHtml(m.area) : ''}</span>
              </label>`).join('') : '<p class="page-sub">Nenhum equipamento com esses filtros</p>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function expToggleCampo(k) { expCampos[k] = !expCampos[k]; expRender(); }
function expTodosCampos(v) {
  const campos = expCamposDef();
  expCampos = {};
  if (v) Object.keys(campos).forEach(k => expCampos[k] = true);
  expRender();
}
function expToggleEq(id) { expSelecao[id] = !expSelecao[id]; document.getElementById('exp-cont').textContent = expListaFiltrada().filter(m=>expSelecao[m.id]).length; }
function expSelTodos(v) {
  expListaFiltrada().forEach(m => expSelecao[m.id] = v);
  expRender();
}

function expSelecionados() {
  return expListaFiltrada().filter(m => expSelecao[m.id]);
}

// ─── EXCEL ─────────────────────────────────────────────────────────────
function expGerarExcel() {
  const sel = expSelecionados();
  if (!sel.length) { alert('Selecione ao menos um equipamento'); return; }
  const campos = expCamposDef();
  const colunas = Object.keys(campos).filter(k => expCampos[k]);
  if (!colunas.length) { alert('Selecione ao menos uma coluna'); return; }

  const cabecalho = colunas.map(k => campos[k].rotulo);
  const linhas = sel.map(m => colunas.map(k => {
    const v = campos[k].valor(m);
    return v == null ? '' : v;
  }));

  const aoa = [cabecalho, ...linhas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // largura básica das colunas
  ws['!cols'] = colunas.map(k => ({ wch: Math.max(12, campos[k].rotulo.length + 2) }));
  const wb = XLSX.utils.book_new();
  const nomePlan = expFonte === 'maquinas' ? 'Máquinas' : 'V&I';
  XLSX.utils.book_append_sheet(wb, ws, nomePlan);

  const data = new Date().toISOString().slice(0,10).replace(/-/g,'');
  XLSX.writeFile(wb, `export_${expFonte}_${data}.xlsx`);
}

// ─── PDF (4 equipamentos por folha A4: TAG + foto favorita) ────────────
function expFotoFavoritaUrl(m) {
  const fotos = expFonte === 'maquinas' ? (m.fotos || []) : (m.vi_fotos || []);
  if (!fotos.length) return null;
  let f = null;
  if (m.foto_principal_id) f = fotos.find(x => x.id === m.foto_principal_id);
  if (!f) f = fotos[0];
  return f ? dbUrlFoto(f.caminho_storage) : null;
}

function _imgParaDataURL(img) {
  const cv = document.createElement('canvas');
  const MAX = 700;
  let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  if (w > MAX || h > MAX) { if (w>h){h=Math.round(h*MAX/w);w=MAX;} else {w=Math.round(w*MAX/h);h=MAX;} }
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(img, 0, 0, w, h);
  return { dataUrl: cv.toDataURL('image/jpeg', 0.85), w, h };
}

// Carrega via fetch->blob->dataURL (contorna CORS de cache e taint do canvas)
async function carregarImagemDataURL(url) {
  // 1ª tentativa: fetch do blob (Supabase público envia CORS em requisições fetch)
  try {
    const resp = await fetch(url, { mode: 'cors', cache: 'reload' });
    if (resp.ok) {
      const blob = await resp.blob();
      const dataUrlOrig = await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => res(null);
        fr.readAsDataURL(blob);
      });
      if (dataUrlOrig) {
        const img = await new Promise(res => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = dataUrlOrig;
        });
        if (img) { const r = _imgParaDataURL(img); if (r) return r; }
      }
    }
  } catch (e) { /* cai no fallback */ }

  // 2ª tentativa: Image com crossOrigin e cache-busting
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { try { resolve(_imgParaDataURL(img)); } catch (e) { resolve(null); } };
    img.onerror = () => resolve(null);
    const sep = url.includes('?') ? '&' : '?';
    img.src = url + sep + '_cb=' + Date.now();
  });
}

async function expGerarPDF() {
  const sel = expSelecionados();
  if (!sel.length) { alert('Selecione ao menos um equipamento'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 12;
  const titulo = expFonte === 'maquinas' ? 'Máquinas' : 'Válvulas & Instrumentos';

  // grade 2 colunas × 2 linhas = 4 por página
  const cellW = (PW - M*2) / 2;
  const cellH = (PH - M*2 - 14) / 2;   // 14mm p/ cabeçalho

  // pré-carrega imagens (com indicador)
  setConteudo(`<div class="loading" style="margin-top:60px"><div class="spinner"></div> Gerando PDF — carregando fotos...</div>`);

  const itens = [];
  for (const m of sel) {
    const url = expFotoFavoritaUrl(m);
    const img = url ? await carregarImagemDataURL(url) : null;
    itens.push({ m, img });
  }

  for (let i = 0; i < itens.length; i++) {
    const pos = i % 4;
    if (i > 0 && pos === 0) doc.addPage();
    if (pos === 0) {
      // cabeçalho da página
      doc.setFontSize(13); doc.setFont(undefined, 'bold');
      doc.text(`Relatório — ${titulo}`, M, M);
      doc.setFontSize(8); doc.setFont(undefined, 'normal');
      doc.setTextColor(120);
      doc.text(`MANUTENÇÃO GERAL UIS3 2026 · ${new Date().toLocaleDateString('pt-BR')}`, M, M + 5);
      doc.setTextColor(0);
    }

    const col = pos % 2, row = Math.floor(pos / 2);
    const x = M + col * cellW;
    const y = M + 14 + row * cellH;

    // moldura
    doc.setDrawColor(200); doc.setLineWidth(0.3);
    doc.rect(x, y, cellW - 4, cellH - 4);

    // TAG
    doc.setFontSize(12); doc.setFont(undefined, 'bold');
    doc.text(String(itens[i].m.tag || '—'), x + 4, y + 7);

    // foto
    const it = itens[i];
    const imgX = x + 4, imgY = y + 11;
    const imgMaxW = cellW - 12, imgMaxH = cellH - 20;
    if (it.img) {
      let w = it.img.w, h = it.img.h;
      const r = Math.min(imgMaxW / w, imgMaxH / h);
      w = w * r; h = h * r;
      try { doc.addImage(it.img.dataUrl, 'JPEG', imgX, imgY, w, h); }
      catch (e) { doc.setFontSize(9); doc.setTextColor(150); doc.text('(erro na imagem)', imgX, imgY + 10); doc.setTextColor(0); }
    } else {
      doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(150);
      doc.text('sem foto', imgX, imgY + 10);
      doc.setTextColor(0);
    }
  }

  const data = new Date().toISOString().slice(0,10).replace(/-/g,'');
  doc.save(`relatorio_${expFonte}_${data}.pdf`);
  telaExportar();
}

