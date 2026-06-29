'use strict';
// ─── proj_dashboard_exec.js — dashboard de execução de projetos ───────

let _prjExecChart = null;

async function telaProjDashboardExec() {
  window._ajudaChave = 'projetos';
  setConteudo(`
    <div class="page-head">
      <h2>Dashboard — Execução de Projetos</h2>
      <p class="page-sub">Avanço real em campo · Planejado × Realizado · Curva S</p>
    </div>
    <div id="prjex-area"><div class="loading"><div class="spinner"></div> Calculando...</div></div>
  `);
  await _prjCarregarPerfis();
  _carregarDashExec();
}

async function _carregarDashExec() {
  const el = document.getElementById('prjex-area');
  try {
    const projetos = await prjListarExecDash();
    if (!projetos.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhum projeto cadastrado</p></div>`;
      return;
    }

    const hoje = new Date();

    // KPIs de execução
    const comExec = projetos.filter(p => (p.projeto_exec_etapas||[]).length > 0);
    const totalProj = projetos.length;
    const pctExecList = projetos.map(p => prjExecCalcProgresso(p.projeto_exec_etapas||[]));
    const pctExecMedio = pctExecList.length ? pctExecList.reduce((a,b)=>a+b,0)/pctExecList.length : 0;

    // Todas as etapas exec
    const todasEtapas = projetos.flatMap(p =>
      (p.projeto_exec_etapas||[]).map(e => ({ ...e, _proj: p }))
    );
    const etConc    = todasEtapas.filter(e => e.status === 'concluida').length;
    const etAnd     = todasEtapas.filter(e => e.status === 'em_andamento').length;
    const etAtras   = todasEtapas.filter(e =>
      e.status !== 'concluida' && e.data_fim && new Date(e.data_fim+'T23:59:59') < hoje).length;

    // Planejado vs realizado por projeto
    const comparativo = projetos.map(p => {
      const etaplasPlan = []; // planejamento não é buscado aqui; usamos prjListarResumido separado
      const pctExec = prjExecCalcProgresso(p.projeto_exec_etapas||[]);
      return { ...p, pctExec };
    });

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-valor">${totalProj}</div><div class="kpi-rotulo">Projetos</div></div>
        <div class="kpi"><div class="kpi-valor" style="color:#16a34a">${pctExecMedio.toFixed(0)}%</div><div class="kpi-rotulo">Execução média</div></div>
        <div class="kpi"><div class="kpi-valor kpi-verde">${etConc}</div><div class="kpi-rotulo">Etapas concluídas</div></div>
        <div class="kpi"><div class="kpi-valor kpi-amarelo">${etAnd}</div><div class="kpi-rotulo">Em andamento</div></div>
        <div class="kpi ${etAtras>0?'kpi-alerta':''}"><div class="kpi-valor kpi-vermelho">${etAtras}</div><div class="kpi-rotulo">Etapas atrasadas</div></div>
        <div class="kpi"><div class="kpi-valor kpi-azul">${comExec.length}</div><div class="kpi-rotulo">Com execução iniciada</div></div>
      </div>
      ${(() => {
        // Projetos com desvio calculado
        const atrasadosPrev = projetos.filter(p => {
          const ets = p.projeto_exec_etapas||[];
          return ets.some(e => e.data_fim_prev && e.status!=='concluida' && new Date(e.data_fim_prev+'T23:59:59') < hoje);
        }).length;
        return atrasadosPrev > 0 ? `<div class="alert-prazos">&#9888; ${atrasadosPrev} projeto(s) com etapas de execução além do prazo previsto.</div>` : '';
      })()}

      <div class="dash-grid" style="grid-template-columns:1.5fr 1fr">
        <!-- Curva S de execução -->
        <div class="card-sec dash-curva">
          <h3 class="card-sec-titulo">Curva S — Execução (etapas concluídas × prazo)</h3>
          <canvas id="prjex-curva" height="260"></canvas>
        </div>

        <!-- Progresso por projeto -->
        <div class="card-sec">
          <h3 class="card-sec-titulo">Progresso de execução por projeto</h3>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${comparativo.map(p => {
              const atrasado = p.status !== 'concluido' && p.prazo_final &&
                new Date(p.prazo_final+'T23:59:59') < hoje;
              return `
              <div style="cursor:pointer" onclick="abrirFichaProjeto('${p.id}','exec')">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px">
                  <span style="font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${atrasado?'color:var(--crit)':'color:var(--accent)'}"
                    title="${escHtml(p.titulo)}">${escHtml(p.titulo)}</span>
                  <span style="font-family:var(--mono);font-size:12px;min-width:34px;text-align:right">${p.pctExec.toFixed(0)}%</span>
                </div>
                <div class="prj-barra-wrap" style="height:9px">
                  <div class="prj-barra-fill" style="width:${p.pctExec.toFixed(0)}%;height:9px;border-radius:4px;background:#16a34a"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Tabela detalhe por projeto -->
      <div class="card-sec" style="margin-top:16px">
        <h3 class="card-sec-titulo">Detalhe por projeto</h3>
        <div class="tabela-wrap" style="box-shadow:none;border:none">
          <table class="tabela">
            <thead><tr>
              <th>Projeto</th><th>Setor</th>
              <th>Etapas exec.</th><th>Concluídas</th><th>Atrasadas</th>
              <th>% Execução</th><th>Prazo final</th>
            </tr></thead>
            <tbody>
              ${projetos.map(p => {
                const ets = p.projeto_exec_etapas || [];
                const conc  = ets.filter(e=>e.status==='concluida').length;
                const atras = ets.filter(e=>e.status!=='concluida'&&e.data_fim&&new Date(e.data_fim+'T23:59:59')<hoje).length;
                const pct   = prjExecCalcProgresso(ets);
                const projAtras = p.status!=='concluido'&&p.prazo_final&&new Date(p.prazo_final+'T23:59:59')<hoje;
                return `<tr class="${projAtras?'ac-l-atras':''}" style="cursor:pointer" onclick="abrirFichaProjeto('${p.id}','exec')">
                  <td><strong style="color:var(--accent)">${escHtml(p.titulo)}</strong></td>
                  <td>${escHtml(p.setor||'—')}</td>
                  <td class="td-mono td-center">${ets.length}</td>
                  <td class="td-mono td-center" style="color:#16a34a">${conc}</td>
                  <td class="td-mono td-center" style="color:${atras>0?'var(--crit)':'var(--tx2)'}">${atras}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px">
                      <div class="prj-barra-wrap" style="flex:1"><div class="prj-barra-fill" style="width:${pct.toFixed(0)}%;background:#16a34a"></div></div>
                      <span style="font-family:var(--mono);font-size:11px;min-width:32px">${pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td class="td-mono">${p.prazo_final?new Date(p.prazo_final+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    _desenharCurvaExec(todasEtapas);
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function _desenharCurvaExec(todasEtapas) {
  const canvas = document.getElementById('prjex-curva');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_prjExecChart) { _prjExecChart.destroy(); _prjExecChart = null; }

  const total = todasEtapas.length;
  if (!total) {
    canvas.style.display = 'none';
    canvas.insertAdjacentHTML('afterend', '<p class="page-sub">Cadastre etapas de execução com datas para gerar a curva.</p>');
    return;
  }

  const prazos    = todasEtapas.map(e => e.data_fim_prev || e.data_fim).filter(Boolean).sort();
  const conclusoes= todasEtapas.filter(e => e.concluido_em).map(e => e.concluido_em.slice(0,10)).sort();

  if (!prazos.length && !conclusoes.length) {
    canvas.style.display='none';
    canvas.insertAdjacentHTML('afterend','<p class="page-sub">Defina datas fim nas etapas de execução para gerar a curva.</p>');
    return;
  }

  const todasDatas = [...prazos, ...conclusoes];
  const hoje = new Date();
  const minD = new Date(todasDatas[0]);
  const maxD = new Date(todasDatas[todasDatas.length-1]);
  if (hoje > maxD) maxD.setTime(hoje.getTime());

  const dias = Math.ceil((maxD - minD)/86400000)+1;
  const passo = dias > 180 ? 7 : 1;
  const labels=[], planejado=[], realizado=[];

  for (let d=new Date(minD); d<=maxD; d.setDate(d.getDate()+passo)) {
    const iso = d.toISOString().slice(0,10);
    labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    planejado.push(Math.round(prazos.filter(p=>p<=iso).length/total*100));
    realizado.push(d<=hoje ? Math.round(conclusoes.filter(c=>c<=iso).length/total*100) : null);
  }

  _prjExecChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Planejado (data fim)', data:planejado, borderColor:'#6b7589', backgroundColor:'rgba(107,117,137,0.08)', borderDash:[6,4], fill:true, pointRadius:0, tension:0.3 },
        { label:'Realizado', data:realizado, borderColor:'#16a34a', backgroundColor:'rgba(22,163,74,0.10)', fill:true, pointRadius:0, tension:0.3, spanGaps:false }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{labels:{font:{family:'IBM Plex Sans',size:12},usePointStyle:true}},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y}%`}}
      },
      scales:{
        y:{min:0,max:100,ticks:{callback:v=>v+'%'}},
        x:{ticks:{maxTicksLimit:14,font:{size:11}}}
      }
    }
  });
}
