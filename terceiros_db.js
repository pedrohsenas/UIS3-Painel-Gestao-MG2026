'use strict';
// ─── terceiros_db.js — empresas, solicitações e RDO ───────────────────

// ══ Empresas ══════════════════════════════════════════════════════════
async function empListar() {
  const { data, error } = await sb.from('empresas_terceiras')
    .select('*').order('nome');
  if (error) throw error;
  return data || [];
}

async function empCriar(campos) {
  const { data, error } = await sb.from('empresas_terceiras')
    .insert(campos).select().single();
  if (error) throw error;
  return data;
}

async function empAtualizar(id, campos) {
  const { error } = await sb.from('empresas_terceiras').update(campos).eq('id', id);
  if (error) throw error;
}

async function empExcluir(id) {
  const { error } = await sb.from('empresas_terceiras').delete().eq('id', id);
  if (error) throw error;
}

// ══ Usuários terceiros (perfis com papel='terceiro') ══════════════════
async function empListarUsuarios(empresa_id) {
  const { data, error } = await sb.from('perfis')
    .select('id, nome, papel, empresa_id')
    .eq('empresa_id', empresa_id)
    .order('nome');
  if (error) throw error;
  return data || [];
}

// Cria conta de usuário terceiro via Auth + perfil
// Requer que o gestor esteja logado; usa signUp (não invalida sessão do gestor
// pois Supabase mantém a sessão atual ao criar nova conta).
async function empCriarUsuario(empresa_id, dados) {
  const { email, senha, nome } = dados;
  // 1. Cria no Auth
  const { data: auth, error: authErr } = await sb.auth.signUp({
    email, password: senha,
    options: { data: { nome } }
  });
  if (authErr) throw authErr;
  if (!auth.user) throw new Error('Falha ao criar usuário no Auth');

  // 2. Cria/atualiza perfil
  const { error: perfilErr } = await sb.from('perfis').upsert({
    id: auth.user.id, nome, papel: 'terceiro', empresa_id
  });
  if (perfilErr) throw perfilErr;
  return auth.user;
}

async function empAtualizarUsuario(perfil_id, campos) {
  const { error } = await sb.from('perfis').update(campos).eq('id', perfil_id);
  if (error) throw error;
}

// ══ Listagem filtrada para terceiros (só projetos onde a empresa atua) ══
async function prjListarParaTerceiro(empresa_id) {
  // Subconsulta: ids de projetos que têm etapa exec dessa empresa
  const { data: etapas, error: e1 } = await sb.from('projeto_exec_etapas')
    .select('projeto_id').eq('empresa_id', empresa_id);
  if (e1) throw e1;
  const projIds = [...new Set((etapas || []).map(e => e.projeto_id))];
  if (!projIds.length) return [];

  const { data, error } = await sb.from('projetos')
    .select('*, projeto_exec_etapas(id, nome, ordem, peso_projeto, status, ' +
      'data_inicio, data_fim, data_inicio_prev, data_fim_prev, duracao_prev_dias, ' +
      'concluido_em, responsavel_id, empresa_id, ' +
      'projeto_exec_checklist(id, peso, concluido))')
    .in('id', projIds)
    .order('prazo_final', { ascending: true });
  if (error) throw error;
  if (data) data.forEach(p => p.projeto_exec_etapas?.sort((a,b) => a.ordem - b.ordem));
  return data || [];
}

// ══ Solicitações de alteração ═════════════════════════════════════════
async function solCriar(projeto_id, empresa_id, itens) {
  // itens: [{ exec_etapa_id, campo, valor_antes, valor_depois }]
  const sess = await dbSessao();
  const { data: sol, error } = await sb.from('projeto_solicitacoes')
    .insert({ projeto_id, empresa_id, solicitante_id: sess.user.id })
    .select().single();
  if (error) throw error;

  const linhas = itens.map(it => ({
    solicitacao_id: sol.id,
    exec_etapa_id: it.exec_etapa_id,
    campo: it.campo,
    valor_antes: it.valor_antes == null ? null : String(it.valor_antes),
    valor_depois: it.valor_depois == null ? null : String(it.valor_depois)
  }));
  const { error: e2 } = await sb.from('projeto_solicitacao_itens').insert(linhas);
  if (e2) throw e2;
  return sol;
}

async function solListar(filtro) {
  // filtro: { status?, projeto_id?, empresa_id? }
  let q = sb.from('projeto_solicitacoes')
    .select('*, empresas_terceiras(nome), projetos(titulo), ' +
      'projeto_solicitacao_itens(*, projeto_exec_etapas(nome, ordem))')
    .order('criado_em', { ascending: false });
  if (filtro?.status)      q = q.eq('status', filtro.status);
  if (filtro?.projeto_id)  q = q.eq('projeto_id', filtro.projeto_id);
  if (filtro?.empresa_id)  q = q.eq('empresa_id', filtro.empresa_id);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function solBuscar(id) {
  const { data, error } = await sb.from('projeto_solicitacoes')
    .select('*, empresas_terceiras(nome), projetos(titulo, id), ' +
      'projeto_solicitacao_itens(*, projeto_exec_etapas(id, nome, ordem))')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

// Aplica decisões em lote: aprova itens marcados, rejeita os demais
async function solDecidir(sol_id, decisoes, nota) {
  // decisoes: [{ item_id, decisao: 'aprovada'|'rejeitada' }]
  const sess = await dbSessao();
  const agora = new Date().toISOString();
  const itensAprovados = [];

  // 1. Atualiza decisão de cada item
  for (const d of decisoes) {
    const { error } = await sb.from('projeto_solicitacao_itens').update({
      decisao: d.decisao,
      decidido_por: sess.user.id,
      decidido_em: agora
    }).eq('id', d.item_id);
    if (error) throw error;
    if (d.decisao === 'aprovada') itensAprovados.push(d.item_id);
  }

  // 2. Para aprovados, busca info completa e aplica na etapa
  if (itensAprovados.length) {
    const { data: itens, error: e2 } = await sb.from('projeto_solicitacao_itens')
      .select('*').in('id', itensAprovados);
    if (e2) throw e2;

    // Agrupa por etapa para 1 update por etapa
    const porEtapa = {};
    for (const it of itens) {
      porEtapa[it.exec_etapa_id] = porEtapa[it.exec_etapa_id] || {};
      porEtapa[it.exec_etapa_id][it.campo] = _converterValor(it.campo, it.valor_depois);
    }
    for (const [etapaId, campos] of Object.entries(porEtapa)) {
      campos.atualizado_em = agora;
      const { error } = await sb.from('projeto_exec_etapas')
        .update(campos).eq('id', etapaId);
      if (error) throw error;
    }
  }

  // 3. Atualiza status da solicitação
  const total = decisoes.length;
  const aprovadas = decisoes.filter(d => d.decisao === 'aprovada').length;
  let statusFinal = 'rejeitada';
  if (aprovadas === total) statusFinal = 'aplicada_total';
  else if (aprovadas > 0)  statusFinal = 'aplicada_parcial';

  const { error: e3 } = await sb.from('projeto_solicitacoes').update({
    status: statusFinal,
    revisado_por: sess.user.id,
    revisado_em: agora,
    nota_revisor: nota || null
  }).eq('id', sol_id);
  if (e3) throw e3;

  return { aprovadas, total, status: statusFinal };
}

// Helper: converte valor textual de volta para o tipo certo do banco
function _converterValor(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const intFields = ['duracao_prev_dias', 'peso_projeto'];
  const dateFields = ['data_inicio', 'data_fim', 'data_inicio_prev', 'data_fim_prev'];
  if (intFields.includes(campo)) return +valor;
  if (dateFields.includes(campo)) return valor;
  // status, responsavel_id, nome, empresa_id e demais: string/uuid
  return valor;
}

async function solContarPendentes() {
  const { count, error } = await sb.from('projeto_solicitacoes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente');
  if (error) return 0;
  return count || 0;
}

// ══ RDO ═══════════════════════════════════════════════════════════════
async function rdoListar(projeto_id) {
  const { data, error } = await sb.from('projeto_rdo')
    .select('*, empresas_terceiras(nome)')
    .eq('projeto_id', projeto_id)
    .order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function rdoBuscar(id) {
  const { data, error } = await sb.from('projeto_rdo')
    .select('*, empresas_terceiras(nome)')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

async function rdoCriar(campos) {
  const sess = await dbSessao();
  const perfil = PERFIL;
  const { data, error } = await sb.from('projeto_rdo').insert({
    ...campos,
    autor_id: sess.user.id,
    empresa_id: perfil?.empresa_id || null
  }).select().single();
  if (error) throw error;
  return data;
}

async function rdoAtualizar(id, campos) {
  const { error } = await sb.from('projeto_rdo').update(campos).eq('id', id);
  if (error) throw error;
}

async function rdoExcluir(id) {
  const { error } = await sb.from('projeto_rdo').delete().eq('id', id);
  if (error) throw error;
}
