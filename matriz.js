'use strict';
// ─── matriz.js — lançamento geral (etapas × máquinas) ──────────────────

let matrizCategoria = 'ex';
let matrizSelecao = {};   // { etapaId: { tag, etapaNome } }
let matrizDados = [];
let matrizData = '';   // data do lançamento (vazia até o usuário selecionar)
let matrizResp = '';
let _matrizPerfis = null;

function telaMatriz(cat) {
  if (cat) matrizCategoria = cat;
  matrizSelecao = {};
  matrizData = '';
  matrizResp = '';
  window._ajudaChave = 'matriz';

  setConteudo(`
    <div class="page-head">
      <h2>Lançamento Geral</h2>
      <p class="page-sub">Marque as etapas concluídas de várias máquinas de uma vez. Linhas = etapas · Colunas = máquinas</p>
    </div>

    <div class="cat-tabs">
      ${Object.entries(CATEGORIAS).map(([k, v]) => `
        <button class="cat-tab ${k === matrizCategoria ? 'ativo' : ''} ${v.ehEx ? 'tab-ex' : ''}"
          onclick="telaMatriz('${k}')">${v.titulo}</button>
      `).join('')}
    </div>

    <div id="matriz-area"><div class="loading"><div class="spinner"></div> Carregando matriz...</div></div>

    <div class="matriz-rodape" id="matriz-rodape" style="display:none">
      <span id="matriz-contagem"></span>
      <div class="matriz-data">
        <label for="matriz-data-input">Data do lançamento:</label>
        <input type="date" id="matriz-data-input" value=""
          onchange="matrizData=this.value" onfocus="if(!this.value)this.defaultValue=new Date().toISOString().slice(0,10)" />
      </div>
      <button class="btn" onclick="telaConfirmacao()">Revisar lançamentos ›</button>
    </div>
  `);
  carregarMatriz();
}

async function carregarMatriz() {
  const c = CATEGORIAS[matrizCategoria];
  const el = document.getElementById('matriz-area');
  try {
    if (!_matrizPerfis) { try { _matrizPerfis = await dbListarPerfis(); } catch { _matrizPerfis = []; } }
    matrizDados = await dbMaquinasComEtapas(c.filtro);
    if (!matrizDados.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhuma máquina ativa nesta categoria</p></div>`;
      return;
    }
    renderMatriz();
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

const ORDEM_ETAPAS = ['levantamento','compra_componentes','preparacao_recursos',
  'retirada','manutencao_planejada','instalacao_conferencia','conclusao'];

function renderMatriz() {
  const el = document.getElementById('matriz-area');

  el.innerHTML = `
    <div class="matriz-wrap">
      <table class="matriz">
        <thead>
          <tr>
            <th class="matriz-fixa">Etapa</th>
            ${matrizDados.map(m => `
              <th class="matriz-col-tag">
                <span class="matriz-tag" title="${escHtml(m.area)}">${escHtml(m.tag)}</span>
                ${m.ex ? '<span class="ex-badge">EX</span>' : ''}
              </th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${ORDEM_ETAPAS.map(cod => `
            <tr>
              <td class="matriz-fixa matriz-etapa-nome">${NOMES_ETAPAS[cod]}</td>
              ${matrizDados.map(m => {
                const e = (m.etapas || []).find(x => x.codigo === cod);
                if (!e) return '<td class="matriz-cel">—</td>';
                if (e.status === 'concluida') {
                  return `<td class="matriz-cel concluida" title="Concluída">✓</td>`;
                }
                const sel = matrizSelecao[e.id] ? 'selecionada' : '';
                return `<td class="matriz-cel clicavel ${e.status === 'em_andamento' ? 'andamento' : ''} ${sel}"
                  onclick="alternarCelula('${e.id}', '${escHtml(m.tag)}', '${cod}')"
                  id="cel-${e.id}">${matrizSelecao[e.id] ? '●' : ''}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="matriz-legenda">
      <span><span class="leg leg-conc">✓</span> Concluída</span>
      <span><span class="leg leg-and"></span> Em andamento</span>
      <span><span class="leg leg-sel">●</span> Selecionada para lançamento</span>
    </div>
  `;
  atualizarRodape();
}

function alternarCelula(etapaId, tag, codigo) {
  if (matrizSelecao[etapaId]) {
    delete matrizSelecao[etapaId];
  } else {
    matrizSelecao[etapaId] = { tag, etapaNome: NOMES_ETAPAS[codigo] };
  }
  const cel = document.getElementById('cel-' + etapaId);
  if (cel) {
    cel.classList.toggle('selecionada', !!matrizSelecao[etapaId]);
    cel.textContent = matrizSelecao[etapaId] ? '●' : '';
  }
  atualizarRodape();
}

function atualizarRodape() {
  const n = Object.keys(matrizSelecao).length;
  const rodape = document.getElementById('matriz-rodape');
  const contagem = document.getElementById('matriz-contagem');
  if (!rodape) return;
  rodape.style.display = n > 0 ? 'flex' : 'none';
  if (contagem) contagem.textContent = `${n} lançamento${n > 1 ? 's' : ''} selecionado${n > 1 ? 's' : ''}`;
}

// ─── Tela de confirmação ───────────────────────────────────────────────
function telaConfirmacao() {
  const itens = Object.entries(matrizSelecao);
  if (!itens.length) return;
  matrizData = document.getElementById('matriz-data-input')?.value || matrizData;
  if (!matrizData) {
    alert('Selecione a data do lançamento das atividades antes de prosseguir.');
    document.getElementById('matriz-data-input')?.focus();
    return;
  }
  window._ajudaChave = 'confirmacao';

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="voltarMatriz()">‹ Voltar à matriz</button>
      <div class="ficha-titulo"><span class="etapa-titulo-nome">Confirmar lançamentos</span></div>
    </div>

    <p class="page-sub" style="margin-bottom:16px">
      Revise os lançamentos abaixo. Ao confirmar, cada etapa será marcada como <strong>concluída</strong>
      com a data <strong>${new Date(matrizData + 'T12:00').toLocaleDateString('pt-BR')}</strong>.
    </p>

    <div class="field" style="max-width:360px;margin-bottom:16px">
      <label>Responsável (opcional — aplica a todos)</label>
      <select id="matriz-resp" onchange="matrizResp=this.value">
        <option value="">— não alterar —</option>
        ${(_matrizPerfis || []).map(p => `<option value="${escHtml(p.nome)}"${matrizResp===p.nome?' selected':''}>${escHtml(p.nome)} (${p.papel==='gestor'?'Gestor':'Técnico'})</option>`).join('')}
      </select>
    </div>

    <div class="conf-lista">
      ${itens.map(([id, item]) => `
        <div class="conf-item" id="conf-${id}">
          <span class="td-mono conf-tag">${escHtml(item.tag)}</span>
          <span class="conf-servico">${item.etapaNome}</span>
          <button class="btn-mini btn-mini-danger" onclick="removerDaConfirmacao('${id}')">Remover</button>
        </div>`).join('')}
    </div>

    <div class="conf-acoes">
      <button class="btn" id="btn-confirmar" onclick="confirmarLancamentos()">
        ✓ Confirmar ${itens.length} lançamento${itens.length > 1 ? 's' : ''}
      </button>
      <button class="btn btn-sec" onclick="voltarMatriz()">Cancelar</button>
    </div>
  `);
}

function voltarMatriz() {
  const selecaoBackup = { ...matrizSelecao };
  const dataBackup = matrizData;
  telaMatriz();
  matrizSelecao = selecaoBackup;
  matrizData = dataBackup;
  setTimeout(() => {
    const inp = document.getElementById('matriz-data-input');
    if (inp && dataBackup) inp.value = dataBackup;
    atualizarRodape();
    // Re-renderiza seleção visual
    Object.keys(matrizSelecao).forEach(id => {
      const cel = document.getElementById('cel-' + id);
      if (cel) { cel.classList.add('selecionada'); cel.textContent = '●'; }
    });
  }, 100);
}

function removerDaConfirmacao(id) {
  delete matrizSelecao[id];
  const el = document.getElementById('conf-' + id);
  if (el) el.remove();
  const n = Object.keys(matrizSelecao).length;
  if (n === 0) { voltarMatriz(); return; }
  const btn = document.getElementById('btn-confirmar');
  if (btn) btn.textContent = `✓ Confirmar ${n} lançamento${n > 1 ? 's' : ''}`;
}

async function confirmarLancamentos() {
  const ids = Object.keys(matrizSelecao);
  if (!ids.length) return;
  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true; btn.textContent = 'Lançando...';
  try {
    matrizResp = document.getElementById('matriz-resp')?.value || matrizResp;
    await dbConcluirEtapasLote(ids, matrizData, matrizResp);
    setConteudo(`
      <div class="result-card ok" style="margin-top:40px">
        <h3>✅ Lançamentos confirmados</h3>
        <p>${ids.length} etapa${ids.length > 1 ? 's' : ''} marcada${ids.length > 1 ? 's' : ''} como concluída${ids.length > 1 ? 's' : ''}.</p>
        <div class="result-actions">
          <button class="btn" onclick="matrizSelecao={};telaMatriz()">Voltar à matriz</button>
          <button class="btn btn-sec" onclick="navegar('maquinas')">Ver máquinas</button>
        </div>
      </div>
    `);
  } catch (e) {
    alert('Erro ao lançar: ' + e.message);
    btn.disabled = false;
    btn.textContent = `✓ Confirmar ${ids.length} lançamentos`;
  }
}
