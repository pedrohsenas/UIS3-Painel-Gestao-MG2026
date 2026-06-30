'use strict';
// ─── solicitacoes.js — Central de aprovação de solicitações ──────────

let _solCache = [];
let _solFiltroStatus = 'pendente';

async function telaSolicitacoes() {
  window._ajudaChave = 'solicitacoes';
  setConteudo(`
    <div class="page-head">
      <h2>Central de Solicitações</h2>
      <p class="page-sub">Aprove ou rejeite alterações propostas por empresas terceiras</p>
    </div>
    <div class="ac-filtros">
      <div class="field"><label>Status</label>
        <select onchange="_solFiltroStatus=this.value;_solCarregar()">
          <option value="pendente"${_solFiltroStatus==='pendente'?' selected':''}>Pendentes</option>
          <option value=""${_solFiltroStatus===''?' selected':''}>Todas</option>
          <option value="aplicada_total"${_solFiltroStatus==='aplicada_total'?' selected':''}>Aplicadas</option>
          <option value="aplicada_parcial"${_solFiltroStatus==='aplicada_parcial'?' selected':''}>Aplicadas (parcial)</option>
          <option value="rejeitada"${_solFiltroStatus==='rejeitada'?' selected':''}>Rejeitadas</option>
        </select></div>
    </div>
    <div id="sol-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  await _solCarregar();
}

async function _solCarregar() {
  const el = document.getElementById('sol-area');
  try {
    const filtro = _solFiltroStatus ? { status: _solFiltroStatus } : {};
    _solCache = await solListar(filtro);
    _solRender();
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function _solRender() {
  const el = document.getElementById('sol-area');
  if (!_solCache.length) {
    el.innerHTML = `<div class="empty-state"><p class="empty-title">Nenhuma solicitação ${_solFiltroStatus==='pendente'?'pendente':'encontrada'}</p></div>`;
    return;
  }
  el.innerHTML = `<div class="contagem">${_solCache.length} solicitação(ões)</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${_solCache.map(s => _solRenderCard(s)).join('')}
    </div>`;
}

function _solRenderCard(s) {
  const itens = s.projeto_solicitacao_itens || [];
  const pendente = s.status === 'pendente';
  const podeDecidir = pendente && _solPodeAprovar(s);

  const statusMap = {
    pendente:          ['ac-cont ac-c-and',    'Pendente'],
    aplicada_total:    ['ac-cont ac-c-conc',   'Aplicada'],
    aplicada_parcial:  ['ac-cont ac-c-pend',   'Aplicada (parcial)'],
    rejeitada:         ['badge-status arquivada', 'Rejeitada']
  };
  const [cls, lbl] = statusMap[s.status] || ['badge-status', s.status];

  // Agrupa itens por etapa
  const porEtapa = {};
  for (const it of itens) {
    const k = it.exec_etapa_id;
    porEtapa[k] = porEtapa[k] || { etapa: it.projeto_exec_etapas, itens: [] };
    porEtapa[k].itens.push(it);
  }

  return `
    <div class="card-sec" id="sol-card-${s.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <strong style="font-size:15px">${escHtml(s.projetos?.titulo || '—')}</strong>
          <div style="font-size:12px;color:var(--tx2);margin-top:3px">
            ${escHtml(s.empresas_terceiras?.nome || '—')} · ${new Date(s.criado_em).toLocaleString('pt-BR')}
          </div>
        </div>
        <span class="${cls}">${lbl}</span>
      </div>

      ${Object.values(porEtapa).map(grupo => `
        <div style="border:1px solid var(--line2);border-radius:var(--r2);padding:10px 12px;margin-bottom:8px">
          <div style="font-weight:600;font-size:13px;margin-bottom:8px">
            Etapa: ${escHtml(grupo.etapa?.nome || '—')}
          </div>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <thead><tr style="color:var(--tx2);font-size:11px;text-transform:uppercase">
              ${podeDecidir ? '<th style="width:30px"></th>' : ''}
              <th style="text-align:left;padding:4px">Campo</th>
              <th style="text-align:left;padding:4px">Antes</th>
              <th style="text-align:left;padding:4px">Depois</th>
              ${!pendente ? '<th style="text-align:left;padding:4px">Decisão</th>' : ''}
            </tr></thead>
            <tbody>
              ${grupo.itens.map(it => `
                <tr style="border-top:1px solid var(--line)">
                  ${podeDecidir ? `<td style="padding:6px 4px"><input type="checkbox" class="sol-item-check" data-id="${it.id}" checked /></td>` : ''}
                  <td style="padding:6px 4px"><strong>${_solNomeCampo(it.campo)}</strong></td>
                  <td style="padding:6px 4px;color:var(--tx2)">${escHtml(_solFmtValor(it.campo, it.valor_antes)) || '—'}</td>
                  <td style="padding:6px 4px;color:var(--accent);font-weight:600">${escHtml(_solFmtValor(it.campo, it.valor_depois)) || '—'}</td>
                  ${!pendente ? `<td style="padding:6px 4px">${_solBadgeDecisao(it.decisao)}</td>` : ''}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`).join('')}

      ${s.nota_revisor ? `<p class="page-sub" style="margin-top:8px">Nota: ${escHtml(s.nota_revisor)}</p>` : ''}
      ${s.revisado_em ? `<p class="page-sub">Revisada em ${new Date(s.revisado_em).toLocaleString('pt-BR')}</p>` : ''}

      ${podeDecidir ? `
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
          <button class="btn-mini" onclick="_solMarcarTodos('${s.id}',true)">Marcar todas</button>
          <button class="btn-mini" onclick="_solMarcarTodos('${s.id}',false)">Desmarcar todas</button>
          <button class="btn btn-sec" onclick="_solRejeitar('${s.id}')">Rejeitar todas</button>
          <button class="btn" onclick="_solAplicar('${s.id}')">Aplicar selecionadas</button>
        </div>` : ''}
    </div>`;
}

function _solPodeAprovar(sol) {
  if (PERFIL?.papel === 'gestor') return true;
  if (PERFIL?.papel === 'tecnico') {
    // Técnico só aprova se estiver na equipe do projeto
    // Como não temos a equipe carregada aqui, deixamos para o backend RLS confirmar.
    // Para a UI, mostramos os botões — o servidor recusará se não autorizado.
    return true;
  }
  return false;
}

function _solNomeCampo(c) {
  const MAP = {
    status: 'Status', data_inicio: 'Data início real', data_fim: 'Data fim real',
    data_inicio_prev: 'Início previsto', data_fim_prev: 'Fim previsto',
    duracao_prev_dias: 'Duração prevista (d)', responsavel_id: 'Responsável',
    peso_projeto: 'Peso', nome: 'Nome', empresa_id: 'Empresa'
  };
  return MAP[c] || c;
}

function _solFmtValor(campo, valor) {
  if (valor == null || valor === '') return '';
  if (['data_inicio','data_fim','data_inicio_prev','data_fim_prev'].includes(campo))
    return new Date(valor + 'T12:00:00').toLocaleDateString('pt-BR');
  if (campo === 'status') {
    return {pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída'}[valor] || valor;
  }
  if (campo === 'responsavel_id') {
    return (_prjPerfis || []).find(p => p.id === valor)?.nome || valor;
  }
  return valor;
}

function _solBadgeDecisao(d) {
  if (d === 'aprovada') return '<span class="ac-cont ac-c-conc">Aprovada</span>';
  if (d === 'rejeitada') return '<span class="badge-status arquivada">Rejeitada</span>';
  return '<span class="ac-cont ac-c-pend">Pendente</span>';
}

function _solMarcarTodos(sol_id, marcar) {
  document.querySelectorAll(`#sol-card-${sol_id} .sol-item-check`).forEach(el => el.checked = marcar);
}

async function _solAplicar(sol_id) {
  const checks = [...document.querySelectorAll(`#sol-card-${sol_id} .sol-item-check`)];
  if (!checks.length) return;
  const decisoes = checks.map(c => ({
    item_id: c.dataset.id,
    decisao: c.checked ? 'aprovada' : 'rejeitada'
  }));
  const aprov = decisoes.filter(d => d.decisao === 'aprovada').length;
  if (!confirm(`${aprov} item(ns) serão aplicados, ${decisoes.length - aprov} rejeitado(s). Confirmar?`)) return;
  const nota = prompt('Observação (opcional):', '') || '';
  try {
    const r = await solDecidir(sol_id, decisoes, nota);
    alert(`Concluído. ${r.aprovadas} aplicada(s) de ${r.total}.`);
    _solCarregar();
    _atualizarBadgeSolicitacoes();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _solRejeitar(sol_id) {
  if (!confirm('Rejeitar todas as alterações desta solicitação?')) return;
  const nota = prompt('Motivo da rejeição (opcional):', '') || '';
  const checks = [...document.querySelectorAll(`#sol-card-${sol_id} .sol-item-check`)];
  const decisoes = checks.map(c => ({ item_id: c.dataset.id, decisao: 'rejeitada' }));
  try {
    await solDecidir(sol_id, decisoes, nota);
    _solCarregar();
    _atualizarBadgeSolicitacoes();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// Badge do menu lateral
async function _atualizarBadgeSolicitacoes() {
  const n = await solContarPendentes();
  const badge = document.getElementById('badge-solicitacoes');
  if (badge) badge.textContent = n > 0 ? n : '';
  if (badge) badge.style.display = n > 0 ? '' : 'none';
}
