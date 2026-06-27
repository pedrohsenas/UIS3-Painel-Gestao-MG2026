'use strict';
// ─── vi_menu.js — integra a seção V&I ao menu e às rotas ──────────────
// Robusto à ordem de carregamento: usa um wrapper que adia a leitura de
// navegar original até o primeiro clique, e protege contra app.js
// redefinir navegar depois.

// Placeholder da etapa V&I (Fase 3 trará a tela completa)
if (typeof window.viTelaEtapa === 'undefined') {
  window.viTelaEtapa = function (id) {
    setConteudo(`
      <div class="ficha-head">
        <button class="btn-mini" onclick="viAbrirFicha(viFichaAtual ? viFichaAtual.id : '')">‹ Voltar</button>
        <div class="ficha-titulo"><span class="etapa-titulo-nome">Gestão da etapa</span></div>
      </div>
      <div class="empty-state">
        <p class="empty-title">Gestão de etapas V&I — Fase 3</p>
        <p class="empty-sub">Status, prazos, anotações, fotos e checklist de serviços virão na próxima fase</p>
      </div>`);
  };
}

// Rotas de V&I
window.VI_ROTAS = {
  vi_equip:    () => viTelaEquip(),
  vi_importar: () => viTelaImportar()
};

// Função de navegação de V&I — chamada diretamente pelos itens de menu
window.viNavegar = function (rota) {
  window._ajudaChave = rota;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('ativo', el.dataset.rota === rota));
  if (window.VI_ROTAS[rota]) window.VI_ROTAS[rota]();
  document.getElementById('sidebar')?.classList.remove('aberto');
};

// Injeta os itens de menu de V&I na sidebar
function viInjetarMenu() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || document.querySelector('[data-rota="vi_equip"]')) return;

  const gestor = (typeof PERFIL !== 'undefined' && PERFIL && PERFIL.papel === 'gestor');

  const sep = document.createElement('div');
  sep.className = 'vi-menu-sep';
  sep.textContent = 'Válvulas & Instrumentos';

  const itemEquip = document.createElement('a');
  itemEquip.className = 'nav-item';
  itemEquip.dataset.rota = 'vi_equip';
  // chama viNavegar diretamente — NÃO depende de navegar()
  itemEquip.addEventListener('click', () => viNavegar('vi_equip'));
  itemEquip.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
    Instrum. &amp; Válvulas`;

  const espaco = sidebar.querySelector('.nav-espaco');
  const ancora = espaco || null;

  if (ancora) sidebar.insertBefore(sep, ancora); else sidebar.appendChild(sep);
  if (ancora) sidebar.insertBefore(itemEquip, ancora); else sidebar.appendChild(itemEquip);

  if (gestor) {
    const itemImp = document.createElement('a');
    itemImp.className = 'nav-item';
    itemImp.dataset.rota = 'vi_importar';
    itemImp.addEventListener('click', () => viNavegar('vi_importar'));
    itemImp.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Importar V&amp;I`;
    if (ancora) sidebar.insertBefore(itemImp, ancora); else sidebar.appendChild(itemImp);
  }
}

// Quando uma rota de motores é acionada, tira o destaque dos itens V&I.
// Fazemos isso observando cliques nos itens originais — simples e robusto.
document.addEventListener('click', function (e) {
  const item = e.target.closest && e.target.closest('.nav-item');
  if (item && item.dataset.rota && !window.VI_ROTAS[item.dataset.rota]) {
    // clicou num item de motores: garante que telas V&I não fiquem ativas
    document.querySelectorAll('[data-rota="vi_equip"],[data-rota="vi_importar"]')
      .forEach(el => el.classList.remove('ativo'));
  }
});

// Observa o DOM até a sidebar existir, então injeta
(function () {
  const tryInject = () => { if (document.getElementById('sidebar')) viInjetarMenu(); };
  const obs = new MutationObserver(tryInject);
  obs.observe(document.body, { childList: true, subtree: true });
  tryInject();
})();
