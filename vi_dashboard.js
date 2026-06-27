'use strict';
// ─── vi_dashboard.js — dashboard e curva S próprios de V&I ─────────────

let viDashDominio = 'todos';
let _viChartCurvaS = null;

const VI_DASH_FILTROS = {
  todos:       { titulo: 'Todos' },
  instrumento: { titulo: 'Instrumentos' },
  valvula:     { titulo: 'Válvulas' }
};

function viTelaDashboard(dom) {
  if (dom) viDashDominio = dom;
  window._ajudaChave = 'vi_dashboard';

  setConteudo(`
    <div class="page-head">
      <h2>Dashboard — Válvulas & Instrumentos</h2>
      <p class="page-sub">Acompanhamento macro do avanço das etapas de V&I</p>
    </div>
    <div class="cat-tabs">
      ${Object.entries(VI_DASH_FILTROS).map(([k, v]) => `
        <button class="cat-tab ${k === viDashDominio ? 'ativo' : ''}"
          onclick="viTelaDashboard('${k}')">${v.titulo}</button>`).join('')}
    </div>
    <div id="vi-dash-area"><div class="loading"><div class="spinner"></div> Calculando indicadores...</div></div>
  `);
  viCarregarDashboard();
}

async function viCarregarDashboard() {
  const el = document.getElementById('vi-dash-area');
  try {
    const filtro = viDashDominio === 'todos' ? {} : { dominio: viDashDominio };
    const [etapas, equipamentos] = await Promise.all([
      viEtapasResumo(filtro),
      viListarEquipamentos({ ...filtro, status: 'ativa' })
    ]);

    if (!etapas.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Sem dados nesta categoria</p></div>`;
      return;
    }

    const eqSet = new Set(etapas.map(e => e.vi_equipamentos.id));
    const total = etapas.length;
    const concluidas = etapas.filter(e => e.status === 'concluida').length;
    const andamento = etapas.filter(e => e.status === 'em_andamento').length;
    const hoje = new Date();
    const atrasadas = etapas.filter(e =>
      e.prazo && e.status !== 'concluida' && new Date(e.prazo + 'T23:59:59') < hoje).length;
    const semPrazo = etapas.filter(e => !e.prazo).length;
    const pct = total ? Math.round(concluidas / total * 100) : 0;

    const porEtapa = VI_ETAPAS_ORDEM.map(cod => {
      const doCod = etapas.filter(e => e.codigo === cod);
      const conc = doCod.filter(e => e.status === 'concluida').length;
      return { nome: VI_ETAPAS_NOMES[cod], total: doCod.length, conc,
        pct: doCod.length ? Math.round(conc / doCod.length * 100) : 0 };
    });

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-valor">${eqSet.size}</div><div class="kpi-rotulo">Equipamentos</div></div>
        <div class="kpi"><div class="kpi-valor kpi-azul">${pct}%</div><div class="kpi-rotulo">Avanço geral</div></div>
        <div class="kpi"><div class="kpi-valor kpi-verde">${concluidas}</div><div class="kpi-rotulo">Etapas concluídas</div></div>
        <div class="kpi"><div class="kpi-valor kpi-amarelo">${andamento}</div><div class="kpi-rotulo">Em andamento</div></div>
        <div class="kpi ${atrasadas > 0 ? 'kpi-alerta' : ''}"><div class="kpi-valor kpi-vermelho">${atrasadas}</div><div class="kpi-rotulo">Atrasadas</div></div>
      </div>

      ${semPrazo > 0 ? `<div class="alert-prazos">⚠ ${semPrazo} etapa${semPrazo>1?'s':''} sem prazo definido — a curva planejada considera apenas etapas com prazo. Use a tela <strong>Prazos V&I</strong> para completar.</div>` : ''}

      <div class="dash-grid">
        <div class="card-sec dash-curva">
          <h3 class="card-sec-titulo">Curva S — Planejado × Realizado</h3>
          <canvas id="vi-curva-s" height="280"></canvas>
        </div>
        <div class="card-sec">
          <h3 class="card-sec-titulo">Avanço por etapa</h3>
          <div class="etapa-barras">
            ${porEtapa.map(e => `
              <div class="etapa-barra-linha">
                <span class="etapa-barra-nome">${e.nome}</span>
                <div class="prog-bar etapa-barra"><div class="prog-fill ${e.pct === 100 ? 'completo' : ''}" style="width:${e.pct}%"></div></div>
                <span class="etapa-barra-num">${e.conc}/${e.total}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      ${viRenderTabelasEstat(equipamentos)}
    `;

    viDesenharCurvaS(etapas, total);
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function viDesenharCurvaS(etapas, totalEtapas) {
  const canvas = document.getElementById('vi-curva-s');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_viChartCurvaS) { _viChartCurvaS.destroy(); _viChartCurvaS = null; }

  const prazos = etapas.filter(e => e.prazo).map(e => e.prazo).sort();
  const conclusoes = etapas.filter(e => e.concluido_em).map(e => e.concluido_em.slice(0,10)).sort();

  if (!prazos.length && !conclusoes.length) {
    canvas.parentElement.insertAdjacentHTML('beforeend',
      '<p class="page-sub">Defina prazos e conclua etapas para gerar a curva</p>');
    canvas.style.display = 'none';
    return;
  }

  const hojeISO = new Date().toISOString().slice(0,10);
  const todasDatas = [...prazos, ...conclusoes];
  const min = new Date(todasDatas[0] < hojeISO ? todasDatas[0] : hojeISO);
  const max = new Date(todasDatas[todasDatas.length - 1]);
  const hoje = new Date();
  if (hoje > max) max.setTime(hoje.getTime());

  const dias = Math.ceil((max - min) / 86400000) + 1;
  const passo = dias > 180 ? 7 : 1;

  const labels = [], planejado = [], realizado = [];
  for (let d = new Date(min); d <= max; d.setDate(d.getDate() + passo)) {
    const iso = d.toISOString().slice(0,10);
    labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    planejado.push(Math.round(prazos.filter(p => p <= iso).length / totalEtapas * 100));
    realizado.push(d <= hoje
      ? Math.round(conclusoes.filter(c => c <= iso).length / totalEtapas * 100)
      : null);
  }

  _viChartCurvaS = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Planejado', data: planejado, borderColor: '#6b7589',
          backgroundColor: 'rgba(107,117,137,0.08)', borderDash: [6,4], fill: true, pointRadius: 0, tension: 0.3 },
        { label: 'Realizado', data: realizado, borderColor: '#1a5fd4',
          backgroundColor: 'rgba(26,95,212,0.10)', fill: true, pointRadius: 0, tension: 0.3, spanGaps: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { family: 'IBM Plex Sans', size: 12 }, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } }
      },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
        x: { ticks: { maxTicksLimit: 14, font: { size: 11 } } }
      }
    }
  });
}

// ─── Tabelas estatísticas de V&I ───────────────────────────────────────
function viRenderTabelasEstat(equip) {
  if (!equip || !equip.length) return '';

  const dominios = [...new Set(equip.map(e => e.dominio))].sort();
  const areas = [...new Set(equip.map(e => e.area || '— sem área —'))].sort();
  const nomeDom = d => d === 'valvula' ? 'Válvulas' : 'Instrumentos';

  // Tabela 1: quantidade por área × domínio
  const qtd = {};
  areas.forEach(a => { qtd[a] = {}; dominios.forEach(d => qtd[a][d] = 0); });
  equip.forEach(e => qtd[e.area || '— sem área —'][e.dominio]++);
  const totCol = {}; dominios.forEach(d => totCol[d] = 0);
  let totGeral = 0;
  const linhas = areas.map(a => {
    let tl = 0;
    const cels = dominios.map(d => { const v = qtd[a][d]; tl += v; totCol[d] += v; return v; });
    totGeral += tl;
    return { area: a, cels, total: tl };
  });

  // Tabela 2: instrumentos por criticidade
  const inst = equip.filter(e => e.dominio === 'instrumento');
  const porCrit = { 'A': 0, 'B': 0, 'C': 0, '—': 0 };
  inst.forEach(e => { const c = (e.criticidade || '')[0]; porCrit[c === 'A' || c === 'B' || c === 'C' ? c : '—']++; });

  // Tabela 3: equipamentos por fabricante
  const porFab = {};
  equip.forEach(e => { const f = (e.fabricante || '').trim() || '— não informado —'; porFab[f] = (porFab[f]||0)+1; });
  const fabricantes = Object.entries(porFab).sort((a,b) => b[1]-a[1]);

  let html = `
    <div class="card-sec" style="margin-top:16px">
      <h3 class="card-sec-titulo">Equipamentos por área × tipo</h3>
      <div class="tabela-wrap" style="box-shadow:none;border:none">
        <table class="tabela tabela-stats">
          <thead><tr><th>Área</th>${dominios.map(d => `<th class="td-center">${nomeDom(d)}</th>`).join('')}<th class="td-center th-total">Total</th></tr></thead>
          <tbody>
            ${linhas.map(l => `<tr><td style="font-weight:600">${escHtml(l.area)}</td>${l.cels.map(v => `<td class="td-center">${v||'—'}</td>`).join('')}<td class="td-center td-total">${l.total}</td></tr>`).join('')}
            <tr class="linha-total"><td>TOTAL</td>${dominios.map(d => `<td class="td-center">${totCol[d]}</td>`).join('')}<td class="td-center">${totGeral}</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  if (inst.length) {
    html += `
    <div class="card-sec" style="margin-top:16px;max-width:480px">
      <h3 class="card-sec-titulo">Instrumentos por criticidade</h3>
      <div class="tabela-wrap" style="box-shadow:none;border:none">
        <table class="tabela tabela-stats">
          <thead><tr><th>Criticidade</th><th class="td-center">Quantidade</th><th class="td-center">%</th></tr></thead>
          <tbody>
            ${[['A','Alta'],['B','Média'],['C','Baixa'],['—','Não definida']].map(([k,nome]) =>
              `<tr><td style="font-weight:600">${k === '—' ? nome : k + ' — ' + nome}</td><td class="td-center">${porCrit[k]}</td><td class="td-center">${inst.length ? Math.round(porCrit[k]/inst.length*100) : 0}%</td></tr>`).join('')}
            <tr class="linha-total"><td>TOTAL</td><td class="td-center">${inst.length}</td><td class="td-center">100%</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }

  html += `
    <div class="card-sec" style="margin-top:16px;max-width:560px">
      <h3 class="card-sec-titulo">Equipamentos por fabricante</h3>
      <div class="tabela-wrap" style="box-shadow:none;border:none">
        <table class="tabela tabela-stats">
          <thead><tr><th>Fabricante</th><th class="td-center">Quantidade</th><th class="td-center">%</th></tr></thead>
          <tbody>
            ${fabricantes.map(([f,n]) => `<tr><td style="font-weight:600">${escHtml(f)}</td><td class="td-center">${n}</td><td class="td-center">${Math.round(n/equip.length*100)}%</td></tr>`).join('')}
            <tr class="linha-total"><td>TOTAL</td><td class="td-center">${equip.length}</td><td class="td-center">100%</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  return html;
}
