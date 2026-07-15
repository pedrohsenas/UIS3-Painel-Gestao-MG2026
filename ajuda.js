'use strict';
// ─── ajuda.js — botão de ajuda contextual em cada tela ─────────────────

window._ajudaChave = 'maquinas';

const AJUDAS = {
  dashboard: {
    titulo: 'Dashboard',
    texto: `<p>Visão macro do avanço da Manutenção Geral.</p>
<ul>
<li><strong>Filtro de categoria:</strong> use as abas para ver indicadores de todas as máquinas ou de um grupo específico.</li>
<li><strong>Cartões (KPIs):</strong> total de máquinas, percentual geral de avanço, etapas concluídas, em andamento e atrasadas (prazo vencido sem conclusão).</li>
<li><strong>Curva S:</strong> a linha cinza tracejada é o <strong>planejado</strong> (acumulado dos prazos definidos) e a azul é o <strong>realizado</strong> (acumulado das conclusões). Se a azul está abaixo da cinza, a MG está atrasada em relação ao plano.</li>
<li><strong>Tabelas estatísticas:</strong> distribuição de máquinas por tipo e área, potência instalada e fabricantes — cada uma com totalizadores.</li>
</ul>
<p>Para a curva S funcionar, os prazos devem estar cadastrados na tela <strong>Prazos</strong>.</p>`
  },
  maquinas: {
    titulo: 'Máquinas',
    texto: `<p>Consulta de todas as máquinas importadas, organizadas por categoria.</p>
<ul>
<li><strong>Abas:</strong> Motores EX, Bombas EX e Outros EX (equipamentos à prova de explosão — cada tipo é um escopo separado; uma motobomba EX tem cadastro de motor e de bomba independentes), Motores, Bombas, Redutores e Outras máquinas.</li>
<li><strong>Busca:</strong> filtre por TAG, área, localização ou fabricante em tempo real.</li>
<li><strong>Barra de etapas:</strong> mostra o progresso (x/7) de cada máquina — verde quando completa.</li>
<li><strong>Clique em uma linha</strong> para abrir a ficha completa da máquina.</li>
</ul>`
  },
  ficha: {
    titulo: 'Ficha da máquina',
    texto: `<p>Dados completos de uma máquina.</p>
<ul>
<li><strong>Edição:</strong> gestores podem alterar qualquer campo e salvar; técnicos visualizam.</li>
<li><strong>Fotos:</strong> separadas entre as da coleta de campo e as adicionadas no painel. Qualquer usuário pode adicionar fotos; só gestores excluem.</li>
<li><strong>Serviços planejados (PCM):</strong> gestores marcam aqui os serviços que deverão ser executados nesta máquina. Esta lista será conferida pelo técnico na etapa Execução da manutenção.</li>
<li><strong>Etapas:</strong> clique em qualquer etapa para abrir sua gestão (status, prazo, anotações, fotos).</li>
<li><strong>Arquivar:</strong> retira a máquina das listas ativas sem excluir os dados.</li>
</ul>`
  },
  etapa: {
    titulo: 'Gestão da etapa',
    texto: `<p>Controle individual de uma etapa da máquina.</p>
<ul>
<li><strong>Status:</strong> Pendente → Em andamento → Concluída. A conclusão registra data e hora automaticamente.</li>
<li><strong>Prazo:</strong> definido apenas por gestores (individualmente aqui ou em massa na tela Prazos).</li>
<li><strong>Responsável:</strong> para técnicos é preenchido automaticamente com o usuário logado; gestores devem selecionar um responsável da lista.</li>
<li><strong>Execução da manutenção:</strong> exibe a conferência dos serviços planejados pelo PCM. A etapa só pode ser concluída quando todos os serviços estiverem confirmados. Técnicos marcam; somente gestores desmarcam.</li>
<li><strong>Anotações e fotos:</strong> registre observações e anexe fotos da execução.</li>
</ul>`
  },
  matriz: {
    titulo: 'Lançamento Geral',
    texto: `<p>Lançamento de conclusão de etapas em massa.</p>
<ul>
<li><strong>Estrutura:</strong> linhas são as 7 etapas e colunas são as máquinas da categoria selecionada.</li>
<li><strong>Células:</strong> ✓ verde = concluída (travada); fundo amarelo = em andamento; vazia = pendente.</li>
<li><strong>Como lançar:</strong> clique nas células desejadas (ficam azuis), depois use o botão <strong>Revisar lançamentos</strong> no rodapé.</li>
<li><strong>Confirmação:</strong> a tela seguinte lista cada TAG e serviço/etapa para revisão final antes de gravar.</li>
</ul>`
  },
  confirmacao: {
    titulo: 'Confirmação de lançamentos',
    texto: `<p>Revisão final antes de gravar as conclusões em massa.</p>
<ul>
<li>Cada linha mostra a <strong>TAG</strong> da máquina e a <strong>etapa</strong> que será concluída.</li>
<li>Use <strong>Remover</strong> para tirar um item da lista sem perder os demais.</li>
<li><strong>Confirmar</strong> grava todas as conclusões com a data e hora atual. A ação alimenta diretamente a curva S do Dashboard.</li>
</ul>`
  },
  prazos: {
    titulo: 'Prazos em Massa',
    texto: `<p>Definição dos prazos planejados — a base da curva S.</p>
<ul>
<li><strong>Por categoria:</strong> selecione a aba e defina a data de cada etapa para todas as máquinas do grupo.</li>
<li><strong>Modos:</strong> "Só preencher vazios" preserva prazos já definidos individualmente; "Sobrescrever todos" substitui tudo (pede confirmação).</li>
<li><strong>Colunas Com/Sem prazo:</strong> mostram a cobertura atual — etapas sem prazo ficam fora da curva planejada.</li>
<li>Prazos individuais podem ser ajustados na tela de cada etapa.</li>
</ul>`
  },
  servicos: {
    titulo: 'Serviços Planejados',
    texto: `<p>Definição em massa dos serviços que serão executados por categoria (atribuição do PCM).</p>
<ul>
<li><strong>Adicionar:</strong> marque os serviços e aplique — não duplica o que já estava planejado.</li>
<li><strong>Remover:</strong> exclui o planejamento dos serviços selecionados de todas as máquinas da categoria.</li>
<li><strong>Ajuste fino:</strong> serviços de uma máquina específica podem ser ajustados na ficha dela.</li>
<li>Os serviços planejados aparecem para conferência do técnico na etapa <strong>Execução da manutenção</strong>, que só pode ser concluída com todos confirmados.</li>
</ul>`
  },
  importar: {
    titulo: 'Importar ZIP',
    texto: `<p>Importação dos arquivos gerados pelo aplicativo de coleta de campo.</p>
<ul>
<li>Selecione o ZIP no padrão <strong>TTTTT_EEEEE_LLLLL_AAAAMMDD.zip</strong>.</li>
<li>O sistema lê o dados.csv, cadastra as máquinas (criando automaticamente as 7 etapas de cada uma) e envia as fotos para a nuvem.</li>
<li>Ao final, um resumo mostra quantas máquinas e fotos foram importadas e eventuais avisos.</li>
<li>Cada importação fica registrada na <strong>Biblioteca</strong> pelo nome do arquivo.</li>
</ul>`
  },
  biblioteca: {
    titulo: 'Biblioteca',
    texto: `<p>Histórico de todas as importações realizadas.</p>
<ul>
<li>Cada linha é um ZIP importado, identificado pelo nome do arquivo, técnico e quantidade de máquinas.</li>
<li><strong>Arquivar:</strong> marca a importação como inativa, sem excluir dados.</li>
<li><strong>Excluir:</strong> remove a importação e <strong>todas as máquinas, etapas e fotos vinculadas</strong> — ação irreversível, use com cautela.</li>
</ul>`
  }
};

function abrirAjudaTela() {
  const a = AJUDAS[window._ajudaChave] || AJUDAS.maquinas;
  const overlay = document.createElement('div');
  overlay.id = 'ajuda-tela-overlay';
  overlay.innerHTML = `
    <div class="ajuda-tela-modal" role="dialog">
      <div class="ajuda-tela-head">
        <span class="ajuda-tela-titulo">❓ ${a.titulo}</span>
        <button class="ajuda-tela-fechar" onclick="fecharAjudaTela()">✕</button>
      </div>
      <div class="ajuda-tela-body">${a.texto}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) fecharAjudaTela(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
}

function fecharAjudaTela() {
  const el = document.getElementById('ajuda-tela-overlay');
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 200);
}
