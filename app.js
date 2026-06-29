'use strict';
// ─── app.js — navegação e shell do aplicativo ─────────────────────────

const LOGO_B64 = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjQzMSIgdmVyc2lvbj0iMS4xIiB2aWV3Qm94PSIwIDAgNTAwIDQzMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KIDxnIHRyYW5zZm9ybT0ibWF0cml4KDUuOTQ3NSAwIDAgNS45NDc1IDEuMzMxZS02IC4yMzI1NykiPgogIDxwYXRoIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0yNzIuMjMgLTE5OC43OSkiIGQ9Im0yNzcuODUgMjI2LjY5YTMwLjg3OSAzMC44NzkgMCAwIDAtNS42MjExIDAuNSAxNC4wODQgMTQuMDg0IDAgMCAxIDAuMzY3MTkgMy41MjU0djM5Ljc3OWgxNi4yMjFjNS41OTIgMCA2LjE5OTItNC41MjkyIDYuMTk5Mi0xMC4xMTdoLTEwLjgxMnYtMzAuMWMtMC4wMTgtMi43ODctMS45MDI1LTMuNTg3OS02LjM1MzUtMy41ODc5em03NC4wNTUgOC45NDUzYy02LjYzMSAwLTguNDEyMSA0Ljg1NTUtOC40MTIxIDQuODU1NWgtMC4yMDExN2wtMS00LjE3MzhoLTguMTMyOHYzNC4xODRoMTEuMDkydi0yMy4zMTFzMS40MzI2LTEuOTc2NiA1LjgwNjYtMS45NzY2YTIyLjEzNyAyMi4xMzcgMCAwIDEgNC4wMzkxIDAuNTM5MDZsMC40Mzc1LTEuMzAwOGMyLjEwNi02LjQyNC0wLjQ4MzkxLTguODE2NC0zLjYyODktOC44MTY0em0tMzYuMTQ2IDRlLTNjLTExLjY4NyAwLTE3Ljk3MyA3Ljg1My0xNy45ODYgMTkgM2UtMyA5Ljc3NSAzLjc1MzEgMTYuNTQzIDExLjk1MyAxNi41NDNhMTEuNzc0IDExLjc3NCAwIDAgMCA5LjAxOTUtNC40NDczbDAuMTM4NjcgOGUtM2E1LjIzNCA1LjIzNCAwIDAgMCA1LjI5MSA0LjEwMTZjNC45MjMgMCA2LjYxNTYtMy41NTk0IDYuMDE1Ni02LjM1OTQtMS41NzYgMC0yLjIxNTItMS4xNjI5LTIuMTk5Mi0zLjk2Mjl2LTIyLjc2MmEzNC41NzUgMzQuNTc1IDAgMCAwLTEyLjIzMi0yLjEyMTF6bS0wLjczNjMzIDguODgwOWExNC41NzUgMTQuNTc1IDAgMCAxIDIuMTc5NyAwLjIwNTA4djE2LjMzNGE0LjQxOSA0LjQxOSAwIDAgMS0zLjE1ODIgMS4zNjkxYy0yLjUzMyAwLTUuNDQ4LTEuMjk0Mi01LjQ1Ny04LjIwMTIgMC4wMTctNS43NDIgMi44ODE2LTkuNzA3IDYuNDM1Ni05LjcwN3oiIGZpbGw9IiM0NDQzNDQiLz4KICA8cGF0aCB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMjYyLjM2IC0xNTYuODIpIiBkPSJtMzEyLjMgMTYzLjY5Yy00LjI4IDAtNy45MjcgMi0xMS4yIDYuOTgtMC4yODMgMC40MjctMC43NTUgMC4zODItMC45MTcgMC4wMTMtMS4wNzctMi40NjItNC40MzEtNy4wMDYtOC4yOTMtNy4wMDYtMy43IDAtOC41MjggMy4wNDQtOC41MjggMTEuMTUxYTE0LjA1MSAxNC4wNTEgMCAwIDAgNC4zMjkgMTAuMDI2YzAuMzggMC4zMzQtMC4wNDYgMC44NTEtMC42MjggMC40NzVhMTYuMjY0IDE2LjI2NCAwIDAgMS03LjgyMy0xNC4yODRjMC04LjIyOSA1Ljc1OS0xNC4xMTQgMTEuODU2LTE0LjExNCA0LjM1MiAwIDcuOTk1IDMuMyA5Ljk1NSA3LjQ5MiAzLjUzOC00LjkzOCA4LjYzLTcuNiAxMy4yNjctNy42IDYuNjY0IDAgMTIuNjMgMy45MjMgMTIuNjMgMTIuNCAwIDExLjYyNy03LjEgMTguMjQtMjEuMzA1IDIwLjMxNy02LjI4NSAwLjkyMi0xNS42MTQgMi4zMzMtMjAuMDE1IDExLjM2My0wLjI1OCAwLjUzMS0xLjI0MS0wLjExOC0xLjAxMi0wLjc2NyAzLjE0Ny04LjgxMiAxMS4zLTEzLjU0MSAyMC4wMDgtMTUuMzMxIDkuNTA3LTEuOTU3IDE0LjUxNS03LjgzNCAxNC41MTUtMTMuMzM5IDAtNC4yMDYtMi4xMzctNy43NjktNi44MzMtNy43NjkiIGZpbGw9IiNlNTFhNDEiIGRhdGEtbmFtZT0iQ2FtaW5obyAxNTciLz4KIDwvZz4KPC9zdmc+Cg==';
let PERFIL = null;

function escHtml(v) {
  if (v == null) return '';
  return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setConteudo(html) {
  document.getElementById('conteudo').innerHTML = html;
}

function telaDashboard() { telaDashboardReal(); }

// ─── Navegação ─────────────────────────────────────────────────────────
const ROTAS = {
  dashboard:            telaDashboard,
  acompanhamento:       telaAcompanhamento,
  proj_dashboard:       telaProjDashboard,
  projetos:             telaProjetos,
  proj_acompanhamento:  telaProjAcompanhamento,
  maquinas:             telaMaquinas,
  nova_maquina:         telaNovaMaquina,
  exportar:             telaExportar,
  matriz:               telaMatriz,
  prazos:               telaPrazos,
  servicos:             telaServicos,
  importar:             telaImportar,
  biblioteca:           telaBiblioteca
};

function navegar(rota) {
  window._ajudaChave = rota;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('ativo', el.dataset.rota === rota));
  (ROTAS[rota] || telaMaquinas)();
  document.getElementById('sidebar')?.classList.remove('aberto');
}

// ─── Login ─────────────────────────────────────────────────────────────
function telaLogin(erro) {
  document.getElementById('root').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <img src="${LOGO_B64}" class="login-logo" alt="Lar" />
        <div class="login-eyebrow">MANUTENÇÃO GERAL UIS3 2026</div>
        <h1>Painel de Gestão</h1>
        ${erro ? `<div class="login-erro">${erro}</div>` : ''}
        <div class="field">
          <label>E-mail</label>
          <input type="email" id="login-email" placeholder="seu@email.com" autocomplete="username" />
        </div>
        <div class="field">
          <label>Senha</label>
          <input type="password" id="login-senha" placeholder="••••••••" autocomplete="current-password"
            onkeypress="if(event.key==='Enter')fazerLogin()" />
        </div>
        <button class="btn btn-block" id="btn-login" onclick="fazerLogin()">Entrar</button>
      </div>
    </div>
  `;
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!email || !senha) return;
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    await dbLogin(email, senha);
    await iniciarApp();
  } catch (e) {
    telaLogin(e.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : e.message);
  }
}

async function sair() {
  await dbLogout();
  telaLogin();
}

// ─── SVGs reutilizados ─────────────────────────────────────────────────
const _SVG = {
  dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,
  check:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  projeto:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,
  maquina:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  matriz:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  calendar:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  tool:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  upload:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  download:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  folder:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
};

function _navItem(rota, svg, label, extra='') {
  return `<a class="nav-item${extra}" data-rota="${rota}" onclick="navegar('${rota}')">${svg}${label}</a>`;
}

// ─── Shell principal ───────────────────────────────────────────────────
async function iniciarApp() {
  PERFIL = await dbMeuPerfil();
  if (!PERFIL) { telaLogin(); return; }
  const g = PERFIL.papel === 'gestor';

  document.getElementById('root').innerHTML = `
    <div class="shell">
      <header class="topbar">
        <button class="menu-btn" onclick="document.getElementById('sidebar').classList.toggle('aberto')">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <img src="${LOGO_B64}" class="topbar-logo" alt="Lar" />
        <div class="topbar-titulo">
          <div class="topbar-eyebrow">MANUTENÇÃO GERAL UIS3 2026</div>
          <div class="topbar-nome">Painel de Gestão</div>
        </div>
        <div class="topbar-user">
          <span class="user-nome">${escHtml(PERFIL.nome)}</span>
          <span class="user-papel ${PERFIL.papel}">${g ? 'Gestor' : 'Técnico'}</span>
          <button class="btn-mini" onclick="sair()">Sair</button>
        </div>
      </header>

      <button class="btn-ajuda-flutuante" onclick="abrirAjudaTela()" title="Ajuda desta tela">?</button>

      <div class="corpo">
        <nav class="sidebar" id="sidebar">

          <!-- GESTÃO -->
          <div class="nav-sec">Gestão</div>
          ${_navItem('dashboard',           _SVG.dashboard, 'Dashboard Máquinas')}
          ${_navItem('acompanhamento',      _SVG.check,     'Acomp. Máq. &amp; V&amp;I')}

          <!-- PROJETOS -->
          <div class="nav-sec">Projetos MG</div>
          ${_navItem('proj_dashboard',      _SVG.dashboard, 'Dashboard Projetos')}
          ${_navItem('projetos',            _SVG.projeto,   'Projetos')}
          ${_navItem('proj_acompanhamento', _SVG.check,     'Acompanhamento')}

          <!-- MÁQUINAS ELÉTRICAS -->
          <div class="nav-sec">Máquinas Elétricas</div>
          ${_navItem('maquinas', _SVG.maquina, 'Máquinas', ' ativo')}
          ${_navItem('matriz',   _SVG.matriz,  'Lançamento Geral')}
          ${g ? _navItem('prazos',   _SVG.calendar, 'Prazos') : ''}
          ${g ? _navItem('servicos', _SVG.tool,     'Serviços') : ''}
          ${g ? _navItem('importar', _SVG.upload,   'Importar ZIP') : ''}

          <!-- V&I — itens injetados por vi_menu.js -->
          <div id="vi-secao-marcador"></div>

          <!-- DADOS -->
          <div class="nav-sec">Dados</div>
          ${_navItem('exportar',   _SVG.download, 'Exportação de Dados')}
          ${_navItem('biblioteca', _SVG.folder,   'Biblioteca')}

        </nav>

        <main class="conteudo" id="conteudo"></main>
      </div>
    </div>
  `;
  navegar('maquinas');
}

// ─── Init ──────────────────────────────────────────────────────────────
(async () => {
  const sess = await dbSessao();
  if (sess) await iniciarApp();
  else telaLogin();
})();
