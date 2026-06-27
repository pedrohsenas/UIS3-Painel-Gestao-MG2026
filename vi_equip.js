'use strict';
// ─── vi_equip.js — telas de consulta de Válvulas & Instrumentos ────────

const VI_CATEGORIAS = {
  instrumento: { titulo: 'Instrumentos', sub: 'Transmissores, sensores, manômetros, pressostatos e demais', dominio: 'instrumento' },
  valvula:     { titulo: 'Válvulas',     sub: 'Válvulas de processo e utilidades', dominio: 'valvula' }
};

let viCategoriaAtual = 'instrumento';
let viBusca = '';
let viStatus = 'ativa';

function viTelaEquip(cat) {
  if (cat) viCategoriaAtual = cat;
  window._ajudaChave = 'vi_equip';
  const c = VI_CATEGORIAS[viCategoriaAtual];

  setConteudo(`
    <div class="page-head"><h2>Instrumentos & Válvulas</h2></div>

    <div class="cat-tabs">
      ${Object.entries(VI_CATEGORIAS).map(([k, v]) => `
        <button class="cat-tab ${k === viCategoriaAtual ? 'ativo' : ''}"
          onclick="viTelaEquip('${k}')">${v.titulo}</button>`).join('')}
    </div>

    <p class="page-sub" style="margin-bottom:14px">${c.sub}</p>

    <div class="filtros-bar">
      <input type="text" id="vi-filtro-busca" placeholder="Buscar por TAG, área ou fabricante..."
        value="${escHtml(viBusca)}" oninput="viBusca=this.value;viFiltrarTabela()" style="max-width:320px" />
      <select id="vi-filtro-status" onchange="viStatus=this.value;viCarregarEquip()" style="max-width:160px">
        <option value="ativa" ${viStatus==='ativa'?'selected':''}>Ativos</option>
        <option value="arquivada" ${viStatus==='arquivada'?'selected':''}>Arquivados</option>
        <option value="" ${viStatus===''?'selected':''}>Todos</option>
      </select>
    </div>

    <div id="vi-lista"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  viCarregarEquip();
}

async function viCarregarEquip() {
  const c = VI_CATEGORIAS[viCategoriaAtual];
  const el = document.getElementById('vi-lista');
  el.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  try {
    const filtro = { dominio: c.dominio };
    if (viStatus) filtro.status = viStatus;
    const lista = await viListarEquipamentos(filtro);
    window._viCache = lista;
    viRenderTabela(lista);
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function viFiltrarTabela() {
  const t = viBusca.toLowerCase();
  const lista = (window._viCache || []).filter(m =>
    !t || (m.tag||'').toLowerCase().includes(t) || (m.area||'').toLowerCase().includes(t) ||
    (m.localizacao||'').toLowerCase().includes(t) || (m.fabricante||'').toLowerCase().includes(t));
  viRenderTabela(lista);
}

function viProgresso(etapas) {
  if (!etapas || !etapas.length) return { done: 0, total: 6 };
  return { done: etapas.filter(e => e.status === 'concluida').length, total: etapas.length };
}

function viUrlFotoPrincipal(m) {
  const fotos = m.vi_fotos || [];
  if (!fotos.length) return null;
  let f = null;
  if (m.foto_principal_id) f = fotos.find(x => x.id === m.foto_principal_id);
  if (!f) f = fotos[0];
  return f ? dbUrlFoto(f.caminho_storage) : null;
}

function viRenderTabela(lista) {
  const el = document.getElementById('vi-lista');
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhum equipamento encontrado</p>
      <p class="empty-sub">Ajuste os filtros ou importe um ZIP de V&I</p></div>`;
    return;
  }
  const ehInst = viCategoriaAtual === 'instrumento';
  el.innerHTML = `
    <div class="contagem">${lista.length} ${ehInst ? 'instrumento' : 'válvula'}${lista.length>1?'s':''}</div>
    <div class="tabela-wrap">
      <table class="tabela">
        <thead><tr>
          <th>TAG</th><th>Tipo</th><th>Área</th><th>Foto</th>
          ${ehInst ? '<th>Criticidade</th>' : '<th>DN</th><th>Condição</th>'}
          <th>Etapas</th><th></th>
        </tr></thead>
        <tbody>
          ${lista.map(m => {
            const p = viProgresso(m.vi_etapas);
            const pct = Math.round(p.done / p.total * 100);
            const url = viUrlFotoPrincipal(m);
            return `
            <tr class="linha-click ${m.status==='arquivada'?'linha-arquivada':''}" onclick="viAbrirFicha('${m.id}')">
              <td class="td-mono">${escHtml(m.tag)}${m.ex ? ' <span class="ex-badge">EX</span>' : ''}</td>
              <td>${escHtml(m.tipo) || '—'}</td>
              <td>${escHtml(m.area)}${m.localizacao ? '<br><span class="td-sub">'+escHtml(m.localizacao)+'</span>' : ''}</td>
              <td class="td-foto">${url
                ? `<img src="${url}" class="thumb-maq" loading="lazy" alt="foto" onclick="event.stopPropagation();abrirVisor('${url}')" />`
                : '<span class="sem-foto">sem foto</span>'}</td>
              ${ehInst
                ? `<td>${m.criticidade ? `<span class="badge crit-${(m.criticidade[0]||'').toLowerCase()}">${escHtml(m.criticidade[0])}</span>` : '—'}</td>`
                : `<td>${escHtml(m.dn) || '—'}</td><td><span class="badge-estado ${m.condicao}">${({ok:'OK',atencao:'Atenção',critico:'Crítico'})[m.condicao]||m.condicao}</span></td>`}
              <td>
                <div class="prog-wrap">
                  <div class="prog-bar"><div class="prog-fill ${pct===100?'completo':''}" style="width:${pct}%"></div></div>
                  <span class="prog-txt">${p.done}/${p.total}</span>
                </div>
              </td>
              <td class="td-seta">›</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}
