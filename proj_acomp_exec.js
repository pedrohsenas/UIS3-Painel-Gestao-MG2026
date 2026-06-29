'use strict';
// ─── proj_acomp_exec.js — acompanhamento de etapas de execução ────────

let paeStatus = '';
let paeSetor  = '';
let paePrio   = '';
let paeResp   = '';
let paeDe     = '';
let paeAte    = '';
let paeDados  = [];

async function telaProjAcompExec() {
  window._ajudaChave = 'projetos';
  setConteudo(`
    <div class="page-head">
      <h2>Acompanhamento — Execução de Projetos</h2>
      <p class="page-sub">Etapas de execução em campo, ordenadas por situação e prazo</p>
    </div>
    <div id="pae-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  await _prjCarregarPerfis();
  await paeCarregar();
}

async function paeCarregar() {
  const el = document.getElementById('pae-area');
  try {
    paeDados = await prjListarResumido();
    paeRender();
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function paeLinhasFlat() {
  const linhas = [];
  for (const p of paeDados) {
    for (const et of (p.projeto_exec_etapas || [])) {
      linhas.push({
        projetoId:    p.id,
        projetoTitulo:p.titulo,
        setor:        p.setor || '',
        prioridade:   p.prioridade || 'media',
        projetoStatus:p.status,
        etapaId:      et.id,
        etapaNome:    et.nome,
        etapaOrdem:   et.ordem,
        status:       et.status,
        dataInicio:   et.data_inicio || null,
        prazo:        et.data_fim || null,
        responsavelId:et.responsavel_id || null,
        pct:          prjExecCalcProgressoEtapa(et),
      });
    }
  }
  return linhas;
}

function paeEhAtrasada(l) {
  return l.prazo && l.status !== 'concluida' && l.projetoStatus !== 'cancelado' &&
    new Date(l.prazo + 'T23:59:59') < new Date();
}
function paeDiasPrazo(l) {
  if (!l.prazo) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.round((new Date(l.prazo+'T00:00:00') - hoje) / 86400000);
}
function paePesoSit(l) {
  if (l.status==='concluida') return 3;
  if (paeEhAtrasada(l)) return 0;
  if (l.status==='em_andamento') return 1;
  return 2;
}

function paeListaFiltrada() {
  let lista = paeLinhasFlat();
  if (paeStatus) {
    if (paeStatus==='atrasado') lista=lista.filter(l=>paeEhAtrasada(l));
    else if (paeStatus==='pendente') lista=lista.filter(l=>l.status==='pendente'&&!paeEhAtrasada(l));
    else lista=lista.filter(l=>l.status===paeStatus);
  }
  if (paeSetor) lista=lista.filter(l=>l.setor===paeSetor);
  if (paePrio)  lista=lista.filter(l=>l.prioridade===paePrio);
  if (paeResp)  lista=lista.filter(l=>l.responsavelId===paeResp);
  if (paeDe)    lista=lista.filter(l=>l.prazo&&l.prazo>=paeDe);
  if (paeAte)   lista=lista.filter(l=>l.prazo&&l.prazo<=paeAte);
  lista.sort((a,b)=>{
    const pa=paePesoSit(a),pb=paePesoSit(b);
    if(pa!==pb) return pa-pb;
    const da=paeDiasPrazo(a),db=paeDiasPrazo(b);
    if(da===null&&db===null) return 0;
    if(da===null) return 1; if(db===null) return -1;
    return da-db;
  });
  return lista;
}

function paeRender() {
  const el = document.getElementById('pae-area');
  const lista  = paeListaFiltrada();
  const todas  = paeLinhasFlat();
  const perfis = _prjPerfis || [];

  const base = todas.filter(l =>
    (!paeSetor||l.setor===paeSetor) && (!paePrio||l.prioridade===paePrio) && (!paeResp||l.responsavelId===paeResp));
  const cAtras = base.filter(l=>paeEhAtrasada(l)).length;
  const cAnd   = base.filter(l=>l.status==='em_andamento').length;
  const cPend  = base.filter(l=>l.status==='pendente'&&!paeEhAtrasada(l)).length;
  const cConc  = base.filter(l=>l.status==='concluida').length;

  const setores = [...new Set(paeDados.map(p=>p.setor).filter(Boolean))].sort();

  el.innerHTML = `
    <div class="ac-filtros">
      <div class="field"><label>Setor</label>
        <select onchange="paeSetor=this.value;paeRender()">
          <option value="">Todos</option>
          ${setores.map(s=>`<option value="${escHtml(s)}"${paeSetor===s?' selected':''}>${escHtml(s)}</option>`).join('')}
        </select></div>
      <div class="field"><label>Prioridade</label>
        <select onchange="paePrio=this.value;paeRender()">
          <option value="">Todas</option>
          <option value="alta"${paePrio==='alta'?' selected':''}>Alta</option>
          <option value="media"${paePrio==='media'?' selected':''}>Média</option>
          <option value="baixa"${paePrio==='baixa'?' selected':''}>Baixa</option>
        </select></div>
      <div class="field"><label>Responsável</label>
        <select onchange="paeResp=this.value;paeRender()">
          <option value="">Todos</option>
          ${perfis.map(pf=>`<option value="${pf.id}"${paeResp===pf.id?' selected':''}>${escHtml(pf.nome)}</option>`).join('')}
        </select></div>
      <div class="field"><label>Status</label>
        <select onchange="paeStatus=this.value;paeRender()">
          <option value="">Todos</option>
          <option value="atrasado"${paeStatus==='atrasado'?' selected':''}>Atrasadas</option>
          <option value="pendente"${paeStatus==='pendente'?' selected':''}>Pendentes</option>
          <option value="em_andamento"${paeStatus==='em_andamento'?' selected':''}>Em andamento</option>
          <option value="concluida"${paeStatus==='concluida'?' selected':''}>Concluídas</option>
        </select></div>
      <div class="field"><label>Data fim de</label>
        <input type="date" value="${paeDe}" onchange="paeDe=this.value;paeRender()" /></div>
      <div class="field"><label>Data fim até</label>
        <input type="date" value="${paeAte}" onchange="paeAte=this.value;paeRender()" /></div>
      <div class="field" style="align-self:flex-end">
        <button class="btn-mini" onclick="paeLimparFiltros()">Limpar filtros</button>
      </div>
    </div>

    <div class="ac-contadores">
      <span class="ac-cont ac-c-atras">${cAtras} atrasada(s)</span>
      <span class="ac-cont ac-c-and">${cAnd} em andamento</span>
      <span class="ac-cont ac-c-pend">${cPend} pendente(s)</span>
      <span class="ac-cont ac-c-conc">${cConc} concluída(s)</span>
    </div>

    <div class="contagem">${lista.length} etapa${lista.length!==1?'s':''} de execução</div>

    <div class="tabela-wrap">
      <table class="tabela ac-tabela">
        <thead><tr>
          <th>Projeto</th><th>Setor</th><th>Etapa</th>
          <th>Responsável</th><th>Início</th><th>Progresso</th><th>Prazo fim</th><th>Prio</th>
        </tr></thead>
        <tbody>
          ${lista.length ? lista.map(l => paeLinha(l, perfis)).join('') :
            '<tr><td colspan="8"><div class="empty-state"><p class="empty-title">Nenhuma etapa com esses filtros</p></div></td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function paeLinha(l, perfis) {
  const dias  = paeDiasPrazo(l);
  const atras = paeEhAtrasada(l);
  let cls = '';
  if (l.status==='concluida') cls='ac-l-conc';
  else if (atras) cls='ac-l-atras';
  else if (l.status==='em_andamento') cls='ac-l-and';
  else cls='ac-l-pend';

  let prazoCel;
  if (l.status==='concluida') prazoCel=`<span class="ac-dias ac-dias-ok">&#x2713; concluída</span>`;
  else if (dias===null) prazoCel=`<span class="ac-dias-sem">sem prazo</span>`;
  else if (dias<0) prazoCel=`<span class="ac-dias ac-dias-atras">${dias}d</span>`;
  else if (dias===0) prazoCel=`<span class="ac-dias ac-dias-hoje">hoje</span>`;
  else prazoCel=`<span class="ac-dias ac-dias-corre">+${dias}d</span>`;

  const respNome = perfis.find(p=>p.id===l.responsavelId)?.nome||'—';
  const inicioStr = l.dataInicio ? new Date(l.dataInicio+'T12:00:00').toLocaleDateString('pt-BR') : '—';

  return `
    <tr class="linha-click ${cls}" onclick="abrirFichaProjeto('${l.projetoId}','exec')">
      <td><strong style="color:var(--accent)">${escHtml(l.projetoTitulo)}</strong></td>
      <td>${escHtml(l.setor)||'—'}</td>
      <td>${escHtml(l.etapaNome)}</td>
      <td style="font-size:13px">${escHtml(respNome)}</td>
      <td class="td-mono" style="font-size:12px">${inicioStr}</td>
      <td style="min-width:100px">
        <div style="display:flex;align-items:center;gap:6px">
          <div class="prj-barra-wrap"><div class="prj-barra-fill" style="width:${l.pct.toFixed(0)}%;background:#16a34a"></div></div>
          <span style="font-family:var(--mono);font-size:11px;min-width:30px">${l.pct.toFixed(0)}%</span>
        </div>
      </td>
      <td>${prazoCel}</td>
      <td>${_prjBadgePrio(l.prioridade)}</td>
    </tr>`;
}

function paeLimparFiltros() {
  paeStatus='';paeSetor='';paePrio='';paeResp='';paeDe='';paeAte='';
  paeRender();
}
