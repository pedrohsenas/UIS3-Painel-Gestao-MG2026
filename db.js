'use strict';
// ─── db.js — camada de dados (Supabase) ───────────────────────────────
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

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
  // Exclui as máquinas vinculadas (cascateia etapas/fotos no banco)
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
  let q = sb.from('maquinas').select('*, etapas(status)').order('tag');
  if (filtro.ex === true) q = q.eq('ex', true);
  if (filtro.ex === false) q = q.eq('ex', false);
  if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
  if (filtro.tipos) q = q.in('tipo', filtro.tipos);
  if (filtro.status) q = q.eq('status', filtro.status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function dbMaquina(id) {
  const { data, error } = await sb.from('maquinas')
    .select('*, etapas(*), fotos(*), servicos_planejados(servico)').eq('id', id).single();
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
  let q = sb.from('maquinas')
    .select('id, tag, ex, tipo, area, etapas(id, codigo, ordem, status)')
    .eq('status', 'ativa').order('tag');
  if (filtro.ex === true) q = q.eq('ex', true);
  if (filtro.ex === false) q = q.eq('ex', false);
  if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
  if (filtro.tipos) q = q.in('tipos' in filtro ? 'tipo' : 'tipo', filtro.tipos);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function dbConcluirEtapasLote(ids, dataLancamento) {
  const agora = new Date().toISOString();
  const concluido = dataLancamento
    ? new Date(dataLancamento + 'T12:00:00').toISOString()
    : agora;
  const { error } = await sb.from('etapas')
    .update({ status: 'concluida', concluido_em: concluido, atualizado_em: agora })
    .in('id', ids);
  if (error) throw error;
}

// ═══ FASE 5 — Prazos em massa e Dashboard ════════════════════════════
async function dbEtapasResumo(filtroMaq = {}) {
  let q = sb.from('etapas')
    .select('id, codigo, status, prazo, concluido_em, maquinas!inner(id, tipo, ex, status, area)')
    .eq('maquinas.status', 'ativa');
  if (filtroMaq.ex === true) q = q.eq('maquinas.ex', true);
  if (filtroMaq.ex === false) q = q.eq('maquinas.ex', false);
  if (filtroMaq.tipo) q = q.eq('maquinas.tipo', filtroMaq.tipo);
  if (filtroMaq.tipos) q = q.in('maquinas.tipo', filtroMaq.tipos);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function dbDefinirPrazosLote(maquinaIds, codigo, prazo, apenasVazios) {
  let q = sb.from('etapas')
    .update({ prazo, atualizado_em: new Date().toISOString() })
    .in('maquina_id', maquinaIds)
    .eq('codigo', codigo);
  if (apenasVazios) q = q.is('prazo', null);
  const { error, count } = await q;
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

async function dbDefinirFotoPrincipal(maquinaId, fotoId) {
  const { error } = await sb.from('maquinas')
    .update({ foto_principal_id: fotoId, atualizado_em: new Date().toISOString() })
    .eq('id', maquinaId);
  if (error) throw error;
}

async function dbListarMaquinasComFoto(filtro = {}) {
  let q = sb.from('maquinas')
    .select('*, etapas(status), fotos(id, caminho_storage)')
    .order('tag');
  if (filtro.ex === true) q = q.eq('ex', true);
  if (filtro.ex === false) q = q.eq('ex', false);
  if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
  if (filtro.tipos) q = q.in('tipo', filtro.tipos);
  if (filtro.status) q = q.eq('status', filtro.status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
