'use strict';
// ─── rdo.js — Relatório Diário de Obra ────────────────────────────────

const CLIMAS = ['Bom', 'Nublado', 'Chuvoso', 'Impeditivo'];

// ── Abre tela de RDOs de um projeto ──
async function rdoTelaProjeto(projeto_id) {
  window._ajudaChave = 'rdo';
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando RDOs...</div>');
  try {
    const [rdos, proj] = await Promise.all([
      rdoListar(projeto_id),
      prjBuscar(projeto_id)
    ]);
    _rdoRenderLista(proj, rdos);
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}

function _rdoRenderLista(proj, rdos) {
  const podeCriar = _rdoPodeRegistrar(proj);
  setConteudo(`
    <div class="ficha-head">
      <button class="btn-mini" onclick="abrirFichaProjeto('${proj.id}','exec')">‹ Voltar ao projeto</button>
      <div class="ficha-titulo">
        <span style="font-weight:700;font-size:16px">RDO — ${escHtml(proj.titulo)}</span>
      </div>
      ${podeCriar ? `<button class="btn" onclick="_rdoAbrirForm('${proj.id}', null)">+ RDO do dia</button>` : ''}
    </div>

    ${rdos.length === 0 ? `
      <div class="empty-state">
        <p class="empty-title">Nenhum RDO registrado</p>
        ${podeCriar ? '<p class="empty-sub">Clique em "+ RDO do dia" para iniciar.</p>' : ''}
      </div>` : `
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr>
            <th>Data</th><th>Empresa</th><th>Clima</th><th>H. trab.</th><th>M.O.</th><th>Resumo</th><th></th>
          </tr></thead>
          <tbody>
            ${rdos.map(r => `
              <tr class="linha-click" onclick="_rdoAbrirVisualizacao('${r.id}','${proj.id}')">
                <td class="td-mono">${new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${escHtml(r.empresas_terceiras?.nome || '—')}</td>
                <td>${escHtml(r.clima || '—')}</td>
                <td class="td-mono">${r.horas_trabalhadas || '—'}</td>
                <td class="td-mono">${r.mao_obra_qtd || '—'}</td>
                <td>${escHtml((r.atividades_realizadas || '').slice(0,80))}${(r.atividades_realizadas||'').length>80?'...':''}</td>
                <td><div class="td-acoes">
                  <button class="btn-mini" onclick="event.stopPropagation();_rdoExportarPdf('${r.id}','${proj.id}')">PDF</button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}

    <div id="rdo-modal-root"></div>
  `);
}

function _rdoPodeRegistrar(proj) {
  if (PERFIL?.papel === 'gestor') return true;
  if (PERFIL?.papel === 'tecnico') {
    const equipe = (proj.projeto_equipe || []).map(e => e.perfil_id);
    return equipe.includes(PERFIL.id);
  }
  if (PERFIL?.papel === 'terceiro') {
    // Terceiro pode criar se sua empresa tem etapa nesse projeto
    const etapas = proj.projeto_exec_etapas || [];
    return etapas.some(e => e.empresa_id === PERFIL.empresa_id);
  }
  return false;
}

function _rdoAbrirForm(projeto_id, rdoExistente) {
  const r = rdoExistente || {};
  const hoje = new Date().toISOString().slice(0,10);
  document.getElementById('rdo-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)_rdoFechar()">
      <div class="prj-modal" style="max-width:680px">
        <div class="prj-modal-head">
          <h3>${r.id ? 'Editar RDO' : 'Novo RDO'}</h3>
          <button class="btn-mini" onclick="_rdoFechar()">&#x2715;</button>
        </div>

        <div class="row2">
          <div class="field"><label>Data *</label>
            <input id="rdo-data" type="date" value="${r.data || hoje}" /></div>
          <div class="field"><label>Clima</label>
            <select id="rdo-clima">
              <option value="">—</option>
              ${CLIMAS.map(c => `<option value="${c}"${r.clima===c?' selected':''}>${c}</option>`).join('')}
            </select></div>
        </div>
        <div class="row2">
          <div class="field"><label>Temperatura (°C)</label>
            <input id="rdo-temp" type="number" step="0.1" value="${r.temperatura_c || ''}" /></div>
          <div class="field"><label>Horas trabalhadas</label>
            <input id="rdo-horas" type="number" step="0.5" value="${r.horas_trabalhadas || ''}" /></div>
        </div>
        <div class="field"><label>Mão de obra (qtd. pessoas)</label>
          <input id="rdo-mao" type="number" min="0" value="${r.mao_obra_qtd || ''}" style="max-width:160px" /></div>

        <div class="field"><label>Atividades realizadas</label>
          <textarea id="rdo-ativ" rows="4" placeholder="O que foi executado hoje...">${escHtml(r.atividades_realizadas || '')}</textarea></div>
        <div class="field"><label>Ocorrências</label>
          <textarea id="rdo-ocor" rows="3" placeholder="Acidentes, atrasos, paradas, problemas...">${escHtml(r.ocorrencias || '')}</textarea></div>
        <div class="field"><label>Observações</label>
          <textarea id="rdo-obs" rows="2" placeholder="Comentários adicionais...">${escHtml(r.observacoes || '')}</textarea></div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">
          ${r.id && (PERFIL?.papel === 'gestor' || r.autor_id === PERFIL?.id) ? `<button class="btn btn-sec" style="color:var(--crit)" onclick="_rdoExcluir('${r.id}','${projeto_id}')">Excluir</button>` : ''}
          <button class="btn btn-sec" onclick="_rdoFechar()">Cancelar</button>
          <button class="btn" onclick="_rdoSalvar('${projeto_id}','${r.id || ''}')">${r.id ? 'Salvar' : 'Criar RDO'}</button>
        </div>
      </div>
    </div>`;
}

function _rdoFechar() {
  document.getElementById('rdo-modal-root').innerHTML = '';
}

async function _rdoSalvar(projeto_id, id) {
  const campos = {
    projeto_id,
    data:                   document.getElementById('rdo-data').value,
    clima:                  document.getElementById('rdo-clima').value || null,
    temperatura_c:         +document.getElementById('rdo-temp').value || null,
    horas_trabalhadas:     +document.getElementById('rdo-horas').value || null,
    mao_obra_qtd:          +document.getElementById('rdo-mao').value || null,
    atividades_realizadas: document.getElementById('rdo-ativ').value.trim() || null,
    ocorrencias:           document.getElementById('rdo-ocor').value.trim() || null,
    observacoes:           document.getElementById('rdo-obs').value.trim() || null
  };
  if (!campos.data) { alert('Informe a data.'); return; }
  try {
    if (id) await rdoAtualizar(id, campos);
    else    await rdoCriar(campos);
    _rdoFechar();
    rdoTelaProjeto(projeto_id);
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _rdoExcluir(id, projeto_id) {
  if (!confirm('Excluir este RDO?')) return;
  try {
    await rdoExcluir(id);
    _rdoFechar();
    rdoTelaProjeto(projeto_id);
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _rdoAbrirVisualizacao(id, projeto_id) {
  try {
    const r = await rdoBuscar(id);
    // Reabre o form com os dados (gestor e autor podem editar; outros visualizam)
    _rdoAbrirForm(projeto_id, r);
    if (PERFIL?.papel !== 'gestor' && r.autor_id !== PERFIL?.id) {
      // desabilita campos
      document.querySelectorAll('#rdo-modal-root input, #rdo-modal-root select, #rdo-modal-root textarea').forEach(el => el.disabled = true);
      const salvar = document.querySelector('#rdo-modal-root .btn:last-child');
      if (salvar) salvar.style.display = 'none';
    }
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ── Exportação PDF ──
async function _rdoExportarPdf(id, projeto_id) {
  if (!window.jspdf) { alert('Biblioteca PDF não disponível.'); return; }
  try {
    const [r, proj] = await Promise.all([rdoBuscar(id), prjBuscar(projeto_id)]);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 18;

    doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('RELATÓRIO DIÁRIO DE OBRA', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('Manutenção Geral UIS3 2026', 105, y, { align: 'center' });
    y += 12;

    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text('Projeto:', 14, y);
    doc.setFont('helvetica','normal');
    doc.text(proj.titulo, 38, y);
    y += 6;

    doc.setFont('helvetica','bold'); doc.text('Data:', 14, y);
    doc.setFont('helvetica','normal');
    doc.text(new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR'), 38, y);
    doc.setFont('helvetica','bold'); doc.text('Empresa:', 110, y);
    doc.setFont('helvetica','normal');
    doc.text(r.empresas_terceiras?.nome || '—', 138, y);
    y += 6;

    doc.setFont('helvetica','bold'); doc.text('Clima:', 14, y);
    doc.setFont('helvetica','normal');
    doc.text((r.clima || '—') + (r.temperatura_c ? ` (${r.temperatura_c}°C)` : ''), 38, y);
    doc.setFont('helvetica','bold'); doc.text('Horas trab.:', 110, y);
    doc.setFont('helvetica','normal');
    doc.text(String(r.horas_trabalhadas || '—'), 138, y);
    doc.setFont('helvetica','bold'); doc.text('Mão de obra:', 160, y);
    doc.setFont('helvetica','normal');
    doc.text(String(r.mao_obra_qtd || '—'), 188, y);
    y += 10;

    const blocos = [
      ['Atividades realizadas', r.atividades_realizadas],
      ['Ocorrências', r.ocorrencias],
      ['Observações', r.observacoes]
    ];
    for (const [titulo, texto] of blocos) {
      if (!texto) continue;
      doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text(titulo, 14, y); y += 5;
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      const linhas = doc.splitTextToSize(texto, 180);
      doc.text(linhas, 14, y);
      y += linhas.length * 5 + 4;
      if (y > 270) { doc.addPage(); y = 18; }
    }

    y += 6;
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 285);

    doc.save(`RDO_${proj.titulo.slice(0,30).replace(/\W/g,'_')}_${r.data}.pdf`);
  } catch (e) {
    alert('Erro ao exportar PDF: ' + e.message);
  }
}
