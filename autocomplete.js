'use strict';
// ─── autocomplete.js — autocomplete dinâmico de rolamentos ─────────────
// Uso: <input id="meu-campo" ... >  +  acAtivarRolamento('meu-campo')
// Busca no banco (dbSugerirRolamentos) conforme o usuário digita.

(function () {
  let _timer = null;
  let _boxAtual = null;

  function fecharBox() {
    if (_boxAtual) { _boxAtual.remove(); _boxAtual = null; }
  }

  document.addEventListener('click', e => {
    if (_boxAtual && !e.target.closest('.ac-box') && !e.target.classList.contains('ac-input')) {
      fecharBox();
    }
  });

  window.acAtivarRolamento = function (inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.acAtivo) return;
    input.dataset.acAtivo = '1';
    input.classList.add('ac-input');
    input.setAttribute('autocomplete', 'off');

    input.addEventListener('input', () => {
      const termo = input.value.trim();
      clearTimeout(_timer);
      if (termo.length < 1) { fecharBox(); return; }
      _timer = setTimeout(async () => {
        let sugestoes = [];
        try { sugestoes = await dbSugerirRolamentos(termo); } catch { sugestoes = []; }
        // não sugere se a única opção for exatamente o que já está digitado
        sugestoes = sugestoes.filter(s => s.toLowerCase() !== termo.toLowerCase());
        if (!sugestoes.length) { fecharBox(); return; }
        mostrarBox(input, sugestoes);
      }, 220);
    });

    input.addEventListener('blur', () => setTimeout(fecharBox, 180));
  };

  function mostrarBox(input, sugestoes) {
    fecharBox();
    const r = input.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'ac-box';
    box.style.position = 'absolute';
    box.style.left = (r.left + window.scrollX) + 'px';
    box.style.top = (r.bottom + window.scrollY + 2) + 'px';
    box.style.width = r.width + 'px';
    box.innerHTML = sugestoes.map(s => `<div class="ac-item">${s.replace(/</g,'&lt;')}</div>`).join('');
    document.body.appendChild(box);
    _boxAtual = box;

    box.querySelectorAll('.ac-item').forEach((el, i) => {
      el.addEventListener('mousedown', ev => {
        ev.preventDefault();
        input.value = sugestoes[i];
        input.dispatchEvent(new Event('change'));
        fecharBox();
        input.focus();
      });
    });
  }
})();
