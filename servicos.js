'use strict';
// ─── servicos.js — lançamento em massa de serviços planejados (PCM) ────

let servCategoria = 'ex';

function telaServicos(cat) {
  if (cat) servCategoria = cat;
  window._ajudaChave = 'servicos';

  setConteudo(`
    <div class="page-head">
      <h2>Serviços Planejados</h2>
      <p class="page-sub">Defina em massa quais serviços deverão ser executados por categoria de máquina. Ajustes individuais podem ser feitos na ficha de cada máquina.</p>
    </div>

    <div class="cat-tabs">
      ${Object.entries(CATEGORIAS).map(([k, v]) => `
        <button class="cat-tab ${k === servCategoria ? 'ativo' : ''} ${k === 'ex' ? 'tab-ex' : ''}"
          onclick="telaServicos('${k}')">${v.titulo}</button>
      `).join('')}
    </div>

    <div id="serv-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  carregarServicos();
}

async function carregarServicos() {
  const c = CATEGORIAS[servCategoria];
  const el = document.getElementById('serv-area');
  try {
    const maquinas = await dbMaquinasComEtapas(c.filtro);
    if (!maquinas.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhuma máquina ativa nesta categoria</p></div>`;
      return;
    }
    window._servMaquinas = maquinas;

    el.innerHTML = `
      <p class="page-sub" style="margin-bottom:12px"><strong>${maquinas.length}</strong> máquinas nesta categoria serão afetadas</p>

      <div class="card-sec" style="max-width:760px">
        <h3 class="card-sec-titulo">Selecione os serviços</h3>
        <div class="srv-grid">
          ${SERVICOS_CHECKLIST.map((s, i) => `
            <label class="srv-item">
              <input type="checkbox" id="srv-massa-${i}" />
              <span class="srv-check"></span>
              <span class="srv-nome">${s}</span>
            </label>`).join('')}
        </div>
        <div class="conf-acoes">
          <button class="btn" id="btn-serv-aplicar" onclick="aplicarServicosMassa('adicionar')">Adicionar às ${maquinas.length} máquinas</button>
          <button class="btn btn-sec" onclick="aplicarServicosMassa('remover')">Remover das ${maquinas.length} máquinas</button>
        </div>
        <p class="page-sub" style="margin-top:10px">Adicionar não duplica serviços já planejados. Remover exclui o planejamento dos serviços selecionados em todas as máquinas da categoria.</p>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

async function aplicarServicosMassa(modo) {
  const selecionados = SERVICOS_CHECKLIST.filter((s, i) =>
    document.getElementById('srv-massa-' + i)?.checked);
  if (!selecionados.length) { alert('Selecione ao menos um serviço'); return; }

  const ids = (window._servMaquinas || []).map(m => m.id);
  const verbo = modo === 'adicionar' ? 'Adicionar' : 'Remover';
  if (!confirm(`${verbo} ${selecionados.length} serviço(s) ${modo === 'adicionar' ? 'a' : 'de'} ${ids.length} máquinas?\n\n• ${selecionados.join('\n• ')}`)) return;

  const btn = document.getElementById('btn-serv-aplicar');
  btn.disabled = true; btn.textContent = 'Aplicando...';
  try {
    if (modo === 'adicionar') await dbPlanejarServicosLote(ids, selecionados);
    else await dbRemoverServicosLote(ids, selecionados);
    alert(`✓ Concluído: ${selecionados.length} serviço(s) ${modo === 'adicionar' ? 'planejados para' : 'removidos de'} ${ids.length} máquinas.`);
    carregarServicos();
  } catch (e) {
    alert('Erro: ' + e.message);
    btn.disabled = false;
  }
}
