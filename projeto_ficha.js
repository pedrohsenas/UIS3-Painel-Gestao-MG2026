'use strict';
// ─── projeto_ficha.js — ficha do projeto + modal de etapa ─────────────

let _fichaProj = null;      // projeto completo carregado
let _fichaProjEtapaId = null; // etapa aberta no modal

// ──────────────────────────────────────────────────────────────────────
// FICHA DO PROJETO
// ──────────────────────────────────────────────────────────────────────
async function abrirFichaProjeto(id) {
  window._ajudaChave = 'projetos';
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando projeto...</div>');
  try {
    await _prjCarregarPerfis();
    _fichaProj = await prjBuscar(id);
    _renderFichaProjeto();
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}

function _podeCriarProjeto() {
  return PERFIL?.papel === 'gestor';
}

function _podeEditarProjeto() {
  if (PERFIL?.papel === 'gestor') return true;
  if (!_fichaProj) return false;
  const equipe = (_fichaProj.projeto_equipe || []).map(e => e.perfil_id);
  const sess = _fichaProj._meuId; // definido abaixo no carregamento
  // fallback: compara por nome (pois PERFIL.id vem de auth)
  return equipe.includes(_fichaProj._meuAuthId);
}

async function _prjCarregarMeuId() {
  const sess = await dbSessao();
  if (_fichaProj) _fichaProj._meuAuthId = sess?.user?.id;
}

function _renderFichaProjeto() {
  const p      = _fichaProj;
  const gestor = PERFIL?.papel === 'gestor';
  const equipeIds = (p.projeto_equipe || []).map(e => e.perfil_id);
  const podeEditar = gestor || equipeIds.includes(p._meuAuthId);
  const etapas = p.projeto_etapas || [];
  const pct    = prjCalcProgresso(etapas);
  const perfis = _prjPerfis || [];

  // Status geral atrasado?
  const atrasado = p.status !== 'concluido' && p.status !== 'cancelado' &&
    p.prazo_final && new Date(p.prazo_final + 'T23:59:59') < new Date();

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="telaProjetos()">‹ Projetos</button>
      <div class="ficha-titulo">
        <span style="font-weight:700;font-size:17px">${escHtml(p.titulo)}</span>
        ${_prjBadgeStatus(p.status)}
        ${atrasado ? '<span class="badge-atrasada">⚠ Atrasado</span>' : ''}
        ${_prjBadgePrio(p.prioridade)}
      </div>
      ${gestor ? `<div class="ficha-acoes">
        <button class="btn-mini" onclick="_abrirModalEditarProjeto()">Editar</button>
        <button class="btn-mini btn-mini-danger" onclick="prjAcaoExcluir('${p.id}','${escHtml(p.titulo)}')">Excluir</button>
      </div>` : ''}
    </div>

    <div class="ficha-grid">
      <!-- Coluna esquerda: dados + equipe -->
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Informações</h3>
          <div class="row2">
            <div class="field"><label>Setor</label>
              <input type="text" value="${escHtml(p.setor || '—')}" disabled /></div>
            <div class="field"><label>Prazo final</label>
              <input type="text" value="${p.prazo_final ? new Date(p.prazo_final+'T12:00:00').toLocaleDateString('pt-BR') : '—'}" disabled /></div>
          </div>
          <div class="row2">
            <div class="field"><label>Status</label>
              ${podeEditar ? `
              <select id="fp-status" onchange="_prjSalvarCampo('status',this.value)">
                <option value="pendente"${p.status==='pendente'?' selected':''}>Pendente</option>
                <option value="em_andamento"${p.status==='em_andamento'?' selected':''}>Em andamento</option>
                <option value="concluido"${p.status==='concluido'?' selected':''}>Concluído</option>
                <option value="cancelado"${p.status==='cancelado'?' selected':''}>Cancelado</option>
              </select>` :
              `<input type="text" value="${p.status}" disabled />`}
            </div>
            <div class="field"><label>Prioridade</label>
              ${gestor ? `
              <select id="fp-prio" onchange="_prjSalvarCampo('prioridade',this.value)">
                <option value="alta"${p.prioridade==='alta'?' selected':''}>Alta</option>
                <option value="media"${p.prioridade==='media'?' selected':''}>Média</option>
                <option value="baixa"${p.prioridade==='baixa'?' selected':''}>Baixa</option>
              </select>` :
              `<input type="text" value="${p.prioridade || '—'}" disabled />`}
            </div>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Progresso geral</h3>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
            <div class="prj-barra-wrap" style="flex:1;height:14px">
              <div class="prj-barra-fill" style="width:${pct.toFixed(0)}%;height:14px;border-radius:7px"></div>
            </div>
            <span style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--accent)">${pct.toFixed(1)}%</span>
          </div>
          <p class="page-sub">${etapas.length} etapa(s) · Prazo final: ${p.prazo_final ? new Date(p.prazo_final+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</p>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Descrição</h3>
          ${podeEditar ? `
          <textarea id="fp-descricao" rows="4" placeholder="Descreva o escopo, objetivos e detalhes relevantes do projeto..."
            style="margin-bottom:8px">${escHtml(p.descricao||'')}</textarea>
          <button class="btn-mini" onclick="_prjSalvarDescricao()">Salvar descrição</button>` :
          `<p style="font-size:14px;white-space:pre-wrap;color:var(--tx1)">${escHtml(p.descricao||'Sem descrição cadastrada.')}</p>`}
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos do projeto</h3>
          <div class="etapa-fotos" id="fp-fotos-projeto">
            ${(p.projeto_fotos||[]).filter(f=>!f.etapa_id).map(f => `
              <div class="etapa-foto-wrap" id="pfoto-${f.id}">
                <img src="${prjUrlFoto(f.caminho_storage)}" class="etapa-foto"
                  onclick="window.open('${prjUrlFoto(f.caminho_storage)}','_blank')" />
                ${podeEditar ? `<button class="foto-del-btn" onclick="_prjFotoProjetoExcluir('${f.id}','${f.caminho_storage}')">&#x2715;</button>` : ''}
              </div>`).join('')}
          </div>
          ${podeEditar ? `
          <label class="btn btn-sec" style="margin-top:10px;display:inline-block;cursor:pointer">
            + Adicionar fotos
            <input type="file" accept="image/*" multiple style="display:none"
              onchange="_prjFotosProjetoAdicionar(this)" />
          </label>` : ''}
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Equipe técnica</h3>
          ${gestor ? `
          <div class="prj-equipe-grid" id="fp-equipe">
            ${perfis.map(pf => `
              <label class="prj-check-label">
                <input type="checkbox" value="${pf.id}" ${equipeIds.includes(pf.id)?'checked':''}
                  onchange="_prjSalvarEquipe()" />
                ${escHtml(pf.nome)} <span style="color:var(--tx2);font-size:11px">(${pf.papel})</span>
              </label>`).join('')}
          </div>` : (equipeIds.length ? `
          <ul style="padding-left:18px;font-size:14px">
            ${(p.projeto_equipe||[]).map(e=>`<li>${escHtml(e.perfis?.nome||'')}</li>`).join('')}
          </ul>` : '<p class="page-sub">Nenhum técnico adicionado.</p>')}
        </div>
      </div>

      <!-- Coluna direita: etapas -->
      <div class="ficha-col">
        <div class="card-sec">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 class="card-sec-titulo" style="margin:0">Etapas</h3>
            ${gestor ? `<button class="btn-mini" onclick="_abrirModalEditarEtapas()">Gerenciar etapas</button>` : ''}
          </div>
          ${etapas.map(et => {
            const pEt = prjCalcProgressoEtapa(et);
            const atrasEt = et.status !== 'concluida' && et.prazo &&
              new Date(et.prazo + 'T23:59:59') < new Date();
            const resp = perfis.find(pf => pf.id === et.responsavel_id);
            return `
            <div class="prj-etapa-card ${atrasEt ? 'prj-et-atras' : ''}" onclick="abrirModalEtapa('${et.id}')">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <span class="prj-et-nome">${escHtml(et.nome)}</span>
                  ${et.fixo ? '<span style="font-size:10px;color:var(--tx2);margin-left:6px">marco final</span>' : ''}
                  ${atrasEt ? '<span class="badge-atrasada" style="margin-left:6px">Atrasada</span>' : ''}
                </div>
                <span class="badge-etapa ${et.status}">${_prjNomeStatus(et.status)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
                <div class="prj-barra-wrap" style="flex:1">
                  <div class="prj-barra-fill" style="width:${pEt.toFixed(0)}%"></div>
                </div>
                <span style="font-family:var(--mono);font-size:12px;min-width:34px">${pEt.toFixed(0)}%</span>
              </div>
              <div style="display:flex;gap:14px;margin-top:6px;font-size:12px;color:var(--tx2)">
                ${et.prazo ? `<span>📅 ${new Date(et.prazo+'T12:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
                ${resp ? `<span>👤 ${escHtml(resp.nome)}</span>` : ''}
                <span>Peso: ${et.peso_projeto || 1}</span>
                <span style="color:var(--accent)">↗ abrir</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div id="prj-modal-root"></div>
    <div id="prj-etapa-modal-root"></div>
  `);

  // Carrega auth id para controle de edição
  _prjCarregarMeuId();
}

function _prjNomeStatus(s) {
  return { pendente:'Pendente', em_andamento:'Em andamento', concluida:'Concluída', cancelada:'Cancelada' }[s] || s;
}

async function _prjSalvarCampo(campo, valor) {
  try {
    await prjAtualizar(_fichaProj.id, { [campo]: valor });
    _fichaProj[campo] = valor;
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

async function _prjSalvarEquipe() {
  const ids = [...document.querySelectorAll('#fp-equipe input:checked')].map(el => el.value);
  try {
    await prjEquipeDefinir(_fichaProj.id, ids);
  } catch (e) {
    alert('Erro ao salvar equipe: ' + e.message);
  }
}

// ── Modal editar dados gerais do projeto ──
function _abrirModalEditarProjeto() {
  const p = _fichaProj;
  document.getElementById('prj-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)_fecharModalEditarProjeto()">
      <div class="prj-modal" style="max-width:500px">
        <div class="prj-modal-head">
          <h3>Editar Projeto</h3>
          <button class="btn-mini" onclick="_fecharModalEditarProjeto()">✕</button>
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
            <input id="ep-prazo" type="date" value="${p.prazo_final || ''}" /></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button class="btn btn-sec" onclick="_fecharModalEditarProjeto()">Cancelar</button>
          <button class="btn" onclick="_prjSalvarEdicao()">Salvar</button>
        </div>
      </div>
    </div>`;
}

function _fecharModalEditarProjeto() {
  document.getElementById('prj-modal-root').innerHTML = '';
}

async function _prjSalvarEdicao() {
  const titulo = document.getElementById('ep-titulo').value.trim();
  if (!titulo) { alert('Informe o título.'); return; }
  const prazo = document.getElementById('ep-prazo').value;
  const setor  = document.getElementById('ep-setor').value;
  try {
    await prjAtualizar(_fichaProj.id, { titulo, setor: setor||null, prazo_final: prazo||null });
    _fecharModalEditarProjeto();
    _fichaProj = await prjBuscar(_fichaProj.id);
    _renderFichaProjeto();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ── Modal gerenciar etapas ──
function _abrirModalEditarEtapas() {
  const etapas = (_fichaProj.projeto_etapas || []).map(e => ({ ...e }));
  document.getElementById('prj-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)_fecharModalEditarEtapas()">
      <div class="prj-modal" style="max-width:620px">
        <div class="prj-modal-head">
          <h3>Gerenciar Etapas</h3>
          <button class="btn-mini" onclick="_fecharModalEditarEtapas()">✕</button>
        </div>
        <p class="page-sub" style="margin-bottom:12px">Alterações são salvas individualmente. A etapa "Conclusão" não pode ser removida.</p>
        <div id="ged-lista">
          ${etapas.map(et => `
            <div class="prj-etapa-row" id="ged-row-${et.id}">
              <span class="prj-etapa-ord">${et.ordem}</span>
              <input type="text" value="${escHtml(et.nome)}" placeholder="Nome" ${et.fixo?'disabled':''}
                id="ged-nome-${et.id}" style="flex:2" />
              <input type="date" value="${et.prazo||''}" id="ged-prazo-${et.id}" style="flex:1" />
              <div style="display:flex;align-items:center;gap:4px;flex:0 0 90px">
                <span style="font-size:11px;color:var(--tx2)">Peso</span>
                <input type="number" min="1" max="99" value="${et.peso_projeto||1}"
                  id="ged-peso-${et.id}" style="width:52px;padding:6px 8px" />
              </div>
              <button class="btn-mini" onclick="_gedSalvarEtapa('${et.id}')">💾</button>
              ${!et.fixo ? `<button class="btn-mini btn-mini-danger" onclick="_gedExcluirEtapa('${et.id}','${escHtml(et.nome)}')">✕</button>` : '<span style="width:50px"></span>'}
            </div>`).join('')}
        </div>
        <button class="btn btn-sec" style="margin-top:12px" onclick="_gedAdicionarEtapa()">+ Adicionar etapa</button>
        <div style="display:flex;justify-content:flex-end;margin-top:18px">
          <button class="btn" onclick="_fecharModalEditarEtapas()">Fechar</button>
        </div>
      </div>
    </div>`;
}

function _fecharModalEditarEtapas() {
  document.getElementById('prj-modal-root').innerHTML = '';
  abrirFichaProjeto(_fichaProj.id);
}

async function _gedSalvarEtapa(id) {
  const nome  = document.getElementById('ged-nome-' + id)?.value.trim();
  const prazo = document.getElementById('ged-prazo-' + id)?.value;
  const peso  = +(document.getElementById('ged-peso-' + id)?.value) || 1;
  if (!nome) { alert('Informe o nome da etapa.'); return; }
  try {
    await prjEtapaAtualizar(id, { nome, prazo: prazo||null, peso_projeto: peso });
    const btn = document.querySelector(`#ged-row-${id} .btn-mini`);
    if (btn) { btn.textContent = '✓'; setTimeout(() => btn.textContent = '💾', 1200); }
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _gedExcluirEtapa(id, nome) {
  if (!confirm(`Excluir etapa "${nome}"? Todo checklist e comentários desta etapa serão removidos.`)) return;
  try {
    await prjEtapaExcluir(id);
    document.getElementById('ged-row-' + id)?.remove();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _gedAdicionarEtapa() {
  const etapas  = _fichaProj.projeto_etapas || [];
  const ultimaOrdem = Math.max(...etapas.map(e => e.ordem), 0);
  // Insere antes da "Conclusão"
  const conclusao = etapas.find(e => e.fixo);
  const novaOrdem = conclusao ? conclusao.ordem : ultimaOrdem + 1;
  if (conclusao) {
    // sobe a ordem da conclusão
    await prjEtapaAtualizar(conclusao.id, { ordem: novaOrdem + 1 });
  }
  try {
    await prjEtapaCriar({
      projeto_id: _fichaProj.id,
      nome: 'Nova etapa',
      ordem: novaOrdem,
      peso_projeto: 1,
      status: 'pendente'
    });
    _fichaProj = await prjBuscar(_fichaProj.id);
    _abrirModalEditarEtapas();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════
// MODAL DE ETAPA
// ══════════════════════════════════════════════════════════════════════
async function abrirModalEtapa(etapaId) {
  _fichaProjEtapaId = etapaId;
  await _renderModalEtapa();
}

async function _renderModalEtapa() {
  const p = _fichaProj;
  const etapa = (p.projeto_etapas || []).find(e => e.id === _fichaProjEtapaId);
  if (!etapa) return;

  const gestor   = PERFIL?.papel === 'gestor';
  const equipeIds = (p.projeto_equipe || []).map(e => e.perfil_id);
  const podeEditar = gestor || equipeIds.includes(p._meuAuthId);
  const perfis   = _prjPerfis || [];
  const check    = (etapa.projeto_checklist || []).sort((a,b) => a.id > b.id ? 1:-1);
  const coments  = (etapa.projeto_comentarios || []).sort((a,b) => a.criado_em > b.criado_em ? 1:-1);
  const fotos    = etapa.projeto_fotos || [];
  const pEt      = prjCalcProgressoEtapa(etapa);
  const pesoTotalCheck = check.reduce((s,c) => s+(c.peso||1), 0);

  document.getElementById('prj-etapa-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)fecharModalEtapa()">
      <div class="prj-modal prj-etapa-modal">
        <div class="prj-modal-head">
          <h3>${escHtml(etapa.nome)}</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-family:var(--mono);font-size:13px;color:var(--accent)">${pEt.toFixed(0)}%</span>
            <button class="btn-mini" onclick="fecharModalEtapa()">✕</button>
          </div>
        </div>

        <!-- Controle -->
        <div class="card-sec" style="margin-bottom:14px">
          <h3 class="card-sec-titulo">Controle</h3>
          <div class="row3f">
            <div class="field"><label>Status</label>
              ${podeEditar ? `
              <select id="met-status" onchange="_etapaSalvar()">
                <option value="pendente"${etapa.status==='pendente'?' selected':''}>Pendente</option>
                <option value="em_andamento"${etapa.status==='em_andamento'?' selected':''}>Em andamento</option>
                <option value="concluida"${etapa.status==='concluida'?' selected':''}>Concluída</option>
              </select>` :
              `<input type="text" value="${_prjNomeStatus(etapa.status)}" disabled />`}
            </div>
            <div class="field"><label>Prazo</label>
              <input id="met-prazo" type="date" value="${etapa.prazo||''}" ${gestor?'':'disabled'}
                onchange="_etapaSalvar()" /></div>
            <div class="field"><label>Responsável</label>
              ${gestor ? `
              <select id="met-resp" onchange="_etapaSalvar()">
                <option value="">— selecione —</option>
                ${perfis.map(pf=>`<option value="${pf.id}"${etapa.responsavel_id===pf.id?' selected':''}>${escHtml(pf.nome)}</option>`).join('')}
              </select>` :
              `<input type="text" value="${escHtml(perfis.find(pf=>pf.id===etapa.responsavel_id)?.nome||'—')}" disabled />`}
            </div>
          </div>
          ${etapa.concluido_em ? `<p class="page-sub">Concluída em ${new Date(etapa.concluido_em).toLocaleString('pt-BR')}</p>` : ''}
        </div>

        <!-- Checklist -->
        <div class="card-sec" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 class="card-sec-titulo" style="margin:0">Checklist
              <span style="font-family:var(--mono);font-size:12px;color:var(--tx2);margin-left:8px">
                ${check.filter(c=>c.concluido).length}/${check.length} · Peso total: ${pesoTotalCheck}
              </span>
            </h3>
            ${podeEditar ? `<button class="btn-mini" onclick="_checkAdicionar('${etapa.id}')">+ Item</button>` : ''}
          </div>
          <div id="met-check-lista">
            ${check.length === 0 ? `<p class="page-sub">Nenhum item no checklist.</p>` :
              check.map(c => {
                return `
                <div class="prj-check-item" id="ci-${c.id}">
                  <label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer">
                    <input type="checkbox" ${c.concluido?'checked':''} ${podeEditar?'':'disabled'}
                      onchange="_checkMarcar('${c.id}',this.checked)" />
                    <span style="${c.concluido?'text-decoration:line-through;color:var(--tx2)':''}">${escHtml(c.descricao)}</span>
                  </label>
                  <span class="prj-check-peso">Peso ${c.peso||1}</span>
                  ${podeEditar ? `<button class="btn-mini btn-mini-danger" style="padding:2px 7px" onclick="_checkExcluir('${c.id}')">✕</button>` : ''}
                </div>`;
              }).join('')}
          </div>
        </div>

        <!-- Comentários -->
        <div class="card-sec" style="margin-bottom:14px">
          <h3 class="card-sec-titulo">Comentários</h3>
          <div id="met-coments" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
            ${coments.length === 0 ? `<p class="page-sub">Sem comentários.</p>` :
              coments.map(c => {
                const autorNome = (_prjPerfis||[]).find(pf=>pf.id===c.autor_id)?.nome || '';
                return `<div class="prj-coment" id="comt-${c.id}">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <span style="font-size:12px;font-weight:600">${escHtml(autorNome)}</span>
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-size:11px;color:var(--tx2)">${new Date(c.criado_em).toLocaleString('pt-BR')}</span>
                      ${gestor ? `<button class="btn-mini btn-mini-danger" style="padding:2px 6px" onclick="_comentExcluir('${c.id}')">&#x2715;</button>` : ''}
                    </div>
                  </div>
                  <p style="margin-top:4px;font-size:14px;white-space:pre-wrap">${escHtml(c.texto)}</p>
                </div>`;
              }).join('')}
          </div>
          ${podeEditar ? `
          <textarea id="met-novo-coment" rows="2" placeholder="Adicionar comentário..." style="margin-bottom:8px"></textarea>
          <button class="btn btn-sec" onclick="_comentAdicionar('${etapa.id}')">Enviar comentário</button>` : ''}
        </div>

        <!-- Fotos -->
        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos</h3>
          <div class="etapa-fotos" id="met-fotos">
            ${fotos.map(f => `
              <div class="etapa-foto-wrap" id="fw-${f.id}">
                <img src="${prjUrlFoto(f.caminho_storage)}" class="etapa-foto"
                  onclick="window.open('${prjUrlFoto(f.caminho_storage)}','_blank')" />
                ${podeEditar ? `<button class="foto-del-btn" onclick="_fotoExcluir('${f.id}','${f.caminho_storage}')">✕</button>` : ''}
              </div>`).join('')}
          </div>
          ${podeEditar ? `
          <label class="btn btn-sec" style="margin-top:10px;display:inline-block;cursor:pointer">
            + Adicionar fotos
            <input type="file" accept="image/*" multiple style="display:none"
              onchange="_fotosAdicionar('${p.id}','${etapa.id}',this)" />
          </label>` : ''}
        </div>
      </div>
    </div>`;
}

function fecharModalEtapa() {
  document.getElementById('prj-etapa-modal-root').innerHTML = '';
  _fichaProjEtapaId = null;
}

async function _etapaSalvar() {
  const etapa = (_fichaProj.projeto_etapas||[]).find(e=>e.id===_fichaProjEtapaId);
  if (!etapa) return;
  const status = document.getElementById('met-status')?.value || etapa.status;
  const prazo  = document.getElementById('met-prazo')?.value || null;
  const resp   = document.getElementById('met-resp')?.value || null;
  const campos = { status, prazo: prazo||null, responsavel_id: resp||null };
  if (status === 'concluida' && !etapa.concluido_em) campos.concluido_em = new Date().toISOString();
  if (status !== 'concluida') campos.concluido_em = null;
  try {
    await prjEtapaAtualizar(etapa.id, campos);
    Object.assign(etapa, campos);
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ── Checklist ──
async function _checkAdicionar(etapaId) {
  const desc = prompt('Descrição do item:');
  if (!desc?.trim()) return;
  const pesoStr = prompt('Peso do item (número inteiro, ex: 1, 2, 3):', '1');
  const peso = parseInt(pesoStr) || 1;
  try {
    const novo = await prjCheckCriar({ etapa_id: etapaId, descricao: desc.trim(), peso });
    // Atualiza cache local
    const etapa = (_fichaProj.projeto_etapas||[]).find(e=>e.id===etapaId);
    if (etapa) { etapa.projeto_checklist = etapa.projeto_checklist || []; etapa.projeto_checklist.push(novo); }
    await _renderModalEtapa();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _checkMarcar(id, concluido) {
  try {
    await prjCheckMarcar(id, concluido);
    const etapa = (_fichaProj.projeto_etapas||[]).find(e=>e.id===_fichaProjEtapaId);
    if (etapa) {
      const item = (etapa.projeto_checklist||[]).find(c=>c.id===id);
      if (item) { item.concluido = concluido; item.concluido_em = concluido ? new Date().toISOString() : null; }
    }
    // Atualiza % no header do modal sem re-renderizar tudo
    const etapaAtual = (_fichaProj.projeto_etapas||[]).find(e=>e.id===_fichaProjEtapaId);
    const pEt = etapaAtual ? prjCalcProgressoEtapa(etapaAtual) : 0;
    const pctEl = document.querySelector('.prj-etapa-modal .prj-modal-head span');
    if (pctEl) pctEl.textContent = pEt.toFixed(0) + '%';
    // Atualiza visual do item
    const row = document.getElementById('ci-' + id);
    if (row) {
      const span = row.querySelector('label span');
      if (span) span.style = concluido ? 'text-decoration:line-through;color:var(--tx2)' : '';
    }
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _checkExcluir(id) {
  if (!confirm('Excluir este item do checklist?')) return;
  try {
    await prjCheckExcluir(id);
    const etapa = (_fichaProj.projeto_etapas||[]).find(e=>e.id===_fichaProjEtapaId);
    if (etapa) etapa.projeto_checklist = (etapa.projeto_checklist||[]).filter(c=>c.id!==id);
    document.getElementById('ci-' + id)?.remove();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ── Comentários ──
async function _comentAdicionar(etapaId) {
  const txt = document.getElementById('met-novo-coment')?.value.trim();
  if (!txt) return;
  try {
    const novo = await prjComentarioCriar(etapaId, txt);
    const etapa = (_fichaProj.projeto_etapas||[]).find(e=>e.id===etapaId);
    if (etapa) { etapa.projeto_comentarios = etapa.projeto_comentarios || []; etapa.projeto_comentarios.push(novo); }
    document.getElementById('met-novo-coment').value = '';
    const lista = document.getElementById('met-coments');
    if (lista) {
      if (lista.querySelector('.page-sub')) lista.innerHTML = '';
      lista.insertAdjacentHTML('beforeend', `
        <div class="prj-coment" id="comt-${novo.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <span style="font-size:12px;font-weight:600">${escHtml(PERFIL?.nome||'')}</span>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:11px;color:var(--tx2)">${new Date(novo.criado_em).toLocaleString('pt-BR')}</span>
              ${PERFIL?.papel==='gestor'?`<button class="btn-mini btn-mini-danger" style="padding:2px 6px" onclick="_comentExcluir('${novo.id}')">✕</button>`:''}
            </div>
          </div>
          <p style="margin-top:4px;font-size:14px;white-space:pre-wrap">${escHtml(novo.texto)}</p>
        </div>`);
    }
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _comentExcluir(id) {
  if (!confirm('Excluir comentário?')) return;
  try {
    await prjComentarioExcluir(id);
    const etapa = (_fichaProj.projeto_etapas||[]).find(e=>e.id===_fichaProjEtapaId);
    if (etapa) etapa.projeto_comentarios = (etapa.projeto_comentarios||[]).filter(c=>c.id!==id);
    document.getElementById('comt-' + id)?.remove();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ── Fotos ──
async function _fotosAdicionar(projetoId, etapaId, input) {
  const files = [...input.files];
  if (!files.length) return;
  const btn = input.parentElement;
  btn.textContent = 'Enviando...';
  try {
    for (const file of files) {
      const blob = await _prjComprimirFoto(file);
      await prjUploadFoto(projetoId, etapaId, blob);
    }
    // Recarrega etapa para pegar novos ids de foto
    _fichaProj = await prjBuscar(projetoId);
    await _renderModalEtapa();
  } catch (e) {
    alert('Erro ao enviar foto: ' + e.message);
    btn.innerHTML = '+ Adicionar fotos<input type="file" accept="image/*" multiple style="display:none" onchange="_fotosAdicionar(\''+projetoId+'\',\''+etapaId+'\',this)" />';
  }
}

async function _prjComprimirFoto(file) {
  return new Promise(res => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h*MAX/w); w=MAX; } else { w=Math.round(w*MAX/h); h=MAX; } }
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(b => { URL.revokeObjectURL(url); res(b); }, 'image/jpeg', 0.82);
    };
    img.src = url;
  });
}

async function _fotoExcluir(id, caminho) {
  if (!confirm('Excluir esta foto?')) return;
  try {
    await prjFotoExcluir(id, caminho);
    const etapa = (_fichaProj.projeto_etapas||[]).find(e=>e.id===_fichaProjEtapaId);
    if (etapa) etapa.projeto_fotos = (etapa.projeto_fotos||[]).filter(f=>f.id!==id);
    document.getElementById('fw-' + id)?.remove();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ── Descrição do projeto ──
async function _prjSalvarDescricao() {
  const txt = document.getElementById('fp-descricao')?.value ?? '';
  try {
    await prjAtualizar(_fichaProj.id, { descricao: txt });
    _fichaProj.descricao = txt;
    const btn = document.querySelector('#fp-descricao ~ button');
    if (btn) { btn.textContent = '✓ Salvo'; setTimeout(() => btn.textContent = 'Salvar descrição', 1500); }
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

// ── Fotos gerais do projeto ──
async function _prjFotosProjetoAdicionar(input) {
  const files = [...input.files];
  if (!files.length) return;
  const label = input.parentElement;
  const textoOriginal = label.childNodes[0].textContent.trim();
  label.childNodes[0].textContent = ' Enviando...';
  try {
    for (const file of files) {
      const blob = await _prjComprimirFoto(file);
      await prjUploadFoto(_fichaProj.id, null, blob);
    }
    _fichaProj = await prjBuscar(_fichaProj.id);
    _renderFichaProjeto();
  } catch (e) {
    alert('Erro ao enviar foto: ' + e.message);
    label.childNodes[0].textContent = textoOriginal;
  }
}

async function _prjFotoProjetoExcluir(id, caminho) {
  if (!confirm('Excluir esta foto do projeto?')) return;
  try {
    await prjFotoExcluir(id, caminho);
    if (_fichaProj.projeto_fotos)
      _fichaProj.projeto_fotos = _fichaProj.projeto_fotos.filter(f => f.id !== id);
    document.getElementById('pfoto-' + id)?.remove();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}
