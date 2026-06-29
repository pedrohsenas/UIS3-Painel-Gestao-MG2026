// ─── projetos.js — lista de projetos + cadastro ───────────────────────

var _prjPerfis = null;
async function _prjCarregarPerfis() {
  if (!_prjPerfis) _prjPerfis = await dbListarPerfis();
  return _prjPerfis;
}

// ══════════════════════════════════════════════════════════════════════
// TELA LISTA
// ══════════════════════════════════════════════════════════════════════
async function telaProjetos() {
  window._ajudaChave = 'projetos';
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando projetos...</div>');
  try {
    const [projetos] = await Promise.all([prjListar(), _prjCarregarPerfis()]);
    renderListaProjetos(projetos);
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}


// ── Pizza de progresso (SVG inline, gradiente) ──
function _pizzaSvg(pct, cor, corFundo) {
  const r = 16, cx = 18, cy = 18, circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  const gap  = circ - dash;
  return `<svg width="36" height="36" viewBox="0 0 36 36" style="transform:rotate(-90deg)">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${corFundo}" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cor}" stroke-width="4"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-linecap="round"/>
  </svg>`;
}

function renderListaProjetos(projetos) {
  const gestor = PERFIL?.papel === 'gestor';

  // KPIs rápidos
  const total = projetos.length;
  const concluidos  = projetos.filter(p => p.status === 'concluido').length;
  const emAndamento = projetos.filter(p => p.status === 'em_andamento').length;
  const atrasados   = projetos.filter(p => {
    if (p.status === 'concluido' || p.status === 'cancelado') return false;
    return p.prazo_final && new Date(p.prazo_final + 'T23:59:59') < new Date();
  }).length;

  setConteudo(`
    <div class="page-head" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div>
        <h2>Projetos MG</h2>
        <p class="page-sub">Atividades e melhorias sem vínculo com máquinas específicas</p>
      </div>
      ${gestor ? `<button class="btn" onclick="abrirModalNovoProjeto()">+ Novo projeto</button>` : ''}
    </div>

    <div class="prj-kpis">
      <div class="prj-kpi"><span class="prj-kpi-n">${total}</span><span class="prj-kpi-l">Total</span></div>
      <div class="prj-kpi prj-kpi-and"><span class="prj-kpi-n">${emAndamento}</span><span class="prj-kpi-l">Em andamento</span></div>
      <div class="prj-kpi prj-kpi-ok"><span class="prj-kpi-n">${concluidos}</span><span class="prj-kpi-l">Concluídos</span></div>
      <div class="prj-kpi prj-kpi-crit"><span class="prj-kpi-n">${atrasados}</span><span class="prj-kpi-l">Atrasados</span></div>
    </div>

    ${projetos.length === 0 ? `
      <div class="empty-state">
        <p class="empty-title">Nenhum projeto cadastrado</p>
        ${gestor ? `<p class="empty-sub">Clique em "Novo projeto" para começar.</p>` : ''}
      </div>` : `
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr>
            <th>Título</th>
            <th>Setor</th>
            <th>Prazo</th>
            <th style="text-align:center">Planej.</th>
            <th style="text-align:center">Exec.</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${projetos.map(p => {
              const pctPlan = prjCalcProgresso(p.projeto_etapas || []);
              const pctExec = prjExecCalcProgresso(p.projeto_exec_etapas || []);
              const atras = p.status !== 'concluido' && p.status !== 'cancelado' &&
                            p.prazo_final && new Date(p.prazo_final + 'T23:59:59') < new Date();
              return `<tr class="${atras ? 'ac-l-atras' : ''}">
                <td><strong style="cursor:pointer;color:var(--accent)" onclick="abrirFichaProjeto('${p.id}')">${escHtml(p.titulo)}</strong></td>
                <td>${escHtml(p.setor || '—')}</td>
                <td class="td-mono">${p.prazo_final ? new Date(p.prazo_final + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td style="text-align:center">
                  <div style="display:inline-flex;flex-direction:column;align-items:center;gap:1px">
                    ${_pizzaSvg(pctPlan,'var(--accent)','var(--bg2)')}
                    <span style="font-family:var(--mono);font-size:10px;color:var(--accent)">${pctPlan.toFixed(0)}%</span>
                  </div>
                </td>
                <td style="text-align:center">
                  <div style="display:inline-flex;flex-direction:column;align-items:center;gap:1px">
                    ${_pizzaSvg(pctExec,'#16a34a','var(--bg2)')}
                    <span style="font-family:var(--mono);font-size:10px;color:#16a34a">${pctExec.toFixed(0)}%</span>
                  </div>
                </td>
                <td>${_prjBadgeStatus(p.status)}</td>
                <td>${_prjBadgePrio(p.prioridade)}</td>
                <td><div class="td-acoes">
                  <button class="btn-mini" onclick="abrirFichaProjeto('${p.id}')">Abrir</button>
                  ${gestor ? `<button class="btn-mini btn-mini-danger" onclick="prjAcaoExcluir('${p.id}','${escHtml(p.titulo)}')">Excluir</button>` : ''}
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}

    <div id="prj-modal-root"></div>
  `);
  // Restaura posição de scroll ao voltar da ficha
  if (typeof _restaurarScroll !== 'undefined') _restaurarScroll('projetos');
}

function _prjBadgeStatus(s) {
  const MAP = {
    pendente:     ['badge-status arquivada', 'Pendente'],
    em_andamento: ['ac-cont ac-c-and', 'Em andamento'],
    concluido:    ['ac-cont ac-c-conc', 'Concluído'],
    cancelado:    ['badge-status arquivada', 'Cancelado'],
  };
  const [cls, txt] = MAP[s] || ['badge-status', s];
  return `<span class="${cls}">${txt}</span>`;
}

function _prjBadgePrio(p) {
  const MAP = {
    alta:  ['badge crit-a', 'Alta'],
    media: ['badge crit-b', 'Média'],
    baixa: ['badge crit-c', 'Baixa'],
  };
  const [cls, txt] = (MAP[p] || ['badge-status arquivada', p || '—']);
  return `<span class="${cls}">${txt}</span>`;
}

async function prjAcaoExcluir(id, titulo) {
  if (!confirm(`Excluir projeto "${titulo}"? Todas as etapas, checklist, comentários e fotos serão removidos.`)) return;
  try {
    await prjExcluir(id);
    telaProjetos();
  } catch (e) {
    alert('Erro ao excluir: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════
// MODAL NOVO PROJETO
// ══════════════════════════════════════════════════════════════════════
var _novoEtapas = []; // { nome, prazo, peso_projeto }

function abrirModalNovoProjeto() {
  // Etapas padrão iniciais: usuário pode editar/adicionar; "Conclusão" é sempre a última
  _novoEtapas = [
    { nome: 'Planejamento', prazo: '', peso_projeto: 1 },
    { nome: 'Execução',     prazo: '', peso_projeto: 3 },
    { nome: 'Conclusão',    prazo: '', peso_projeto: 1, fixo: true },
  ];
  _renderModalNovo();
}

function _renderModalNovo() {
  const perfis = _prjPerfis || [];
  document.getElementById('prj-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)fecharModalNovo()">
      <div class="prj-modal" style="max-width:620px">
        <div class="prj-modal-head">
          <h3>Novo Projeto</h3>
          <button class="btn-mini" onclick="fecharModalNovo()">✕</button>
        </div>

        <div class="row2">
          <div class="field" style="grid-column:1/-1">
            <label>Título *</label>
            <input id="np-titulo" type="text" maxlength="120" placeholder="Ex: Instalação de redler novo — Expedição" />
          </div>
        </div>
        <div class="row2">
          <div class="field">
            <label>Setor</label>
            <select id="np-setor">
              <option value="">— selecione —</option>
              ${SETORES_PROJETOS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Prioridade</label>
            <select id="np-prio">
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label>Equipe técnica (podem editar o projeto)</label>
          <div class="prj-equipe-grid" id="np-equipe">
            ${perfis.map(p => `
              <label class="prj-check-label">
                <input type="checkbox" value="${p.id}" />
                ${escHtml(p.nome)} <span style="color:var(--tx2);font-size:11px">(${p.papel})</span>
              </label>`).join('')}
          </div>
        </div>

        <div class="card-sec" style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 class="card-sec-titulo" style="margin:0">Etapas</h3>
            <button class="btn-mini" onclick="_novoAdicionarEtapa()">+ Etapa</button>
          </div>
          <p class="page-sub" style="margin-bottom:10px">A última etapa "Conclusão" é sempre o marco final. Prazo final do projeto = prazo da Conclusão.</p>
          <div id="np-etapas-lista"></div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button class="btn btn-sec" onclick="fecharModalNovo()">Cancelar</button>
          <button class="btn" onclick="prjAcaoCriar()">Criar projeto</button>
        </div>
      </div>
    </div>
  `;
  _renderNovoEtapas();
}

function _renderNovoEtapas() {
  const el = document.getElementById('np-etapas-lista');
  if (!el) return;
  el.innerHTML = _novoEtapas.map((et, i) => `
    <div class="prj-etapa-row">
      <span class="prj-etapa-ord">${i + 1}</span>
      <input type="text" value="${escHtml(et.nome)}" placeholder="Nome da etapa"
        ${et.fixo ? 'disabled' : ''}
        oninput="_novoEtapas[${i}].nome=this.value" style="flex:2" />
      <input type="date" value="${et.prazo}" title="Prazo"
        oninput="_novoEtapas[${i}].prazo=this.value" style="flex:1" />
      <div style="display:flex;align-items:center;gap:4px;flex:0 0 90px">
        <span style="font-size:11px;color:var(--tx2)">Peso</span>
        <input type="number" min="1" max="99" value="${et.peso_projeto || 1}"
          oninput="_novoEtapas[${i}].peso_projeto=+this.value||1"
          style="width:52px;padding:6px 8px" />
      </div>
      ${(!et.fixo && _novoEtapas.length > 2) ?
        `<button class="btn-mini btn-mini-danger" onclick="_novoRemoverEtapa(${i})">✕</button>` :
        `<span style="width:50px"></span>`}
    </div>
  `).join('');
}

function _novoAdicionarEtapa() {
  // Insere antes da "Conclusão" (sempre a última)
  const conclusao = _novoEtapas.pop();
  _novoEtapas.push({ nome: '', prazo: '', peso_projeto: 1 });
  _novoEtapas.push(conclusao);
  _renderNovoEtapas();
}

function _novoRemoverEtapa(i) {
  _novoEtapas.splice(i, 1);
  _renderNovoEtapas();
}

function fecharModalNovo() {
  document.getElementById('prj-modal-root').innerHTML = '';
}

async function prjAcaoCriar() {
  const titulo = document.getElementById('np-titulo').value.trim();
  if (!titulo) { alert('Informe o título do projeto.'); return; }

  // Valida etapas
  for (const et of _novoEtapas) {
    if (!et.nome.trim()) { alert('Todas as etapas precisam ter nome.'); return; }
  }
  const conclusao = _novoEtapas[_novoEtapas.length - 1];
  if (!conclusao.prazo) { alert('Informe o prazo da etapa "Conclusão" (= prazo final do projeto).'); return; }

  const setor   = document.getElementById('np-setor').value;
  const prio    = document.getElementById('np-prio').value;
  const equipeIds = [...document.querySelectorAll('#np-equipe input:checked')].map(el => el.value);

  const btn = document.querySelector('.prj-modal .btn:last-child');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    const proj = await prjCriar({
      titulo,
      setor: setor || null,
      prioridade: prio,
      prazo_final: conclusao.prazo,
      status: 'pendente'
    });

    // Criar etapas
    for (let i = 0; i < _novoEtapas.length; i++) {
      const et = _novoEtapas[i];
      await prjEtapaCriar({
        projeto_id: proj.id,
        nome: et.nome.trim(),
        ordem: i + 1,
        peso_projeto: et.peso_projeto || 1,
        prazo: et.prazo || null,
        status: 'pendente',
        fixo: !!et.fixo
      });
    }

    // Equipe
    if (equipeIds.length) await prjEquipeDefinir(proj.id, equipeIds);

    fecharModalNovo();
    abrirFichaProjeto(proj.id);
  } catch (e) {
    alert('Erro: ' + e.message);
    btn.disabled = false; btn.textContent = 'Criar projeto';
  }
}
