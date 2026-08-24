'use strict';
// ─── maquinas.js — telas de consulta por tipo ──────────────────────────

const CATEGORIAS = {
  ex:        { titulo: 'Motores EX',  sub: 'Equipamentos à prova de explosão — processo próprio de movimentação para oficinas externas', filtro: { ex: true } },
  motores:   { titulo: 'Motores',     sub: 'Motores elétricos convencionais', filtro: { ex: false, tipo: 'motor_eletrico' } },
  bombas:    { titulo: 'Bombas',      sub: 'Bombas de processo e utilidades', filtro: { ex: false, tipo: 'bomba' } },
  redutores: { titulo: 'Redutores',   sub: 'Redutores de velocidade', filtro: { ex: false, tipo: 'redutor' } },
  outros:    { titulo: 'Outras máquinas', sub: 'Ventiladores, compressores, transportadores e demais', filtro: { ex: false, tipos: ['ventilador','compressor','transportador','outro'] } }
};

const TIPOS_NOMES = {
  motor_eletrico:'Motor elétrico', bomba:'Bomba', redutor:'Redutor',
  ventilador:'Ventilador', compressor:'Compressor',
  transportador:'Transportador', outro:'Outro'
};

let categoriaAtual = 'ex';
let buscaAtual = '';
let statusAtual = 'ativa';
let areaAtual = '';  // '' = todas as áreas

function telaMaquinas(cat) {
  if (cat) categoriaAtual = cat;
  const c = CATEGORIAS[categoriaAtual];

  setConteudo(`
    <div class="page-head" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <h2>Máquinas</h2>
      <button class="btn" onclick="telaNovaMaquina()" style="white-space:nowrap">+ Nova Máquina</button>
    </div>

    <div class="cat-tabs">
      ${Object.entries(CATEGORIAS).map(([k, v]) => `
        <button class="cat-tab ${k === categoriaAtual ? 'ativo' : ''} ${k === 'ex' ? 'tab-ex' : ''}"
          onclick="telaMaquinas('${k}')">${v.titulo}</button>
      `).join('')}
    </div>

    <p class="page-sub" style="margin-bottom:14px">${c.sub}</p>

    <div class="filtros-bar">
      <input type="text" id="filtro-busca" placeholder="Buscar por TAG, área, fabricante ou ID..."
        value="${escHtml(buscaAtual)}" oninput="buscaAtual=this.value;filtrarTabela()" style="max-width:320px" />
      <select id="filtro-area" onchange="areaAtual=this.value;filtrarTabela()" style="max-width:200px">
        <option value="" ${areaAtual===''?'selected':''}>Todas as áreas</option>
        ${(typeof AREAS_LISTA!=='undefined'?AREAS_LISTA:[]).map(a=>`<option value="${a}" ${areaAtual===a?'selected':''}>${a}</option>`).join('')}
      </select>
      <select id="filtro-status" onchange="statusAtual=this.value;carregarMaquinas()" style="max-width:160px">
        <option value="ativa" ${statusAtual==='ativa'?'selected':''}>Ativas</option>
        <option value="arquivada" ${statusAtual==='arquivada'?'selected':''}>Arquivadas</option>
        <option value="" ${statusAtual===''?'selected':''}>Todas</option>
      </select>
    </div>

    <div id="maq-lista"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  carregarMaquinas();
}

async function carregarMaquinas() {
  const c = CATEGORIAS[categoriaAtual];
  const el = document.getElementById('maq-lista');
  el.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';

  try {
    const filtro = { ...c.filtro };
    if (statusAtual) filtro.status = statusAtual;
    const lista = await dbListarMaquinasComFoto(filtro);
    window._maquinasCache = lista;
    filtrarTabela();
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function filtrarTabela() {
  const termo = buscaAtual.toLowerCase();
  const lista = (window._maquinasCache || []).filter(m => {
    if (areaAtual && (m.area||'') !== areaAtual) return false;
    if (!termo) return true;
    return (m.tag||'').toLowerCase().includes(termo) ||
      (m.area||'').toLowerCase().includes(termo) ||
      (m.localizacao||'').toLowerCase().includes(termo) ||
      (m.fabricante||'').toLowerCase().includes(termo) ||
      (m.codigo_seq||'').toLowerCase().includes(termo);
  });
  renderTabelaMaquinas(lista);
}

function progressoEtapas(etapas) {
  if (!etapas || !etapas.length) return { done: 0, total: 7 };
  return { done: etapas.filter(e => e.status === 'concluida').length, total: etapas.length };
}

function urlFotoPrincipal(m) {
  const fotos = m.fotos || [];
  if (!fotos.length) return null;
  let f = null;
  if (m.foto_principal_id) f = fotos.find(x => x.id === m.foto_principal_id);
  if (!f) f = fotos[0];   // padrão: primeira foto
  return f ? dbUrlFoto(f.caminho_storage) : null;
}


function renderTabelaMaquinas(lista) {
  const el = document.getElementById('maq-lista');
  if (!el) return;

  if (!lista.length) {
    el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhuma máquina encontrada</p>
      <p class="empty-sub">Ajuste os filtros ou importe um ZIP de coleta</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="contagem">${lista.length} máquina${lista.length > 1 ? 's' : ''}</div>
    <div class="tabela-wrap">
      <table class="tabela">
        <thead><tr>
          <th>ID</th><th>TAG</th><th>Tipo</th><th>Área</th><th>Foto</th><th>Potência</th>
          <th>Estado</th><th>Etapas</th><th></th>
        </tr></thead>
        <tbody>
          ${lista.map(m => {
            const p = progressoEtapas(m.etapas);
            const pct = Math.round(p.done / p.total * 100);
            return `
            <tr class="linha-click ${m.status === 'arquivada' ? 'linha-arquivada' : ''}" onclick="abrirFicha('${m.id}')">
              <td class="td-mono td-codigo">${escHtml(m.codigo_seq || '—')}</td>
              <td class="td-mono">${escHtml(m.tag)}${m.ex ? ' <span class="ex-badge">EX</span>' : ''}</td>
              <td>${TIPOS_NOMES[m.tipo] || m.tipo}</td>
              <td>${escHtml(m.area)}${m.localizacao ? '<br><span class="td-sub">' + escHtml(m.localizacao) + '</span>' : ''}</td>
              <td class="td-foto">${(() => {
                const url = urlFotoPrincipal(m);
                return url
                  ? `<img src="${url}" class="thumb-maq" loading="lazy" alt="foto principal"
                       onclick="event.stopPropagation();abrirVisor('${url}')" />`
                  : '<span class="sem-foto">sem foto</span>';
              })()}</td>
              <td>${m.potencia ? m.potencia + ' ' + (m.unidade_pot || 'kW') : '—'}</td>
              <td><span class="badge-estado ${m.status_coleta}">${({ok:'OK',atencao:'Atenção',critico:'Crítico'})[m.status_coleta] || m.status_coleta}</span></td>
              <td>
                <div class="prog-wrap">
                  <div class="prog-bar"><div class="prog-fill ${pct === 100 ? 'completo' : ''}" style="width:${pct}%"></div></div>
                  <span class="prog-txt">${p.done}/${p.total}</span>
                </div>
              </td>
              <td class="td-seta">›</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  // Restaura posição de scroll ao voltar da ficha
  if (typeof _restaurarScroll !== 'undefined') _restaurarScroll('maquinas');
}
