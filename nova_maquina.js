'use strict';
// ─── nova_maquina.js — cadastro manual de máquina ──────────────────────

function telaNovaMaquina() {
  window._ajudaChave = 'nova_maquina';
  const tiposOpts = Object.entries(TIPOS_NOMES)
    .map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
  const areasOpts = AREAS_LISTA.map(a => `<option value="${a}">${a}</option>`).join('');

  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="telaMaquinas()">‹ Voltar</button>
      <div class="ficha-titulo"><span class="etapa-titulo-nome">Nova Máquina</span></div>
    </div>

    <div class="ficha-grid">
      <div class="ficha-col">
        <div class="card-sec">
          <h3 class="card-sec-titulo">Identificação</h3>
          <div class="row2">
            <div class="field"><label>TAG *</label>
              <input id="n-tag" type="text" placeholder="ex: M-EX-0101"
                oninput="this.value=this.value.replace(/[^A-Z0-9\\-]/g,'').toUpperCase()"
                style="font-family:var(--mono)" /></div>
            <div class="field"><label>Tipo</label>
              <select id="n-tipo">${tiposOpts}</select></div>
          </div>
          <div class="row2">
            <div class="field"><label>Equipamento EX</label>
              <select id="n-ex"><option value="false">Não</option><option value="true">Sim — EX</option></select></div>
            <div class="field"><label>Área</label>
              <select id="n-area"><option value="">—</option>${areasOpts}</select></div>
          </div>
          <div class="field"><label>Localização</label>
            <input id="n-localizacao" type="text" maxlength="30"
              oninput="this.value=this.value.toUpperCase()" /></div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Dados de placa</h3>
          <div class="row3f">
            <div class="field"><label>Potência</label><input id="n-potencia" type="number" step="any" /></div>
            <div class="field"><label>Unidade</label>
              <select id="n-unidade"><option value="kW">kW</option><option value="cv">cv</option><option value="HP">HP</option></select></div>
            <div class="field"><label>Tensão (V)</label>
              <input id="n-tensao" type="text" maxlength="3" oninput="this.value=this.value.replace(/[^0-9]/g,'')" /></div>
          </div>
          <div class="row3f">
            <div class="field"><label>Ligação</label>
              <select id="n-ligacao"><option value="trifasico">Trifásico</option><option value="monofasico">Monofásico</option></select></div>
            <div class="field"><label>Corrente (A)</label><input id="n-corrente" type="number" step="any" /></div>
            <div class="field"><label>RPM</label><input id="n-rpm" type="number" /></div>
          </div>
          <div class="row3f">
            <div class="field"><label>FP</label><input id="n-fp" type="number" step="0.01" /></div>
            <div class="field"><label>IP</label><input id="n-ip" type="text" /></div>
            <div class="field"><label>Classe</label>
              <select id="n-classe"><option value="">—</option><option>A</option><option>B</option><option>F</option><option>H</option></select></div>
          </div>
          <div class="row3f">
            <div class="field"><label>Frequência</label>
              <select id="n-freq"><option value="60">60 Hz</option><option value="50">50 Hz</option></select></div>
            <div class="field"><label>Fabricante</label><input id="n-fabricante" type="text" /></div>
            <div class="field"><label>Modelo</label><input id="n-modelo" type="text" /></div>
          </div>
          <div class="field"><label>Nº de série</label><input id="n-serie" type="text" /></div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Rolamentos</h3>
          <div class="row2">
            <div class="field"><label>Rolamento dianteiro</label>
              <input id="n-rol-diant" type="text" placeholder="ex: 6309-2Z" /></div>
            <div class="field"><label>Rolamento traseiro</label>
              <input id="n-rol-tras" type="text" placeholder="ex: 6207-2RS" /></div>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Dimensões (cm)</h3>
          <div class="row3f">
            <div class="field"><label>A — Altura</label><input id="n-alt" type="number" step="0.1" /></div>
            <div class="field"><label>L — Largura</label><input id="n-lar" type="number" step="0.1" /></div>
            <div class="field"><label>C — Comprimento</label><input id="n-comp" type="number" step="0.1" /></div>
          </div>
        </div>

        <div class="card-sec">
          <h3 class="card-sec-titulo">Coleta de campo</h3>
          <div class="field"><label>Estado observado</label>
            <select id="n-status-coleta">
              <option value="ok">OK</option><option value="atencao">Atenção</option><option value="critico">Crítico</option>
            </select></div>
          <div class="field"><label>Anotações</label>
            <textarea id="n-anotacoes" rows="3"></textarea></div>
        </div>

        <button class="btn" id="btn-criar-maq" onclick="criarMaquina()">Criar máquina</button>
        <p class="page-sub" style="margin-top:10px">As 7 etapas de gestão serão criadas automaticamente. Fotos podem ser adicionadas após criar, na ficha.</p>
      </div>
    </div>
  `);
  acAtivarRolamento('n-rol-diant');
  acAtivarRolamento('n-rol-tras');
}

async function criarMaquina() {
  const tag = document.getElementById('n-tag').value.trim();
  if (!tag) { alert('Informe a TAG'); return; }
  const btn = document.getElementById('btn-criar-maq');
  btn.disabled = true; btn.textContent = 'Criando...';
  const num = id => { const v = document.getElementById(id).value; return v === '' ? null : parseFloat(v); };
  try {
    const nova = await dbInserirMaquina({
      tag,
      tipo: document.getElementById('n-tipo').value,
      ex: document.getElementById('n-ex').value === 'true',
      area: document.getElementById('n-area').value,
      localizacao: document.getElementById('n-localizacao').value.trim(),
      potencia: num('n-potencia'),
      unidade_pot: document.getElementById('n-unidade').value,
      tensao: document.getElementById('n-tensao').value.trim(),
      ligacao: document.getElementById('n-ligacao').value,
      corrente: num('n-corrente'),
      rpm: num('n-rpm'),
      fp: num('n-fp'),
      ip: document.getElementById('n-ip').value.trim(),
      classe: document.getElementById('n-classe').value,
      freq: document.getElementById('n-freq').value,
      fabricante: document.getElementById('n-fabricante').value.trim(),
      modelo: document.getElementById('n-modelo').value.trim(),
      serie: document.getElementById('n-serie').value.trim(),
      rolamento_dianteiro: document.getElementById('n-rol-diant').value.trim(),
      rolamento_traseiro: document.getElementById('n-rol-tras').value.trim(),
      dim_alt: num('n-alt'),
      dim_lar: num('n-lar'),
      dim_comp: num('n-comp'),
      status_coleta: document.getElementById('n-status-coleta').value,
      anotacoes_coleta: document.getElementById('n-anotacoes').value.trim()
    });
    abrirFicha(nova.id);
  } catch (e) {
    alert('Erro ao criar: ' + e.message);
    btn.disabled = false; btn.textContent = 'Criar máquina';
  }
}
