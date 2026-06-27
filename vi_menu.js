'use strict';
// ─── vi_menu.js — integra a seção V&I ao menu e às rotas, sem editar app.js ──

// Placeholder da etapa V&I (Fase 3 trará a tela completa)
if (typeof viTelaEtapa === 'undefined') {
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

// Roteador de V&I (chamado pelos onclick navegar('vi_...'))
const VI_ROTAS = {
  vi_equip:    () => viTelaEquip(),
  vi_importar: () => viTelaImportar()
};

// Intercepta navegar() para também tratar rotas vi_*
(function () {
  const navOriginal = window.navegar;
  window.navegar = function (rota) {
    if (VI_ROTAS[rota]) {
      window._ajudaChave = rota;
      document.querySelectorAll('.nav-item').forEach(el =>
        el.classList.toggle('ativo', el.dataset.rota === rota));
      VI_ROTAS[rota]();
      document.getElementById('sidebar')?.classList.remove('aberto');
      return;
    }
    if (typeof navOriginal === 'function') navOriginal(rota);
  };
})();

// Injeta os itens de menu de V&I na sidebar, após carregar o shell
function viInjetarMenu() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || document.querySelector('[data-rota="vi_equip"]')) return;

  const gestor = (typeof PERFIL !== 'undefined' && PERFIL?.papel === 'gestor');

  // separador
  const sep = document.createElement('div');
  sep.className = 'vi-menu-sep';
  sep.textContent = 'Válvulas & Instrumentos';

  const itemEquip = document.createElement('a');
  itemEquip.className = 'nav-item';
  itemEquip.dataset.rota = 'vi_equip';
  itemEquip.onclick = () => navegar('vi_equip');
  itemEquip.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
    Instrum. &amp; Válvulas`;

  // ponto de inserção: antes do separador/Biblioteca (que tem nav-espaco antes)
  const espaco = sidebar.querySelector('.nav-espaco');
  if (espaco) {
    sidebar.insertBefore(sep, espaco);
    sidebar.insertBefore(itemEquip, espaco);
    if (gestor) {
      const itemImp = document.createElement('a');
      itemImp.className = 'nav-item';
      itemImp.dataset.rota = 'vi_importar';
      itemImp.onclick = () => navegar('vi_importar');
      itemImp.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Importar V&amp;I`;
      sidebar.insertBefore(itemImp, espaco);
    }
  } else {
    sidebar.appendChild(sep);
    sidebar.appendChild(itemEquip);
  }
}

// Observa o DOM até a sidebar existir, então injeta
(function () {
  const obs = new MutationObserver(() => {
    if (document.getElementById('sidebar')) viInjetarMenu();
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
