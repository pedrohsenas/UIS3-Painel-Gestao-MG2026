'use strict';
// ─── ficha.js — ficha individual da máquina ────────────────────────────

const AREAS_LISTA = [
  'ARMAZÉM 01','ARMAZÉM 02','ARMAZÉM DE CAVACO',
  'CALDEIRA ICAVI','CALDEIRA MEPPAN',
  'CASA DE MÁQUINAS 01','CASA DE MÁQUINAS 02',
  'ETE','EXPEDIÇÃO DE FARELO','EXTRAÇÃO','PELETIZAÇÃO','PREPARAÇÃO'
];

let fichaAtual = null;

async function abrirFicha(id) {
  window._ajudaChave = 'ficha';
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando ficha...</div>');
  try {
    fichaAtual = await dbMaquina(id);
    renderFicha();
    if (PERFIL?.papel === 'gestor') {
      acAtivarRolamento('e-rol-diant');
      acAtivarRolamento('e-rol-tras');
      _fichaInitSaveBar();
    }
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}

function renderFicha() {
  const m = fichaAtual;
  const gestor = PERFIL?.papel === 'gestor';
  const ro = gestor ? '' : 'disabled';
  const fotosColeta = (m.fotos || []).filter(f => f.origem === 'coleta');
  const fotosPainel = (m.fotos || []).filter(f => f.origem === 'painel');

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="telaMaquinas()">‹ Voltar</button>
      <div class="ficha-titulo">
        <span class="ficha-tag">${escHtml(m.tag)}</span>
        ${m.ex ? '<span class="ex-badge">EX</span>' : ''}
        <span class="badge-status ${m.status}">${m.status === 'ativa' ? 'Ativa' : 'Arquivada'}</span>
      </div>
      ${gestor ? `
      <div class="ficha-acoes">
        <button class="btn-mini" onclick="acaoArquivarMaq()">${m.status === 'ativa' ? 'Arquivar' : 'Reativar'}</button>
        <button class="btn-mini btn-mini-danger" onclick="acaoExcluirMaq()">Excluir</button>
      </div>` : ''}
    </div>

    <div class="ficha-grid">
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Identificação</h3>
          <div class="row2">
            <div class="field"><label>TAG</label>
              <input id="e-tag" type="text" value="${escHtml(m.tag)}" ${ro}
                oninput="this.value=this.value.replace(/[^A-Z0-9\\-]/g,'').toUpperCase()" /></div>
            <div class="field"><label>Tipo</label>
              <select id="e-tipo" ${ro}>
                ${Object.entries(TIPOS_NOMES).map(([v,l])=>`<option value="${v}"${m.tipo===v?' selected':''}>${l}</option>`).join('')}
              </select></div>
          </div>
          <div class="row2">
            <div class="field"><label>Equipamento EX</label>
              <select id="e-ex" ${ro}>
                <option value="false"${!m.ex?' selected':''}>Não</option>
                <option value="true"${m.ex?' selected':''}>Sim — EX</option>
              </select></div>
            <div class="field"><label>Área</label>
              <select id="e-area" ${ro}>
                <option value="">—</option>
                ${AREAS_LISTA.map(a=>`<option value="${a}"${m.area===a?' selected':''}>${a}</option>`).join('')}
              </select></div>
          </div>
          <div class="field"><label>Localização</label>
            <input id="e-localizacao" type="text" maxlength="30" value="${escHtml(m.localizacao)}" ${ro}
              oninput="this.value=this.value.toUpperCase()" /></div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Dados de placa</h3>
          <div class="row3f">
            <div class="field"><label>Potência</label>
              <input id="e-potencia" type="number" step="any" value="${m.potencia ?? ''}" ${ro} /></div>
            <div class="field"><label>Unidade</label>
              <select id="e-unidade" ${ro}>
                ${['kW','cv','HP'].map(u=>`<option value="${u}"${(m.unidade_pot||'kW')===u?' selected':''}>${u}</option>`).join('')}
              </select></div>
            <div class="field"><label>Tensão (V)</label>
              <input id="e-tensao" type="text" maxlength="3" value="${escHtml(m.tensao)}" ${ro}
                oninput="this.value=this.value.replace(/[^0-9]/g,'')" /></div>
          </div>
          <div class="row3f">
            <div class="field"><label>Ligação</label>
              <select id="e-ligacao" ${ro}>
                <option value="trifasico"${m.ligacao!=='monofasico'?' selected':''}>Trifásico</option>
                <option value="monofasico"${m.ligacao==='monofasico'?' selected':''}>Monofásico</option>
              </select></div>
            <div class="field"><label>Corrente (A)</label>
              <input id="e-corrente" type="number" step="any" value="${m.corrente ?? ''}" ${ro} /></div>
            <div class="field"><label>RPM</label>
              <input id="e-rpm" type="number" value="${m.rpm ?? ''}" ${ro} /></div>
          </div>
          <div class="row3f">
            <div class="field"><label>FP</label>
              <input id="e-fp" type="number" step="0.01" value="${m.fp ?? ''}" ${ro} /></div>
            <div class="field"><label>IP</label>
              <input id="e-ip" type="text" value="${escHtml(m.ip)}" ${ro} /></div>
            <div class="field"><label>Classe</label>
              <select id="e-classe" ${ro}>
                <option value="">—</option>
                ${['A','B','F','H'].map(v=>`<option value="${v}"${m.classe===v?' selected':''}>${v}</option>`).join('')}
              </select></div>
          </div>
          <div class="row3f">
            <div class="field"><label>Frequência</label>
              <select id="e-freq" ${ro}>
                <option value="60"${m.freq!=='50'?' selected':''}>60 Hz</option>
                <option value="50"${m.freq==='50'?' selected':''}>50 Hz</option>
              </select></div>
            <div class="field"><label>Fabricante</label>
              <input id="e-fabricante" type="text" value="${escHtml(m.fabricante)}" ${ro} /></div>
            <div class="field"><label>Modelo</label>
              <input id="e-modelo" type="text" value="${escHtml(m.modelo)}" ${ro} /></div>
          </div>
          <div class="field"><label>Nº de série</label>
            <input id="e-serie" type="text" value="${escHtml(m.serie)}" ${ro} /></div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Rolamentos</h3>
          <div class="row2">
            <div class="field"><label>Rolamento dianteiro</label>
              <input id="e-rol-diant" type="text" value="${escHtml(m.rolamento_dianteiro)}" ${ro}
                placeholder="ex: 6309-2Z" /></div>
            <div class="field"><label>Rolamento traseiro</label>
              <input id="e-rol-tras" type="text" value="${escHtml(m.rolamento_traseiro)}" ${ro}
                placeholder="ex: 6207-2RS" /></div>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Dimensões (cm)</h3>
          <div class="row3f">
            <div class="field"><label>A — Altura</label>
              <input id="e-alt" type="number" step="0.1" value="${m.dim_alt ?? ''}" ${ro} /></div>
            <div class="field"><label>L — Largura</label>
              <input id="e-lar" type="number" step="0.1" value="${m.dim_lar ?? ''}" ${ro} /></div>
            <div class="field"><label>C — Comprimento</label>
              <input id="e-comp" type="number" step="0.1" value="${m.dim_comp ?? ''}" ${ro} /></div>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Coleta de campo</h3>
          <div class="row2">
            <div class="field"><label>Estado observado</label>
              <select id="e-status-coleta" ${ro}>
                <option value="ok"${m.status_coleta==='ok'?' selected':''}>OK</option>
                <option value="atencao"${m.status_coleta==='atencao'?' selected':''}>Atenção</option>
                <option value="critico"${m.status_coleta==='critico'?' selected':''}>Crítico</option>
              </select></div>
          </div>
          <div class="field"><label>Anotações da coleta</label>
            <textarea id="e-anotacoes" rows="3" ${ro}>${escHtml(m.anotacoes_coleta)}</textarea></div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Serviços planejados (PCM)</h3>
          <p class="page-sub" style="margin-bottom:12px">${gestor ? 'Marque os serviços que deverão ser executados nesta máquina durante a MG' : 'Serviços definidos pelo PCM para esta máquina'}</p>
          <div class="srv-grid">
            ${SERVICOS_CHECKLIST.map(s => {
              const plan = (m.servicos_planejados || []).some(p => p.servico === s);
              return `
              <label class="srv-item ${plan ? 'planejado' : ''} ${gestor ? '' : 'srv-ro'}">
                <input type="checkbox" ${plan ? 'checked' : ''} ${gestor ? `onchange="alternarPlanejado(this, '${s.replace(/'/g,"\\'")}')"` : 'disabled'} />
                <span class="srv-check"></span>
                <span class="srv-nome">${s}</span>
              </label>`;
            }).join('')}
          </div>
        </div>

        
      </div>

      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos da coleta (${fotosColeta.length})</h3>
          <div class="foto-galeria" id="galeria-coleta">${renderGaleria(fotosColeta, gestor)}</div>
          <label class="add-foto-btn">
            <input type="file" accept="image/*" multiple style="display:none" onchange="adicionarFotosFicha(this, 'coleta')" />
            + Adicionar fotos da coleta
          </label>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos do painel (${fotosPainel.length})</h3>
          <div class="foto-galeria" id="galeria-painel">${renderGaleria(fotosPainel, gestor)}</div>
          ${gestor ? `
          <label class="add-foto-btn">
            <input type="file" accept="image/*" multiple style="display:none" onchange="adicionarFotosFicha(this, 'painel')" />
            + Adicionar fotos do painel
          </label>` : '<p class="page-sub">Apenas o PCM adiciona fotos do painel</p>'}
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Etapas</h3>
          <div class="etapas-resumo">
            ${(m.etapas || []).sort((a,b)=>a.ordem-b.ordem).map(e => `
              <div class="etapa-linha etapa-click" onclick="telaEtapa('${e.id}')">
                <span class="etapa-dot ${e.status}"></span>
                <span class="etapa-nome">${NOMES_ETAPAS[e.codigo] || e.codigo}</span>
                ${e.prazo ? `<span class="etapa-prazo ${etapaAtrasada(e) ? 'atrasada' : ''}">${new Date(e.prazo+'T12:00').toLocaleDateString('pt-BR')}</span>` : ''}
                <span class="etapa-st">${({pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída'})[e.status]}</span>
                <span class="td-seta">›</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `);
}

const NOMES_ETAPAS = {
  levantamento: 'Levantamento de dados',
  compra_componentes: 'Compra de componentes',
  preparacao_recursos: 'Preparação de recursos',
  retirada: 'Retirada da máquina',
  manutencao_planejada: 'Execução da manutenção',
  instalacao_conferencia: 'Instalação e conferência',
  conclusao: 'Conclusão'
};

function renderGaleria(fotos, gestor) {
  if (!fotos.length) return '<p class="page-sub">Nenhuma foto</p>';
  // Determina qual é a principal: a definida, ou a primeira foto da máquina (padrão)
  const todas = fichaAtual.fotos || [];
  let principalId = fichaAtual.foto_principal_id;
  if (!principalId && todas.length) principalId = todas[0].id;
  return fotos.map(f => {
    const ehPrincipal = f.id === principalId;
    return `
    <div class="foto-thumb-painel ${ehPrincipal ? 'eh-principal' : ''}">
      <img src="${dbUrlFoto(f.caminho_storage)}" loading="lazy" alt="foto"
     style="cursor:zoom-in" onclick="abrirVisor('${dbUrlFoto(f.caminho_storage)}')" />
      <button class="foto-principal-btn ${ehPrincipal ? 'ativa' : ''}"
        title="${ehPrincipal ? 'Foto principal' : 'Definir como foto principal'}"
        onclick="definirPrincipal('${f.id}', ${ehPrincipal})">★</button>
      ${gestor ? `<button class="foto-del-painel" onclick="excluirFotoFicha('${f.id}','${f.caminho_storage}')">✕</button>` : ''}
    </div>`;
  }).join('');
}

async function definirPrincipal(fotoId, jaEhPrincipal) {
  if (jaEhPrincipal) return;
  if (!confirm('Definir esta foto como a imagem principal da máquina?\n\nEla será exibida na lista de máquinas.')) return;
  try {
    await dbDefinirFotoPrincipal(fichaAtual.id, fotoId);
    fichaAtual = await dbMaquina(fichaAtual.id);
    renderFicha();
  } catch (e) { alert('Erro: ' + e.message); }
}

// Inicializa barra de salvamento e observa campos editáveis da ficha
function _fichaInitSaveBar() {
  if (PERFIL?.papel !== 'gestor') return;
  if (typeof SaveBar === 'undefined') return;
  SaveBar.init({ onSave: salvarFicha, contexto: 'máquina' });
  const cont = document.getElementById('conteudo');
  if (!cont) return;
  cont.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'file' || el._sbBound) return;
    el._sbBound = true;
    const ev = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(ev, () => SaveBar.markDirty());
  });
}

async function salvarFicha() {
  const num = id => { const v = document.getElementById(id).value; return v === '' ? null : parseFloat(v); };
  try {
    await dbAtualizarMaquina(fichaAtual.id, {
      tag: document.getElementById('e-tag').value.trim(),
      tipo: document.getElementById('e-tipo').value,
      ex: document.getElementById('e-ex').value === 'true',
      area: document.getElementById('e-area').value,
      localizacao: document.getElementById('e-localizacao').value.trim(),
      potencia: num('e-potencia'),
      unidade_pot: document.getElementById('e-unidade').value,
      tensao: document.getElementById('e-tensao').value.trim(),
      ligacao: document.getElementById('e-ligacao').value,
      corrente: num('e-corrente'),
      rpm: num('e-rpm'),
      fp: num('e-fp'),
      ip: document.getElementById('e-ip').value.trim(),
      classe: document.getElementById('e-classe').value,
      freq: document.getElementById('e-freq').value,
      fabricante: document.getElementById('e-fabricante').value.trim(),
      modelo: document.getElementById('e-modelo').value.trim(),
      serie: document.getElementById('e-serie').value.trim(),
      rolamento_dianteiro: document.getElementById('e-rol-diant').value.trim(),
      rolamento_traseiro: document.getElementById('e-rol-tras').value.trim(),
      dim_alt: num('e-alt'),
      dim_lar: num('e-lar'),
      dim_comp: num('e-comp'),
      status_coleta: document.getElementById('e-status-coleta').value,
      anotacoes_coleta: document.getElementById('e-anotacoes').value.trim()
    });
    // SaveBar cuida do feedback visual de sucesso
  } catch (e) {
    throw e; // SaveBar exibe o erro
  }
}

async function acaoArquivarMaq() {
  const novo = fichaAtual.status === 'ativa' ? 'arquivada' : 'ativa';
  await dbAtualizarMaquina(fichaAtual.id, { status: novo });
  abrirFicha(fichaAtual.id);
}

async function acaoExcluirMaq() {
  if (!confirm(`Excluir a máquina ${fichaAtual.tag}?\n\nTodas as etapas e fotos vinculadas serão excluídas. Esta ação não pode ser desfeita.`)) return;
  try {
    await dbExcluirMaquina(fichaAtual.id);
    telaMaquinas();
  } catch (e) { alert('Erro: ' + e.message); }
}

function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => {
      img.onload = () => {
        const MAX = 1400;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h*MAX/w); w = MAX; }
          else       { w = Math.round(w*MAX/h); h = MAX; }
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao comprimir')), 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Falha na leitura'));
    reader.readAsDataURL(file);
  });
}

async function adicionarFotosFicha(input, origem) {
  origem = origem || 'painel';
  const files = Array.from(input.files);
  if (!files.length) return;
  const galeria = document.getElementById(origem === 'coleta' ? 'galeria-coleta' : 'galeria-painel');
  galeria.insertAdjacentHTML('beforeend', '<div class="loading"><div class="spinner"></div> Enviando...</div>');
  try {
    for (const file of files) {
      const blob = await comprimirImagem(file);
      const nome = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const caminho = `maquinas/${fichaAtual.id}/${origem}_${nome}`;
      await dbUploadFoto(caminho, blob);
      await dbRegistrarFoto(fichaAtual.id, caminho, origem);
    }
    abrirFicha(fichaAtual.id);
  } catch (e) {
    alert('Erro no envio: ' + e.message);
    abrirFicha(fichaAtual.id);
  }
  input.value = '';
}

async function excluirFotoFicha(fotoId, caminho) {
  if (!confirm('Excluir esta foto?')) return;
  try {
    await dbExcluirFoto(fotoId, caminho);
    abrirFicha(fichaAtual.id);
  } catch (e) { alert('Erro: ' + e.message); }
}


async function alternarPlanejado(checkbox, servico) {
  checkbox.disabled = true;
  try {
    if (checkbox.checked) await dbPlanejarServico(fichaAtual.id, servico);
    else await dbRemoverServicoPlanejado(fichaAtual.id, servico);
    fichaAtual = await dbMaquina(fichaAtual.id);
    renderFicha();
  } catch (e) {
    alert('Erro: ' + e.message);
    checkbox.checked = !checkbox.checked;
    checkbox.disabled = false;
  }
}
