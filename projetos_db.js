'use strict';
// ─── projetos_db.js — camada de dados de Projetos MG ──────────────────

const SETORES_PROJETOS = [
  'ARMAZÉM 01','ARMAZÉM 02','ARMAZÉM DE CAVACO',
  'CALDEIRA ICAVI','CALDEIRA MEPPAN',
  'CASA DE MÁQUINAS 01','CASA DE MÁQUINAS 02',
  'ETE','EXPEDIÇÃO DE FARELO','EXTRAÇÃO','PELETIZAÇÃO','PREPARAÇÃO','GERAL'
];

// ── Projetos ──
async function prjListar() {
  const { data, error } = await sb.from('projetos')
    .select('*, projeto_etapas(id, nome, ordem, peso_projeto, status, prazo, responsavel_id, ' +
            'projeto_checklist(id, peso, concluido))')
    .order('criado_em', { ascending: false });
  if (error) throw error;
  if (data) data.forEach(p => p.projeto_etapas?.sort((a, b) => a.ordem - b.ordem));
  return data;
}

async function prjBuscar(id) {
  const { data, error } = await sb.from('projetos')
    .select('*, ' +
            'projeto_equipe(perfil_id, perfis(id, nome, papel)), ' +
            'projeto_fotos!projeto_fotos_projeto_id_fkey(id, caminho_storage, etapa_id), ' +
            'projeto_etapas(*, ' +
              'projeto_checklist(*), ' +
              'projeto_comentarios(*), ' +
              'projeto_fotos(*)' +
            ')')
    .eq('id', id).single();
  if (error) throw error;
  if (data.projeto_etapas) data.projeto_etapas.sort((a, b) => a.ordem - b.ordem);
  return data;
}

async function prjCriar(campos) {
  const sess = await dbSessao();
  const { data, error } = await sb.from('projetos')
    .insert({ ...campos, criado_por: sess.user.id })
    .select().single();
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

// ── Equipe ──
async function prjEquipeDefinir(projeto_id, perfil_ids) {
  await sb.from('projeto_equipe').delete().eq('projeto_id', projeto_id);
  if (!perfil_ids.length) return;
  const linhas = perfil_ids.map(pid => ({ projeto_id, perfil_id: pid }));
  const { error } = await sb.from('projeto_equipe').insert(linhas);
  if (error) throw error;
}

// ── Etapas ──
async function prjEtapaCriar(campos) {
  const { data, error } = await sb.from('projeto_etapas')
    .insert(campos).select().single();
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

// ── Checklist ──
async function prjCheckCriar(campos) {
  const { data, error } = await sb.from('projeto_checklist')
    .insert(campos).select().single();
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
  const campos = {
    concluido,
    concluido_por: concluido ? sess.user.id : null,
    concluido_em:  concluido ? new Date().toISOString() : null
  };
  const { error } = await sb.from('projeto_checklist').update(campos).eq('id', id);
  if (error) throw error;
}

// ── Comentários ──
async function prjComentarioCriar(etapa_id, texto) {
  const sess = await dbSessao();
  const { data, error } = await sb.from('projeto_comentarios')
    .insert({ etapa_id, texto, autor_id: sess.user.id })
    .select().single();
  if (error) throw error;
  return data;
}

async function prjComentarioExcluir(id) {
  const { error } = await sb.from('projeto_comentarios').delete().eq('id', id);
  if (error) throw error;
}

// ── Fotos ──
async function prjUploadFoto(projeto_id, etapa_id, blob) {
  // etapa_id pode ser null para fotos gerais do projeto
  const sess = await dbSessao();
  const nome = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const pasta = etapa_id ? `projetos/${projeto_id}/${etapa_id}` : `projetos/${projeto_id}/geral`;
  const caminho = `${pasta}/${nome}`;
  const { error: ue } = await sb.storage.from('fotos')
    .upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
  if (ue) throw ue;
  const { error: ie } = await sb.from('projeto_fotos')
    .insert({ projeto_id, etapa_id: etapa_id || null, caminho_storage: caminho, enviado_por: sess.user.id });
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

// ── Cálculo de progresso ──
function prjCalcProgresso(etapas) {
  if (!etapas || !etapas.length) return 0;
  const pesoTotalProjeto = etapas.reduce((s, e) => s + (e.peso_projeto || 1), 0);
  if (!pesoTotalProjeto) return 0;
  let soma = 0;
  for (const etapa of etapas) {
    const pEtapa = etapa.peso_projeto || 1;
    const check = etapa.projeto_checklist || [];
    if (!check.length) {
      if (etapa.status === 'concluida') soma += pEtapa;
    } else {
      const pesoTotal = check.reduce((s, c) => s + (c.peso || 1), 0);
      const pesoConcluido = check.filter(c => c.concluido).reduce((s, c) => s + (c.peso || 1), 0);
      soma += pEtapa * (pesoTotal ? pesoConcluido / pesoTotal : 0);
    }
  }
  return (soma / pesoTotalProjeto) * 100;
}

function prjCalcProgressoEtapa(etapa) {
  const check = etapa.projeto_checklist || [];
  if (!check.length) return etapa.status === 'concluida' ? 100 : 0;
  const pesoTotal = check.reduce((s, c) => s + (c.peso || 1), 0);
  const pesoConcluido = check.filter(c => c.concluido).reduce((s, c) => s + (c.peso || 1), 0);
  return pesoTotal ? (pesoConcluido / pesoTotal) * 100 : 0;
}

async function prjListarResumido() {
  const { data, error } = await sb.from('projetos')
    .select('id, titulo, setor, prazo_final, status, prioridade, criado_em, ' +
            'projeto_equipe(perfil_id), ' +
            'projeto_etapas(id, nome, ordem, peso_projeto, status, prazo, responsavel_id, ' +
              'projeto_checklist(id, peso, concluido))')
    .order('prazo_final', { ascending: true });
  if (error) throw error;
  if (data) data.forEach(p => p.projeto_etapas?.sort((a, b) => a.ordem - b.ordem));
  return data;
}
