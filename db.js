'use strict';
// ─── db.js — camada de dados (Supabase) ───────────────────────────────
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Helper de paginação: busca TODAS as linhas, contornando o teto de 1000 ──
async function dbBuscarTudo(builderFn) {
  const PASSO = 1000;
  let inicio = 0, todos = [];
  while (true) {
    const { data, error } = await builderFn().range(inicio, inicio + PASSO - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    todos = todos.concat(data);
    if (data.length < PASSO) break;
    inicio += PASSO;
  }
  return todos;
}


// ── Autenticação ──
async function dbLogin(email, senha) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}
async function dbLogout() { await sb.auth.signOut(); }
async function dbSessao() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
async function dbMeuPerfil() {
  const sess = await dbSessao();
  if (!sess) return null;
  const { data, error } = await sb.from('perfis').select('*').eq('id', sess.user.id).single();
  if (error) return null;
  return data;
}

// ── Importações ──
async function dbListarImportacoes() {
  const { data, error } = await sb.from('importacoes')
    .select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data;
}
async function dbCriarImportacao(nome_zip, tecnico, qtd) {
  const sess = await dbSessao();
  const { data, error } = await sb.from('importacoes')
    .insert({ nome_zip, tecnico, qtd_maquinas: qtd, importado_por: sess.user.id })
    .select().single();
  if (error) throw error;
  return data;
}
async function dbArquivarImportacao(id, arquivar) {
  const { error } = await sb.from('importacoes')
    .update({ status: arquivar ? 'arquivada' : 'ativa' }).eq('id', id);
  if (error) throw error;
}
async function dbExcluirImportacao(id) {
  const { error: e1 } = await sb.from('maquinas').delete().eq('importacao_id', id);
  if (e1) throw e1;
  const { error: e2 } = await sb.from('importacoes').delete().eq('id', id);
  if (e2) throw e2;
}

// ── Máquinas ──
async function dbInserirMaquina(m) {
  const { data, error } = await sb.from('maquinas').insert(m).select('id, tag').single();
  if (error) throw error;
  return data;
}
async function dbContarMaquinas() {
  const { count, error } = await sb.from('maquinas')
    .select('*', { count: 'exact', head: true }).eq('status', 'ativa');
  if (error) return 0;
  return count;
}

// ── Fotos ──
async function dbUploadFoto(caminho, blob) {
  const { error } = await sb.storage.from('fotos').upload(caminho, blob, {
    contentType: 'image/jpeg', upsert: true
  });
  if (error) throw error;
}
async function dbRegistrarFoto(maquina_id, caminho_storage, origem) {
  const sess = await dbSessao();
  const { error } = await sb.from('fotos').insert({
    maquina_id, caminho_storage, origem, enviado_por: sess.user.id
  });
  if (error) throw error;
}
function dbUrlFoto(caminho) {
  return sb.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}

// ═══ FASE 2 — Máquinas ═══════════════════════════════════════════════
async function dbListarMaquinas(filtro = {}) {
  return dbBuscarTudo(() => {
    let q = sb.from('maquinas').select('*, etapas(status)').order('tag');
    if (filtro.ex === true) q = q.eq('ex', true);
    if (filtro.ex === false) q = q.eq('ex', false);
    if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
    if (filtro.tipos) q = q.in('tipo', filtro.tipos);
    if (filtro.status) q = q.eq('status', filtro.status);
    return q;
  });
}

async function dbMaquina(id) {
  const { data, error } = await sb.from('maquinas')
    .select('*, etapas(*), fotos!fotos_maquina_id_fkey(*), servicos_planejados(servico)').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function dbAtualizarMaquina(id, campos) {
  campos.atualizado_em = new Date().toISOString();
  const { error } = await sb.from('maquinas').update(campos).eq('id', id);
  if (error) throw error;
}

async function dbExcluirMaquina(id) {
  const { error } = await sb.from('maquinas').delete().eq('id', id);
  if (error) throw error;
}

async function dbExcluirFoto(fotoId, caminho) {
  await sb.storage.from('fotos').remove([caminho]);
  const { error } = await sb.from('fotos').delete().eq('id', fotoId);
  if (error) throw error;
}

// ═══ FASE 3 — Etapas ═════════════════════════════════════════════════
async function dbEtapaDetalhe(id) {
  const { data, error } = await sb.from('etapas')
    .select('*, maquinas(id, tag, ex, tipo, servicos_planejados(servico)), servicos_realizados(*), fotos(*)')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

async function dbAtualizarEtapa(id, campos) {
  campos.atualizado_em = new Date().toISOString();
  const { error } = await sb.from('etapas').update(campos).eq('id', id);
  if (error) throw error;
}

async function dbConfirmarServico(etapa_id, servico) {
  const sess = await dbSessao();
  const { error } = await sb.from('servicos_realizados')
    .insert({ etapa_id, servico, confirmado_por: sess.user.id });
  if (error) throw error;
}

async function dbRemoverServico(etapa_id, servico) {
  const { error } = await sb.from('servicos_realizados')
    .delete().eq('etapa_id', etapa_id).eq('servico', servico);
  if (error) throw error;
}

async function dbRegistrarFotoEtapa(maquina_id, etapa_id, caminho_storage) {
  const sess = await dbSessao();
  const { error } = await sb.from('fotos').insert({
    maquina_id, etapa_id, caminho_storage, origem: 'etapa', enviado_por: sess.user.id
  });
  if (error) throw error;
}

// ═══ FASE 4 — Matriz de lançamento ═══════════════════════════════════
async function dbMaquinasComEtapas(filtro = {}) {
  return dbBuscarTudo(() => {
    let q = sb.from('maquinas')
      .select('id, tag, ex, tipo, area, etapas(id, codigo, ordem, status), servicos_planejados(servico)')
      .eq('status', 'ativa').order('tag');
    if (filtro.ex === true) q = q.eq('ex', true);
    if (filtro.ex === false) q = q.eq('ex', false);
    if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
    if (filtro.tipos) q = q.in('tipo', filtro.tipos);
    return q;
  });
}

async function dbConcluirEtapasLote(ids, dataLancamento, responsavel) {
  const agora = new Date().toISOString();
  const concluido = dataLancamento
    ? new Date(dataLancamento + 'T12:00:00').toISOString()
    : agora;
  const campos = { status: 'concluida', concluido_em: concluido, atualizado_em: agora };
  if (responsavel) campos.responsavel = responsavel;
  const { error } = await sb.from('etapas').update(campos).in('id', ids);
  if (error) throw error;
}

// ═══ FASE 5 — Prazos em massa e Dashboard ════════════════════════════
async function dbEtapasResumo(filtroMaq = {}) {
  return dbBuscarTudo(() => {
    let q = sb.from('etapas')
      .select('id, codigo, status, prazo, concluido_em, maquinas!inner(id, tipo, ex, status, area)')
      .eq('maquinas.status', 'ativa');
    if (filtroMaq.ex === true) q = q.eq('maquinas.ex', true);
    if (filtroMaq.ex === false) q = q.eq('maquinas.ex', false);
    if (filtroMaq.tipo) q = q.eq('maquinas.tipo', filtroMaq.tipo);
    if (filtroMaq.tipos) q = q.in('maquinas.tipo', filtroMaq.tipos);
    return q;
  });
}

async function dbDefinirPrazosLote(maquinaIds, codigo, prazo, apenasVazios) {
  let q = sb.from('etapas')
    .update({ prazo, atualizado_em: new Date().toISOString() })
    .in('maquina_id', maquinaIds)
    .eq('codigo', codigo);
  if (apenasVazios) q = q.is('prazo', null);
  const { error } = await q;
  if (error) throw error;
}

// ═══ AJUSTES — perfis, serviços planejados ═══════════════════════════
async function dbListarPerfis() {
  const { data, error } = await sb.from('perfis').select('id, nome, papel').order('nome');
  if (error) throw error;
  return data;
}

async function dbPlanejarServico(maquina_id, servico) {
  const sess = await dbSessao();
  const { error } = await sb.from('servicos_planejados')
    .upsert({ maquina_id, servico, definido_por: sess.user.id },
      { onConflict: 'maquina_id,servico', ignoreDuplicates: true });
  if (error) throw error;
}

async function dbRemoverServicoPlanejado(maquina_id, servico) {
  const { error } = await sb.from('servicos_planejados')
    .delete().eq('maquina_id', maquina_id).eq('servico', servico);
  if (error) throw error;
}

async function dbPlanejarServicosLote(maquinaIds, servicos) {
  const sess = await dbSessao();
  const linhas = [];
  maquinaIds.forEach(mid => servicos.forEach(s =>
    linhas.push({ maquina_id: mid, servico: s, definido_por: sess.user.id })));
  const { error } = await sb.from('servicos_planejados')
    .upsert(linhas, { onConflict: 'maquina_id,servico', ignoreDuplicates: true });
  if (error) throw error;
}

async function dbRemoverServicosLote(maquinaIds, servicos) {
  const { error } = await sb.from('servicos_planejados')
    .delete().in('maquina_id', maquinaIds).in('servico', servicos);
  if (error) throw error;
}

// ═══ Foto principal ══════════════════════════════════════════════════
async function dbDefinirFotoPrincipal(maquinaId, fotoId) {
  const { error } = await sb.from('maquinas')
    .update({ foto_principal_id: fotoId, atualizado_em: new Date().toISOString() })
    .eq('id', maquinaId);
  if (error) throw error;
}

async function dbListarMaquinasComFoto(filtro = {}) {
  return dbBuscarTudo(() => {
    let q = sb.from('maquinas')
      .select('*, etapas(status), fotos!fotos_maquina_id_fkey(id, caminho_storage)')
      .order('tag');
    if (filtro.ex === true) q = q.eq('ex', true);
    if (filtro.ex === false) q = q.eq('ex', false);
    if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
    if (filtro.tipos) q = q.in('tipo', filtro.tipos);
    if (filtro.status) q = q.eq('status', filtro.status);
    return q;
  });
}

// ═══ Rolamentos — autocomplete dinâmico ══════════════════════════════
async function dbSugerirRolamentos(termo) {
  if (!termo || termo.length < 1) return [];
  const t = `%${termo}%`;
  const [d, tr] = await Promise.all([
    sb.from('maquinas').select('rolamento_dianteiro').ilike('rolamento_dianteiro', t).limit(50),
    sb.from('maquinas').select('rolamento_traseiro').ilike('rolamento_traseiro', t).limit(50)
  ]);
  const set = new Set();
  (d.data || []).forEach(r => { const v = (r.rolamento_dianteiro || '').trim(); if (v) set.add(v); });
  (tr.data || []).forEach(r => { const v = (r.rolamento_traseiro || '').trim(); if (v) set.add(v); });
  return [...set].sort().slice(0, 12);
}

// ═══ Fotos para exportação — busca direta, sem ambiguidade de relação ══
async function dbTodasFotosMaquinas() {
  return dbBuscarTudo(() =>
    sb.from('fotos').select('id, maquina_id, caminho_storage, origem').order('maquina_id')
  );
}

// ═══ Acompanhamento de Tarefas — etapas de máquinas ══════════════════
async function dbEtapasAcompanhamento() {
  return dbBuscarTudo(() =>
    sb.from('etapas')
      .select('id, codigo, status, prazo, concluido_em, responsavel, ' +
              'maquinas!inner(id, tag, tipo, area, status, foto_principal_id, fotos!fotos_maquina_id_fkey(id, caminho_storage))')
      .eq('maquinas.status', 'ativa')
  );
}
