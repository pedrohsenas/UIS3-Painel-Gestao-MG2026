'use strict';
// ─── biblioteca.js — biblioteca de importações (máquinas + V&I) ───────
//                    + verificador de duplicidades

let _bibAba = 'importacoes';  // 'importacoes' | 'duplicatas'

async function telaBiblioteca() {
  window._ajudaChave = 'biblioteca';
  setConteudo(`
    <div class="page-head">
      <h2>Biblioteca de Importações</h2>
      <p class="page-sub">Histórico de ZIPs (Máquinas e V&amp;I) e verificação de duplicidades</p>
    </div>
    <div class="cat-tabs" style="margin-bottom:14px">
      <button class="cat-tab ${_bibAba==='importacoes'?'ativo':''}" onclick="_bibTrocarAba('importacoes')">📥 Importações</button>
      <button class="cat-tab ${_bibAba==='duplicatas'?'ativo':''}" onclick="_bibTrocarAba('duplicatas')">🔍 Duplicidades</button>
    </div>
    <div id="bib-area"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);
  if (_bibAba === 'importacoes') _bibCarregarImportacoes();
  else _bibCarregarDuplicatas();
}

function _bibTrocarAba(aba) {
  _bibAba = aba;
  telaBiblioteca();
}

// ══════════════════════════════════════════════════════════════════════
// ABA IMPORTAÇÕES — máquinas + V&I combinados
// ══════════════════════════════════════════════════════════════════════
async function _bibCarregarImportacoes() {
  const el = document.getElementById('bib-area');
  try {
    const [importMaq, importVI] = await Promise.all([
      dbListarImportacoes().catch(() => []),
      (typeof viListarImportacoes === 'function' ? viListarImportacoes() : Promise.resolve([])).catch(() => [])
    ]);

    // Unifica em uma lista ordenada por data
    const lista = [
      ...importMaq.map(i => ({ ...i, _origem: 'maq' })),
      ...importVI.map(i  => ({ ...i, _origem: 'vi' }))
    ].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    if (!lista.length) {
      el.innerHTML = `<div class="empty-state">
        <p class="empty-title">Nenhuma importação registrada</p>
        <p class="empty-sub">Use "Importar ZIP" (Máquinas ou V&amp;I) no menu para começar</p>
      </div>`;
      return;
    }

    const gestor = PERFIL?.papel === 'gestor';
    el.innerHTML = `
      <div class="contagem">${lista.length} importação(ões) · ${importMaq.length} Máquinas · ${importVI.length} V&amp;I</div>
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr>
            <th>Tipo</th><th>Arquivo ZIP</th><th>Técnico</th><th>Itens</th><th>Data</th><th>Status</th>
            ${gestor ? '<th>Ações</th>' : ''}
          </tr></thead>
          <tbody>
            ${lista.map(i => {
              const isMaq = i._origem === 'maq';
              const qtdTxt = isMaq
                ? `${i.qtd_maquinas} máq.`
                : `${i.qtd_instrumentos || 0} inst. · ${i.qtd_valvulas || 0} válv.`;
              const arquivarFn = isMaq ? 'acaoArquivar' : '_bibArquivarVI';
              const excluirFn  = isMaq ? 'acaoExcluir'  : '_bibExcluirVI';
              return `<tr class="${i.status === 'arquivada' ? 'linha-arquivada' : ''}">
                <td><span class="badge-origem ${i._origem}">${isMaq?'⚙ Máquinas':'🔧 V&amp;I'}</span></td>
                <td class="td-mono">${escHtml(i.nome_zip)}</td>
                <td>${escHtml(i.tecnico)}</td>
                <td class="td-center td-mono">${qtdTxt}</td>
                <td>${new Date(i.criado_em).toLocaleString('pt-BR')}</td>
                <td><span class="badge-status ${i.status}">${i.status === 'ativa' ? 'Ativa' : 'Arquivada'}</span></td>
                ${gestor ? `<td><div class="td-acoes">
                  <button class="btn-mini" onclick="${arquivarFn}('${i.id}', ${i.status === 'ativa'})">${i.status === 'ativa' ? 'Arquivar' : 'Reativar'}</button>
                  <button class="btn-mini btn-mini-danger" onclick="${excluirFn}('${i.id}', '${escHtml(i.nome_zip)}')">Excluir</button>
                </div></td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

// Ações Máquinas (do biblioteca.js original)
async function acaoArquivar(id, arquivar) {
  try {
    await dbArquivarImportacao(id, arquivar);
    telaBiblioteca();
  } catch (e) { alert('Erro: ' + e.message); }
}

async function acaoExcluir(id, nome) {
  if (!confirm(`Excluir a importação "${nome}"?\n\nATENÇÃO: todas as máquinas, etapas e fotos vinculadas a ela serão excluídas do banco. Esta ação não pode ser desfeita.`)) return;
  try {
    await dbExcluirImportacao(id);
    telaBiblioteca();
  } catch (e) { alert('Erro: ' + e.message); }
}

// Ações V&I
async function _bibArquivarVI(id, arquivar) {
  try { await viArquivarImportacao(id, arquivar); telaBiblioteca(); }
  catch (e) { alert('Erro: ' + e.message); }
}

async function _bibExcluirVI(id, nome) {
  if (!confirm(`Excluir a importação V&I "${nome}"?\n\nATENÇÃO: todos os equipamentos, etapas e fotos vinculados serão excluídos. Ação irreversível.`)) return;
  try { await viExcluirImportacao(id); telaBiblioteca(); }
  catch (e) { alert('Erro: ' + e.message); }
}

// ══════════════════════════════════════════════════════════════════════
// ABA DUPLICIDADES — TAGs de máquinas/V&I e ZIPs repetidos
// ══════════════════════════════════════════════════════════════════════
async function _bibCarregarDuplicatas() {
  const el = document.getElementById('bib-area');
  el.innerHTML = '<div class="loading"><div class="spinner"></div> Verificando duplicidades...</div>';
  try {
    const [dupMaqTag, dupViTag, dupZipMaq, dupZipVI] = await Promise.all([
      _bibDetectarTagsDupMaq(),
      _bibDetectarTagsDupVI(),
      _bibDetectarZipsDupMaq(),
      _bibDetectarZipsDupVI()
    ]);

    const totalMaqTag = dupMaqTag.length;
    const totalViTag  = dupViTag.length;
    const totalZipMaq = dupZipMaq.length;
    const totalZipVI  = dupZipVI.length;
    const total = totalMaqTag + totalViTag + totalZipMaq + totalZipVI;

    el.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:18px">
        <div class="kpi ${totalMaqTag?'kpi-alerta':''}"><div class="kpi-valor ${totalMaqTag?'kpi-vermelho':'kpi-verde'}">${totalMaqTag}</div><div class="kpi-rotulo">TAGs Máquinas duplicadas</div></div>
        <div class="kpi ${totalViTag?'kpi-alerta':''}"><div class="kpi-valor ${totalViTag?'kpi-vermelho':'kpi-verde'}">${totalViTag}</div><div class="kpi-rotulo">TAGs V&amp;I duplicadas</div></div>
        <div class="kpi ${totalZipMaq?'kpi-alerta':''}"><div class="kpi-valor ${totalZipMaq?'kpi-vermelho':'kpi-verde'}">${totalZipMaq}</div><div class="kpi-rotulo">ZIPs Máquinas repetidos</div></div>
        <div class="kpi ${totalZipVI?'kpi-alerta':''}"><div class="kpi-valor ${totalZipVI?'kpi-vermelho':'kpi-verde'}">${totalZipVI}</div><div class="kpi-rotulo">ZIPs V&amp;I repetidos</div></div>
      </div>

      ${total === 0 ? `
        <div class="empty-state" style="border-color:var(--ok-bd);background:var(--ok-bg)">
          <p class="empty-title" style="color:#166534">✓ Nenhuma duplicidade encontrada</p>
          <p class="empty-sub">Os cadastros estão íntegros.</p>
        </div>` : ''}

      ${_bibRenderGruposPorTipo(dupMaqTag, 'maq')}
      ${_bibRenderGruposPorTipo(dupViTag, 'vi')}
      ${_bibRenderGrupoZip('Máquinas — ZIPs importados mais de uma vez', dupZipMaq, 'maq')}
      ${_bibRenderGrupoZip('V&I — ZIPs importados mais de uma vez', dupZipVI, 'vi')}
    `;
  } catch (e) {
    el.innerHTML = `<div class="result-card erro"><p>Erro: ${e.message}</p></div>`;
  }
}

// Detectores ------------------------------------------------------------
// Campos comparados para calcular "diferenças" entre cadastros de mesma TAG
const _BIB_CAMPOS_MAQ = ['tipo','area','localizacao','potencia','unidade_pot','fabricante','rolamento_dianteiro','rolamento_traseiro','ex'];
const _BIB_CAMPOS_VI  = ['dominio','tipo','area','localizacao','fabricante','modelo'];

async function _bibDetectarTagsDupMaq() {
  const { data, error } = await sb.from('maquinas')
    .select('id, tag, tipo, area, localizacao, potencia, unidade_pot, fabricante, ' +
            'rolamento_dianteiro, rolamento_traseiro, ex, status, criado_em, importacao_id, dup_verificado, ' +
            'importacoes(nome_zip), fotos!fotos_maquina_id_fkey(id)');
  if (error) throw error;
  const norm = (data || []).map(m => ({
    ...m,
    _zip: m.importacoes?.nome_zip || '—',
    _qtdFotos: (m.fotos || []).length
  }));
  // Agrupa por TIPO + TAG: mesma TAG em tipos diferentes (motor vs redutor) NÃO é duplicidade
  const grupos = _bibAgruparPorTipoTag(norm, 'tipo');
  grupos.forEach(g => _bibCalcularDiferencas(g, _BIB_CAMPOS_MAQ.filter(f => f !== 'tipo')));
  return grupos;
}

async function _bibDetectarTagsDupVI() {
  if (typeof sb === 'undefined') return [];
  const { data, error } = await sb.from('vi_equipamentos')
    .select('id, tag, dominio, tipo, area, localizacao, fabricante, modelo, status, criado_em, ' +
            'importacao_id, dup_verificado, vi_importacoes(nome_zip), vi_fotos!equipamento_id(id)');
  if (error) return [];
  const norm = (data || []).map(m => ({
    ...m,
    _zip: m.vi_importacoes?.nome_zip || '—',
    _qtdFotos: (m.vi_fotos || []).length
  }));
  const grupos = _bibAgruparPorTipoTag(norm, 'dominio');
  grupos.forEach(g => _bibCalcularDiferencas(g, _BIB_CAMPOS_VI.filter(f => f !== 'dominio')));
  return grupos;
}

// Compara os cadastros do grupo par-a-par e anota quantas/quais diferenças há.
// 0 diferenças = duplicata idêntica (provável importação dupla)
// >0 diferenças = cadastros distintos com mesma TAG (ex: SEMTAG)
function _bibCalcularDiferencas(grupo, campos) {
  const ref = grupo.ocorrencias[0];
  const difs = new Set();
  for (const o of grupo.ocorrencias.slice(1)) {
    for (const campo of campos) {
      const a = ref[campo] == null ? '' : String(ref[campo]).trim();
      const b = o[campo]   == null ? '' : String(o[campo]).trim();
      if (a !== b) difs.add(_bibNomeCampo(campo));
    }
    if ((ref._qtdFotos || 0) !== (o._qtdFotos || 0)) difs.add('fotos');
  }
  grupo.diferencas = [...difs];
}

function _bibNomeCampo(c) {
  const MAP = {
    tipo:'tipo', area:'setor', localizacao:'localização', potencia:'potência',
    unidade_pot:'unid. potência', fabricante:'fabricante',
    rolamento_dianteiro:'rol. dianteiro', rolamento_traseiro:'rol. traseiro',
    ex:'EX', dominio:'domínio', modelo:'modelo'
  };
  return MAP[c] || c;
}

async function _bibDetectarZipsDupMaq() {
  const lista = await dbListarImportacoes().catch(() => []);
  return _bibAgruparPor(lista, 'nome_zip');
}

async function _bibDetectarZipsDupVI() {
  if (typeof viListarImportacoes !== 'function') return [];
  const lista = await viListarImportacoes().catch(() => []);
  return _bibAgruparPor(lista, 'nome_zip');
}

// Agrupa por (campoTipo + TAG): duplicidade só dentro do mesmo tipo/domínio
function _bibAgruparPorTipoTag(items, campoTipo) {
  const g = {};
  for (const it of items) {
    if (!it.tag) continue;
    const tipoVal = (it[campoTipo] || 'outro');
    const k = tipoVal + '§' + String(it.tag).trim().toUpperCase();
    g[k] = g[k] || [];
    g[k].push(it);
  }
  return Object.entries(g)
    .filter(([_, arr]) => arr.length > 1)
    .map(([k, arr]) => ({
      chave: k.split('§')[1],
      _tipo: k.split('§')[0],
      ocorrencias: arr
    }))
    .sort((a, b) => b.ocorrencias.length - a.ocorrencias.length);
}

function _bibAgruparPorTag(items, chave) {
  return _bibAgruparPor(items, chave, (val) => (val || '').trim().toUpperCase());
}
function _bibAgruparPor(items, chave, normaliza) {
  const g = {};
  for (const it of items) {
    const raw = it[chave];
    if (!raw) continue;
    const k = normaliza ? normaliza(raw) : raw;
    if (!k) continue;
    g[k] = g[k] || [];
    g[k].push(it);
  }
  // só retorna as chaves com 2+ ocorrências
  return Object.entries(g)
    .filter(([_, arr]) => arr.length > 1)
    .map(([k, arr]) => ({ chave: k, ocorrencias: arr }))
    .sort((a, b) => b.ocorrencias.length - a.ocorrencias.length);
}

// Separa os grupos por tipo de máquina/domínio e gera uma seção com cabeçalho para cada
function _bibRenderGruposPorTipo(grupos, origem) {
  if (!grupos.length) return '';
  const NOMES_MAQ = {
    motor_eletrico:'Motores elétricos', bomba:'Bombas', redutor:'Redutores',
    ventilador:'Ventiladores', compressor:'Compressores',
    transportador:'Transportadores', outro:'Outras máquinas'
  };
  const NOMES_VI  = { instrumento: 'Instrumentos', valvula: 'Válvulas' };
  const porTipo = {};
  for (const g of grupos) {
    const t = g._tipo || 'outro';
    porTipo[t] = porTipo[t] || [];
    porTipo[t].push(g);
  }
  return Object.entries(porTipo).map(([t, gs]) => {
    const nomeTipo = origem === 'maq' ? (NOMES_MAQ[t] || t) : (NOMES_VI[t] || t);
    return _bibRenderGrupoTag(`${nomeTipo} — TAGs duplicadas`, gs, origem === 'maq' ? 'maq' : 'vi');
  }).join('');
}

function _bibRenderGrupoTag(titulo, grupos, tipo) {
  if (!grupos.length) return '';
  const gestor = PERFIL?.papel === 'gestor';
  return `
    <div class="card-sec" style="margin-bottom:14px">
      <h3 class="card-sec-titulo">${titulo} · ${grupos.length}</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${grupos.map(g => {
          const nDif = (g.diferencas || []).length;
          const provavelImportDupla = nDif === 0;
          const corBorda = provavelImportDupla ? 'var(--crit-bd)' : 'var(--warn-bd)';
          const corFundo = provavelImportDupla ? 'var(--crit-bg)' : 'var(--warn-bg)';
          return `
          <div style="border:1px solid ${corBorda};border-radius:var(--r2);padding:10px 12px;background:${corFundo}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:6px">
              <strong style="font-family:var(--mono);font-size:14px">${escHtml(g.chave)}</strong>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                ${provavelImportDupla
                  ? '<span class="badge crit-a" style="font-size:11px">⚠ Idênticos — provável importação dupla</span>'
                  : `<span class="badge crit-b" style="font-size:11px">${nDif} diferença(s) — possível TAG repetida legítima</span>`}
                <span style="font-size:12px;color:var(--tx2)">${g.ocorrencias.length} cadastros</span>
              </div>
            </div>
            ${nDif > 0 ? `<div style="font-size:11px;color:var(--tx2);margin-bottom:6px">
              Campos divergentes: ${g.diferencas.map(d => `<span class="prj-check-peso" style="margin-right:3px">${escHtml(d)}</span>`).join('')}
            </div>` : ''}
            <div class="tabela-wrap" style="box-shadow:none;border:none;background:transparent">
            <table style="width:100%;font-size:12px;border-collapse:collapse;min-width:640px">
              <thead><tr style="color:var(--tx2)">
                <th style="padding:3px 6px;width:28px" title="Verificado">✓</th>
                <th style="text-align:left;padding:3px 6px">TAG</th>
                ${tipo==='vi' ? '<th style="text-align:left;padding:3px 6px">Domínio</th>' : ''}
                <th style="text-align:left;padding:3px 6px">Setor</th>
                <th style="text-align:left;padding:3px 6px">ZIP de origem</th>
                <th style="text-align:center;padding:3px 6px">Fotos</th>
                <th style="text-align:left;padding:3px 6px">Status</th>
                <th style="text-align:left;padding:3px 6px">Criado</th>
                <th style="width:110px"></th>
              </tr></thead>
              <tbody>
                ${g.ocorrencias.map(o => `
                  <tr id="bib-row-${o.id}" style="border-top:1px solid var(--line);${o.dup_verificado?'background:var(--ok-bg)':''}">
                    <td style="padding:5px 6px;text-align:center">
                      <input type="checkbox" ${o.dup_verificado?'checked':''} title="Verificado — manter como está"
                        onchange="_bibMarcarVerificado('${o.id}','${tipo}',this.checked)" />
                    </td>
                    <td class="td-mono" style="padding:5px 6px">${escHtml(o.tag)}</td>
                    ${tipo==='vi' ? `<td style="padding:5px 6px">${escHtml(o.dominio || '—')}</td>` : ''}
                    <td style="padding:5px 6px">${escHtml(o.area || '—')}</td>
                    <td class="td-mono" style="padding:5px 6px;font-size:11px">${escHtml(o._zip)}</td>
                    <td class="td-mono" style="padding:5px 6px;text-align:center">${o._qtdFotos ?? '—'}</td>
                    <td style="padding:5px 6px"><span class="badge-status ${o.status}">${o.status}</span></td>
                    <td style="padding:5px 6px">${new Date(o.criado_em).toLocaleDateString('pt-BR')}</td>
                    <td style="padding:5px 6px;text-align:right;white-space:nowrap">
                      <button class="btn-mini" onclick="_bibAbrirNovaGuia('${o.id}','${tipo}')">Abrir ↗</button>
                      ${gestor ? `<button class="btn-mini btn-mini-danger" onclick="_bibExcluirItem('${o.id}','${tipo}','${escHtml(o.tag)}')">Excluir</button>` : ''}
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function _bibRenderGrupoZip(titulo, grupos, tipo) {
  if (!grupos.length) return '';
  const gestor = PERFIL?.papel === 'gestor';
  return `
    <div class="card-sec" style="margin-bottom:14px">
      <h3 class="card-sec-titulo">${titulo} · ${grupos.length}</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${grupos.map(g => `
          <div style="border:1px solid var(--warn-bd);border-radius:var(--r2);padding:10px 12px;background:var(--warn-bg)">
            <div style="margin-bottom:6px">
              <strong style="font-family:var(--mono);font-size:13px">${escHtml(g.chave)}</strong>
              <span style="font-size:12px;color:var(--tx2);margin-left:8px">${g.ocorrencias.length} importações</span>
            </div>
            <table style="width:100%;font-size:12px;border-collapse:collapse">
              <thead><tr style="color:var(--tx2)">
                <th style="text-align:left;padding:3px 6px">Técnico</th>
                <th style="text-align:left;padding:3px 6px">Itens</th>
                <th style="text-align:left;padding:3px 6px">Data</th>
                <th style="text-align:left;padding:3px 6px">Status</th>
                <th style="width:180px"></th>
              </tr></thead>
              <tbody>
                ${g.ocorrencias.map(o => {
                  const itens = tipo==='maq'
                    ? `${o.qtd_maquinas} máq.`
                    : `${o.qtd_instrumentos || 0} inst. · ${o.qtd_valvulas || 0} válv.`;
                  const excluirFn = tipo==='maq' ? 'acaoExcluir' : '_bibExcluirVI';
                  const arqFn     = tipo==='maq' ? 'acaoArquivar' : '_bibArquivarVI';
                  return `
                    <tr style="border-top:1px solid var(--line)">
                      <td style="padding:5px 6px">${escHtml(o.tecnico)}</td>
                      <td class="td-mono" style="padding:5px 6px">${itens}</td>
                      <td style="padding:5px 6px">${new Date(o.criado_em).toLocaleString('pt-BR')}</td>
                      <td style="padding:5px 6px"><span class="badge-status ${o.status}">${o.status}</span></td>
                      <td style="padding:5px 6px;text-align:right">
                        ${gestor ? `
                          <button class="btn-mini" onclick="${arqFn}('${o.id}', ${o.status==='ativa'})">${o.status==='ativa'?'Arquivar':'Reativar'}</button>
                          <button class="btn-mini btn-mini-danger" onclick="${excluirFn}('${o.id}','${escHtml(o.nome_zip)}')">Excluir</button>
                        ` : ''}
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`).join('')}
      </div>
    </div>`;
}

// Marca/desmarca cadastro como verificado (mantido como está)
async function _bibMarcarVerificado(id, tipo, marcado) {
  const tabela = tipo === 'vi' ? 'vi_equipamentos' : 'maquinas';
  try {
    const { error } = await sb.from(tabela).update({ dup_verificado: marcado }).eq('id', id);
    if (error) throw error;
    const row = document.getElementById('bib-row-' + id);
    if (row) row.style.background = marcado ? 'var(--ok-bg)' : '';
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// Abre a ficha do cadastro em uma nova guia (via hash de rota)
function _bibAbrirNovaGuia(id, tipo) {
  const hash = tipo === 'vi' ? '#vi=' + id : '#maq=' + id;
  window.open(location.pathname + hash, '_blank');
}

// Excluir item duplicado (máquina ou equipamento V&I)
async function _bibExcluirItem(id, tipo, tag) {
  if (!confirm(`Excluir cadastro "${tag}"? Etapas, fotos e serviços vinculados serão perdidos.`)) return;
  try {
    if (tipo === 'vi') {
      await sb.from('vi_equipamentos').delete().eq('id', id);
    } else {
      await sb.from('maquinas').delete().eq('id', id);
    }
    _bibCarregarDuplicatas();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}
