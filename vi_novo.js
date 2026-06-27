'use strict';
// ─── vi_novo.js — cadastro manual de instrumento/válvula ───────────────

function viTelaNovo(dominio) {
  window._ajudaChave = 'vi_novo';
  const ehInst = dominio === 'instrumento';
  const areasOpts = VI_AREAS.map(a => `<option value="${a}">${a}</option>`).join('');
  const tiposOpts = (ehInst ? VI_TIPOS_INST : VI_TIPOS_VALV)
    .map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="viTelaEquip('${dominio}')">‹ Voltar</button>
      <div class="ficha-titulo"><span class="etapa-titulo-nome">Novo ${ehInst ? 'Instrumento' : 'Válvula'}</span></div>
    </div>

    <div class="ficha-grid">
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Identificação</h3>
          <div class="row2">
            <div class="field"><label>TAG *</label>
              <input id="vn-tag" type="text" placeholder="${ehInst ? 'ex: PT-EX-0101' : 'ex: VLV-EX-0205'}"
                oninput="this.value=this.value.replace(/[^A-Z0-9\\-]/g,'').toUpperCase()" style="font-family:var(--mono)" /></div>
            <div class="field"><label>Tipo</label>
              <select id="vn-tipo"><option value="">—</option>${tiposOpts}</select></div>
          </div>
          <div class="row2">
            <div class="field"><label>Área</label>
              <select id="vn-area"><option value="">—</option>${areasOpts}</select></div>
            <div class="field"><label>Localização</label>
              <input id="vn-localizacao" type="text" maxlength="30" oninput="this.value=this.value.toUpperCase()" /></div>
          </div>
          ${ehInst ? `
          <div class="field"><label>Equipamento EX</label>
            <select id="vn-ex"><option value="false">Não</option><option value="true">Sim — EX</option></select></div>` : ''}
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Dados ${ehInst ? 'do instrumento' : 'da válvula'}</h3>
          <div class="row2">
            <div class="field"><label>Fabricante</label><input id="vn-fabricante" type="text" /></div>
            <div class="field"><label>Modelo</label><input id="vn-modelo" type="text" /></div>
          </div>
          <div class="row2">
            <div class="field"><label>Nº de série</label><input id="vn-serie" type="text" /></div>
            ${ehInst ? `
            <div class="field"><label>Ano de fabricação</label>
              <input id="vn-ano" type="text" maxlength="4" oninput="this.value=this.value.replace(/[^0-9]/g,'')" /></div>`
            : `
            <div class="field"><label>DN</label>
              <select id="vn-dn"><option value="">—</option>${VI_DNS.map(d=>`<option value="${d}">${d}</option>`).join('')}</select></div>`}
          </div>
          ${ehInst ? `
          <div class="row2">
            <div class="field"><label>Código do fabricante</label><input id="vn-codigo" type="text" /></div>
            <div class="field"><label>Criticidade</label>
              <select id="vn-criticidade"><option value="">—</option>${VI_CRITICIDADES.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div>
          </div>`
          : `
          <div class="row2">
            <div class="field"><label>Classe</label>
              <select id="vn-classe"><option value="">—</option>${VI_CLASSES.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div>
            <div class="field"><label>Atuador</label>
              <select id="vn-atuador"><option value="">—</option>${VI_ATUADORES.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div>
          </div>`}
        </div>

        ${!ehInst ? `
        <div class="card-sec">
          <h3 class="card-sec-titulo">Condição</h3>
          <div class="status-group">
            ${['ok','atencao','critico'].map(s => `
              <label class="status-opt ${s}">
                <input type="radio" name="vn-condicao" value="${s}" ${s==='ok'?'checked':''} />
                <span class="status-dot"></span><span>${({ok:'OK',atencao:'Atenção',critico:'Crítico'})[s]}</span>
              </label>`).join('')}
          </div>
        </div>` : ''}

        <div class="card-sec">
          <h3 class="card-sec-titulo">Dimensões (cm)</h3>
          <div class="row3f">
            <div class="field"><label>A — Altura</label><input id="vn-alt" type="number" step="0.1" /></div>
            <div class="field"><label>L — Largura</label><input id="vn-lar" type="number" step="0.1" /></div>
            <div class="field"><label>C — Comprimento</label><input id="vn-comp" type="number" step="0.1" /></div>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Anotações da coleta</h3>
          <div class="field"><textarea id="vn-anotacoes" rows="3"></textarea></div>
        </div>

        <button class="btn" id="vi-btn-criar" onclick="viCriarEquip('${dominio}')">Criar ${ehInst ? 'instrumento' : 'válvula'}</button>
        <p class="page-sub" style="margin-top:10px">As 6 etapas de gestão serão criadas automaticamente. Fotos podem ser adicionadas após criar, na ficha.</p>
      </div>
    </div>
  `);
}

async function viCriarEquip(dominio) {
  const ehInst = dominio === 'instrumento';
  const tag = document.getElementById('vn-tag').value.trim();
  if (!tag) { alert('Informe a TAG'); return; }
  const btn = document.getElementById('vi-btn-criar');
  btn.disabled = true; btn.textContent = 'Criando...';
  const num = id => { const el = document.getElementById(id); if (!el) return null; const v = el.value; return v === '' ? null : parseFloat(v); };
  const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const txt = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  try {
    const base = {
      dominio, tag,
      area: val('vn-area'), localizacao: txt('vn-localizacao'),
      tipo: val('vn-tipo'), fabricante: txt('vn-fabricante'), modelo: txt('vn-modelo'),
      serie: txt('vn-serie'),
      dim_alt: num('vn-alt'), dim_lar: num('vn-lar'), dim_comp: num('vn-comp'),
      anotacoes_coleta: txt('vn-anotacoes')
    };
    if (ehInst) {
      base.ex = val('vn-ex') === 'true';
      base.ano_fabricacao = txt('vn-ano');
      base.codigo_fabricante = txt('vn-codigo');
      base.criticidade = val('vn-criticidade');
    } else {
      base.dn = val('vn-dn');
      base.classe = val('vn-classe');
      base.atuador = val('vn-atuador');
      base.condicao = document.querySelector('input[name="vn-condicao"]:checked')?.value || 'ok';
    }
    const novo = await viInserirEquipamento(base);
    viAbrirFicha(novo.id);
  } catch (e) {
    alert('Erro ao criar: ' + e.message);
    btn.disabled = false; btn.textContent = `Criar ${ehInst ? 'instrumento' : 'válvula'}`;
  }
}
