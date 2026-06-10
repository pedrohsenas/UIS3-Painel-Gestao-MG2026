'use strict';
// ─── dashboard.js — painel macro com curva S ───────────────────────────

let dashCategoria = 'todas';
let _chartCurvaS = null;

const DASH_FILTROS = {
  todas: { titulo: 'Todas', filtro: {} },
  ...Object.fromEntries(Object.entries(CATEGORIAS).map(([k,v]) => [k, { titulo: v.titulo, filtro: v.filtro }]))
};

function telaDashboardReal(cat) {
  if (cat) dashCategoria = cat;
  window._ajudaChave = 'dashboard';

  setConteudo(`
    <div class="page-head">
      <h2>Dashboard — Manutenção Geral UIS3 2026</h2>
      <p class="page-sub">Acompanhamento macro do avanço das etapas</p>
    </div>

    <div class="cat-tabs">
      ${Object.entries(DASH_FILTROS).map(([k, v]) => `
        <button class="cat-tab ${k === dashCategoria ? 'ativo' : ''} ${k === 'ex' ? 'tab-ex' : ''}"
          onclick="telaDashboardReal('${k}')">${v.titulo}</button>
      `).join('')}
    </div>

    <div id="dash-area"><div class="loading"><div class="spinner"></div> Calculando indicadores...</div></div>
  `);
  carregarDashboard();
}

async function carregarDashboard() {
  const el = document.getElementById('dash-area');
  try {
    const filtroCat = DASH_FILTROS[dashCategoria].filtro;
    const [etapas, maquinasStats] = await Promise.all([
      dbEtapasResumo(filtroCat),
      dbListarMaquinas({ ...filtroCat, status: 'ativa' })
    ]);

    if (!etapas.length) {
      el.innerHTML = `<div class="empty-state"><p class="empty-title">Sem dados nesta categoria</p></div>`;
      return;
    }

    // ── KPIs ──
    const maquinasSet = new Set(etapas.map(e => e.maquinas.id));
    const total = etapas.length;
    const concluidas = etapas.filter(e => e.status === 'concluida').length;
    const andamento = etapas.filter(e => e.status === 'em_andamento').length;
    const hoje = new Date();
    const atrasadas = etapas.filter(e =>
      e.prazo && e.status !== 'concluida' && new Date(e.prazo + 'T23:59:59') < hoje).length;
    const semPrazo = etapas.filter(e => !e.prazo).length;
    const pct = total ? Math.round(concluidas / total * 100) : 0;

    // ── Avanço por etapa ──
    const porEtapa = ORDEM_ETAPAS.map(cod => {
      const doCod = etapas.filter(e => e.codigo === cod);
      const conc = doCod.filter(e => e.status === 'concluida').length;
      return { cod, nome: NOMES_ETAPAS[cod], total: doCod.length, conc,
        pct: doCod.length ? Math.round(conc / doCod.length * 100) : 0 };
    });

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-valor">${maquinasSet.size}</div><div class="kpi-rotulo">Máquinas</div></div>
        <div class="kpi"><div class="kpi-valor kpi-azul">${pct}%</div><div class="kpi-rotulo">Avanço geral</div></div>
        <div class="kpi"><div class="kpi-valor kpi-verde">${concluidas}</div><div class="kpi-rotulo">Etapas concluídas</div></div>
        <div class="kpi"><div class="kpi-valor kpi-amarelo">${andamento}</div><div class="kpi-rotulo">Em andamento</div></div>
        <div class="kpi ${atrasadas > 0 ? 'kpi-alerta' : ''}"><div class="kpi-valor kpi-vermelho">${atrasadas}</div><div class="kpi-rotulo">Atrasadas</div></div>
      </div>

      ${semPrazo > 0 ? `<div class="alert-prazos">⚠ ${semPrazo} etapa${semPrazo>1?'s':''} sem prazo definido — a curva planejada considera apenas etapas com prazo. Use a tela <strong>Prazos</strong> para completar.</div>` : ''}

      <div class="dash-grid">
        <div class="card-sec dash-curva">
          <h3 class="card-sec-titulo">Curva S — Planejado × Realizado</h3>
          <canvas id="curva-s" height="280"></canvas>
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

      ${renderTabelasEstatisticas(maquinasStats)}
    `;

    desenharCurvaS(etapas, total);
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function desenharCurvaS(etapas, totalEtapas) {
  const canvas = document.getElementById('curva-s');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_chartCurvaS) { _chartCurvaS.destroy(); _chartCurvaS = null; }

  // Coleta datas
  const prazos = etapas.filter(e => e.prazo).map(e => e.prazo).sort();
  const conclusoes = etapas.filter(e => e.concluido_em)
    .map(e => e.concluido_em.slice(0, 10)).sort();

  if (!prazos.length && !conclusoes.length) {
    canvas.parentElement.insertAdjacentHTML('beforeend',
      '<p class="page-sub">Defina prazos e conclua etapas para gerar a curva</p>');
    canvas.style.display = 'none';
    return;
  }

  // Intervalo de datas
  const todasDatas = [...prazos, ...conclusoes];
  const min = new Date(todasDatas[0] < new Date().toISOString().slice(0,10) ? todasDatas[0] : new Date().toISOString().slice(0,10));
  const max = new Date(todasDatas[todasDatas.length - 1]);
  const hoje = new Date();
  if (hoje > max) max.setTime(hoje.getTime());

  const dias = Math.ceil((max - min) / 86400000) + 1;
  const passo = dias > 180 ? 7 : 1;   // semanal se intervalo longo

  const labels = [], planejado = [], realizado = [];
  for (let d = new Date(min); d <= max; d.setDate(d.getDate() + passo)) {
    const iso = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    planejado.push(Math.round(prazos.filter(p => p <= iso).length / totalEtapas * 100));
    // Realizado só até hoje
    realizado.push(d <= hoje
      ? Math.round(conclusoes.filter(c => c <= iso).length / totalEtapas * 100)
      : null);
  }

  _chartCurvaS = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Planejado',
          data: planejado,
          borderColor: '#6b7589',
          backgroundColor: 'rgba(107,117,137,0.08)',
          borderDash: [6, 4],
          fill: true,
          pointRadius: 0,
          tension: 0.3
        },
        {
          label: 'Realizado',
          data: realizado,
          borderColor: '#1a5fd4',
          backgroundColor: 'rgba(26,95,212,0.10)',
          fill: true,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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


// ─── Tabelas estatísticas ──────────────────────────────────────────────
function paraKW(m) {
  if (m.potencia == null) return null;
  const p = parseFloat(m.potencia);
  if (isNaN(p)) return null;
  if (m.unidade_pot === 'cv') return p * 0.7355;
  if (m.unidade_pot === 'HP') return p * 0.7457;
  return p;
}

function renderTabelasEstatisticas(maquinas) {
  if (!maquinas || !maquinas.length) return '';

  const tipos = [...new Set(maquinas.map(m => m.tipo))].sort();
  const areas = [...new Set(maquinas.map(m => m.area || '— sem área —'))].sort();

  // ── Tabela 1: quantidade por área × tipo ──
  const qtd = {};
  areas.forEach(a => { qtd[a] = {}; tipos.forEach(t => qtd[a][t] = 0); });
  maquinas.forEach(m => qtd[m.area || '— sem área —'][m.tipo]++);

  const totColQtd = {}; tipos.forEach(t => totColQtd[t] = 0);
  let totGeralQtd = 0;
  const linhasQtd = areas.map(a => {
    let totLinha = 0;
    const cels = tipos.map(t => { const v = qtd[a][t]; totLinha += v; totColQtd[t] += v; return v; });
    totGeralQtd += totLinha;
    return { area: a, cels, total: totLinha };
  });

  // ── Tabela 2: potência instalada (kW) por área × tipo ──
  const pot = {};
  areas.forEach(a => { pot[a] = {}; tipos.forEach(t => pot[a][t] = 0); });
  let semPotencia = 0;
  maquinas.forEach(m => {
    const kw = paraKW(m);
    if (kw == null) { semPotencia++; return; }
    pot[m.area || '— sem área —'][m.tipo] += kw;
  });
  const totColPot = {}; tipos.forEach(t => totColPot[t] = 0);
  let totGeralPot = 0;
  const linhasPot = areas.map(a => {
    let totLinha = 0;
    const cels = tipos.map(t => { const v = pot[a][t]; totLinha += v; totColPot[t] += v; return v; });
    totGeralPot += totLinha;
    return { area: a, cels, total: totLinha };
  });
  const fmtKW = v => v ? v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—';

  // ── Tabela 3: máquinas por fabricante ──
  const porFab = {};
  maquinas.forEach(m => {
    const f = (m.fabricante || '').trim() || '— não informado —';
    porFab[f] = (porFab[f] || 0) + 1;
  });
  const fabricantes = Object.entries(porFab).sort((a, b) => b[1] - a[1]);

  return `
    <div class="card-sec" style="margin-top:16px">
      <h3 class="card-sec-titulo">Máquinas por área × tipo</h3>
      <div class="tabela-wrap" style="box-shadow:none;border:none">
        <table class="tabela tabela-stats">
          <thead><tr><th>Área</th>${tipos.map(t => `<th class="td-center">${TIPOS_NOMES[t] || t}</th>`).join('')}<th class="td-center th-total">Total</th></tr></thead>
          <tbody>
            ${linhasQtd.map(l => `<tr><td style="font-weight:600">${escHtml(l.area)}</td>${l.cels.map(v => `<td class="td-center">${v || '—'}</td>`).join('')}<td class="td-center td-total">${l.total}</td></tr>`).join('')}
            <tr class="linha-total"><td>TOTAL</td>${tipos.map(t => `<td class="td-center">${totColQtd[t]}</td>`).join('')}<td class="td-center">${totGeralQtd}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card-sec" style="margin-top:16px">
      <h3 class="card-sec-titulo">Potência instalada (kW) por área × tipo</h3>
      ${semPotencia > 0 ? `<p class="page-sub" style="margin-bottom:10px">${semPotencia} máquina(s) sem potência cadastrada não entram nesta tabela. Valores em cv/HP convertidos para kW.</p>` : '<p class="page-sub" style="margin-bottom:10px">Valores em cv/HP convertidos para kW.</p>'}
      <div class="tabela-wrap" style="box-shadow:none;border:none">
        <table class="tabela tabela-stats">
          <thead><tr><th>Área</th>${tipos.map(t => `<th class="td-center">${TIPOS_NOMES[t] || t}</th>`).join('')}<th class="td-center th-total">Total (kW)</th></tr></thead>
          <tbody>
            ${linhasPot.map(l => `<tr><td style="font-weight:600">${escHtml(l.area)}</td>${l.cels.map(v => `<td class="td-center">${fmtKW(v)}</td>`).join('')}<td class="td-center td-total">${fmtKW(l.total)}</td></tr>`).join('')}
            <tr class="linha-total"><td>TOTAL</td>${tipos.map(t => `<td class="td-center">${fmtKW(totColPot[t])}</td>`).join('')}<td class="td-center">${fmtKW(totGeralPot)} kW</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card-sec" style="margin-top:16px;max-width:560px">
      <h3 class="card-sec-titulo">Máquinas por fabricante</h3>
      <div class="tabela-wrap" style="box-shadow:none;border:none">
        <table class="tabela tabela-stats">
          <thead><tr><th>Fabricante</th><th class="td-center">Quantidade</th><th class="td-center">%</th></tr></thead>
          <tbody>
            ${fabricantes.map(([f, n]) => `<tr><td style="font-weight:600">${escHtml(f)}</td><td class="td-center">${n}</td><td class="td-center">${Math.round(n / maquinas.length * 100)}%</td></tr>`).join('')}
            <tr class="linha-total"><td>TOTAL</td><td class="td-center">${maquinas.length}</td><td class="td-center">100%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
