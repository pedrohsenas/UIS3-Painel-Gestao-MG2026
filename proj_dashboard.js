'use strict';
// ─── proj_dashboard.js — dashboard de Projetos MG ─────────────────────

async function telaProjDashboard() {
  window._ajudaChave = 'projetos';
  setConteudo(`
    <div class="page-head">
      <h2>Dashboard — Projetos MG</h2>
      <p class="page-sub">Visão macro do avanço dos projetos e etapas</p>
    </div>
    <div id="prjd-area"><div class="loading"><div class="spinner"></div> Calculando indicadores...</div></div>
  `);
  await _prjCarregarPerfis();
  _carregarProjDashboard();
}

async function _carregarProjDashboard() {
  const el = document.getElementById('prjd-area');
  try {
    const projetos = await prjListar();
    if (!projetos.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhum projeto cadastrado ainda</p><p class="empty-sub">Acesse "Projetos MG" para criar o primeiro projeto.</p></div>`;
      return;
    }

    const hoje = new Date();
    const ativos = projetos.filter(p => p.status !== 'cancelado');
    const total      = ativos.length;
    const concluidos = ativos.filter(p => p.status === 'concluido').length;
    const emAnd      = ativos.filter(p => p.status === 'em_andamento').length;
    const pendentes  = ativos.filter(p => p.status === 'pendente').length;
    const atrasados  = ativos.filter(p =>
      p.status !== 'concluido' && p.prazo_final &&
      new Date(p.prazo_final + 'T23:59:59') < hoje).length;

    // progresso médio geral
    const pcts = ativos.map(p => prjCalcProgresso(p.projeto_etapas || []));
    const pctMedio = pcts.length ? pcts.reduce((a,b) => a+b, 0) / pcts.length : 0;

    // todas as etapas de todos os projetos
    const todasEtapas = ativos.flatMap(p => (p.projeto_etapas || []).map(e => ({ ...e, projetoStatus: p.status })));
    const etAtrasadas = todasEtapas.filter(e =>
      e.status !== 'concluida' && e.prazo &&
      new Date(e.prazo + 'T23:59:59') < hoje).length;

    // por prioridade
    const pAlta  = ativos.filter(p => p.prioridade === 'alta').length;
    const pMedia = ativos.filter(p => p.prioridade === 'media').length;
    const pBaixa = ativos.filter(p => p.prioridade === 'baixa').length;

    // lista projetos com progresso, ordenada por prazo
    const comPct = ativos.map(p => ({
      ...p,
      pct: prjCalcProgresso(p.projeto_etapas || []),
      atrasado: p.status !== 'concluido' && p.prazo_final && new Date(p.prazo_final + 'T23:59:59') < hoje
    })).sort((a, b) => {
      // atrasados primeiro, depois por prazo
      if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
      if (!a.prazo_final && !b.prazo_final) return 0;
      if (!a.prazo_final) return 1;
      if (!b.prazo_final) return -1;
      return a.prazo_final.localeCompare(b.prazo_final);
    });

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-valor">${total}</div><div class="kpi-rotulo">Projetos ativos</div></div>
        <div class="kpi"><div class="kpi-valor kpi-azul">${pctMedio.toFixed(0)}%</div><div class="kpi-rotulo">Progresso médio</div></div>
        <div class="kpi"><div class="kpi-valor kpi-amarelo">${emAnd}</div><div class="kpi-rotulo">Em andamento</div></div>
        <div class="kpi"><div class="kpi-valor kpi-verde">${concluidos}</div><div class="kpi-rotulo">Concluídos</div></div>
        <div class="kpi ${atrasados > 0 ? 'kpi-alerta' : ''}"><div class="kpi-valor kpi-vermelho">${atrasados}</div><div class="kpi-rotulo">Proj. atrasados</div></div>
        <div class="kpi ${etAtrasadas > 0 ? 'kpi-alerta' : ''}"><div class="kpi-valor kpi-vermelho">${etAtrasadas}</div><div class="kpi-rotulo">Etapas atrasadas</div></div>
      </div>

      <div class="dash-grid" style="grid-template-columns:1.6fr 1fr">

        <!-- Lista de projetos com barras -->
        <div class="card-sec">
          <h3 class="card-sec-titulo">Projetos — progresso e prazo</h3>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${comPct.map(p => {
              const dias = p.prazo_final ? Math.round(
                (new Date(p.prazo_final + 'T00:00:00') - hoje) / 86400000) : null;
              let prazoBadge = '';
              if (p.status === 'concluido') {
                prazoBadge = `<span class="ac-dias ac-dias-ok">&#x2713; concluído</span>`;
              } else if (dias === null) {
                prazoBadge = `<span class="ac-dias-sem">sem prazo</span>`;
              } else if (dias < 0) {
                prazoBadge = `<span class="ac-dias ac-dias-atras">${dias}d</span>`;
              } else if (dias === 0) {
                prazoBadge = `<span class="ac-dias ac-dias-hoje">hoje</span>`;
              } else {
                prazoBadge = `<span class="ac-dias ac-dias-corre">+${dias}d</span>`;
              }
              return `
              <div style="cursor:pointer" onclick="abrirFichaProjeto('${p.id}')">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
                  <span style="font-size:13px;font-weight:600;color:var(--accent);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    title="${escHtml(p.titulo)}">${escHtml(p.titulo)}</span>
                  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                    ${_prjBadgePrio(p.prioridade)}
                    ${prazoBadge}
                    <span style="font-family:var(--mono);font-size:12px;min-width:34px;text-align:right">${p.pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div class="prj-barra-wrap" style="height:10px">
                  <div class="prj-barra-fill" style="width:${p.pct.toFixed(0)}%;height:10px;border-radius:5px;
                    background:${p.status==='concluido'?'#16a34a':p.atrasado?'#dc2626':'var(--accent)'}"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Coluna direita -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Por status -->
          <div class="card-sec">
            <h3 class="card-sec-titulo">Distribuição por status</h3>
            <div class="etapa-barras">
              ${[
                ['Em andamento', emAnd,  total, '#2563eb'],
                ['Pendentes',    pendentes, total, '#d97706'],
                ['Concluídos',   concluidos, total, '#16a34a'],
              ].map(([nome, val, tot, cor]) => {
                const p = tot ? Math.round(val/tot*100) : 0;
                return `<div class="etapa-barra-linha">
                  <span class="etapa-barra-nome">${nome}</span>
                  <div class="etapa-barra prog-bar" style="flex:1;height:9px">
                    <div style="width:${p}%;height:100%;background:${cor};border-radius:4px;transition:width .3s"></div>
                  </div>
                  <span class="etapa-barra-num">${val} (${p}%)</span>
                </div>`;
              }).join('')}
            </div>
          </div>

          <!-- Por prioridade -->
          <div class="card-sec">
            <h3 class="card-sec-titulo">Por prioridade</h3>
            <div class="etapa-barras">
              ${[
                ['Alta',  pAlta,  'var(--crit)'],
                ['Média', pMedia, '#d97706'],
                ['Baixa', pBaixa, '#16a34a'],
              ].map(([nome, val, cor]) => {
                const p = total ? Math.round(val/total*100) : 0;
                return `<div class="etapa-barra-linha">
                  <span class="etapa-barra-nome">${nome}</span>
                  <div class="etapa-barra prog-bar" style="flex:1;height:9px">
                    <div style="width:${p}%;height:100%;background:${cor};border-radius:4px;transition:width .3s"></div>
                  </div>
                  <span class="etapa-barra-num">${val}</span>
                </div>`;
              }).join('')}
            </div>
          </div>

          <!-- Projetos sem prazo -->
          ${ativos.filter(p=>!p.prazo_final && p.status!=='concluido').length ? `
          <div class="card-sec" style="border-color:var(--warn-bd);background:var(--warn-bg)">
            <h3 class="card-sec-titulo" style="color:var(--warn)">&#9888; Sem prazo definido</h3>
            ${ativos.filter(p=>!p.prazo_final && p.status!=='concluido').map(p =>
              `<div style="font-size:13px;padding:4px 0;cursor:pointer;color:var(--accent)"
                onclick="abrirFichaProjeto('${p.id}')">${escHtml(p.titulo)}</div>`
            ).join('')}
          </div>` : ''}

        </div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}
