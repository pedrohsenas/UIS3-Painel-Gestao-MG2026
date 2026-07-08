'use strict';
// ─── empresas.js — cadastro de empresas terceiras e usuários ──────────

let _empCache = null;

async function telaEmpresas() {
  if (PERFIL?.papel !== 'gestor') {
    setConteudo('<div class="result-card erro"><p>Acesso restrito a gestores.</p></div>');
    return;
  }
  window._ajudaChave = 'empresas';
  setConteudo('<div class="loading"><div class="spinner"></div> Carregando...</div>');
  try {
    _empCache = await empListar();
    _renderEmpresas();
  } catch (e) {
    setConteudo(`<div class="result-card erro"><p>Erro: ${e.message}</p></div>`);
  }
}

function _renderEmpresas() {
  const empresas = _empCache || [];
  setConteudo(`
    <div class="page-head" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div>
        <h2>Empresas Terceiras</h2>
        <p class="page-sub">Empresas que executam etapas em campo</p>
      </div>
      <button class="btn" onclick="_empAbrirNova()">+ Nova empresa</button>
    </div>

    ${empresas.length === 0 ? `
      <div class="empty-state">
        <p class="empty-title">Nenhuma empresa cadastrada</p>
        <p class="empty-sub">Clique em "Nova empresa" para começar.</p>
      </div>` : `
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr>
            <th>Nome</th><th>Matrícula</th><th>Contato</th><th>E-mail</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${empresas.map(e => `
              <tr>
                <td><strong style="cursor:pointer;color:var(--accent)" onclick="_empAbrirDetalhe('${e.id}')">${escHtml(e.nome)}</strong></td>
                <td class="td-mono">${e.matricula || '—'}</td>
                <td>${escHtml(e.contato_nome || '—')}</td>
                <td>${escHtml(e.contato_email || '—')}</td>
                <td>${e.ativo ? '<span class="ac-cont ac-c-conc">Ativa</span>' : '<span class="badge-status arquivada">Inativa</span>'}</td>
                <td><div class="td-acoes">
                  <button class="btn-mini" onclick="_empAbrirDetalhe('${e.id}')">Abrir</button>
                  <button class="btn-mini btn-mini-danger" onclick="_empExcluir('${e.id}','${escHtml(e.nome)}')">Excluir</button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}

    <div id="emp-modal-root"></div>
  `);
}

function _empAbrirNova() {
  _empAbrirDetalhe(null);
}

async function _empAbrirDetalhe(id) {
  const emp = id ? _empCache.find(e => e.id === id) : null;
  let usuarios = [];
  if (id) {
    try { usuarios = await empListarUsuarios(id); }
    catch (e) { console.error(e); }
  }

  document.getElementById('emp-modal-root').innerHTML = `
    <div class="prj-overlay" onclick="if(event.target===this)_empFechar()">
      <div class="prj-modal" style="max-width:640px">
        <div class="prj-modal-head">
          <h3>${emp ? 'Editar empresa' : 'Nova empresa'}</h3>
          <button class="btn-mini" onclick="_empFechar()">&#x2715;</button>
        </div>

        <div class="row2">
          <div class="field" style="grid-column:1/-1">
            <label>Nome da empresa *</label>
            <input id="emp-nome" type="text" maxlength="120" value="${escHtml(emp?.nome || '')}" />
          </div>
        </div>
        <div class="row2">
          <div class="field">
            <label>Matrícula</label>
            <input id="emp-mat" type="number" value="${emp?.matricula || ''}" />
          </div>
          <div class="field">
            <label>Status</label>
            <select id="emp-ativo">
              <option value="true"${emp?.ativo!==false?' selected':''}>Ativa</option>
              <option value="false"${emp?.ativo===false?' selected':''}>Inativa</option>
            </select>
          </div>
        </div>
        <div class="row2">
          <div class="field">
            <label>Contato (nome)</label>
            <input id="emp-cont-nome" type="text" value="${escHtml(emp?.contato_nome || '')}" />
          </div>
          <div class="field">
            <label>Contato (e-mail)</label>
            <input id="emp-cont-email" type="email" value="${escHtml(emp?.contato_email || '')}" />
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
          <button class="btn btn-sec" onclick="_empFechar()">Cancelar</button>
          <button class="btn" onclick="_empSalvar('${emp?.id || ''}')">${emp ? 'Salvar' : 'Criar empresa'}</button>
        </div>

        ${emp ? `
        <div class="card-sec" style="margin-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 class="card-sec-titulo" style="margin:0">Usuários terceiros</h3>
            <button class="btn-mini" onclick="_empAbrirNovoUsuario('${emp.id}')">+ Novo usuário</button>
          </div>
          ${usuarios.length ? `
            <table class="tabela" style="font-size:13px">
              <thead><tr><th>Nome</th><th>Papel</th></tr></thead>
              <tbody>
                ${usuarios.map(u => `
                  <tr><td>${escHtml(u.nome)}</td><td><span class="user-papel ${u.papel}">${u.papel}</span></td></tr>
                `).join('')}
              </tbody>
            </table>` : '<p class="page-sub">Nenhum usuário cadastrado nesta empresa.</p>'}
        </div>` : ''}
      </div>
    </div>
    <div id="emp-user-modal"></div>
  `;
}

function _empFechar() {
  // Se há texto digitado no nome e não é edição carregada, confirma
  const nome = document.getElementById('emp-nome')?.value?.trim();
  const ehNovo = !document.querySelector('#emp-modal-root .card-sec'); // sem card de usuários = modal de criação
  if (nome && ehNovo && !confirm('Fechar sem salvar a empresa?')) return;
  document.getElementById('emp-modal-root').innerHTML = '';
}

async function _empSalvar(id) {
  const campos = {
    nome:           document.getElementById('emp-nome').value.trim(),
    matricula:     +document.getElementById('emp-mat').value || null,
    contato_nome:  document.getElementById('emp-cont-nome').value.trim() || null,
    contato_email: document.getElementById('emp-cont-email').value.trim() || null,
    ativo:         document.getElementById('emp-ativo').value === 'true'
  };
  if (!campos.nome) { alert('Informe o nome da empresa.'); return; }
  try {
    if (id) await empAtualizar(id, campos);
    else    await empCriar(campos);
    _empFechar();
    telaEmpresas();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function _empExcluir(id, nome) {
  if (!confirm(`Excluir "${nome}"? Usuários e vínculos com etapas podem ser afetados.`)) return;
  try {
    await empExcluir(id);
    telaEmpresas();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ── Criar usuário terceiro ──
function _empAbrirNovoUsuario(empresa_id) {
  document.getElementById('emp-user-modal').innerHTML = `
    <div class="prj-overlay" style="z-index:110" onclick="if(event.target===this)_empFecharUser()">
      <div class="prj-modal" style="max-width:440px">
        <div class="prj-modal-head">
          <h3>Novo usuário</h3>
          <button class="btn-mini" onclick="_empFecharUser()">&#x2715;</button>
        </div>
        <div class="field"><label>Nome *</label>
          <input id="empu-nome" type="text" /></div>
        <div class="field"><label>E-mail *</label>
          <input id="empu-email" type="email" /></div>
        <div class="field"><label>Senha temporária *</label>
          <input id="empu-senha" type="text" value="${_empGerarSenha()}" />
          <p class="page-sub" style="margin-top:4px">Envie esta senha ao terceiro. Ele poderá alterá-la depois.</p>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
          <button class="btn btn-sec" onclick="_empFecharUser()">Cancelar</button>
          <button class="btn" onclick="_empCriarUsuario('${empresa_id}')">Criar usuário</button>
        </div>
      </div>
    </div>`;
}

function _empGerarSenha() {
  return 'Lar' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random()*99);
}

function _empFecharUser() {
  document.getElementById('emp-user-modal').innerHTML = '';
}

async function _empCriarUsuario(empresa_id) {
  const nome  = document.getElementById('empu-nome').value.trim();
  const email = document.getElementById('empu-email').value.trim();
  const senha = document.getElementById('empu-senha').value;
  if (!nome || !email || !senha) { alert('Preencha todos os campos.'); return; }
  if (senha.length < 6) { alert('A senha deve ter ao menos 6 caracteres.'); return; }

  const btn = document.querySelector('#emp-user-modal .btn:last-child');
  btn.disabled = true; btn.textContent = 'Criando...';
  try {
    await empCriarUsuario(empresa_id, { email, senha, nome });
    alert(`Usuário criado!\n\nE-mail: ${email}\nSenha: ${senha}\n\nAnote esta senha — ela não será mostrada novamente.`);
    _empFecharUser();
    _empAbrirDetalhe(empresa_id);
  } catch (e) {
    alert('Erro ao criar usuário: ' + e.message);
    btn.disabled = false; btn.textContent = 'Criar usuário';
  }
}
