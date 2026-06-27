'use strict';
// ─── visor.js — visualizador de fotos com zoom (pinça/scroll), sem download ──
// Autocontido. Basta incluir <script src="visor.js"></script> no index.html
// e trocar as <img> das galerias para chamarem abrirVisor('URL').

(function () {
  let escala = 1, tx = 0, ty = 0;
  let arrastando = false, px = 0, py = 0;
  let pinchDist = 0, pinchBase = 1;
  let imgEl = null;

  function aplicar() {
    if (imgEl) imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${escala})`;
  }

  function reset() { escala = 1; tx = 0; ty = 0; aplicar(); }

  window.abrirVisor = function (url) {
    fecharVisor();
    const ov = document.createElement('div');
    ov.id = 'visor-overlay';
    ov.innerHTML = `
      <div class="visor-barra">
        <span class="visor-dica">PC: scroll do mouse para zoom e arrastar · Mobile: pinça e arraste para mover</span>
        <button class="visor-fechar" aria-label="Fechar">✕</button>
      </div>
      <div class="visor-palco" id="visor-palco">
        <img src="${url}" alt="foto" id="visor-img" draggable="false" />
      </div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => ov.classList.add('show'));

    imgEl = ov.querySelector('#visor-img');
    const palco = ov.querySelector('#visor-palco');
    reset();

    ov.querySelector('.visor-fechar').addEventListener('click', fecharVisor);
    ov.addEventListener('click', e => { if (e.target === ov || e.target === palco) fecharVisor(); });

    // ── Scroll (desktop) ──
    palco.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      const novo = Math.min(6, Math.max(1, escala + delta * escala));
      escala = novo;
      if (escala === 1) { tx = 0; ty = 0; }
      aplicar();
    }, { passive: false });

    // ── Duplo clique/toque: alterna zoom ──
    palco.addEventListener('dblclick', () => {
      escala = escala > 1 ? 1 : 2.5;
      if (escala === 1) { tx = 0; ty = 0; }
      aplicar();
    });

    // ── Arraste com mouse ──
    palco.addEventListener('mousedown', e => {
      if (escala <= 1) return;
      arrastando = true; px = e.clientX - tx; py = e.clientY - ty;
    });
    window.addEventListener('mousemove', e => {
      if (!arrastando) return;
      tx = e.clientX - px; ty = e.clientY - py; aplicar();
    });
    window.addEventListener('mouseup', () => { arrastando = false; });

    // ── Touch: pinça + arraste ──
    palco.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        pinchDist = dist(e.touches);
        pinchBase = escala;
      } else if (e.touches.length === 1 && escala > 1) {
        arrastando = true;
        px = e.touches[0].clientX - tx;
        py = e.touches[0].clientY - ty;
      }
    }, { passive: false });

    palco.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = dist(e.touches);
        escala = Math.min(6, Math.max(1, pinchBase * (d / pinchDist)));
        if (escala === 1) { tx = 0; ty = 0; }
        aplicar();
      } else if (e.touches.length === 1 && arrastando) {
        e.preventDefault();
        tx = e.touches[0].clientX - px;
        ty = e.touches[0].clientY - py;
        aplicar();
      }
    }, { passive: false });

    palco.addEventListener('touchend', e => {
      if (e.touches.length === 0) arrastando = false;
    });

    document.addEventListener('keydown', escFechar);
  };

  function dist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }

  function escFechar(e) { if (e.key === 'Escape') fecharVisor(); }

  window.fecharVisor = function () {
    const el = document.getElementById('visor-overlay');
    if (!el) return;
    el.classList.remove('show');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escFechar);
    setTimeout(() => el.remove(), 200);
    imgEl = null;
  };
})();
