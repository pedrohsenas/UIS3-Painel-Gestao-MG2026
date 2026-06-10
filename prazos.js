'use strict';
// ─── prazos.js — definição de prazos em massa ──────────────────────────

let prazosCategoria = 'ex';

function telaPrazos(cat) {
  if (cat) prazosCategoria = cat;
  window._ajudaChave = 'prazos';

  setConteudo(`
    <div class="page-head">
      <h2>Prazos em Massa</h2>
      <p class="page-sub">Defina o prazo de cada etapa para todas as máquinas de uma categoria de uma vez — base do planejado da curva S</p>
    </div>

    <div class="cat-tabs">
      ${Object.entries(CATEGORIAS).map(([k, v]) => `
        <button class="cat-tab ${k === prazosCategoria ? 'ativo' : ''} ${k === 'ex' ? 'tab-ex' : ''}"
          onclick="telaPrazos('${k}')">${v.titulo}</button>
      `).join('')}
    </div>

    <div id="prazos-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  carregarPrazos();
}

async function carregarPrazos() {
  const c = CATEGORIAS[prazosCategoria];
  const el = document.getElementById('prazos-area');
  try {
    const maquinas = await dbMaquinasComEtapas(c.filtro);
    if (!maquinas.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhuma máquina ativa nesta categoria</p></div>`;
      return;
    }
    window._prazosMaquinas = maquinas;

    // Estatística de prazos existentes por etapa
    const stats = {};
    ORDEM_ETAPAS.forEach(cod => stats[cod] = { com: 0, sem: 0 });
    maquinas.forEach(m => (m.etapas || []).forEach(e => {
      if (stats[e.codigo]) (e.prazo ? stats[e.codigo].com++ : stats[e.codigo].sem++);
    }));

    el.innerHTML = `
      <p class="page-sub" style="margin-bottom:12px"><strong>${maquinas.length}</strong> máquinas nesta categoria serão afetadas</p>

      <div class="prazos-tabela tabela-wrap">
        <table class="tabela">
          <thead><tr>
            <th>Etapa</th><th>Com prazo</th><th>Sem prazo</th><th>Novo prazo</th><th>Modo</th><th></th>
          </tr></thead>
          <tbody>
            ${ORDEM_ETAPAS.map(cod => `
              <tr>
                <td style="font-weight:600">${NOMES_ETAPAS[cod]}</td>
                <td class="td-center">${stats[cod].com}</td>
                <td class="td-center" style="color:${stats[cod].sem > 0 ? 'var(--warn)' : 'var(--tx2)'}">${stats[cod].sem}</td>
                <td><input type="date" id="prazo-${cod}" style="max-width:170px" /></td>
                <td>
                  <select id="modo-${cod}" style="max-width:200px">
                    <option value="vazios">Só preencher vazios</option>
                    <option value="todos">Sobrescrever todos</option>
                  </select>
                </td>
                <td><button class="btn-mini" onclick="aplicarPrazo('${cod}')">Aplicar</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="card-sec" style="margin-top:16px;max-width:640px">
        <h3 class="card-sec-titulo">Aplicar todos de uma vez</h3>
        <p class="page-sub" style="margin-bottom:12px">Preencha as datas acima e aplique todas as etapas com um clique</p>
        <button class="btn" id="btn-aplicar-todos" onclick="aplicarTodosPrazos()">Aplicar todas as etapas preenchidas</button>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

async function aplicarPrazo(codigo) {
  const prazo = document.getElementById('prazo-' + codigo).value;
  if (!prazo) { alert('Informe a data do prazo'); return; }
  const modo = document.getElementById('modo-' + codigo).value;
  const ids = (window._prazosMaquinas || []).map(m => m.id);
  if (!ids.length) return;
  if (modo === 'todos' && !confirm(`Sobrescrever o prazo de "${NOMES_ETAPAS[codigo]}" em TODAS as ${ids.length} máquinas?`)) return;
  try {
    await dbDefinirPrazosLote(ids, codigo, prazo, modo === 'vazios');
    carregarPrazos();
  } catch (e) { alert('Erro: ' + e.message); }
}

async function aplicarTodosPrazos() {
  const ids = (window._prazosMaquinas || []).map(m => m.id);
  if (!ids.length) return;
  const btn = document.getElementById('btn-aplicar-todos');
  btn.disabled = true; btn.textContent = 'Aplicando...';
  let aplicados = 0;
  try {
    for (const cod of ORDEM_ETAPAS) {
      const prazo = document.getElementById('prazo-' + cod)?.value;
      if (!prazo) continue;
      const modo = document.getElementById('modo-' + cod).value;
      await dbDefinirPrazosLote(ids, cod, prazo, modo === 'vazios');
      aplicados++;
    }
    if (!aplicados) alert('Nenhuma data preenchida');
    carregarPrazos();
  } catch (e) {
    alert('Erro: ' + e.message);
    btn.disabled = false; btn.textContent = 'Aplicar todas as etapas preenchidas';
  }
}
