'use strict';
// ─── save_manager.js — sistema central de salvamento com dirty-state ──
//
// Uso:
//   1. Após renderizar uma tela com campos editáveis, chame:
//        SaveBar.init({ onSave: async () => { ...salva... } });
//   2. Marque os inputs editáveis com a classe "js-dirty-watch" OU
//      registre manualmente via SaveBar.markDirty() em handlers customizados.
//   3. O SaveBar cuida do resto: detecta mudanças, mostra barra fixa,
//      estados visuais e feedback de sucesso/erro.
//
// O objetivo é dar ao usuário certeza visual de que suas alterações foram
// (ou não) salvas — crítico num app de página única.

const SaveBar = (function () {
  let _onSave   = null;     // callback async de salvamento
  let _dirty    = false;    // há alterações não salvas?
  let _salvando = false;
  let _contexto = '';       // rótulo opcional (ex: "etapa", "máquina")

  function _el() { return document.getElementById('save-bar'); }

  function _garantirBarra() {
    if (_el()) return;
    const bar = document.createElement('div');
    bar.id = 'save-bar';
    bar.className = 'save-bar';
    bar.innerHTML = `
      <div class="save-bar-msg">
        <span class="save-bar-icon"></span>
        <span class="save-bar-texto"></span>
      </div>
      <div class="save-bar-acoes">
        <button class="btn btn-sec save-bar-descartar" type="button">Descartar</button>
        <button class="btn save-bar-salvar" type="button">Salvar alterações</button>
      </div>`;
    document.body.appendChild(bar);
    bar.querySelector('.save-bar-salvar').addEventListener('click', salvar);
    bar.querySelector('.save-bar-descartar').addEventListener('click', _descartar);
  }

  function _render() {
    _garantirBarra();
    const bar = _el();
    const icon = bar.querySelector('.save-bar-icon');
    const txt  = bar.querySelector('.save-bar-texto');
    const btnSalvar = bar.querySelector('.save-bar-salvar');
    const btnDesc   = bar.querySelector('.save-bar-descartar');

    bar.classList.remove('save-bar-sujo', 'save-bar-salvando', 'save-bar-ok');

    if (_salvando) {
      bar.classList.add('save-bar-visivel', 'save-bar-salvando');
      icon.textContent = '';
      txt.textContent = 'Salvando...';
      btnSalvar.disabled = true; btnDesc.disabled = true;
      btnSalvar.textContent = 'Salvando...';
    } else if (_dirty) {
      bar.classList.add('save-bar-visivel', 'save-bar-sujo');
      icon.textContent = '●';
      txt.textContent = 'Alterações não salvas';
      btnSalvar.disabled = false; btnDesc.disabled = false;
      btnSalvar.textContent = 'Salvar alterações';
    } else {
      bar.classList.remove('save-bar-visivel');
    }
  }

  function _flashOk() {
    _garantirBarra();
    const bar = _el();
    bar.classList.remove('save-bar-sujo', 'save-bar-salvando');
    bar.classList.add('save-bar-visivel', 'save-bar-ok');
    const icon = bar.querySelector('.save-bar-icon');
    const txt  = bar.querySelector('.save-bar-texto');
    icon.textContent = '✓';
    txt.textContent = 'Alterações salvas';
    setTimeout(() => {
      if (!_dirty && !_salvando) bar.classList.remove('save-bar-visivel');
    }, 1800);
  }

  function init(opts) {
    _onSave   = opts?.onSave || null;
    _dirty    = false;
    _salvando = false;
    _contexto = opts?.contexto || '';
    _render();
  }

  function markDirty() {
    if (_salvando) return;
    _dirty = true;
    _render();
  }

  function isDirty() { return _dirty; }

  async function salvar() {
    if (!_onSave || _salvando || !_dirty) return;
    _salvando = true; _render();
    try {
      await _onSave();
      _dirty = false; _salvando = false;
      _flashOk();
    } catch (e) {
      _salvando = false; _render();
      alert('Erro ao salvar: ' + (e?.message || e));
    }
  }

  function _descartar() {
    if (!_dirty) return;
    if (!confirm('Descartar as alterações não salvas?')) return;
    _dirty = false; _salvando = false;
    _render();
    // dispara evento para a tela recarregar seu estado original
    document.dispatchEvent(new CustomEvent('savebar:descartar'));
  }

  // Limpa o estado ao trocar de tela (chamado pela navegação)
  function reset() {
    _onSave = null; _dirty = false; _salvando = false;
    const bar = _el();
    if (bar) bar.classList.remove('save-bar-visivel');
  }

  // Liga automaticamente os inputs marcados com .js-dirty-watch
  function watchInputs(container) {
    const root = container || document;
    root.querySelectorAll('.js-dirty-watch').forEach(el => {
      if (el._dirtyBound) return;
      el._dirtyBound = true;
      const ev = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
      el.addEventListener(ev, markDirty);
    });
  }

  return { init, markDirty, isDirty, salvar, reset, watchInputs };
})();

// Aviso ao tentar sair da página (fechar aba / recarregar) com alterações pendentes
window.addEventListener('beforeunload', (e) => {
  if (SaveBar.isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ─── Validador central de datas ────────────────────────────────────────
// Uso: DataValida.checar('met-fim', 'Data fim') → true/false (alerta se inválida)
//      DataValida.checarTodas(container) → valida todos os inputs date do container
const DataValida = (function () {
  // Verifica se a string YYYY-MM-DD representa uma data real do calendário
  function ehValida(iso) {
    if (!iso) return true; // vazio é permitido (opcional)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return false;
    const [_, a, mes, dia] = m.map(Number);
    const d = new Date(a, mes - 1, dia);
    return d.getFullYear() === a && d.getMonth() === mes - 1 && d.getDate() === dia;
  }

  function checar(inputId, rotulo) {
    const el = document.getElementById(inputId);
    if (!el) return true;
    const v = el.value;
    if (ehValida(v)) return true;
    alert(`${rotulo || 'Data'} inválida: verifique dia e mês (ex: 31/11 não existe).`);
    el.focus();
    return false;
  }

  // Valida todos os input[type=date] dentro de um container; retorna false se algum inválido
  function checarTodas(container) {
    const root = container ? (typeof container === 'string' ? document.getElementById(container) : container) : document;
    if (!root) return true;
    for (const el of root.querySelectorAll('input[type="date"]')) {
      if (!ehValida(el.value)) {
        const rotulo = el.closest('.field')?.querySelector('label')?.textContent || 'Data';
        alert(`${rotulo} inválida: verifique dia e mês (ex: 31/11 não existe).`);
        el.focus();
        return false;
      }
    }
    return true;
  }

  return { ehValida, checar, checarTodas };
})();

// Aviso imediato ao sair de um campo de data com valor inválido (listener global)
document.addEventListener('blur', (e) => {
  const el = e.target;
  if (el?.tagName === 'INPUT' && el.type === 'date' && el.value) {
    if (!DataValida.ehValida(el.value)) {
      el.style.borderColor = 'var(--crit)';
      el.title = 'Data inválida';
    } else {
      el.style.borderColor = '';
      el.title = '';
    }
  }
}, true);
