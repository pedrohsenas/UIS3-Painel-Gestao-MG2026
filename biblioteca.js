'use strict';
// ─── biblioteca.js — biblioteca de importações ─────────────────────────

async function telaBiblioteca() {
  setConteudo(`
    <div class="page-head">
      <h2>Biblioteca de Importações</h2>
      <p class="page-sub">Todos os ZIPs importados, organizados por nome de arquivo</p>
    </div>
    <div id="bib-lista"><div class="loading"><div class="spinner"></div> Carregando...</div></div>
  `);

  try {
    const lista = await dbListarImportacoes();
    const el = document.getElementById('bib-lista');

    if (!lista.length) {
      el.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">Nenhuma importação ainda</p>
          <p class="empty-sub">Use "Importar ZIP" no menu para adicionar a primeira coleta</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="tabela-wrap">
        <table class="tabela">
          <thead>
            <tr>
              <th>Arquivo ZIP</th>
              <th>Técnico</th>
              <th>Máquinas</th>
              <th>Importado em</th>
              <th>Status</th>
              ${PERFIL?.papel === 'gestor' ? '<th>Ações</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${lista.map(i => `
              <tr class="${i.status === 'arquivada' ? 'linha-arquivada' : ''}">
                <td class="td-mono">${escHtml(i.nome_zip)}</td>
                <td>${escHtml(i.tecnico)}</td>
                <td class="td-center">${i.qtd_maquinas}</td>
                <td>${new Date(i.criado_em).toLocaleString('pt-BR')}</td>
                <td><span class="badge-status ${i.status}">${i.status === 'ativa' ? 'Ativa' : 'Arquivada'}</span></td>
                ${PERFIL?.papel === 'gestor' ? `
                <td class="td-acoes">
                  <button class="btn-mini" onclick="acaoArquivar('${i.id}', ${i.status === 'ativa'})">${i.status === 'ativa' ? 'Arquivar' : 'Reativar'}</button>
                  <button class="btn-mini btn-mini-danger" onclick="acaoExcluir('${i.id}', '${escHtml(i.nome_zip)}')">Excluir</button>
                </td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    document.getElementById('bib-lista').innerHTML =
      `<div class="result-card erro"><p>Erro ao carregar: ${e.message}</p></div>`;
  }
}

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
