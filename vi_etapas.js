'use strict';
// ─── vi_etapas.js — gestão das 6 etapas de V&I ─────────────────────────

let viEtapaAtual = null;
let _viPerfisCache = null;

// Etapa onde o checklist de serviços é conferido: "Retorno da manutenção"
const VI_ETAPA_MANUTENCAO = 'retorno_manutencao';

async function viTelaEtapa(id) {
  window._ajudaChave = 'vi_etapa';
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando etapa...</div>');
  try {
    viEtapaAtual = await viEtapaDetalhe(id);
    if (!_viPerfisCache && PERFIL?.papel === 'gestor') _viPerfisCache = await dbListarPerfis();
    viRenderEtapa();
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}

function viEtapaAtrasadaCheck(e) {
  return e.prazo && e.status !== 'concluida' && new Date(e.prazo + 'T23:59:59') < new Date();
}

function viRenderEtapa() {
  const e = viEtapaAtual;
  const eq = e.vi_equipamentos;
  const gestor = PERFIL?.papel === 'gestor';
  const atrasada = viEtapaAtrasadaCheck(e);
  const ehManutencao = e.codigo === VI_ETAPA_MANUTENCAO;
  const servicosFeitos = (e.vi_servicos_realizados || []).map(s => s.servico);
  const fotosEtapa = (e.vi_fotos || []).filter(f => f.etapa_id === e.id);

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="viAbrirFicha('${eq.id}')">‹ ${escHtml(eq.tag)}</button>
      <div class="ficha-titulo">
        <span class="etapa-titulo-nome">${VI_ETAPAS_NOMES[e.codigo]}</span>
        <span class="badge-etapa ${e.status}">${({pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída'})[e.status]}</span>
        ${atrasada ? '<span class="badge-atrasada">⚠ Atrasada</span>' : ''}
      </div>
    </div>

    <div class="ficha-grid">
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Controle</h3>
          <div class="row3f">
            <div class="field"><label>Status</label>
              <select id="vet-status">
                <option value="pendente"${e.status==='pendente'?' selected':''}>Pendente</option>
                <option value="em_andamento"${e.status==='em_andamento'?' selected':''}>Em andamento</option>
                <option value="concluida"${e.status==='concluida'?' selected':''}>Concluída</option>
              </select></div>
            <div class="field"><label>Prazo</label>
              <input id="vet-prazo" type="date" value="${e.prazo || ''}" ${gestor ? '' : 'disabled'} /></div>
            <div class="field"><label>Responsável ${gestor ? '*' : ''}</label>
              ${gestor ? `
              <select id="vet-resp">
                <option value="">— selecione —</option>
                ${(_viPerfisCache || []).map(p => `<option value="${escHtml(p.nome)}"${e.responsavel===p.nome?' selected':''}>${escHtml(p.nome)} (${p.papel==='gestor'?'Gestor':'Técnico'})</option>`).join('')}
              </select>` : `
              <input id="vet-resp" type="text" value="${escHtml(PERFIL?.nome || '')}" disabled title="Preenchido automaticamente com o usuário logado" />`}
            </div>
          </div>
          ${e.concluido_em ? `<p class="page-sub">Concluída em ${new Date(e.concluido_em).toLocaleString('pt-BR')}</p>` : ''}
        </div>

        ${ehManutencao ? (() => {
          const planejados = (eq.vi_servicos_planejados || []).map(p => p.servico);
          const pendentes = planejados.filter(s => !servicosFeitos.includes(s));
          if (!planejados.length) return `
          <div class="card-sec">
            <h3 class="card-sec-titulo">Serviços planejados</h3>
            <div class="alert-prazos">⚠ Nenhum serviço planejado para este equipamento. Solicite ao PCM a definição na ficha do equipamento ou na tela de Serviços V&I.</div>
          </div>`;
          return `
          <div class="card-sec">
            <h3 class="card-sec-titulo">Conferência dos serviços planejados (${servicosFeitos.filter(s=>planejados.includes(s)).length}/${planejados.length})</h3>
            <p class="page-sub" style="margin-bottom:12px">Confirme cada serviço conforme executado. A etapa só pode ser concluída com todos confirmados.</p>
            <div class="srv-grid">
              ${planejados.map(s => {
                const feito = servicosFeitos.includes(s);
                return `
                <label class="srv-item ${feito ? 'feito' : 'srv-pend'}">
                  <input type="checkbox" ${feito ? 'checked' : ''}
                    onchange="viAlternarServico(this, '${s.replace(/'/g,"\\'")}')"
                    ${feito && !gestor ? 'disabled title="Apenas gestor pode desmarcar"' : ''} />
                  <span class="srv-check"></span><span class="srv-nome">${s}</span>
                </label>`;
              }).join('')}
            </div>
            ${pendentes.length ? `<p class="page-sub" style="margin-top:10px;color:var(--warn)">Pendentes: ${pendentes.length}</p>` : '<p class="page-sub" style="margin-top:10px;color:var(--ok)">✓ Todos os serviços confirmados</p>'}
            ${!gestor ? '<p class="page-sub" style="margin-top:4px">Serviços confirmados só podem ser desmarcados por um gestor</p>' : ''}
          </div>`;
        })() : ''}

        <div class="card-sec">
          <h3 class="card-sec-titulo">Anotações gerais</h3>
          <textarea id="vet-anotacoes" rows="5" placeholder="Registre observações desta etapa...">${escHtml(e.anotacoes)}</textarea>
        </div>

        <button class="btn" id="vi-btn-salvar-etapa" onclick="viSalvarEtapa()">Salvar etapa</button>
      </div>

      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos da etapa (${fotosEtapa.length})</h3>
          <div class="foto-galeria" id="vi-galeria-etapa">
            ${fotosEtapa.length ? fotosEtapa.map(f => {
              const url = dbUrlFoto(f.caminho_storage);
              return `
              <div class="foto-thumb-painel">
                <img src="${url}" loading="lazy" alt="foto" style="cursor:zoom-in" onclick="abrirVisor('${url}')" />
                ${gestor ? `<button class="foto-del-painel" onclick="viExcluirFotoEtapa('${f.id}','${f.caminho_storage}')">✕</button>` : ''}
              </div>`;
            }).join('') : '<p class="page-sub">Nenhuma foto nesta etapa</p>'}
          </div>
          <label class="add-foto-btn">
            <input type="file" accept="image/*" multiple style="display:none" onchange="viAdicionarFotosEtapa(this)" />
            + Adicionar fotos
          </label>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Equipamento</h3>
          <div class="info-mini">
            <div><span>TAG</span><strong class="td-mono">${escHtml(eq.tag)}</strong></div>
            <div><span>Domínio</span><strong>${eq.dominio === 'valvula' ? 'Válvula' : 'Instrumento'}</strong></div>
          </div>
        </div>
      </div>
    </div>
  `);
}

async function viSalvarEtapa() {
  const btn = document.getElementById('vi-btn-salvar-etapa');
  const status = document.getElementById('vet-status').value;
  const gestor = PERFIL?.papel === 'gestor';

  const responsavel = gestor
    ? document.getElementById('vet-resp').value.trim()
    : (PERFIL?.nome || '');
  if (gestor && !responsavel) { alert('Selecione o responsável pela etapa.'); return; }

  // Trava: etapa de manutenção só conclui com todos os serviços confirmados
  if (status === 'concluida' && viEtapaAtual.codigo === VI_ETAPA_MANUTENCAO) {
    const planejados = (viEtapaAtual.vi_equipamentos.vi_servicos_planejados || []).map(p => p.servico);
    const feitos = (viEtapaAtual.vi_servicos_realizados || []).map(s => s.servico);
    const pendentes = planejados.filter(s => !feitos.includes(s));
    if (pendentes.length) {
      alert('Não é possível concluir: há ' + pendentes.length + ' serviço(s) planejado(s) sem confirmação:\n\n• ' + pendentes.join('\n• '));
      return;
    }
  }

  btn.disabled = true; btn.textContent = 'Salvando...';
  const campos = {
    status, responsavel,
    anotacoes: document.getElementById('vet-anotacoes').value.trim(),
    concluido_em: status === 'concluida' ? (viEtapaAtual.concluido_em || new Date().toISOString()) : null
  };
  if (gestor) campos.prazo = document.getElementById('vet-prazo').value || null;

  try {
    await viAtualizarEtapa(viEtapaAtual.id, campos);
    btn.textContent = '✓ Salvo';
    setTimeout(() => viTelaEtapa(viEtapaAtual.id), 800);
  } catch (e) {
    alert('Erro: ' + e.message);
    btn.disabled = false; btn.textContent = 'Salvar etapa';
  }
}

async function viAlternarServico(cb, servico) {
  cb.disabled = true;
  try {
    if (cb.checked) await viConfirmarServico(viEtapaAtual.id, servico);
    else await viRemoverServico(viEtapaAtual.id, servico);
    viTelaEtapa(viEtapaAtual.id);
  } catch (e) { alert('Erro: ' + e.message); cb.checked = !cb.checked; cb.disabled = false; }
}

async function viAdicionarFotosEtapa(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const galeria = document.getElementById('vi-galeria-etapa');
  galeria.insertAdjacentHTML('beforeend', '<div class="loading"><div class="spinner"></div> Enviando...</div>');
  try {
    for (const file of files) {
      const blob = await comprimirImagem(file);
      const nome = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const caminho = `vi/${viEtapaAtual.vi_equipamentos.id}/etapas/${viEtapaAtual.codigo}/${nome}`;
      await dbUploadFoto(caminho, blob);
      await viRegistrarFotoEtapa(viEtapaAtual.vi_equipamentos.id, viEtapaAtual.id, caminho);
    }
    viTelaEtapa(viEtapaAtual.id);
  } catch (e) { alert('Erro no envio: ' + e.message); viTelaEtapa(viEtapaAtual.id); }
  input.value = '';
}

async function viExcluirFotoEtapa(fotoId, caminho) {
  if (!confirm('Excluir esta foto?')) return;
  try { await viExcluirFoto(fotoId, caminho); viTelaEtapa(viEtapaAtual.id); }
  catch (e) { alert('Erro: ' + e.message); }
}

// Garante que a versão real sobrescreva qualquer placeholder, independente da ordem de carregamento
window.viTelaEtapa = viTelaEtapa;
