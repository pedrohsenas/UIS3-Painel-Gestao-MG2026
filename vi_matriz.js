'use strict';
// ─── vi_matriz.js — lançamento geral de etapas V&I (matriz) ────────────

let viMatrizCategoria = 'instrumento';
let viMatrizSelecao = {};
let viMatrizData = '';
let viMatrizDados = [];

function viTelaMatriz(cat) {
  if (cat) viMatrizCategoria = cat;
  viMatrizSelecao = {};
  viMatrizData = '';
  window._ajudaChave = 'vi_matriz';

  setConteudo(`
    <div class="page-head">
      <h2>Lançamento Geral — V&I</h2>
      <p class="page-sub">Marque etapas concluídas de vários equipamentos. Linhas = etapas · Colunas = equipamentos</p>
    </div>
    <div class="cat-tabs">
      ${Object.entries(VI_CATEGORIAS).map(([k, v]) => `
        <button class="cat-tab ${k === viMatrizCategoria ? 'ativo' : ''}"
          onclick="viTelaMatriz('${k}')">${v.titulo}</button>`).join('')}
    </div>
    <div id="vi-matriz-area"><div class="loading"><div class="spinner"></div> Carregando matriz...</div></div>
    <div class="matriz-rodape" id="vi-matriz-rodape" style="display:none">
      <span id="vi-matriz-contagem"></span>
      <div class="matriz-data">
        <label for="vi-matriz-data-input">Data do lançamento:</label>
        <input type="date" id="vi-matriz-data-input" value=""
          onchange="viMatrizData=this.value" onfocus="if(!this.value)this.defaultValue=new Date().toISOString().slice(0,10)" />
      </div>
      <button class="btn" onclick="viTelaConfirmacao()">Revisar lançamentos ›</button>
    </div>
  `);
  viCarregarMatriz();
}

async function viCarregarMatriz() {
  const el = document.getElementById('vi-matriz-area');
  try {
    viMatrizDados = await viEquipamentosComEtapas({ dominio: viMatrizCategoria });
    if (!viMatrizDados.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhum equipamento ativo nesta categoria</p></div>`;
      return;
    }
    viRenderMatriz();
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function viRenderMatriz() {
  const el = document.getElementById('vi-matriz-area');
  el.innerHTML = `
    <div class="matriz-wrap">
      <table class="matriz">
        <thead>
          <tr>
            <th class="matriz-fixa">Etapa</th>
            ${viMatrizDados.map(m => `<th class="matriz-col-tag"><span class="matriz-tag" title="${escHtml(m.area)}">${escHtml(m.tag)}</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${VI_ETAPAS_ORDEM.map(cod => `
            <tr>
              <td class="matriz-fixa matriz-etapa-nome">${VI_ETAPAS_NOMES[cod]}</td>
              ${viMatrizDados.map(m => {
                const e = (m.vi_etapas || []).find(x => x.codigo === cod);
                if (!e) return '<td class="matriz-cel">—</td>';
                if (e.status === 'concluida') return `<td class="matriz-cel concluida" title="Concluída">✓</td>`;
                const sel = viMatrizSelecao[e.id] ? 'selecionada' : '';
                return `<td class="matriz-cel clicavel ${e.status === 'em_andamento' ? 'andamento' : ''} ${sel}"
                  onclick="viAlternarCelula('${e.id}', '${escHtml(m.tag)}', '${cod}')"
                  id="vi-cel-${e.id}">${viMatrizSelecao[e.id] ? '●' : ''}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="matriz-legenda">
      <span><span class="leg leg-conc">✓</span> Concluída</span>
      <span><span class="leg leg-and"></span> Em andamento</span>
      <span><span class="leg leg-sel">●</span> Selecionada</span>
    </div>
  `;
  viAtualizarRodape();
}

function viAlternarCelula(etapaId, tag, codigo) {
  if (viMatrizSelecao[etapaId]) delete viMatrizSelecao[etapaId];
  else viMatrizSelecao[etapaId] = { tag, etapaNome: VI_ETAPAS_NOMES[codigo] };
  const cel = document.getElementById('vi-cel-' + etapaId);
  if (cel) {
    cel.classList.toggle('selecionada', !!viMatrizSelecao[etapaId]);
    cel.textContent = viMatrizSelecao[etapaId] ? '●' : '';
  }
  viAtualizarRodape();
}

function viAtualizarRodape() {
  const n = Object.keys(viMatrizSelecao).length;
  const rodape = document.getElementById('vi-matriz-rodape');
  const cont = document.getElementById('vi-matriz-contagem');
  if (!rodape) return;
  rodape.style.display = n > 0 ? 'flex' : 'none';
  if (cont) cont.textContent = `${n} lançamento${n > 1 ? 's' : ''} selecionado${n > 1 ? 's' : ''}`;
}

function viTelaConfirmacao() {
  const itens = Object.entries(viMatrizSelecao);
  if (!itens.length) return;
  viMatrizData = document.getElementById('vi-matriz-data-input')?.value || viMatrizData;
  if (!viMatrizData) {
    alert('Selecione a data do lançamento antes de prosseguir.');
    document.getElementById('vi-matriz-data-input')?.focus();
    return;
  }
  window._ajudaChave = 'vi_confirmacao';

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="viVoltarMatriz()">‹ Voltar à matriz</button>
      <div class="ficha-titulo"><span class="etapa-titulo-nome">Confirmar lançamentos</span></div>
    </div>
    <p class="page-sub" style="margin-bottom:16px">
      Ao confirmar, cada etapa será marcada como <strong>concluída</strong> com a data
      <strong>${new Date(viMatrizData + 'T12:00').toLocaleDateString('pt-BR')}</strong>.
    </p>
    <div class="conf-lista">
      ${itens.map(([id, item]) => `
        <div class="conf-item" id="vi-conf-${id}">
          <span class="td-mono conf-tag">${escHtml(item.tag)}</span>
          <span class="conf-servico">${item.etapaNome}</span>
          <button class="btn-mini btn-mini-danger" onclick="viRemoverDaConfirmacao('${id}')">Remover</button>
        </div>`).join('')}
    </div>
    <div class="conf-acoes">
      <button class="btn" id="vi-btn-confirmar" onclick="viConfirmarLancamentos()">✓ Confirmar ${itens.length} lançamento${itens.length > 1 ? 's' : ''}</button>
      <button class="btn btn-sec" onclick="viVoltarMatriz()">Cancelar</button>
    </div>
  `);
}

function viVoltarMatriz() {
  const sel = { ...viMatrizSelecao };
  const data = viMatrizData;
  viTelaMatriz();
  viMatrizSelecao = sel;
  viMatrizData = data;
  setTimeout(() => {
    const inp = document.getElementById('vi-matriz-data-input');
    if (inp && data) inp.value = data;
    viAtualizarRodape();
    Object.keys(viMatrizSelecao).forEach(id => {
      const cel = document.getElementById('vi-cel-' + id);
      if (cel) { cel.classList.add('selecionada'); cel.textContent = '●'; }
    });
  }, 100);
}

function viRemoverDaConfirmacao(id) {
  delete viMatrizSelecao[id];
  document.getElementById('vi-conf-' + id)?.remove();
  const n = Object.keys(viMatrizSelecao).length;
  if (n === 0) { viVoltarMatriz(); return; }
  const btn = document.getElementById('vi-btn-confirmar');
  if (btn) btn.textContent = `✓ Confirmar ${n} lançamento${n > 1 ? 's' : ''}`;
}

async function viConfirmarLancamentos() {
  const ids = Object.keys(viMatrizSelecao);
  if (!ids.length) return;
  const btn = document.getElementById('vi-btn-confirmar');
  btn.disabled = true; btn.textContent = 'Lançando...';
  try {
    await viConcluirEtapasLote(ids, viMatrizData);
    setConteudo(`
      <div class="result-card ok" style="margin-top:40px">
        <h3>✅ Lançamentos confirmados</h3>
        <p>${ids.length} etapa${ids.length > 1 ? 's' : ''} marcada${ids.length > 1 ? 's' : ''} como concluída${ids.length > 1 ? 's' : ''}.</p>
        <div class="result-actions">
          <button class="btn" onclick="viMatrizSelecao={};viTelaMatriz()">Voltar à matriz</button>
          <button class="btn btn-sec" onclick="viNavegar('vi_equip')">Ver equipamentos</button>
        </div>
      </div>`);
  } catch (e) {
    alert('Erro ao lançar: ' + e.message);
    btn.disabled = false; btn.textContent = `✓ Confirmar ${ids.length} lançamentos`;
  }
}
