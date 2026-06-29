'use strict';
// ─── vi_ficha.js — ficha individual de V&I ─────────────────────────────

const VI_AREAS = [
  'ARMAZÉM 01','ARMAZÉM 02','ARMAZÉM DE CAVACO',
  'CALDEIRA ICAVI','CALDEIRA MEPPAN',
  'CASA DE MÁQUINAS 01','CASA DE MÁQUINAS 02',
  'ETE','EXPEDIÇÃO DE FARELO','EXTRAÇÃO','PELETIZAÇÃO','PREPARAÇÃO'
];
const VI_TIPOS_INST = [
  'Transmissor de pressão','Transmissor de temperatura','Transmissor de nível',
  'Transmissor de vazão','Sensor de temperatura (PT100/Termopar)','Manômetro',
  'Termômetro','Pressostato','Termostato','Chave de nível','Sensor indutivo',
  'Sensor capacitivo','Célula de carga','Analisador','Posicionador','Outro'
];
const VI_CRITICIDADES = ['A — Alta', 'B — Média', 'C — Baixa'];
const VI_TIPOS_VALV = [
  'Esfera','Borboleta','Gaveta','Globo','Retenção','Agulha','Diafragma',
  'Macho','Guilhotina','Segurança / Alívio','Solenoide','Controle','Outro'
];
const VI_DNS = ['DN15','DN20','DN25','DN32','DN40','DN50','DN65','DN80','DN100','DN125',
  'DN150','DN200','DN250','DN300','DN350','DN400','DN450','DN500','Outro'];
const VI_CLASSES = ['125#','150#','300#','600#','900#','PN10','PN16','PN25','PN40','Outra'];
const VI_ATUADORES = ['Manual','Pneumático','Elétrico','Hidráulico','Eletro-hidráulico','Autoatuada','Sem atuador'];

let viFichaAtual = null;

function viSelOpts(lista, atual) {
  return lista.map(v => `<option value="${escHtml(v)}"${atual===v?' selected':''}>${escHtml(v)}</option>`).join('');
}

async function viAbrirFicha(id) {
  window._ajudaChave = 'vi_ficha';
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando ficha...</div>');
  try {
    viFichaAtual = await viEquipamento(id);
    viRenderFicha();
    _viFichaInitSaveBar();
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}

function viRenderFicha() {
  const m = viFichaAtual;
  const ehInst = m.dominio === 'instrumento';
  const gestor = PERFIL?.papel === 'gestor';
  const ro = gestor ? '' : 'disabled';
  const fotosColeta = (m.vi_fotos || []).filter(f => f.origem === 'coleta');
  const fotosPainel = (m.vi_fotos || []).filter(f => f.origem === 'painel');

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="viTelaEquip('${m.dominio}')">‹ Voltar</button>
      <div class="ficha-titulo">
        <span class="ficha-tag">${escHtml(m.tag)}</span>
        ${m.ex ? '<span class="ex-badge">EX</span>' : ''}
        <span class="cat-badge ${m.dominio}">${ehInst ? 'INSTRUMENTO' : 'VÁLVULA'}</span>
        <span class="badge-status ${m.status}">${m.status === 'ativa' ? 'Ativo' : 'Arquivado'}</span>
      </div>
      ${gestor ? `<div class="ficha-acoes">
        <button class="btn-mini" onclick="viArquivar()">${m.status === 'ativa' ? 'Arquivar' : 'Reativar'}</button>
        <button class="btn-mini btn-mini-danger" onclick="viExcluir()">Excluir</button>
      </div>` : ''}
    </div>

    <div class="ficha-grid">
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Identificação</h3>
          <div class="row2">
            <div class="field"><label>TAG</label>
              <input id="ve-tag" type="text" value="${escHtml(m.tag)}" ${ro}
                oninput="this.value=this.value.replace(/[^A-Z0-9\\-]/g,'').toUpperCase()" /></div>
            <div class="field"><label>Tipo</label>
              <select id="ve-tipo" ${ro}>
                <option value="">—</option>
                ${viSelOpts(ehInst ? VI_TIPOS_INST : VI_TIPOS_VALV, m.tipo)}
              </select></div>
          </div>
          <div class="row2">
            <div class="field"><label>Área</label>
              <select id="ve-area" ${ro}><option value="">—</option>${viSelOpts(VI_AREAS, m.area)}</select></div>
            <div class="field"><label>Localização</label>
              <input id="ve-localizacao" type="text" maxlength="30" value="${escHtml(m.localizacao)}" ${ro}
                oninput="this.value=this.value.toUpperCase()" /></div>
          </div>
          ${ehInst ? `
          <div class="field"><label>Equipamento EX</label>
            <select id="ve-ex" ${ro}>
              <option value="false"${!m.ex?' selected':''}>Não</option>
              <option value="true"${m.ex?' selected':''}>Sim — EX</option>
            </select></div>` : ''}
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Dados ${ehInst ? 'do instrumento' : 'da válvula'}</h3>
          <div class="row2">
            <div class="field"><label>Fabricante</label>
              <input id="ve-fabricante" type="text" value="${escHtml(m.fabricante)}" ${ro} /></div>
            <div class="field"><label>Modelo</label>
              <input id="ve-modelo" type="text" value="${escHtml(m.modelo)}" ${ro} /></div>
          </div>
          <div class="row2">
            <div class="field"><label>Nº de série</label>
              <input id="ve-serie" type="text" value="${escHtml(m.serie)}" ${ro} /></div>
            ${ehInst ? `
            <div class="field"><label>Ano de fabricação</label>
              <input id="ve-ano" type="text" maxlength="4" value="${escHtml(m.ano_fabricacao)}" ${ro}
                oninput="this.value=this.value.replace(/[^0-9]/g,'')" /></div>`
            : `
            <div class="field"><label>DN</label>
              <select id="ve-dn" ${ro}><option value="">—</option>${viSelOpts(VI_DNS, m.dn)}</select></div>`}
          </div>
          ${ehInst ? `
          <div class="row2">
            <div class="field"><label>Código do fabricante</label>
              <input id="ve-codigo" type="text" value="${escHtml(m.codigo_fabricante)}" ${ro} /></div>
            <div class="field"><label>Criticidade</label>
              <select id="ve-criticidade" ${ro}><option value="">—</option>${viSelOpts(VI_CRITICIDADES, m.criticidade)}</select></div>
          </div>`
          : `
          <div class="row2">
            <div class="field"><label>Classe</label>
              <select id="ve-classe" ${ro}><option value="">—</option>${viSelOpts(VI_CLASSES, m.classe)}</select></div>
            <div class="field"><label>Atuador</label>
              <select id="ve-atuador" ${ro}><option value="">—</option>${viSelOpts(VI_ATUADORES, m.atuador)}</select></div>
          </div>`}
        </div>

        ${!ehInst ? `
        <div class="card-sec">
          <h3 class="card-sec-titulo">Condição</h3>
          <div class="status-group">
            ${['ok','atencao','critico'].map(s => `
              <label class="status-opt ${s}">
                <input type="radio" name="ve-condicao" value="${s}" ${(m.condicao||'ok')===s?'checked':''} ${ro} />
                <span class="status-dot"></span><span>${({ok:'OK',atencao:'Atenção',critico:'Crítico'})[s]}</span>
              </label>`).join('')}
          </div>
        </div>` : ''}

        <div class="card-sec">
          <h3 class="card-sec-titulo">Dimensões (cm)</h3>
          <div class="row3f">
            <div class="field"><label>A — Altura</label>
              <input id="ve-alt" type="number" step="0.1" value="${m.dim_alt ?? ''}" ${ro} /></div>
            <div class="field"><label>L — Largura</label>
              <input id="ve-lar" type="number" step="0.1" value="${m.dim_lar ?? ''}" ${ro} /></div>
            <div class="field"><label>C — Comprimento</label>
              <input id="ve-comp" type="number" step="0.1" value="${m.dim_comp ?? ''}" ${ro} /></div>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Coleta de campo</h3>
          <div class="field"><label>Anotações da coleta</label>
            <textarea id="ve-anotacoes" rows="3" ${ro}>${escHtml(m.anotacoes_coleta)}</textarea></div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Serviços planejados (PCM)</h3>
          <p class="page-sub" style="margin-bottom:12px">${gestor ? 'Marque os serviços que deverão ser executados neste equipamento' : 'Serviços definidos pelo PCM'}</p>
          <div class="srv-grid">
            ${viServicosDe(m.dominio).map(s => {
              const plan = (m.vi_servicos_planejados || []).some(p => p.servico === s);
              return `
              <label class="srv-item ${plan ? 'planejado' : ''} ${gestor ? '' : 'srv-ro'}">
                <input type="checkbox" ${plan ? 'checked' : ''} ${gestor ? `onchange="viAlternarPlanejado(this, '${s.replace(/'/g,"\\'")}')"` : 'disabled'} />
                <span class="srv-check"></span><span class="srv-nome">${s}</span>
              </label>`;
            }).join('')}
          </div>
        </div>

        
      </div>

      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos da coleta (${fotosColeta.length})</h3>
          <div class="foto-galeria" id="vi-galeria-coleta">${viRenderGaleria(fotosColeta, gestor)}</div>
          <label class="add-foto-btn">
            <input type="file" accept="image/*" multiple style="display:none" onchange="viAdicionarFotos(this, 'coleta')" />
            + Adicionar fotos da coleta
          </label>
        </div>
        <div class="card-sec">
          <h3 class="card-sec-titulo">Fotos do painel (${fotosPainel.length})</h3>
          <div class="foto-galeria" id="vi-galeria-painel">${viRenderGaleria(fotosPainel, gestor)}</div>
          ${gestor ? `
          <label class="add-foto-btn">
            <input type="file" accept="image/*" multiple style="display:none" onchange="viAdicionarFotos(this, 'painel')" />
            + Adicionar fotos do painel
          </label>` : '<p class="page-sub">Apenas o PCM adiciona fotos do painel</p>'}
        </div>
        <div class="card-sec">
          <h3 class="card-sec-titulo">Etapas</h3>
          <div class="etapas-resumo">
            ${(m.vi_etapas || []).sort((a,b)=>a.ordem-b.ordem).map(e => `
              <div class="etapa-linha etapa-click" onclick="viTelaEtapa('${e.id}')">
                <span class="etapa-dot ${e.status}"></span>
                <span class="etapa-nome">${VI_ETAPAS_NOMES[e.codigo] || e.codigo}</span>
                ${e.prazo ? `<span class="etapa-prazo ${viEtapaAtrasada(e) ? 'atrasada' : ''}">${new Date(e.prazo+'T12:00').toLocaleDateString('pt-BR')}</span>` : ''}
                <span class="etapa-st">${({pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída'})[e.status]}</span>
                <span class="td-seta">›</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `);
}

function viEtapaAtrasada(e) {
  return e.prazo && e.status !== 'concluida' && new Date(e.prazo + 'T23:59:59') < new Date();
}

function viRenderGaleria(fotos, gestor) {
  if (!fotos.length) return '<p class="page-sub">Nenhuma foto</p>';
  const todas = viFichaAtual.vi_fotos || [];
  let principalId = viFichaAtual.foto_principal_id;
  if (!principalId && todas.length) principalId = todas[0].id;
  return fotos.map(f => {
    const ehP = f.id === principalId;
    const url = dbUrlFoto(f.caminho_storage);
    return `
    <div class="foto-thumb-painel ${ehP ? 'eh-principal' : ''}">
      <img src="${url}" loading="lazy" alt="foto" style="cursor:zoom-in" onclick="abrirVisor('${url}')" />
      <button class="foto-principal-btn ${ehP ? 'ativa' : ''}" title="${ehP ? 'Foto principal' : 'Definir como principal'}"
        onclick="viDefinirPrincipal('${f.id}', ${ehP})">★</button>
      ${gestor ? `<button class="foto-del-painel" onclick="viExcluirFotoFicha('${f.id}','${f.caminho_storage}')">✕</button>` : ''}
    </div>`;
  }).join('');
}

async function viDefinirPrincipal(fotoId, jaEh) {
  if (jaEh) return;
  if (!confirm('Definir esta foto como a imagem principal do equipamento?\n\nEla será exibida na lista.')) return;
  try { await viDefinirFotoPrincipal(viFichaAtual.id, fotoId); viFichaAtual = await viEquipamento(viFichaAtual.id); viRenderFicha(); }
  catch (e) { alert('Erro: ' + e.message); }
}

async function viAlternarPlanejado(cb, servico) {
  cb.disabled = true;
  try {
    if (cb.checked) await viPlanejarServico(viFichaAtual.id, servico);
    else await viRemoverServicoPlanejado(viFichaAtual.id, servico);
    viFichaAtual = await viEquipamento(viFichaAtual.id);
    viRenderFicha();
  } catch (e) { alert('Erro: ' + e.message); cb.checked = !cb.checked; cb.disabled = false; }
}

function _viFichaInitSaveBar() {
  if (PERFIL?.papel !== 'gestor') return;
  if (typeof SaveBar === 'undefined') return;
  SaveBar.init({ onSave: viSalvarFicha, contexto: 'equipamento' });
  const cont = document.getElementById('conteudo');
  if (!cont) return;
  cont.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'file' || el._sbBound) return;
    el._sbBound = true;
    const ev = (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(ev, () => SaveBar.markDirty());
  });
}

async function viSalvarFicha() {
  const ehInst = viFichaAtual.dominio === 'instrumento';
  const num = id => { const el = document.getElementById(id); if (!el) return null; const v = el.value; return v === '' ? null : parseFloat(v); };
  const val = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  const txt = id => { const el = document.getElementById(id); return el ? el.value.trim() : undefined; };
  try {
    const campos = {
      tag: txt('ve-tag'), tipo: val('ve-tipo'), area: val('ve-area'),
      localizacao: txt('ve-localizacao'), fabricante: txt('ve-fabricante'),
      modelo: txt('ve-modelo'), serie: txt('ve-serie'),
      dim_alt: num('ve-alt'), dim_lar: num('ve-lar'), dim_comp: num('ve-comp'),
      anotacoes_coleta: txt('ve-anotacoes')
    };
    if (ehInst) {
      campos.ex = val('ve-ex') === 'true';
      campos.ano_fabricacao = txt('ve-ano');
      campos.codigo_fabricante = txt('ve-codigo');
      campos.criticidade = val('ve-criticidade');
    } else {
      campos.dn = val('ve-dn');
      campos.classe = val('ve-classe');
      campos.atuador = val('ve-atuador');
      campos.condicao = document.querySelector('input[name="ve-condicao"]:checked')?.value || 'ok';
    }
    await viAtualizarEquipamento(viFichaAtual.id, campos);
  } catch (e) { throw e; }
}

async function viArquivar() {
  const novo = viFichaAtual.status === 'ativa' ? 'arquivada' : 'ativa';
  await viAtualizarEquipamento(viFichaAtual.id, { status: novo });
  viAbrirFicha(viFichaAtual.id);
}
async function viExcluir() {
  if (!confirm(`Excluir o equipamento ${viFichaAtual.tag}?\n\nTodas as etapas e fotos vinculadas serão excluídas. Esta ação não pode ser desfeita.`)) return;
  try { await viExcluirEquipamento(viFichaAtual.id); viTelaEquip(viFichaAtual.dominio); }
  catch (e) { alert('Erro: ' + e.message); }
}

async function viAdicionarFotos(input, origem) {
  origem = origem || 'painel';
  const files = Array.from(input.files);
  if (!files.length) return;
  const galeria = document.getElementById(origem === 'coleta' ? 'vi-galeria-coleta' : 'vi-galeria-painel');
  galeria.insertAdjacentHTML('beforeend', '<div class="loading"><div class="spinner"></div> Enviando...</div>');
  try {
    for (const file of files) {
      const blob = await comprimirImagem(file);
      const nome = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const caminho = `vi/${viFichaAtual.id}/${origem}_${nome}`;
      await dbUploadFoto(caminho, blob);
      await viRegistrarFoto(viFichaAtual.id, caminho, origem);
    }
    viAbrirFicha(viFichaAtual.id);
  } catch (e) { alert('Erro no envio: ' + e.message); viAbrirFicha(viFichaAtual.id); }
  input.value = '';
}

async function viExcluirFotoFicha(fotoId, caminho) {
  if (!confirm('Excluir esta foto?')) return;
  try { await viExcluirFoto(fotoId, caminho); viAbrirFicha(viFichaAtual.id); }
  catch (e) { alert('Erro: ' + e.message); }
}
