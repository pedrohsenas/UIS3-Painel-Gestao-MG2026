'use strict';
// ─── acompanhamento.js — Acompanhamento de Tarefas (seção Gestão) ──────

let acFonte = 'ambos';      // 'ambos' | 'maquinas' | 'vi'
let acTipo = '';            // tipo de equipamento
let acStatus = '';          // '' | pendente | em_andamento | concluida | atrasada
let acResp = '';            // responsável selecionado
let acDe = '';              // filtro prazo DE
let acAte = '';             // filtro prazo ATÉ
let acDados = [];           // etapas normalizadas
let _acPerfis = null;

const AC_ETAPA_NOMES = {     // une os dois conjuntos de nomes
  // máquinas
  levantamento: 'Levantamento de dados',
  compra_componentes: 'Compra de componentes',
  preparacao_recursos: 'Preparação de recursos',
  retirada: 'Retirada',
  manutencao_planejada: 'Execução da manutenção',
  instalacao_conferencia: 'Instalação e conferência',
  conclusao: 'Conclusão',
  // V&I (sobrepõe onde há código próprio)
  retorno_manutencao: 'Retorno da manutenção',
  instalacao_startup: 'Instalação e start-up'
};

function acNomeEtapa(codigo, dominio) {
  // 'retirada' e 'conclusao' existem nos dois; nomes coincidem o suficiente
  if (codigo === 'retirada') return dominio ? 'Retirada do equipamento' : 'Retirada da máquina';
  return AC_ETAPA_NOMES[codigo] || codigo;
}

async function telaAcompanhamento() {
  window._ajudaChave = 'acompanhamento';
  // pré-seleciona o usuário logado
  if (acResp === '' && PERFIL?.nome) acResp = PERFIL.nome;

  setConteudo(`
    <div class="page-head">
      <h2>Acompanhamento de Tarefas</h2>
      <p class="page-sub">Etapas sob responsabilidade, ordenadas por situação e prazo</p>
    </div>
    <div id="ac-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  await acCarregar();
}

async function acCarregar() {
  const el = document.getElementById('ac-area');
  try {
    if (!_acPerfis) { try { _acPerfis = await dbListarPerfis(); } catch { _acPerfis = []; } }

    const promessas = [];
    if (acFonte === 'ambos' || acFonte === 'maquinas') promessas.push(dbEtapasAcompanhamento());
    else promessas.push(Promise.resolve([]));
    if (acFonte === 'ambos' || acFonte === 'vi') promessas.push(viEtapasAcompanhamento());
    else promessas.push(Promise.resolve([]));

    const [etMaq, etVi] = await Promise.all(promessas);

    // normaliza
    const norm = [];
    etMaq.forEach(e => {
      const m = e.maquinas;
      norm.push({
        id: e.id, origem: 'maquina', codigo: e.codigo,
        etapaNome: acNomeEtapa(e.codigo, false),
        status: e.status, prazo: e.prazo, concluido_em: e.concluido_em,
        responsavel: e.responsavel || '',
        tag: m.tag, area: m.area || '', tipo: TIPOS_NOMES[m.tipo] || m.tipo || '—',
        foto: acFotoUrl(m.fotos, m.foto_principal_id),
        abrir: () => telaEtapa(e.id)
      });
    });
    etVi.forEach(e => {
      const eq = e.vi_equipamentos;
      norm.push({
        id: e.id, origem: 'vi', codigo: e.codigo,
        etapaNome: acNomeEtapa(e.codigo, true),
        status: e.status, prazo: e.prazo, concluido_em: e.concluido_em,
        responsavel: e.responsavel || '',
        tag: eq.tag, area: eq.area || '',
        tipo: eq.tipo || (eq.dominio === 'valvula' ? 'Válvula' : 'Instrumento'),
        foto: acFotoUrl(eq.vi_fotos, eq.foto_principal_id),
        abrir: () => viTelaEtapa(e.id)
      });
    });

    acDados = norm;
    acRender();
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

function acFotoUrl(fotos, principalId) {
  fotos = fotos || [];
  if (!fotos.length) return null;
  let f = null;
  if (principalId) f = fotos.find(x => x.id === principalId);
  if (!f) f = fotos[0];
  return f ? dbUrlFoto(f.caminho_storage) : null;
}

function acEhAtrasada(t) {
  return t.prazo && t.status !== 'concluida' && new Date(t.prazo + 'T23:59:59') < new Date();
}

// dias restantes (positivo) ou de atraso (negativo). null se sem prazo.
function acDiasPrazo(t) {
  if (!t.prazo) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const prazo = new Date(t.prazo + 'T00:00:00');
  return Math.round((prazo - hoje) / 86400000);
}

// peso de situação para ordenação: atrasada(0) < em_andamento(1) < pendente(2) < concluida(3)
function acPesoSituacao(t) {
  if (t.status === 'concluida') return 3;
  if (acEhAtrasada(t)) return 0;
  if (t.status === 'em_andamento') return 1;
  return 2; // pendente
}

function acListaFiltrada() {
  let lista = acDados.slice();

  if (acResp) lista = lista.filter(t => t.responsavel === acResp);
  if (acTipo) lista = lista.filter(t => t.tipo === acTipo);

  if (acStatus) {
    if (acStatus === 'atrasada') lista = lista.filter(t => acEhAtrasada(t));
    else if (acStatus === 'pendente') lista = lista.filter(t => t.status === 'pendente' && !acEhAtrasada(t));
    else lista = lista.filter(t => t.status === acStatus);
  }

  if (acDe) lista = lista.filter(t => t.prazo && t.prazo >= acDe);
  if (acAte) lista = lista.filter(t => t.prazo && t.prazo <= acAte);

  // ordenação: situação (primária) → prazo (secundária, mais urgente primeiro; sem prazo por último)
  lista.sort((a, b) => {
    const pa = acPesoSituacao(a), pb = acPesoSituacao(b);
    if (pa !== pb) return pa - pb;
    const da = acDiasPrazo(a), db = acDiasPrazo(b);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
  return lista;
}

function acRender() {
  const el = document.getElementById('ac-area');
  const tipos = [...new Set(acDados.map(t => t.tipo))].sort();
  const lista = acListaFiltrada();

  // contadores rápidos (sobre o conjunto filtrado por resp/fonte/tipo, ignorando status/data)
  const baseCont = acDados.filter(t => (!acResp || t.responsavel === acResp) && (!acTipo || t.tipo === acTipo));
  const cAtras = baseCont.filter(t => acEhAtrasada(t)).length;
  const cAnd = baseCont.filter(t => t.status === 'em_andamento').length;
  const cPend = baseCont.filter(t => t.status === 'pendente' && !acEhAtrasada(t)).length;
  const cConc = baseCont.filter(t => t.status === 'concluida').length;

  el.innerHTML = `
    <div class="ac-filtros">
      <div class="field"><label>Responsável</label>
        <select onchange="acResp=this.value;acRender()">
          <option value="">Todos</option>
          ${(_acPerfis || []).map(p => `<option value="${escHtml(p.nome)}"${acResp===p.nome?' selected':''}>${escHtml(p.nome)}</option>`).join('')}
        </select></div>
      <div class="field"><label>Origem</label>
        <select onchange="acFonte=this.value;acTipo='';acCarregar()">
          <option value="ambos"${acFonte==='ambos'?' selected':''}>Máquinas + V&I</option>
          <option value="maquinas"${acFonte==='maquinas'?' selected':''}>Somente Máquinas</option>
          <option value="vi"${acFonte==='vi'?' selected':''}>Somente V&I</option>
        </select></div>
      <div class="field"><label>Tipo</label>
        <select onchange="acTipo=this.value;acRender()">
          <option value="">Todos</option>
          ${tipos.map(t => `<option value="${escHtml(t)}"${acTipo===t?' selected':''}>${escHtml(t)}</option>`).join('')}
        </select></div>
      <div class="field"><label>Status</label>
        <select onchange="acStatus=this.value;acRender()">
          <option value="">Todos</option>
          <option value="atrasada"${acStatus==='atrasada'?' selected':''}>Atrasadas</option>
          <option value="pendente"${acStatus==='pendente'?' selected':''}>Pendentes</option>
          <option value="em_andamento"${acStatus==='em_andamento'?' selected':''}>Em andamento</option>
          <option value="concluida"${acStatus==='concluida'?' selected':''}>Concluídas</option>
        </select></div>
      <div class="field"><label>Prazo de</label>
        <input type="date" value="${acDe}" onchange="acDe=this.value;acRender()" /></div>
      <div class="field"><label>Prazo até</label>
        <input type="date" value="${acAte}" onchange="acAte=this.value;acRender()" /></div>
      <div class="field" style="justify-content:flex-end">
        <button class="btn-mini" onclick="acLimparFiltros()">Limpar filtros</button>
      </div>
    </div>

    <div class="ac-contadores">
      <span class="ac-cont ac-c-atras">${cAtras} atrasada(s)</span>
      <span class="ac-cont ac-c-and">${cAnd} em andamento</span>
      <span class="ac-cont ac-c-pend">${cPend} pendente(s)</span>
      <span class="ac-cont ac-c-conc">${cConc} concluída(s)</span>
    </div>

    <div class="contagem">${lista.length} tarefa${lista.length!==1?'s':''}</div>
    <div class="tabela-wrap">
      <table class="tabela ac-tabela">
        <thead><tr>
          <th>TAG</th><th>Setor</th><th>Foto</th><th>Etapa</th><th>Prazo</th>
        </tr></thead>
        <tbody>
          ${lista.length ? lista.map(t => acLinha(t)).join('')
            : '<tr><td colspan="5"><div class="empty-state"><p class="empty-title">Nenhuma tarefa com esses filtros</p></div></td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function acLinha(t) {
  const dias = acDiasPrazo(t);
  const atras = acEhAtrasada(t);
  let classe = '';
  if (t.status === 'concluida') classe = 'ac-l-conc';
  else if (atras) classe = 'ac-l-atras';
  else if (t.status === 'em_andamento') classe = 'ac-l-and';
  else classe = 'ac-l-pend';

  let prazoCel;
  if (t.status === 'concluida') {
    prazoCel = `<span class="ac-dias ac-dias-ok">✓ concluída</span>`;
  } else if (dias === null) {
    prazoCel = `<span class="ac-dias-sem">sem prazo</span>`;
  } else if (dias < 0) {
    prazoCel = `<span class="ac-dias ac-dias-atras">${dias} dia(s)</span>`;
  } else if (dias === 0) {
    prazoCel = `<span class="ac-dias ac-dias-hoje">vence hoje</span>`;
  } else {
    prazoCel = `<span class="ac-dias ac-dias-corre">+${dias} dia(s)</span>`;
  }

  const foto = t.foto
    ? `<img src="${t.foto}" class="thumb-maq" loading="lazy" alt="foto" onclick="event.stopPropagation();abrirVisor('${t.foto}')" />`
    : '<span class="sem-foto">sem foto</span>';

  return `
    <tr class="linha-click ${classe}" onclick="acAbrir('${t.origem}','${t.id}')">
      <td class="td-mono">${escHtml(t.tag)}</td>
      <td>${escHtml(t.area) || '—'}</td>
      <td class="td-foto">${foto}</td>
      <td>${escHtml(t.etapaNome)}</td>
      <td>${prazoCel}</td>
    </tr>`;
}

function acAbrir(origem, id) {
  if (origem === 'vi') viTelaEtapa(id);
  else telaEtapa(id);
}

function acLimparFiltros() {
  acTipo = ''; acStatus = ''; acDe = ''; acAte = '';
  acResp = ''; acFonte = 'ambos';
  acCarregar();
}
