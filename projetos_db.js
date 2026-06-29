'use strict';
// ─── projetos_db.js — camada de dados de Projetos MG ──────────────────

const SETORES_PROJETOS = [
  'ARMAZÉM 01','ARMAZÉM 02','ARMAZÉM DE CAVACO',
  'CALDEIRA ICAVI','CALDEIRA MEPPAN',
  'CASA DE MÁQUINAS 01','CASA DE MÁQUINAS 02',
  'ETE','EXPEDIÇÃO DE FARELO','EXTRAÇÃO','PELETIZAÇÃO','PREPARAÇÃO','GERAL'
];

// ══════════════════════════════════════════════════════════════════════
// PROJETOS
// ══════════════════════════════════════════════════════════════════════
async function prjListar() {
  const { data, error } = await sb.from('projetos')
    .select('*, ' +
      'projeto_etapas(id, nome, ordem, peso_projeto, status, prazo, responsavel_id, projeto_checklist(id, peso, concluido)), ' +
      'projeto_exec_etapas(id, nome, ordem, peso_projeto, status, data_inicio, data_fim, responsavel_id, projeto_exec_checklist(id, peso, concluido))')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  if (data) data.forEach(p => {
    p.projeto_etapas?.sort((a, b) => a.ordem - b.ordem);
    p.projeto_exec_etapas?.sort((a, b) => a.ordem - b.ordem);
  });
  return data;
}

async function prjBuscar(id) {
  const { data, error } = await sb.from('projetos')
    .select('*, ' +
      'projeto_equipe(perfil_id, perfis(id, nome, papel)), ' +
      'projeto_fotos!projeto_fotos_projeto_id_fkey(id, caminho_storage, etapa_id, exec_etapa_id), ' +
      'projeto_etapas(*, projeto_checklist(*), projeto_comentarios(*), projeto_fotos(*)), ' +
      'projeto_exec_etapas(*, projeto_exec_checklist(*), projeto_exec_comentarios(*), projeto_exec_fotos(*))')
    .eq('id', id).single();
  if (error) throw error;
  if (data.projeto_etapas) data.projeto_etapas.sort((a, b) => a.ordem - b.ordem);
  if (data.projeto_exec_etapas) data.projeto_exec_etapas.sort((a, b) => a.ordem - b.ordem);
  return data;
}

async function prjCriar(campos) {
  const sess = await dbSessao();
  const { data, error } = await sb.from('projetos')
    .insert({ ...campos, criado_por: sess.user.id }).select().single();
  if (error) throw error;
  return data;
}

async function prjAtualizar(id, campos) {
  campos.atualizado_em = new Date().toISOString();
  const { error } = await sb.from('projetos').update(campos).eq('id', id);
  if (error) throw error;
}

async function prjExcluir(id) {
  const { error } = await sb.from('projetos').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════════
// EQUIPE
// ══════════════════════════════════════════════════════════════════════
async function prjEquipeDefinir(projeto_id, perfil_ids) {
  await sb.from('projeto_equipe').delete().eq('projeto_id', projeto_id);
  if (!perfil_ids.length) return;
  const { error } = await sb.from('projeto_equipe')
    .insert(perfil_ids.map(pid => ({ projeto_id, perfil_id: pid })));
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════════
// ETAPAS DE PLANEJAMENTO
// ══════════════════════════════════════════════════════════════════════
async function prjEtapaCriar(campos) {
  const { data, error } = await sb.from('projeto_etapas').insert(campos).select().single();
  if (error) throw error;
  return data;
}
async function prjEtapaAtualizar(id, campos) {
  campos.atualizado_em = new Date().toISOString();
  const { error } = await sb.from('projeto_etapas').update(campos).eq('id', id);
  if (error) throw error;
}
async function prjEtapaExcluir(id) {
  const { error } = await sb.from('projeto_etapas').delete().eq('id', id);
  if (error) throw error;
}

// ── Checklist planejamento ──
async function prjCheckCriar(campos) {
  const { data, error } = await sb.from('projeto_checklist').insert(campos).select().single();
  if (error) throw error;
  return data;
}
async function prjCheckAtualizar(id, campos) {
  const { error } = await sb.from('projeto_checklist').update(campos).eq('id', id);
  if (error) throw error;
}
async function prjCheckExcluir(id) {
  const { error } = await sb.from('projeto_checklist').delete().eq('id', id);
  if (error) throw error;
}
async function prjCheckMarcar(id, concluido) {
  const sess = await dbSessao();
  const { error } = await sb.from('projeto_checklist').update({
    concluido, concluido_por: concluido ? sess.user.id : null,
    concluido_em: concluido ? new Date().toISOString() : null
  }).eq('id', id);
  if (error) throw error;
}

// ── Comentários planejamento ──
async function prjComentarioCriar(etapa_id, texto) {
  const sess = await dbSessao();
  const { data, error } = await sb.from('projeto_comentarios')
    .insert({ etapa_id, texto, autor_id: sess.user.id }).select().single();
  if (error) throw error;
  return data;
}
async function prjComentarioExcluir(id) {
  const { error } = await sb.from('projeto_comentarios').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════════
// ETAPAS DE EXECUÇÃO
// ══════════════════════════════════════════════════════════════════════
async function prjExecEtapaCriar(campos) {
  const { data, error } = await sb.from('projeto_exec_etapas').insert(campos).select().single();
  if (error) throw error;
  return data;
}
async function prjExecEtapaAtualizar(id, campos) {
  campos.atualizado_em = new Date().toISOString();
  const { error } = await sb.from('projeto_exec_etapas').update(campos).eq('id', id);
  if (error) throw error;
}
async function prjExecEtapaExcluir(id) {
  const { error } = await sb.from('projeto_exec_etapas').delete().eq('id', id);
  if (error) throw error;
}

// ── Checklist execução ──
async function prjExecCheckCriar(campos) {
  const { data, error } = await sb.from('projeto_exec_checklist').insert(campos).select().single();
  if (error) throw error;
  return data;
}
async function prjExecCheckExcluir(id) {
  const { error } = await sb.from('projeto_exec_checklist').delete().eq('id', id);
  if (error) throw error;
}
async function prjExecCheckMarcar(id, concluido) {
  const sess = await dbSessao();
  const { error } = await sb.from('projeto_exec_checklist').update({
    concluido, concluido_por: concluido ? sess.user.id : null,
    concluido_em: concluido ? new Date().toISOString() : null
  }).eq('id', id);
  if (error) throw error;
}

// ── Comentários execução ──
async function prjExecComentarioCriar(etapa_id, texto) {
  const sess = await dbSessao();
  const { data, error } = await sb.from('projeto_exec_comentarios')
    .insert({ etapa_id, texto, autor_id: sess.user.id }).select().single();
  if (error) throw error;
  return data;
}
async function prjExecComentarioExcluir(id) {
  const { error } = await sb.from('projeto_exec_comentarios').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════════
// FOTOS (planejamento e execução compartilham tabela projeto_fotos;
//         execução usa exec_etapa_id; planejamento usa etapa_id)
// ══════════════════════════════════════════════════════════════════════
async function prjUploadFoto(projeto_id, etapa_id, blob, exec_etapa_id) {
  const sess = await dbSessao();
  const nome = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  let pasta = `projetos/${projeto_id}/geral`;
  if (etapa_id)      pasta = `projetos/${projeto_id}/plan/${etapa_id}`;
  if (exec_etapa_id) pasta = `projetos/${projeto_id}/exec/${exec_etapa_id}`;
  const caminho = `${pasta}/${nome}`;
  const { error: ue } = await sb.storage.from('fotos')
    .upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
  if (ue) throw ue;
  const { error: ie } = await sb.from('projeto_fotos').insert({
    projeto_id,
    etapa_id: etapa_id || null,
    exec_etapa_id: exec_etapa_id || null,
    caminho_storage: caminho,
    enviado_por: sess.user.id
  });
  if (ie) throw ie;
  return caminho;
}

async function prjFotoExcluir(id, caminho) {
  await sb.storage.from('fotos').remove([caminho]);
  const { error } = await sb.from('projeto_fotos').delete().eq('id', id);
  if (error) throw error;
}

function prjUrlFoto(caminho) {
  return sb.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}

// ══════════════════════════════════════════════════════════════════════
// CÁLCULO DE PROGRESSO
// ══════════════════════════════════════════════════════════════════════
function _calcProgressoEtapa(etapa, checkKey) {
  const check = etapa[checkKey] || [];
  if (!check.length) return etapa.status === 'concluida' ? 100 : 0;
  const pesoTotal = check.reduce((s, c) => s + (c.peso || 1), 0);
  const pesoConcluido = check.filter(c => c.concluido).reduce((s, c) => s + (c.peso || 1), 0);
  return pesoTotal ? (pesoConcluido / pesoTotal) * 100 : 0;
}

function _calcProgresso(etapas, checkKey) {
  if (!etapas || !etapas.length) return 0;
  const pesoTotal = etapas.reduce((s, e) => s + (e.peso_projeto || 1), 0);
  if (!pesoTotal) return 0;
  let soma = 0;
  for (const et of etapas) {
    soma += (et.peso_projeto || 1) * _calcProgressoEtapa(et, checkKey) / 100;
  }
  return (soma / pesoTotal) * 100;
}

// Planejamento
function prjCalcProgressoEtapa(etapa) { return _calcProgressoEtapa(etapa, 'projeto_checklist'); }
function prjCalcProgresso(etapas)     { return _calcProgresso(etapas, 'projeto_checklist'); }

// Execução
function prjExecCalcProgressoEtapa(etapa) { return _calcProgressoEtapa(etapa, 'projeto_exec_checklist'); }
function prjExecCalcProgresso(etapas)     { return _calcProgresso(etapas, 'projeto_exec_checklist'); }

// ══════════════════════════════════════════════════════════════════════
// LISTAGENS PARA DASHBOARDS / ACOMPANHAMENTO
// ══════════════════════════════════════════════════════════════════════
async function prjListarResumido() {
  const { data, error } = await sb.from('projetos')
    .select('id, titulo, setor, prazo_final, status, prioridade, criado_em, ' +
      'projeto_equipe(perfil_id), ' +
      'projeto_etapas(id, nome, ordem, peso_projeto, status, prazo, responsavel_id, projeto_checklist(id, peso, concluido)), ' +
      'projeto_exec_etapas(id, nome, ordem, peso_projeto, status, data_inicio, data_fim, responsavel_id, projeto_exec_checklist(id, peso, concluido))')
    .order('prazo_final', { ascending: true });
  if (error) throw error;
  if (data) data.forEach(p => {
    p.projeto_etapas?.sort((a, b) => a.ordem - b.ordem);
    p.projeto_exec_etapas?.sort((a, b) => a.ordem - b.ordem);
  });
  return data;
}

// Para dashboard execução — precisa de datas de início/fim e concluido_em
async function prjListarExecDash() {
  const { data, error } = await sb.from('projetos')
    .select('id, titulo, setor, prazo_final, status, prioridade, ' +
      'projeto_exec_etapas(id, nome, ordem, peso_projeto, status, data_inicio, data_fim, concluido_em, responsavel_id, projeto_exec_checklist(id, peso, concluido))')
    .neq('status', 'cancelado')
    .order('prazo_final', { ascending: true });
  if (error) throw error;
  if (data) data.forEach(p => p.projeto_exec_etapas?.sort((a, b) => a.ordem - b.ordem));
  return data;
}
