'use strict';
// ─── projeto_ficha.js — ficha do projeto (planejamento + execução) ────

let _fichaProj     = null;
let _fichaAba      = 'plan';  // 'plan' | 'exec'
let _fichaEtapaId  = null;    // id da etapa aberta no modal
let _fichaEtapaTipo = 'plan'; // 'plan' | 'exec'

// ══════════════════════════════════════════════════════════════════════
// CARREGAMENTO
// ══════════════════════════════════════════════════════════════════════
async function abrirFichaProjeto(id, aba) {
  window._ajudaChave = 'projetos';
  if (aba) _fichaAba = aba;
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando projeto...</div>');
  try {
    await _prjCarregarPerfis();
    _fichaProj = await prjBuscar(id);
    const sess = await dbSessao();
    _fichaProj._meuAuthId = sess?.user?.id;
    _renderFicha();
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}

function _podeEditar() {
  if (PERFIL?.papel === 'gestor') return true;
  const equipe = (_fichaProj?.projeto_equipe || []).map(e => e.perfil_id);
  return equipe.includes(_fichaProj?._meuAuthId);
}

// ══════════════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
function _renderFicha() {
  const p      = _fichaProj;
  const gestor = PERFIL?.papel === 'gestor';
  const podeEditar = _podeEditar();
  const perfis = _prjPerfis || [];
  const equipeIds = (p.projeto_equipe || []).map(e => e.perfil_id);

  const etaplasPlan = p.projeto_etapas || [];
  const etapasExec  = p.projeto_exec_etapas || [];
  const pctPlan = prjCalcProgresso(etaplasPlan);
  const pctExec = prjExecCalcProgresso(etapasExec);

  const atrasado = p.status !== 'concluido' && p.status !== 'cancelado' &&
    p.prazo_final && new Date(p.prazo_final + 'T23:59:59') < new Date();

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="telaProjetos()">‹ Projetos</button>
      <div class="ficha-titulo">
        <span style="font-weight:700;font-size:17px">${escHtml(p.titulo)}</span>
        ${_prjBadgeStatus(p.status)}
        ${atrasado ? '<span class="badge-atrasada">&#9888; Atrasado</span>' : ''}
        ${_prjBadgePrio(p.prioridade)}
      </div>
      ${gestor ? `<div class="ficha-acoes">
        <button class="btn-mini" onclick="_abrirModalEditarProjeto()">Editar</button>
        <button class="btn-mini btn-mini-danger" onclick="prjAcaoExcluir('${p.id}','${escHtml(p.titulo)}')">Excluir</button>
      </div>` : ''}
    </div>

    <!-- Abas Planejamento / Execução -->
    <div class="cat-tabs" style="margin-bottom:18px">
      <button class="cat-tab ${_fichaAba==='plan'?'ativo':''}" onclick="_trocarAba('plan')">
        &#128196; Planejamento <span style="font-family:var(--mono);font-size:11px">${pctPlan.toFixed(0)}%</span>
      </button>
      <button class="cat-tab ${_fichaAba==='exec'?'ativo':''}" onclick="_trocarAba('exec')">
        &#9881; Execução <span style="font-family:var(--mono);font-size:11px">${pctExec.toFixed(0)}%</span>
      </button>
    </div>

    <div id="ficha-aba-conteudo"></div>
    <div id="prj-modal-root"></div>
    <div id="prj-etapa-modal-root"></div>
  `);

  _renderAba();
}

function _trocarAba(aba) {
  _fichaAba = aba;
  document.querySelectorAll('.cat-tab').forEach(el => {
    el.classList.toggle('ativo', el.textContent.includes(aba === 'plan' ? 'Planejamento' : 'Execução'));
  });
  _renderAba();
}

function _renderAba() {
  const el = document.getElementById('ficha-aba-conteudo');
  if (!el) return;
  if (_fichaAba === 'plan') _renderAbaPlan(el);
  else _renderAbaExec(el);
}

// ══════════════════════════════════════════════════════════════════════
// ABA PLANEJAMENTO
// ══════════════════════════════════════════════════════════════════════
function _renderAbaPlan(el) {
  const p = _fichaProj;
  const gestor = PERFIL?.papel === 'gestor';
  const podeEditar = _podeEditar();
  const perfis = _prjPerfis || [];
  const equipeIds = (p.projeto_equipe || []).map(e => e.perfil_id);
  const etapas = p.projeto_etapas || [];
  const pct = prjCalcProgresso(etapas);
  const fotosGerais = (p.projeto_fotos || []).filter(f => !f.etapa_id && !f.exec_etapa_id);

  el.innerHTML = `
    <div class="ficha-grid">
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Informações</h3>
          <div class="row2">
            <div class="field"><label>Setor</label>
              <input type="text" value="${escHtml(p.setor||'—')}" disabled /></div>
            <div class="field"><label>Prazo final</label>
              <input type="text" value="${p.prazo_final?new Date(p.prazo_final+'T12:00:00').toLocaleDateString('pt-BR'):'—'}" disabled /></div>
          </div>
          <div class="row2">
            <div class="field"><label>Status</label>
              ${podeEditar ? `<select id="fp-status">
                <option value="pendente"${p.status==='pendente'?' selected':''}>Pendente</option>
                <option value="em_andamento"${p.status==='em_andamento'?' selected':''}>Em andamento</option>
                <option value="concluido"${p.status==='concluido'?' selected':''}>Concluído</option>
                <option value="cancelado"${p.status==='cancelado'?' selected':''}>Cancelado</option>
              </select>` : `<input type="text" value="${p.status}" disabled />`}
            </div>
            <div class="field"><label>Prioridade</label>
              ${gestor ? `<select id="fp-prio">
                <option value="alta"${p.prioridade==='alta'?' selected':''}>Alta</option>
                <option value="media"${p.prioridade==='media'?' selected':''}>Média</option>
                <option value="baixa"${p.prioridade==='baixa'?' selected':''}>Baixa</option>
              </select>` : `<input type="text" value="${p.prioridade||'—'}" disabled />`}
            </div>
          </div>
          ${podeEditar ? `<button class="btn btn-sec" style="margin-top:8px" onclick="_prjSalvarInfo()">Salvar informações</button>` : ''}
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Progresso de planejamento</h3>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
            <div class="prj-barra-wrap" style="flex:1;height:14px">
              <div class="prj-barra-fill" style="width:${pct.toFixed(0)}%;height:14px;border-radius:7px"></div>
            </div>
            <span style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--accent)">${pct.toFixed(1)}%</span>
          </div>
          <p class="page-sub">${etapas.length} etapa(s) · Prazo: ${p.prazo_final?new Date(p.prazo_final+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</p>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Descrição</h3>
          ${podeEditar ? `
            <textarea id="fp-descricao" rows="4" placeholder="Escopo, objetivos e detalhes relevantes..."
              style="margin-bottom:8px">${escHtml(p.descricao||'')}</textarea>
            <button class="btn btn-sec" onclick="_prjSalvarDescricao()">Salvar descrição</button>` :
            `<p style="font-size:14px;white-space:pre-wrap">${escHtml(p.descricao||'Sem descrição.')}</p>`}
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos do projeto</h3>
          <div class="etapa-fotos" id="fp-fotos-projeto">
            ${fotosGerais.map(f => `
              <div class="etapa-foto-wrap" id="pfoto-${f.id}">
                <img src="${prjUrlFoto(f.caminho_storage)}" class="etapa-foto"
                  onclick="window.open('${prjUrlFoto(f.caminho_storage)}','_blank')" />
                ${podeEditar ? `<button class="foto-del-btn" onclick="_prjFotoProjetoExcluir('${f.id}','${f.caminho_storage}')">&#x2715;</button>` : ''}
              </div>`).join('')}
          </div>
          ${podeEditar ? `<label class="btn btn-sec" style="margin-top:10px;display:inline-block;cursor:pointer">
            + Adicionar fotos
            <input type="file" accept="image/*" multiple style="display:none" onchange="_prjFotosProjetoAdicionar(this)" />
          </label>` : ''}
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Equipe técnica</h3>
          ${gestor ? `<div class="prj-equipe-grid" id="fp-equipe">
            ${(_prjPerfis||[]).map(pf => `
              <label class="prj-check-label">
                <input type="checkbox" value="${pf.id}" ${equipeIds.includes(pf.id)?'checked':''}
                  onchange="_prjSalvarEquipe()" />
                ${escHtml(pf.nome)} <span style="color:var(--tx2);font-size:11px">(${pf.papel})</span>
              </label>`).join('')}
          </div>` : (equipeIds.length ?
            `<ul style="padding-left:18px;font-size:14px">${(p.projeto_equipe||[]).map(e=>`<li>${escHtml(e.perfis?.nome||'')}</li>`).join('')}</ul>` :
            '<p class="page-sub">Nenhum técnico.</p>')}
        </div>
      </div>

      <div class="ficha-col">
        <div class="card-sec">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 class="card-sec-titulo" style="margin:0">Etapas de Planejamento</h3>
            ${gestor ? `<button class="btn-mini" onclick="_abrirModalGerenciarEtapas('plan')">Gerenciar</button>` : ''}
          </div>
          ${etapas.length ? etapas.map(et => _renderCardEtapa(et, 'plan')).join('') :
            '<p class="page-sub">Nenhuma etapa cadastrada.</p>'}
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════
// ABA EXECUÇÃO
// ══════════════════════════════════════════════════════════════════════
function _renderAbaExec(el) {
  const p = _fichaProj;
  const gestor = PERFIL?.papel === 'gestor';
  const podeEditar = _podeEditar();
  const etapas = p.projeto_exec_etapas || [];
  const pct = prjExecCalcProgresso(etapas);

  el.innerHTML = `
    <div class="ficha-grid">
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Progresso de execução</h3>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
            <div class="prj-barra-wrap" style="flex:1;height:14px">
              <div class="prj-barra-fill" style="width:${pct.toFixed(0)}%;height:14px;border-radius:7px;background:#16a34a"></div>
            </div>
            <span style="font-family:var(--mono);font-size:18px;font-weight:700;color:#16a34a">${pct.toFixed(1)}%</span>
          </div>
          <p class="page-sub">${etapas.length} etapa(s) de execução</p>
        </div>

        <!-- Comparativo planejado x realizado -->
        <div class="card-sec">
          <h3 class="card-sec-titulo">Planejado × Realizado</h3>
          ${_renderComparativo(p)}
        </div>
      </div>

      <div class="ficha-col">
        <div class="card-sec">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 class="card-sec-titulo" style="margin:0">Etapas de Execução</h3>
            ${podeEditar ? `<button class="btn-mini" onclick="_abrirModalGerenciarEtapas('exec')">Gerenciar</button>` : ''}
          </div>
          ${etapas.length ? etapas.map(et => _renderCardEtapa(et, 'exec')).join('') :
            '<p class="page-sub">Nenhuma etapa de execução cadastrada.</p>'}
          ${podeEditar ? `<button class="btn btn-sec" style="margin-top:12px;width:100%" onclick="_execAdicionarEtapa()">+ Nova etapa de execução</button>` : ''}
        </div>
      </div>
    </div>`;
}

function _renderComparativo(p) {
  const etaplasPlan = p.projeto_etapas || [];
  const etapasExec  = p.projeto_exec_etapas || [];
  const pctPlan = prjCalcProgresso(etaplasPlan);
  const pctExec = prjExecCalcProgresso(etapasExec);
  const diff = pctExec - pctPlan;
  const diffColor = diff >= 0 ? '#16a34a' : '#dc2626';
  const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';

  return `
    <div style="display:flex;gap:24px;margin-bottom:14px">
      <div style="flex:1;text-align:center">
        <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:var(--accent)">${pctPlan.toFixed(0)}%</div>
        <div style="font-size:12px;color:var(--tx2);margin-top:4px">Planejamento</div>
      </div>
      <div style="flex:1;text-align:center">
        <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:#16a34a">${pctExec.toFixed(0)}%</div>
        <div style="font-size:12px;color:var(--tx2);margin-top:4px">Execução</div>
      </div>
      <div style="flex:1;text-align:center">
        <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:${diffColor}">${diffStr}</div>
        <div style="font-size:12px;color:var(--tx2);margin-top:4px">Variação</div>
      </div>
    </div>
    <div style="margin-bottom:6px">
      <div style="font-size:11px;color:var(--tx2);margin-bottom:3px">Planejamento</div>
      <div class="prj-barra-wrap" style="height:10px">
        <div class="prj-barra-fill" style="width:${pctPlan.toFixed(0)}%;height:10px;border-radius:5px"></div>
      </div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:3px">Execução</div>
      <div class="prj-barra-wrap" style="height:10px">
        <div class="prj-barra-fill" style="width:${pctExec.toFixed(0)}%;height:10px;border-radius:5px;background:#16a34a"></div>
      </div>
    </div>`;
}

function _renderCardEtapa(et, tipo) {
  const checkKey = tipo === 'exec' ? 'projeto_exec_checklist' : 'projeto_checklist';
  const calcFn   = tipo === 'exec' ? prjExecCalcProgressoEtapa : prjCalcProgressoEtapa;
  const pEt = calcFn(et);
  const prazoField = tipo === 'exec' ? et.data_fim : et.prazo;
  const atras = prazoField && et.status !== 'concluida' &&
    new Date(prazoField + 'T23:59:59') < new Date();
  const perfis = _prjPerfis || [];
  const resp = perfis.find(pf => pf.id === et.responsavel_id);

  return `
    <div class="prj-etapa-card ${atras?'prj-et-atras':''}" onclick="abrirModalEtapa('${et.id}','${tipo}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <span class="prj-et-nome">${escHtml(et.nome)}</span>
          ${et.fixo?'<span style="font-size:10px;color:var(--tx2);margin-left:6px">marco final</span>':''}
          ${atras?'<span class="badge-atrasada" style="margin-left:6px">Atrasada</span>':''}
        </div>
        <span class="badge-etapa ${et.status}">${_prjNomeStatus(et.status)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
        <div class="prj-barra-wrap" style="flex:1">
          <div class="prj-barra-fill" style="width:${pEt.toFixed(0)}%;${tipo==='exec'?'background:#16a34a':''}"></div>
        </div>
        <span style="font-family:var(--mono);font-size:12px;min-width:34px">${pEt.toFixed(0)}%</span>
      </div>
      <div style="display:flex;gap:14px;margin-top:6px;font-size:12px;color:var(--tx2)">
        ${tipo==='exec' && et.data_inicio ? `<span>&#128197; início: ${new Date(et.data_inicio+'T12:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
        ${prazoField ? `<span>&#128198; fim: ${new Date(prazoField+'T12:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
        ${resp ? `<span>&#128100; ${escHtml(resp.nome)}</span>` : ''}
        <span style="color:var(--accent)">&#8599; abrir</span>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════
// MODAL DE ETAPA (planejamento e execução)
// ══════════════════════════════════════════════════════════════════════
async function abrirModalEtapa(etapaId, tipo) {
  _fichaEtapaId   = etapaId;
  _fichaEtapaTipo = tipo || 'plan';
  await _renderModalEtapa();
}

function _getEtapaAtual() {
  const lista = _fichaEtapaTipo === 'exec'
    ? (_fichaProj?.projeto_exec_etapas || [])
    : (_fichaProj?.projeto_etapas || []);
  return lista.find(e => e.id === _fichaEtapaId);
}

async function _renderModalEtapa() {
  const etapa = _getEtapaAtual();
  if (!etapa) return;
  const tipo = _fichaEtapaTipo;
  const p = _fichaProj;
  const gestor = PERFIL?.papel === 'gestor';
  const podeEditar = _podeEditar();
  const perfis = _prjPerfis || [];

  const checkKey   = tipo === 'exec' ? 'projeto_exec_checklist'  : 'projeto_checklist';
  const comentKey  = tipo === 'exec' ? 'projeto_exec_comentarios': 'projeto_comentarios';
  // fotos: exec usa projeto_fotos filtrado por exec_etapa_id; plan usa etapa.projeto_fotos
  const calcFn     = tipo === 'exec' ? prjExecCalcProgressoEtapa : prjCalcProgressoEtapa;

  const check  = (etapa[checkKey]  || []).sort((a,b) => a.id>b.id?1:-1);
  const coments= (etapa[comentKey] || []).sort((a,b) => a.criado_em>b.criado_em?1:-1);
  const fotos = tipo === 'exec'
    ? (_fichaProj?.projeto_fotos||[]).filter(f => f.exec_etapa_id === etapa.id)
    : (etapa.projeto_fotos || []);
  const pEt    = calcFn(etapa);
  const pesoTotalCheck = check.reduce((s,c)=>s+(c.peso||1),0);

  const itensPendentes = check.filter(c => !c.concluido).length;

  document.getElementById('prj-etapa-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)fecharModalEtapa()">
      <div class="prj-modal prj-etapa-modal">
        <div class="prj-modal-head">
          <div>
            <h3>${escHtml(etapa.nome)}</h3>
            <span style="font-size:11px;color:var(--tx2)">${tipo==='exec'?'Execução':'Planejamento'}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-family:var(--mono);font-size:13px;color:${tipo==='exec'?'#16a34a':'var(--accent)'}">${pEt.toFixed(0)}%</span>
            <button class="btn-mini" onclick="fecharModalEtapa()">&#x2715;</button>
          </div>
        </div>

        <!-- Controle -->
        <div class="card-sec" style="margin-bottom:14px">
          <h3 class="card-sec-titulo">Controle</h3>
          ${tipo === 'exec' ? `
          <div class="row2" style="margin-bottom:10px">
            <div class="field"><label>Data início</label>
              <input id="met-inicio" type="date" value="${etapa.data_inicio||''}" ${podeEditar?'':'disabled'} /></div>
            <div class="field"><label>Data fim</label>
              <input id="met-fim" type="date" value="${etapa.data_fim||''}" ${podeEditar?'':'disabled'} /></div>
          </div>` : `
          <div class="field" style="max-width:200px;margin-bottom:10px"><label>Prazo</label>
            <input id="met-prazo" type="date" value="${etapa.prazo||''}" ${gestor?'':'disabled'} /></div>`}
          <div class="row2">
            <div class="field"><label>Status</label>
              ${podeEditar ? `<select id="met-status">
                <option value="pendente"${etapa.status==='pendente'?' selected':''}>Pendente</option>
                <option value="em_andamento"${etapa.status==='em_andamento'?' selected':''}>Em andamento</option>
                <option value="concluida"${etapa.status==='concluida'?' selected':''}>Concluída</option>
              </select>` : `<input type="text" value="${_prjNomeStatus(etapa.status)}" disabled />`}
            </div>
            <div class="field"><label>Responsável</label>
              ${gestor ? `<select id="met-resp">
                <option value="">— selecione —</option>
                ${perfis.map(pf=>`<option value="${pf.id}"${etapa.responsavel_id===pf.id?' selected':''}>${escHtml(pf.nome)}</option>`).join('')}
              </select>` : `<input type="text" value="${escHtml(perfis.find(pf=>pf.id===etapa.responsavel_id)?.nome||'—')}" disabled />`}
            </div>
          </div>
          ${etapa.concluido_em ? `<p class="page-sub">Concluída em ${new Date(etapa.concluido_em).toLocaleString('pt-BR')}</p>` : ''}
          ${podeEditar ? `
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
            <button class="btn" onclick="_etapaSalvar()">Salvar alterações</button>
            <span id="met-salvo" style="font-size:12px;color:#16a34a;display:none">&#10003; Salvo</span>
          </div>` : ''}
          ${itensPendentes > 0 && podeEditar ? `
          <p class="page-sub" style="margin-top:8px;color:var(--warn)">
            &#9888; ${itensPendentes} item(ns) do checklist ainda pendente(s)
          </p>` : ''}
        </div>

        <!-- Checklist -->
        <div class="card-sec" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 class="card-sec-titulo" style="margin:0">Checklist
              <span style="font-family:var(--mono);font-size:12px;color:var(--tx2);margin-left:8px">
                ${check.filter(c=>c.concluido).length}/${check.length} · Peso total: ${pesoTotalCheck}
              </span>
            </h3>
            ${podeEditar ? `<button class="btn-mini" onclick="_checkAdicionar('${etapa.id}','${tipo}')">+ Item</button>` : ''}
          </div>
          <div id="met-check-lista">
            ${check.length === 0 ? `<p class="page-sub">Nenhum item.</p>` :
              check.map(c => `
              <div class="prj-check-item" id="ci-${c.id}">
                <label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer">
                  <input type="checkbox" ${c.concluido?'checked':''} ${podeEditar?'':'disabled'}
                    onchange="_checkMarcar('${c.id}',this.checked,'${tipo}')" />
                  <span style="${c.concluido?'text-decoration:line-through;color:var(--tx2)':''}">${escHtml(c.descricao)}</span>
                </label>
                <span class="prj-check-peso">Peso ${c.peso||1}</span>
                ${podeEditar ? `<button class="btn-mini btn-mini-danger" style="padding:2px 7px" onclick="_checkExcluir('${c.id}','${tipo}')">&#x2715;</button>` : ''}
              </div>`).join('')}
          </div>
        </div>

        <!-- Comentários -->
        <div class="card-sec" style="margin-bottom:14px">
          <h3 class="card-sec-titulo">Comentários</h3>
          <div id="met-coments" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
            ${coments.length === 0 ? `<p class="page-sub">Sem comentários.</p>` :
              coments.map(c => {
                const autorNome = (_prjPerfis||[]).find(pf=>pf.id===c.autor_id)?.nome||'';
                return `<div class="prj-coment" id="comt-${c.id}">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <span style="font-size:12px;font-weight:600">${escHtml(autorNome)}</span>
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-size:11px;color:var(--tx2)">${new Date(c.criado_em).toLocaleString('pt-BR')}</span>
                      ${gestor?`<button class="btn-mini btn-mini-danger" style="padding:2px 6px" onclick="_comentExcluir('${c.id}','${tipo}')">&#x2715;</button>`:''}
                    </div>
                  </div>
                  <p style="margin-top:4px;font-size:14px;white-space:pre-wrap">${escHtml(c.texto)}</p>
                </div>`;
              }).join('')}
          </div>
          ${podeEditar ? `
          <textarea id="met-novo-coment" rows="2" placeholder="Adicionar comentário..." style="margin-bottom:8px"></textarea>
          <button class="btn btn-sec" onclick="_comentAdicionar('${etapa.id}','${tipo}')">Enviar comentário</button>` : ''}
        </div>

        <!-- Fotos -->
        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos</h3>
          <div class="etapa-fotos" id="met-fotos">
            ${fotos.map(f => `
              <div class="etapa-foto-wrap" id="fw-${f.id}">
                <img src="${prjUrlFoto(f.caminho_storage)}" class="etapa-foto"
                  onclick="window.open('${prjUrlFoto(f.caminho_storage)}','_blank')" />
                ${podeEditar ? `<button class="foto-del-btn" onclick="_fotoExcluir('${f.id}','${f.caminho_storage}')">&#x2715;</button>` : ''}
              </div>`).join('')}
          </div>
          ${podeEditar ? `
          <label class="btn btn-sec" style="margin-top:10px;display:inline-block;cursor:pointer">
            + Adicionar fotos
            <input type="file" accept="image/*" multiple style="display:none"
              onchange="_fotosAdicionar('${p.id}','${etapa.id}',this,'${tipo}')" />
          </label>` : ''}
        </div>
      </div>
    </div>`;
}

function fecharModalEtapa() {
  document.getElementById('prj-etapa-modal-root').innerHTML = '';
  _fichaEtapaId = null;
}

// ── Salvar controle da etapa (com lógica status ↔ checklist) ──
async function _etapaSalvar() {
  const etapa = _getEtapaAtual();
  if (!etapa) return;
  const tipo = _fichaEtapaTipo;
  const isExec = tipo === 'exec';

  const status = document.getElementById('met-status')?.value || etapa.status;
  const resp   = document.getElementById('met-resp')?.value   || null;
  const campos = { status, responsavel_id: resp || null };

  if (isExec) {
    campos.data_inicio = document.getElementById('met-inicio')?.value || null;
    campos.data_fim    = document.getElementById('met-fim')?.value    || null;
  } else {
    campos.prazo = document.getElementById('met-prazo')?.value || null;
  }

  // Status → concluida: verificar checklist pendente
  const checkKey = isExec ? 'projeto_exec_checklist' : 'projeto_checklist';
  const check = etapa[checkKey] || [];
  const pendentes = check.filter(c => !c.concluido);

  if (status === 'concluida' && pendentes.length > 0) {
    if (!confirm(`${pendentes.length} item(ns) do checklist ainda pendente(s).\nTodos serão marcados como concluídos. Confirmar?`)) return;
    // Marca todos os pendentes
    for (const item of pendentes) {
      const fn = isExec ? prjExecCheckMarcar : prjCheckMarcar;
      await fn(item.id, true);
      item.concluido = true;
    }
  }

  if (status === 'concluida' && !etapa.concluido_em) {
    campos.concluido_em = new Date().toISOString();
  }
  if (status !== 'concluida') campos.concluido_em = null;

  try {
    const fn = isExec ? prjExecEtapaAtualizar : prjEtapaAtualizar;
    await fn(etapa.id, campos);
    Object.assign(etapa, campos);
    const msg = document.getElementById('met-salvo');
    if (msg) { msg.style.display = ''; setTimeout(() => msg.style.display = 'none', 2000); }
    // Re-render do card na ficha (atualiza %)
    _renderAba();
    // Mantém modal aberto — re-renderiza para atualizar checklist visual
    await _renderModalEtapa();
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

// ── Checklist ──
async function _checkAdicionar(etapaId, tipo) {
  const desc = prompt('Descrição do item:');
  if (!desc?.trim()) return;
  const pesoStr = prompt('Peso do item (ex: 1, 2, 3):', '1');
  const peso = parseInt(pesoStr) || 1;
  const isExec = tipo === 'exec';
  const tabela = isExec ? 'projeto_exec_checklist' : 'projeto_checklist';
  const fn = isExec ? prjExecCheckCriar : prjCheckCriar;
  try {
    const novo = await fn({ etapa_id: etapaId, descricao: desc.trim(), peso });
    const etapa = _getEtapaAtual();
    const checkKey = isExec ? 'projeto_exec_checklist' : 'projeto_checklist';
    if (etapa) { etapa[checkKey] = etapa[checkKey] || []; etapa[checkKey].push(novo); }
    await _renderModalEtapa();
  } catch (e) { alert('Erro: ' + e.message); }
}

async function _checkMarcar(id, concluido, tipo) {
  const isExec = tipo === 'exec';
  const fn = isExec ? prjExecCheckMarcar : prjCheckMarcar;
  try {
    await fn(id, concluido);
    const etapa = _getEtapaAtual();
    const checkKey = isExec ? 'projeto_exec_checklist' : 'projeto_checklist';
    const calcFn   = isExec ? prjExecCalcProgressoEtapa : prjCalcProgressoEtapa;
    if (etapa) {
      const item = (etapa[checkKey]||[]).find(c=>c.id===id);
      if (item) { item.concluido = concluido; }
    }

    // Atualiza visual do item
    const span = document.querySelector(`#ci-${id} label span`);
    if (span) span.style = concluido ? 'text-decoration:line-through;color:var(--tx2)' : '';

    // Atualiza % no header
    const pEt = etapa ? calcFn(etapa) : 0;
    const pctEl = document.querySelector('.prj-etapa-modal .prj-modal-head span');
    if (pctEl) pctEl.textContent = pEt.toFixed(0) + '%';

    // Verifica se todos concluídos → sugere marcar etapa como concluída
    const check = etapa?.[checkKey] || [];
    if (concluido && check.length > 0 && check.every(c => c.concluido) && etapa.status !== 'concluida') {
      if (confirm('Todos os itens do checklist foram concluídos!\nDeseja marcar a etapa como "Concluída"?')) {
        document.getElementById('met-status').value = 'concluida';
        await _etapaSalvar();
      }
    }
  } catch (e) { alert('Erro: ' + e.message); }
}

async function _checkExcluir(id, tipo) {
  if (!confirm('Excluir este item?')) return;
  const isExec = tipo === 'exec';
  const fn = isExec ? prjExecCheckExcluir : prjCheckExcluir;
  const checkKey = isExec ? 'projeto_exec_checklist' : 'projeto_checklist';
  try {
    await fn(id);
    const etapa = _getEtapaAtual();
    if (etapa) etapa[checkKey] = (etapa[checkKey]||[]).filter(c=>c.id!==id);
    document.getElementById('ci-'+id)?.remove();
  } catch (e) { alert('Erro: ' + e.message); }
}

// ── Comentários ──
async function _comentAdicionar(etapaId, tipo) {
  const txt = document.getElementById('met-novo-coment')?.value.trim();
  if (!txt) return;
  const isExec = tipo === 'exec';
  const fn = isExec ? prjExecComentarioCriar : prjComentarioCriar;
  const comentKey = isExec ? 'projeto_exec_comentarios' : 'projeto_comentarios';
  try {
    const novo = await fn(etapaId, txt);
    const etapa = _getEtapaAtual();
    if (etapa) { etapa[comentKey] = etapa[comentKey]||[]; etapa[comentKey].push(novo); }
    document.getElementById('met-novo-coment').value = '';
    const lista = document.getElementById('met-coments');
    if (lista) {
      if (lista.querySelector('.page-sub')) lista.innerHTML = '';
      lista.insertAdjacentHTML('beforeend', `
        <div class="prj-coment" id="comt-${novo.id}">
          <div style="display:flex;justify-content:space-between">
            <span style="font-size:12px;font-weight:600">${escHtml(PERFIL?.nome||'')}</span>
            <span style="font-size:11px;color:var(--tx2)">${new Date(novo.criado_em).toLocaleString('pt-BR')}</span>
          </div>
          <p style="margin-top:4px;font-size:14px;white-space:pre-wrap">${escHtml(novo.texto)}</p>
        </div>`);
    }
  } catch (e) { alert('Erro: ' + e.message); }
}

async function _comentExcluir(id, tipo) {
  if (!confirm('Excluir comentário?')) return;
  const fn = tipo === 'exec' ? prjExecComentarioExcluir : prjComentarioExcluir;
  const comentKey = tipo === 'exec' ? 'projeto_exec_comentarios' : 'projeto_comentarios';
  try {
    await fn(id);
    const etapa = _getEtapaAtual();
    if (etapa) etapa[comentKey] = (etapa[comentKey]||[]).filter(c=>c.id!==id);
    document.getElementById('comt-'+id)?.remove();
  } catch (e) { alert('Erro: ' + e.message); }
}

// ── Fotos ──
async function _fotosAdicionar(projetoId, etapaId, input, tipo) {
  const files = [...input.files];
  if (!files.length) return;
  input.parentElement.childNodes[0].textContent = ' Enviando...';
  try {
    for (const file of files) {
      const blob = await _prjComprimirFoto(file);
      if (tipo === 'exec') await prjUploadFoto(projetoId, null, blob, etapaId);
      else await prjUploadFoto(projetoId, etapaId, blob, null);
    }
    _fichaProj = await prjBuscar(projetoId);
    await _renderModalEtapa();
  } catch (e) { alert('Erro ao enviar foto: ' + e.message); }
}

async function _fotoExcluir(id, caminho) {
  if (!confirm('Excluir esta foto?')) return;
  const tipo = _fichaEtapaTipo;
  // fotos exec em projeto_fotos por exec_etapa_id
  try {
    await prjFotoExcluir(id, caminho);
    const etapa = _getEtapaAtual();
  if (tipo === 'exec') {
    if (_fichaProj?.projeto_fotos) _fichaProj.projeto_fotos = _fichaProj.projeto_fotos.filter(f=>f.id!==id);
  } else {
    if (etapa) etapa.projeto_fotos = (etapa.projeto_fotos||[]).filter(f=>f.id!==id);
  }
    document.getElementById('fw-'+id)?.remove();
  } catch (e) { alert('Erro: ' + e.message); }
}

async function _prjComprimirFoto(file) {
  return new Promise(res => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX=1200; let w=img.width,h=img.height;
      if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(b=>{URL.revokeObjectURL(url);res(b);},'image/jpeg',0.82);
    };
    img.src=url;
  });
}

// ── Fotos gerais do projeto ──
async function _prjFotosProjetoAdicionar(input) {
  const files = [...input.files]; if (!files.length) return;
  input.parentElement.childNodes[0].textContent = ' Enviando...';
  try {
    for (const file of files) { const blob = await _prjComprimirFoto(file); await prjUploadFoto(_fichaProj.id, null, blob, null); }
    _fichaProj = await prjBuscar(_fichaProj.id); _renderFicha();
  } catch (e) { alert('Erro: ' + e.message); }
}
async function _prjFotoProjetoExcluir(id, caminho) {
  if (!confirm('Excluir esta foto?')) return;
  try {
    await prjFotoExcluir(id, caminho);
    if (_fichaProj.projeto_fotos) _fichaProj.projeto_fotos = _fichaProj.projeto_fotos.filter(f=>f.id!==id);
    document.getElementById('pfoto-'+id)?.remove();
  } catch(e) { alert('Erro: '+e.message); }
}

// ── Salvar info geral ──
async function _prjSalvarInfo() {
  const status = document.getElementById('fp-status')?.value;
  const prio   = document.getElementById('fp-prio')?.value;
  const campos = {};
  if (status) campos.status = status;
  if (prio)   campos.prioridade = prio;
  try {
    await prjAtualizar(_fichaProj.id, campos);
    Object.assign(_fichaProj, campos);
    _mostrarFeedback('Informações salvas');
  } catch(e) { alert('Erro: '+e.message); }
}

async function _prjSalvarDescricao() {
  const txt = document.getElementById('fp-descricao')?.value ?? '';
  try {
    await prjAtualizar(_fichaProj.id, { descricao: txt });
    _fichaProj.descricao = txt;
    _mostrarFeedback('Descrição salva');
  } catch(e) { alert('Erro: '+e.message); }
}

async function _prjSalvarEquipe() {
  const ids = [...document.querySelectorAll('#fp-equipe input:checked')].map(el => el.value);
  try { await prjEquipeDefinir(_fichaProj.id, ids); }
  catch(e) { alert('Erro ao salvar equipe: '+e.message); }
}

function _mostrarFeedback(msg) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#166534;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:200;box-shadow:0 4px 12px rgba(0,0,0,0.2)';
  el.textContent = '✓ ' + msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ── Nova etapa execução ──
async function _execAdicionarEtapa() {
  const nome = prompt('Nome da nova etapa de execução:');
  if (!nome?.trim()) return;
  const etapas = _fichaProj.projeto_exec_etapas || [];
  const ordem = Math.max(...etapas.map(e => e.ordem), 0) + 1;
  try {
    await prjExecEtapaCriar({ projeto_id: _fichaProj.id, nome: nome.trim(), ordem, peso_projeto: 1, status: 'pendente' });
    _fichaProj = await prjBuscar(_fichaProj.id);
    _renderFicha(); _trocarAba('exec');
  } catch(e) { alert('Erro: '+e.message); }
}

// ── Modal gerenciar etapas (plan e exec) ──
function _abrirModalGerenciarEtapas(tipo) {
  const etapas = tipo === 'exec' ? (_fichaProj.projeto_exec_etapas||[]) : (_fichaProj.projeto_etapas||[]);
  document.getElementById('prj-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)_fecharModalGerenciar()">
      <div class="prj-modal" style="max-width:620px">
        <div class="prj-modal-head">
          <h3>Gerenciar Etapas — ${tipo==='exec'?'Execução':'Planejamento'}</h3>
          <button class="btn-mini" onclick="_fecharModalGerenciar()">&#x2715;</button>
        </div>
        <p class="page-sub" style="margin-bottom:12px">Salve cada linha individualmente.</p>
        <div id="ged-lista">
          ${etapas.map(et => `
            <div class="prj-etapa-row" id="ged-row-${et.id}">
              <span class="prj-etapa-ord">${et.ordem}</span>
              <input type="text" value="${escHtml(et.nome)}" id="ged-nome-${et.id}" style="flex:2" ${et.fixo?'disabled':''} />
              ${tipo==='exec' ? `
                <input type="date" value="${et.data_inicio||''}" id="ged-ini-${et.id}" style="flex:1" title="Início" />
                <input type="date" value="${et.data_fim||''}" id="ged-fim-${et.id}" style="flex:1" title="Fim" />
              ` : `
                <input type="date" value="${et.prazo||''}" id="ged-prazo-${et.id}" style="flex:1" title="Prazo" />
              `}
              <div style="display:flex;align-items:center;gap:4px;flex:0 0 80px">
                <span style="font-size:11px;color:var(--tx2)">Peso</span>
                <input type="number" min="1" max="99" value="${et.peso_projeto||1}" id="ged-peso-${et.id}" style="width:48px;padding:6px 8px" />
              </div>
              <button class="btn-mini" onclick="_gedSalvarEtapa('${et.id}','${tipo}')">&#128190;</button>
              ${!et.fixo ? `<button class="btn-mini btn-mini-danger" onclick="_gedExcluirEtapa('${et.id}','${tipo}','${escHtml(et.nome)}')">&#x2715;</button>` : '<span style="width:50px"></span>'}
            </div>`).join('')}
        </div>
        <button class="btn btn-sec" style="margin-top:12px" onclick="_gedAdicionarEtapa('${tipo}')">+ Adicionar etapa</button>
        <div style="display:flex;justify-content:flex-end;margin-top:18px">
          <button class="btn" onclick="_fecharModalGerenciar()">Fechar</button>
        </div>
      </div>
    </div>`;
}

function _fecharModalGerenciar() {
  document.getElementById('prj-modal-root').innerHTML = '';
  abrirFichaProjeto(_fichaProj.id, _fichaAba);
}

async function _gedSalvarEtapa(id, tipo) {
  const nome  = document.getElementById('ged-nome-'+id)?.value.trim();
  const peso  = +(document.getElementById('ged-peso-'+id)?.value)||1;
  if (!nome) { alert('Informe o nome.'); return; }
  const campos = { nome, peso_projeto: peso };
  if (tipo === 'exec') {
    campos.data_inicio = document.getElementById('ged-ini-'+id)?.value || null;
    campos.data_fim    = document.getElementById('ged-fim-'+id)?.value || null;
  } else {
    campos.prazo = document.getElementById('ged-prazo-'+id)?.value || null;
  }
  try {
    const fn = tipo === 'exec' ? prjExecEtapaAtualizar : prjEtapaAtualizar;
    await fn(id, campos);
    const btn = document.querySelector(`#ged-row-${id} button`);
    if (btn) { btn.textContent='✓'; setTimeout(()=>btn.textContent='💾',1200); }
  } catch(e) { alert('Erro: '+e.message); }
}

async function _gedExcluirEtapa(id, tipo, nome) {
  if (!confirm(`Excluir etapa "${nome}"?`)) return;
  const fn = tipo === 'exec' ? prjExecEtapaExcluir : prjEtapaExcluir;
  try { await fn(id); document.getElementById('ged-row-'+id)?.remove(); }
  catch(e) { alert('Erro: '+e.message); }
}

async function _gedAdicionarEtapa(tipo) {
  const etapas = tipo==='exec' ? (_fichaProj.projeto_exec_etapas||[]) : (_fichaProj.projeto_etapas||[]);
  const conclusao = etapas.find(e=>e.fixo);
  const ordem = conclusao ? conclusao.ordem : Math.max(...etapas.map(e=>e.ordem),0)+1;
  if (conclusao) {
    const fn = tipo==='exec' ? prjExecEtapaAtualizar : prjEtapaAtualizar;
    await fn(conclusao.id, {ordem: ordem+1});
  }
  const fn = tipo==='exec' ? prjExecEtapaCriar : prjEtapaCriar;
  try {
    await fn({ projeto_id:_fichaProj.id, nome:'Nova etapa', ordem, peso_projeto:1, status:'pendente' });
    _fichaProj = await prjBuscar(_fichaProj.id);
    _abrirModalGerenciarEtapas(tipo);
  } catch(e) { alert('Erro: '+e.message); }
}

// ── Modal editar projeto ──
function _abrirModalEditarProjeto() {
  const p = _fichaProj;
  document.getElementById('prj-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)_fecharModalEditarProjeto()">
      <div class="prj-modal" style="max-width:500px">
        <div class="prj-modal-head">
          <h3>Editar Projeto</h3>
          <button class="btn-mini" onclick="_fecharModalEditarProjeto()">&#x2715;</button>
        </div>
        <div class="field"><label>Título *</label>
          <input id="ep-titulo" type="text" maxlength="120" value="${escHtml(p.titulo)}" /></div>
        <div class="row2">
          <div class="field"><label>Setor</label>
            <select id="ep-setor">
              <option value="">— selecione —</option>
              ${SETORES_PROJETOS.map(s=>`<option value="${s}"${p.setor===s?' selected':''}>${s}</option>`).join('')}
            </select></div>
          <div class="field"><label>Prazo final</label>
            <input id="ep-prazo" type="date" value="${p.prazo_final||''}" /></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button class="btn btn-sec" onclick="_fecharModalEditarProjeto()">Cancelar</button>
          <button class="btn" onclick="_prjSalvarEdicao()">Salvar</button>
        </div>
      </div>
    </div>`;
}
function _fecharModalEditarProjeto() { document.getElementById('prj-modal-root').innerHTML=''; }
async function _prjSalvarEdicao() {
  const titulo = document.getElementById('ep-titulo').value.trim();
  if (!titulo) { alert('Informe o título.'); return; }
  const prazo = document.getElementById('ep-prazo').value;
  const setor  = document.getElementById('ep-setor').value;
  try {
    await prjAtualizar(_fichaProj.id, { titulo, setor:setor||null, prazo_final:prazo||null });
    _fecharModalEditarProjeto();
    _fichaProj = await prjBuscar(_fichaProj.id);
    _renderFicha();
  } catch(e) { alert('Erro: '+e.message); }
}

function _prjNomeStatus(s) {
  return {pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída',cancelada:'Cancelada'}[s]||s;
}
