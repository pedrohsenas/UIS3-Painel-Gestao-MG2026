'use strict';
// ─── etapas.js — gestão individual de cada etapa ───────────────────────

const SERVICOS_CHECKLIST = [
  'Troca de rolamento','Alinhamento','Balanceamento',
  'Megagem (isolamento)','Limpeza interna','Reaperto de conexões elétricas',
  'Troca de vedação / retentor','Lubrificação','Revisão de acoplamento',
  'Pintura / tratamento externo','Inspeção termográfica','Outros'
];

let etapaAtual = null;

let _perfisCache = null;

async function telaEtapa(id) {
  window._ajudaChave = 'etapa';
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando etapa...</div>');
  try {
    etapaAtual = await dbEtapaDetalhe(id);
    if (!_perfisCache && PERFIL?.papel === 'gestor') _perfisCache = await dbListarPerfis();
    renderEtapa();
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}

function etapaAtrasada(e) {
  return e.prazo && e.status !== 'concluida' && new Date(e.prazo + 'T23:59:59') < new Date();
}

function renderEtapa() {
  const e = etapaAtual;
  const m = e.maquinas;
  const gestor = PERFIL?.papel === 'gestor';
  const atrasada = etapaAtrasada(e);
  const ehManutencao = e.codigo === 'manutencao_planejada';
  const servicosFeitos = (e.servicos_realizados || []).map(s => s.servico);
  const fotosEtapa = (e.fotos || []).filter(f => f.etapa_id === e.id);

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="abrirFicha('${m.id}')">‹ ${escHtml(m.tag)}</button>
      <div class="ficha-titulo">
        <span class="etapa-titulo-nome">${NOMES_ETAPAS[e.codigo]}</span>
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
              <select id="et-status">
                <option value="pendente"${e.status==='pendente'?' selected':''}>Pendente</option>
                <option value="em_andamento"${e.status==='em_andamento'?' selected':''}>Em andamento</option>
                <option value="concluida"${e.status==='concluida'?' selected':''}>Concluída</option>
              </select></div>
            <div class="field"><label>Prazo</label>
              <input id="et-prazo" type="date" value="${e.prazo || ''}" ${gestor ? '' : 'disabled'} /></div>
            <div class="field"><label>Responsável ${gestor ? '*' : ''}</label>
              ${gestor ? `
              <select id="et-resp">
                <option value="">— selecione —</option>
                ${(_perfisCache || []).map(p => `<option value="${escHtml(p.nome)}"${e.responsavel === p.nome ? ' selected' : ''}>${escHtml(p.nome)} (${p.papel === 'gestor' ? 'Gestor' : 'Técnico'})</option>`).join('')}
              </select>` : `
              <input id="et-resp" type="text" value="${escHtml(PERFIL?.nome || '')}" disabled title="Preenchido automaticamente com o usuário logado" />`}
            </div>
          </div>
          ${e.concluido_em ? `<p class="page-sub">Concluída em ${new Date(e.concluido_em).toLocaleString('pt-BR')}</p>` : ''}
        </div>

        ${ehManutencao ? (() => {
          const planejados = (m.servicos_planejados || []).map(p => p.servico);
          const pendentes = planejados.filter(s => !servicosFeitos.includes(s));
          if (!planejados.length) return `
          <div class="card-sec">
            <h3 class="card-sec-titulo">Serviços planejados</h3>
            <div class="alert-prazos">⚠ Nenhum serviço planejado para esta máquina. Solicite ao PCM a definição na ficha da máquina ou na tela Serviços.</div>
          </div>`;
          return `
          <div class="card-sec">
            <h3 class="card-sec-titulo">Conferência dos serviços planejados (${servicosFeitos.filter(s=>planejados.includes(s)).length}/${planejados.length})</h3>
            <p class="page-sub" style="margin-bottom:12px">Confirme cada serviço conforme for executado. A etapa só pode ser concluída com todos os serviços confirmados.</p>
            <div class="srv-grid">
              ${planejados.map(s => {
                const feito = servicosFeitos.includes(s);
                return `
                <label class="srv-item ${feito ? 'feito' : 'srv-pend'}">
                  <input type="checkbox" ${feito ? 'checked' : ''}
                    onchange="alternarServico(this, '${s.replace(/'/g,"\\'")}')"
                    ${feito && !gestor ? 'disabled title="Apenas gestor pode desmarcar"' : ''} />
                  <span class="srv-check"></span>
                  <span class="srv-nome">${s}</span>
                </label>`;
              }).join('')}
            </div>
            ${pendentes.length ? `<p class="page-sub" style="margin-top:10px;color:var(--warn)">Pendentes: ${pendentes.length}</p>` : '<p class="page-sub" style="margin-top:10px;color:var(--ok)">✓ Todos os serviços confirmados</p>'}
            ${!gestor ? '<p class="page-sub" style="margin-top:4px">Serviços confirmados só podem ser desmarcados por um gestor</p>' : ''}
          </div>`;
        })() : ''}

        <div class="card-sec">
          <h3 class="card-sec-titulo">Anotações gerais</h3>
          <textarea id="et-anotacoes" rows="5" placeholder="Registre observações desta etapa...">${escHtml(e.anotacoes)}</textarea>
        </div>

        <button class="btn" id="btn-salvar-etapa" onclick="salvarEtapa()">Salvar etapa</button>
      </div>

      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos da etapa (${fotosEtapa.length})</h3>
          <div class="foto-galeria" id="galeria-etapa">
            ${fotosEtapa.length ? fotosEtapa.map(f => `
              <div class="foto-thumb-painel">
                <a href="${dbUrlFoto(f.caminho_storage)}" target="_blank">
                  <img src="${dbUrlFoto(f.caminho_storage)}" loading="lazy" alt="foto" />
                </a>
                ${gestor ? `<button class="foto-del-painel" onclick="excluirFotoEtapa('${f.id}','${f.caminho_storage}')">✕</button>` : ''}
              </div>`).join('') : '<p class="page-sub">Nenhuma foto nesta etapa</p>'}
          </div>
          <label class="add-foto-btn">
            <input type="file" accept="image/*" multiple style="display:none" onchange="adicionarFotosEtapa(this)" />
            + Adicionar fotos
          </label>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Máquina</h3>
          <div class="info-mini">
            <div><span>TAG</span><strong class="td-mono">${escHtml(m.tag)}</strong></div>
            <div><span>Tipo</span><strong>${TIPOS_NOMES[m.tipo] || m.tipo}</strong></div>
            <div><span>EX</span><strong>${m.ex ? 'Sim' : 'Não'}</strong></div>
          </div>
        </div>
      </div>
    </div>
  `);
}

async function salvarEtapa() {
  const btn = document.getElementById('btn-salvar-etapa');
  const status = document.getElementById('et-status').value;
  const gestor = PERFIL?.papel === 'gestor';

  // Responsável: automático para técnico; obrigatório para gestor
  const responsavel = gestor
    ? document.getElementById('et-resp').value.trim()
    : (PERFIL?.nome || '');
  if (gestor && !responsavel) {
    alert('Selecione o responsável pela etapa.');
    return;
  }

  // Trava: execução da manutenção só conclui com todos os serviços planejados confirmados
  if (status === 'concluida' && etapaAtual.codigo === 'manutencao_planejada') {
    const planejados = (etapaAtual.maquinas.servicos_planejados || []).map(p => p.servico);
    const feitos = (etapaAtual.servicos_realizados || []).map(s => s.servico);
    const pendentes = planejados.filter(s => !feitos.includes(s));
    if (pendentes.length) {
      alert('Não é possível concluir: há ' + pendentes.length + ' serviço(s) planejado(s) sem confirmação:\n\n• ' + pendentes.join('\n• '));
      return;
    }
  }

  btn.disabled = true; btn.textContent = 'Salvando...';
  const campos = {
    status,
    responsavel,
    anotacoes: document.getElementById('et-anotacoes').value.trim(),
    concluido_em: status === 'concluida'
      ? (etapaAtual.concluido_em || new Date().toISOString())
      : null
  };
  if (gestor) {
    campos.prazo = document.getElementById('et-prazo').value || null;
  }
  try {
    await dbAtualizarEtapa(etapaAtual.id, campos);
    btn.textContent = '✓ Salvo';
    setTimeout(() => telaEtapa(etapaAtual.id), 800);
  } catch (e) {
    alert('Erro: ' + e.message);
    btn.disabled = false; btn.textContent = 'Salvar etapa';
  }
}

async function alternarServico(checkbox, servico) {
  checkbox.disabled = true;
  try {
    if (checkbox.checked) {
      await dbConfirmarServico(etapaAtual.id, servico);
    } else {
      await dbRemoverServico(etapaAtual.id, servico);
    }
    telaEtapa(etapaAtual.id);
  } catch (e) {
    alert('Erro: ' + e.message);
    checkbox.checked = !checkbox.checked;
    checkbox.disabled = false;
  }
}

async function adicionarFotosEtapa(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const galeria = document.getElementById('galeria-etapa');
  galeria.insertAdjacentHTML('beforeend', '<div class="loading"><div class="spinner"></div> Enviando...</div>');
  try {
    for (const file of files) {
      const blob = await comprimirImagem(file);
      const nome = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const caminho = `maquinas/${etapaAtual.maquinas.id}/etapas/${etapaAtual.codigo}/${nome}`;
      await dbUploadFoto(caminho, blob);
      await dbRegistrarFotoEtapa(etapaAtual.maquinas.id, etapaAtual.id, caminho);
    }
    telaEtapa(etapaAtual.id);
  } catch (e) {
    alert('Erro no envio: ' + e.message);
    telaEtapa(etapaAtual.id);
  }
  input.value = '';
}

async function excluirFotoEtapa(fotoId, caminho) {
  if (!confirm('Excluir esta foto?')) return;
  try {
    await dbExcluirFoto(fotoId, caminho);
    telaEtapa(etapaAtual.id);
  } catch (e) { alert('Erro: ' + e.message); }
}
