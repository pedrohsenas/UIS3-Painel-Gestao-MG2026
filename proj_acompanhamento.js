'use strict';
// ─── proj_acompanhamento.js — Acompanhamento de Projetos MG ───────────

let paStatus   = '';   // '' | pendente | em_andamento | concluido | cancelado | atrasado
let paSetor    = '';
let paPrio     = '';
let paResp     = '';   // perfil_id do responsável de etapa
let paDe       = '';
let paAte      = '';
let paDados    = [];   // projetos com etapas expandidas

async function telaProjAcompanhamento() {
  window._ajudaChave = 'projetos';
  setConteudo(`
    <div class="page-head">
      <h2>Acompanhamento de Projetos</h2>
      <p class="page-sub">Visão de etapas de todos os projetos, ordenadas por situação e prazo</p>
    </div>
    <div id="pa-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  await paCarregar();
}

async function paCarregar() {
  const el = document.getElementById('pa-area');
  try {
    await _prjCarregarPerfis();
    const projetos = await prjListarResumido();
    paDados = projetos || [];
    paRender();
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

// ── lista plana de etapas com contexto do projeto ──
function paLinhasFlat() {
  const linhas = [];
  for (const p of paDados) {
    const equipeIds = (p.projeto_equipe || []).map(e => e.perfil_id);
    for (const et of (p.projeto_etapas || [])) {
      linhas.push({
        // projeto
        projetoId:    p.id,
        projetoTitulo: p.titulo,
        setor:        p.setor || '',
        prioridade:   p.prioridade || 'media',
        projetoStatus: p.status,
        equipeIds,
        // etapa
        etapaId:      et.id,
        etapaNome:    et.nome,
        etapaOrdem:   et.ordem,
        status:       et.status,
        prazo:        et.prazo || null,
        responsavelId: et.responsavel_id || null,
        pct:          prjCalcProgressoEtapa(et),
        fixo:         et.fixo,
      });
    }
  }
  return linhas;
}

function paEhAtrasada(l) {
  return l.prazo && l.status !== 'concluida' && l.projetoStatus !== 'cancelado' &&
    new Date(l.prazo + 'T23:59:59') < new Date();
}

function paDiasPrazo(l) {
  if (!l.prazo) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.round((new Date(l.prazo + 'T00:00:00') - hoje) / 86400000);
}

function paPesoSituacao(l) {
  if (l.status === 'concluida') return 3;
  if (paEhAtrasada(l)) return 0;
  if (l.status === 'em_andamento') return 1;
  return 2;
}

function paListaFiltrada() {
  let lista = paLinhasFlat();

  if (paStatus) {
    if (paStatus === 'atrasado') lista = lista.filter(l => paEhAtrasada(l));
    else if (paStatus === 'pendente') lista = lista.filter(l => l.status === 'pendente' && !paEhAtrasada(l));
    else lista = lista.filter(l => l.status === paStatus);
  }
  if (paSetor) lista = lista.filter(l => l.setor === paSetor);
  if (paPrio)  lista = lista.filter(l => l.prioridade === paPrio);
  if (paResp)  lista = lista.filter(l => l.responsavelId === paResp);
  if (paDe)    lista = lista.filter(l => l.prazo && l.prazo >= paDe);
  if (paAte)   lista = lista.filter(l => l.prazo && l.prazo <= paAte);

  lista.sort((a, b) => {
    const pa = paPesoSituacao(a), pb = paPesoSituacao(b);
    if (pa !== pb) return pa - pb;
    const da = paDiasPrazo(a), db = paDiasPrazo(b);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
  return lista;
}

function paRender() {
  const el = document.getElementById('pa-area');
  const lista = paListaFiltrada();
  const todas  = paLinhasFlat();
  const perfis = _prjPerfis || [];

  // contadores (sem filtro de status/data, mas com setor/prio/resp aplicados)
  const base = todas.filter(l =>
    (!paSetor || l.setor === paSetor) &&
    (!paPrio  || l.prioridade === paPrio) &&
    (!paResp  || l.responsavelId === paResp)
  );
  const cAtras = base.filter(l => paEhAtrasada(l)).length;
  const cAnd   = base.filter(l => l.status === 'em_andamento').length;
  const cPend  = base.filter(l => l.status === 'pendente' && !paEhAtrasada(l)).length;
  const cConc  = base.filter(l => l.status === 'concluida').length;

  // opções de setor
  const setores = [...new Set(paDados.map(p => p.setor).filter(Boolean))].sort();

  el.innerHTML = `
    <div class="ac-filtros">
      <div class="field"><label>Setor</label>
        <select onchange="paSetor=this.value;paRender()">
          <option value="">Todos</option>
          ${setores.map(s => `<option value="${escHtml(s)}"${paSetor===s?' selected':''}>${escHtml(s)}</option>`).join('')}
        </select></div>
      <div class="field"><label>Prioridade</label>
        <select onchange="paPrio=this.value;paRender()">
          <option value="">Todas</option>
          <option value="alta"${paPrio==='alta'?' selected':''}>Alta</option>
          <option value="media"${paPrio==='media'?' selected':''}>Média</option>
          <option value="baixa"${paPrio==='baixa'?' selected':''}>Baixa</option>
        </select></div>
      <div class="field"><label>Responsável</label>
        <select onchange="paResp=this.value;paRender()">
          <option value="">Todos</option>
          ${perfis.map(p => `<option value="${p.id}"${paResp===p.id?' selected':''}>${escHtml(p.nome)}</option>`).join('')}
        </select></div>
      <div class="field"><label>Status</label>
        <select onchange="paStatus=this.value;paRender()">
          <option value="">Todos</option>
          <option value="atrasado"${paStatus==='atrasado'?' selected':''}>Atrasadas</option>
          <option value="pendente"${paStatus==='pendente'?' selected':''}>Pendentes</option>
          <option value="em_andamento"${paStatus==='em_andamento'?' selected':''}>Em andamento</option>
          <option value="concluida"${paStatus==='concluida'?' selected':''}>Concluídas</option>
        </select></div>
      <div class="field"><label>Prazo de</label>
        <input type="date" value="${paDe}" onchange="paDe=this.value;paRender()" /></div>
      <div class="field"><label>Prazo até</label>
        <input type="date" value="${paAte}" onchange="paAte=this.value;paRender()" /></div>
      <div class="field" style="align-self:flex-end">
        <button class="btn-mini" onclick="paLimparFiltros()">Limpar filtros</button>
      </div>
    </div>

    <div class="ac-contadores">
      <span class="ac-cont ac-c-atras">${cAtras} atrasada(s)</span>
      <span class="ac-cont ac-c-and">${cAnd} em andamento</span>
      <span class="ac-cont ac-c-pend">${cPend} pendente(s)</span>
      <span class="ac-cont ac-c-conc">${cConc} concluída(s)</span>
    </div>

    <div class="contagem">${lista.length} etapa${lista.length!==1?'s':''}</div>

    <div class="tabela-wrap">
      <table class="tabela ac-tabela">
        <thead><tr>
          <th>Projeto</th>
          <th>Setor</th>
          <th>Etapa</th>
          <th>Responsável</th>
          <th>Progresso</th>
          <th>Prazo</th>
          <th>Prio</th>
        </tr></thead>
        <tbody>
          ${lista.length ? lista.map(l => paLinha(l, perfis)).join('')
            : '<tr><td colspan="7"><div class="empty-state"><p class="empty-title">Nenhuma etapa com esses filtros</p></div></td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function paLinha(l, perfis) {
  const dias   = paDiasPrazo(l);
  const atras  = paEhAtrasada(l);
  let classe = '';
  if (l.status === 'concluida')    classe = 'ac-l-conc';
  else if (atras)                   classe = 'ac-l-atras';
  else if (l.status === 'em_andamento') classe = 'ac-l-and';
  else                              classe = 'ac-l-pend';

  let prazoCel;
  if (l.status === 'concluida') {
    prazoCel = `<span class="ac-dias ac-dias-ok">&#x2713; concluída</span>`;
  } else if (dias === null) {
    prazoCel = `<span class="ac-dias-sem">sem prazo</span>`;
  } else if (dias < 0) {
    prazoCel = `<span class="ac-dias ac-dias-atras">${dias} dia(s)</span>`;
  } else if (dias === 0) {
    prazoCel = `<span class="ac-dias ac-dias-hoje">vence hoje</span>`;
  } else {
    prazoCel = `<span class="ac-dias ac-dias-corre">+${dias} dia(s)</span>`;
  }

  const respNome = perfis.find(p => p.id === l.responsavelId)?.nome || '—';

  return `
    <tr class="linha-click ${classe}" onclick="abrirFichaProjeto('${l.projetoId}')">
      <td>
        <strong style="color:var(--accent)">${escHtml(l.projetoTitulo)}</strong>
        ${l.projetoStatus === 'cancelado' ? '<span class="badge-status arquivada" style="margin-left:6px">Cancelado</span>' : ''}
      </td>
      <td>${escHtml(l.setor) || '—'}</td>
      <td>
        ${escHtml(l.etapaNome)}
        ${l.fixo ? '<span style="font-size:10px;color:var(--tx2);margin-left:4px">&#9873;</span>' : ''}
      </td>
      <td style="font-size:13px">${escHtml(respNome)}</td>
      <td style="min-width:110px">
        <div style="display:flex;align-items:center;gap:6px">
          <div class="prj-barra-wrap"><div class="prj-barra-fill" style="width:${l.pct.toFixed(0)}%"></div></div>
          <span style="font-family:var(--mono);font-size:11px;min-width:30px">${l.pct.toFixed(0)}%</span>
        </div>
      </td>
      <td>${prazoCel}</td>
      <td>${_prjBadgePrio(l.prioridade)}</td>
    </tr>`;
}

function paLimparFiltros() {
  paStatus = ''; paSetor = ''; paPrio = ''; paResp = ''; paDe = ''; paAte = '';
  paRender();
}
