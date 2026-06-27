'use strict';
// ─── vi_db.js — camada de dados de Válvulas & Instrumentos ────────────
// Reutiliza o cliente 'sb' já criado em db.js

// ── Constantes de V&I ──
const VI_ETAPAS_NOMES = {
  levantamento: 'Levantamento de dados',
  preparacao_recursos: 'Preparação de recursos',
  retirada: 'Retirada do equipamento',
  retorno_manutencao: 'Retorno da manutenção',
  instalacao_startup: 'Instalação e start-up',
  conclusao: 'Conclusão'
};
const VI_ETAPAS_ORDEM = ['levantamento','preparacao_recursos','retirada',
  'retorno_manutencao','instalacao_startup','conclusao'];

const VI_SERVICOS_INSTRUMENTO = [
  'Calibração','Aferição / verificação','Limpeza','Substituição de elemento sensor',
  'Reaperto de conexões','Verificação de aterramento','Teste de malha (loop)',
  'Atualização de configuração / parametrização'
];
const VI_SERVICOS_VALVULA = [
  'Troca de vedação / gaxeta','Lapidação de sede','Teste de estanqueidade',
  'Revisão do atuador','Lubrificação','Substituição de internos (trim)',
  'Pintura / tratamento','Teste de acionamento / curso'
];
function viServicosDe(dominio) {
  return dominio === 'valvula' ? VI_SERVICOS_VALVULA : VI_SERVICOS_INSTRUMENTO;
}

// ── Importações V&I ──
async function viListarImportacoes() {
  const { data, error } = await sb.from('vi_importacoes')
    .select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data;
}
async function viCriarImportacao(nome_zip, tecnico, qtdInst, qtdValv) {
  const sess = await dbSessao();
  const { data, error } = await sb.from('vi_importacoes')
    .insert({ nome_zip, tecnico, qtd_instrumentos: qtdInst, qtd_valvulas: qtdValv, importado_por: sess.user.id })
    .select().single();
  if (error) throw error;
  return data;
}
async function viArquivarImportacao(id, arquivar) {
  const { error } = await sb.from('vi_importacoes')
    .update({ status: arquivar ? 'arquivada' : 'ativa' }).eq('id', id);
  if (error) throw error;
}
async function viExcluirImportacao(id) {
  const { error: e1 } = await sb.from('vi_equipamentos').delete().eq('importacao_id', id);
  if (e1) throw e1;
  const { error: e2 } = await sb.from('vi_importacoes').delete().eq('id', id);
  if (e2) throw e2;
}

// ── Equipamentos ──
async function viInserirEquipamento(eq) {
  const { data, error } = await sb.from('vi_equipamentos').insert(eq).select('id, tag').single();
  if (error) throw error;
  return data;
}
async function viListarEquipamentos(filtro = {}) {
  return dbBuscarTudo(() => {
    let q = sb.from('vi_equipamentos')
      .select('*, vi_etapas(status), vi_fotos!equipamento_id(id, caminho_storage)')
      .order('tag');
    if (filtro.dominio) q = q.eq('dominio', filtro.dominio);
    if (filtro.status) q = q.eq('status', filtro.status);
    return q;
  });
}
async function viEquipamento(id) {
  const { data, error } = await sb.from('vi_equipamentos')
    .select('*, vi_etapas(*), vi_fotos!equipamento_id(*), vi_servicos_planejados(servico)')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}
async function viAtualizarEquipamento(id, campos) {
  campos.atualizado_em = new Date().toISOString();
  const { error } = await sb.from('vi_equipamentos').update(campos).eq('id', id);
  if (error) throw error;
}
async function viExcluirEquipamento(id) {
  const { error } = await sb.from('vi_equipamentos').delete().eq('id', id);
  if (error) throw error;
}
async function viDefinirFotoPrincipal(eqId, fotoId) {
  const { error } = await sb.from('vi_equipamentos')
    .update({ foto_principal_id: fotoId, atualizado_em: new Date().toISOString() })
    .eq('id', eqId);
  if (error) throw error;
}

// ── Etapas ──
async function viEtapaDetalhe(id) {
  const { data, error } = await sb.from('vi_etapas')
    .select('*, vi_equipamentos(id, tag, dominio, vi_servicos_planejados(servico)), vi_servicos_realizados(*), vi_fotos!etapa_id(*)')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}
async function viAtualizarEtapa(id, campos) {
  campos.atualizado_em = new Date().toISOString();
  const { error } = await sb.from('vi_etapas').update(campos).eq('id', id);
  if (error) throw error;
}
async function viConfirmarServico(etapa_id, servico) {
  const sess = await dbSessao();
  const { error } = await sb.from('vi_servicos_realizados')
    .insert({ etapa_id, servico, confirmado_por: sess.user.id });
  if (error) throw error;
}
async function viRemoverServico(etapa_id, servico) {
  const { error } = await sb.from('vi_servicos_realizados')
    .delete().eq('etapa_id', etapa_id).eq('servico', servico);
  if (error) throw error;
}

// ── Serviços planejados ──
async function viPlanejarServico(equipamento_id, servico) {
  const sess = await dbSessao();
  const { error } = await sb.from('vi_servicos_planejados')
    .upsert({ equipamento_id, servico, definido_por: sess.user.id },
      { onConflict: 'equipamento_id,servico', ignoreDuplicates: true });
  if (error) throw error;
}
async function viRemoverServicoPlanejado(equipamento_id, servico) {
  const { error } = await sb.from('vi_servicos_planejados')
    .delete().eq('equipamento_id', equipamento_id).eq('servico', servico);
  if (error) throw error;
}
async function viPlanejarServicosLote(eqIds, servicos) {
  const sess = await dbSessao();
  const linhas = [];
  eqIds.forEach(id => servicos.forEach(s =>
    linhas.push({ equipamento_id: id, servico: s, definido_por: sess.user.id })));
  const { error } = await sb.from('vi_servicos_planejados')
    .upsert(linhas, { onConflict: 'equipamento_id,servico', ignoreDuplicates: true });
  if (error) throw error;
}
async function viRemoverServicosLote(eqIds, servicos) {
  const { error } = await sb.from('vi_servicos_planejados')
    .delete().in('equipamento_id', eqIds).in('servico', servicos);
  if (error) throw error;
}

// ── Fotos ──
async function viRegistrarFoto(equipamento_id, caminho_storage, origem) {
  const sess = await dbSessao();
  const { error } = await sb.from('vi_fotos').insert({
    equipamento_id, caminho_storage, origem, enviado_por: sess.user.id
  });
  if (error) throw error;
}
async function viRegistrarFotoEtapa(equipamento_id, etapa_id, caminho_storage) {
  const sess = await dbSessao();
  const { error } = await sb.from('vi_fotos').insert({
    equipamento_id, etapa_id, caminho_storage, origem: 'etapa', enviado_por: sess.user.id
  });
  if (error) throw error;
}
async function viExcluirFoto(fotoId, caminho) {
  await sb.storage.from('fotos').remove([caminho]);
  const { error } = await sb.from('vi_fotos').delete().eq('id', fotoId);
  if (error) throw error;
}

// ── Matriz / prazos / dashboard ──
async function viEquipamentosComEtapas(filtro = {}) {
  return dbBuscarTudo(() => {
    let q = sb.from('vi_equipamentos')
      .select('id, tag, dominio, area, vi_etapas(id, codigo, ordem, status), vi_servicos_planejados(servico)')
      .eq('status', 'ativa').order('tag');
    if (filtro.dominio) q = q.eq('dominio', filtro.dominio);
    return q;
  });
}
async function viConcluirEtapasLote(ids, dataLancamento) {
  const agora = new Date().toISOString();
  const concluido = dataLancamento ? new Date(dataLancamento + 'T12:00:00').toISOString() : agora;
  const { error } = await sb.from('vi_etapas')
    .update({ status: 'concluida', concluido_em: concluido, atualizado_em: agora })
    .in('id', ids);
  if (error) throw error;
}
async function viDefinirPrazosLote(eqIds, codigo, prazo, apenasVazios) {
  // precisa dos ids de etapa: busca etapas desses equipamentos com o código
  let q = sb.from('vi_etapas').select('id, prazo').in('equipamento_id', eqIds).eq('codigo', codigo);
  const { data, error } = await q;
  if (error) throw error;
  const alvo = data.filter(e => !apenasVazios || !e.prazo).map(e => e.id);
  if (!alvo.length) return;
  const { error: e2 } = await sb.from('vi_etapas')
    .update({ prazo, atualizado_em: new Date().toISOString() }).in('id', alvo);
  if (e2) throw e2;
}
async function viEtapasResumo(filtro = {}) {
  return dbBuscarTudo(() => {
    let q = sb.from('vi_etapas')
      .select('id, codigo, status, prazo, concluido_em, vi_equipamentos!inner(id, dominio, status, area)')
      .eq('vi_equipamentos.status', 'ativa');
    if (filtro.dominio) q = q.eq('vi_equipamentos.dominio', filtro.dominio);
    return q;
  });
}

// ═══ Fotos V&I para exportação ═══════════════════════════════════════
async function viTodasFotos() {
  return dbBuscarTudo(() =>
    sb.from('vi_fotos').select('id, equipamento_id, caminho_storage, origem').order('equipamento_id')
  );
}
