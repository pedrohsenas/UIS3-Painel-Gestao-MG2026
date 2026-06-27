'use strict';
// ─── vi_prazos.js — prazos em massa e serviços planejados em massa (V&I) ──

let viPrazosDominio = 'instrumento';

function viTelaPrazos(dom) {
  if (dom) viPrazosDominio = dom;
  window._ajudaChave = 'vi_prazos';
  setConteudo(`
    <div class="page-head">
      <h2>Prazos em Massa — V&I</h2>
      <p class="page-sub">Defina o prazo de cada etapa para todos os equipamentos de uma categoria — base do planejado da curva S</p>
    </div>
    <div class="cat-tabs">
      ${Object.entries(VI_CATEGORIAS).map(([k, v]) => `
        <button class="cat-tab ${k === viPrazosDominio ? 'ativo' : ''}"
          onclick="viTelaPrazos('${k}')">${v.titulo}</button>`).join('')}
    </div>
    <div id="vi-prazos-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  viCarregarPrazos();
}

async function viCarregarPrazos() {
  const el = document.getElementById('vi-prazos-area');
  try {
    const eqs = await viEquipamentosComEtapas({ dominio: viPrazosDominio });
    if (!eqs.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhum equipamento ativo nesta categoria</p></div>`;
      return;
    }
    window._viPrazosEqs = eqs;
    const stats = {};
    VI_ETAPAS_ORDEM.forEach(cod => stats[cod] = { com: 0, sem: 0 });
    eqs.forEach(m => (m.vi_etapas || []).forEach(e => {
      if (stats[e.codigo]) (e.prazo ? stats[e.codigo].com++ : stats[e.codigo].sem++);
    }));

    el.innerHTML = `
      <p class="page-sub" style="margin-bottom:12px"><strong>${eqs.length}</strong> equipamentos serão afetados</p>
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr><th>Etapa</th><th>Com prazo</th><th>Sem prazo</th><th>Novo prazo</th><th>Modo</th><th></th></tr></thead>
          <tbody>
            ${VI_ETAPAS_ORDEM.map(cod => `
              <tr>
                <td style="font-weight:600">${VI_ETAPAS_NOMES[cod]}</td>
                <td class="td-center">${stats[cod].com}</td>
                <td class="td-center" style="color:${stats[cod].sem > 0 ? 'var(--warn)' : 'var(--tx2)'}">${stats[cod].sem}</td>
                <td><input type="date" id="vi-prazo-${cod}" style="max-width:170px" /></td>
                <td><select id="vi-modo-${cod}" style="max-width:200px">
                  <option value="vazios">Só preencher vazios</option>
                  <option value="todos">Sobrescrever todos</option>
                </select></td>
                <td><button class="btn-mini" onclick="viAplicarPrazo('${cod}')">Aplicar</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="card-sec" style="margin-top:16px;max-width:640px">
        <h3 class="card-sec-titulo">Aplicar todos de uma vez</h3>
        <button class="btn" id="vi-btn-prazos-todos" onclick="viAplicarTodosPrazos()">Aplicar todas as etapas preenchidas</button>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

async function viAplicarPrazo(codigo) {
  const prazo = document.getElementById('vi-prazo-' + codigo).value;
  if (!prazo) { alert('Informe a data do prazo'); return; }
  const modo = document.getElementById('vi-modo-' + codigo).value;
  const ids = (window._viPrazosEqs || []).map(m => m.id);
  if (!ids.length) return;
  if (modo === 'todos' && !confirm(`Sobrescrever o prazo de "${VI_ETAPAS_NOMES[codigo]}" em TODOS os ${ids.length} equipamentos?`)) return;
  try { await viDefinirPrazosLote(ids, codigo, prazo, modo === 'vazios'); viCarregarPrazos(); }
  catch (e) { alert('Erro: ' + e.message); }
}

async function viAplicarTodosPrazos() {
  const ids = (window._viPrazosEqs || []).map(m => m.id);
  if (!ids.length) return;
  const btn = document.getElementById('vi-btn-prazos-todos');
  btn.disabled = true; btn.textContent = 'Aplicando...';
  let aplicados = 0;
  try {
    for (const cod of VI_ETAPAS_ORDEM) {
      const prazo = document.getElementById('vi-prazo-' + cod)?.value;
      if (!prazo) continue;
      const modo = document.getElementById('vi-modo-' + cod).value;
      await viDefinirPrazosLote(ids, cod, prazo, modo === 'vazios');
      aplicados++;
    }
    if (!aplicados) alert('Nenhuma data preenchida');
    viCarregarPrazos();
  } catch (e) { alert('Erro: ' + e.message); btn.disabled = false; btn.textContent = 'Aplicar todas as etapas preenchidas'; }
}

// ─── Serviços em massa V&I ─────────────────────────────────────────────
let viServDominio = 'instrumento';

function viTelaServicos(dom) {
  if (dom) viServDominio = dom;
  window._ajudaChave = 'vi_servicos';
  setConteudo(`
    <div class="page-head">
      <h2>Serviços Planejados — V&I</h2>
      <p class="page-sub">Defina em massa os serviços a executar por categoria. Ajustes individuais na ficha de cada equipamento.</p>
    </div>
    <div class="cat-tabs">
      ${Object.entries(VI_CATEGORIAS).map(([k, v]) => `
        <button class="cat-tab ${k === viServDominio ? 'ativo' : ''}"
          onclick="viTelaServicos('${k}')">${v.titulo}</button>`).join('')}
    </div>
    <div id="vi-serv-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  viCarregarServicos();
}

async function viCarregarServicos() {
  const el = document.getElementById('vi-serv-area');
  try {
    const eqs = await viEquipamentosComEtapas({ dominio: viServDominio });
    if (!eqs.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhum equipamento ativo nesta categoria</p></div>`;
      return;
    }
    window._viServEqs = eqs;
    const lista = viServicosDe(viServDominio);
    el.innerHTML = `
      <p class="page-sub" style="margin-bottom:12px"><strong>${eqs.length}</strong> equipamentos serão afetados</p>
      <div class="card-sec" style="max-width:760px">
        <h3 class="card-sec-titulo">Selecione os serviços</h3>
        <div class="srv-grid">
          ${lista.map((s, i) => `
            <label class="srv-item">
              <input type="checkbox" id="vi-srv-massa-${i}" />
              <span class="srv-check"></span><span class="srv-nome">${s}</span>
            </label>`).join('')}
        </div>
        <div class="conf-acoes">
          <button class="btn" id="vi-btn-serv" onclick="viAplicarServicosMassa('adicionar')">Adicionar aos ${eqs.length} equipamentos</button>
          <button class="btn btn-sec" onclick="viAplicarServicosMassa('remover')">Remover dos ${eqs.length}</button>
        </div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

async function viAplicarServicosMassa(modo) {
  const lista = viServicosDe(viServDominio);
  const selecionados = lista.filter((s, i) => document.getElementById('vi-srv-massa-' + i)?.checked);
  if (!selecionados.length) { alert('Selecione ao menos um serviço'); return; }
  const ids = (window._viServEqs || []).map(m => m.id);
  const verbo = modo === 'adicionar' ? 'Adicionar' : 'Remover';
  if (!confirm(`${verbo} ${selecionados.length} serviço(s) ${modo === 'adicionar' ? 'a' : 'de'} ${ids.length} equipamentos?\n\n• ${selecionados.join('\n• ')}`)) return;
  const btn = document.getElementById('vi-btn-serv');
  btn.disabled = true; btn.textContent = 'Aplicando...';
  try {
    if (modo === 'adicionar') await viPlanejarServicosLote(ids, selecionados);
    else await viRemoverServicosLote(ids, selecionados);
    alert(`✓ Concluído.`);
    viCarregarServicos();
  } catch (e) { alert('Erro: ' + e.message); btn.disabled = false; }
}
