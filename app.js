/* =============================================
   EDUQUEST — app.js  (refatorado)
   ============================================= */

/* ===== USUÁRIOS ===== */
const USERS = {
  '2025001': { senha: 'aluno123', tipo: 'aluno', nome: 'Maria Fernanda Silva', turma: '8º Ano A · Manhã', iniciais: 'MF', nivel: 1, pts: 0, avatarClass: 'av-y' },
  '2025002': { senha: 'aluno456', tipo: 'aluno', nome: 'Lucas Mendes',         turma: '8º Ano A · Manhã', iniciais: 'LR', nivel: 1, pts: 0, avatarClass: 'av-b' },
  '2025003': { senha: 'aluno789', tipo: 'aluno', nome: 'Ana Clara Oliveira',   turma: '8º Ano A · Manhã', iniciais: 'AO', nivel: 1, pts: 0, avatarClass: 'av-g' },
  'prof01':  { senha: 'prof2025', tipo: 'professor', nome: 'Prof. Carlos' },
};

/* ===== RECOMPENSAS PADRÃO ===== */
const DEFAULT_REWARDS = [
  { id: 'r2', emoji: '🍭', nome: 'Doce da Cantina',    custo: 50 },
  { id: 'r3', emoji: '📚', nome: 'Livro à Escolha',    custo: 200 },
  { id: 'r5', emoji: '🏆', nome: 'Troféu do Mês',      custo: 500 },
];

/* ===== RANKING PADRÃO (outros alunos) ===== */
const RANKING_BASE = [
  { nome: 'Maria Fernanda S.', iniciais: 'MF', avatarClass: 'av-y', pts: 0, nivel: 1, matricula: '2025001' },
  { nome: 'Lucas R. Mendes',   iniciais: 'LR', avatarClass: 'av-b', pts: 0, nivel: 1, matricula: '2025002' },
  { nome: 'Ana Clara Oliveira',iniciais: 'AO', avatarClass: 'av-g', pts: 0, nivel: 1, matricula: '2025003' },
];

/* ===== NOMES DE NÍVEL ===== */
const NIVEL_NOMES = [
  '', 'Novato', 'Curioso', 'Dedicado', 'Aplicado',
  'Estudante Dedicado', 'Destaque', 'Especialista', 'Mestre', 'Sábio', 'Lendário'
];

/* ===== ESTADO ===== */
let currentUser     = null;
let currentMatricula = null;
let selectedRole    = 'aluno';
let challenges      = [];    // criados pelo professor
let resgates        = [];    // histórico de resgates do aluno atual
let challengesDone  = {};    // { [challengeId]: true } por matrícula (simplificado)
let toastTimer      = null;

/* ===== PERSISTÊNCIA ===== */
function saveData() {
  localStorage.setItem('eq_challenges', JSON.stringify(challenges));
}
function loadData() {
  const ch = localStorage.getItem('eq_challenges');
  if (ch) {
    try { challenges = JSON.parse(ch); } catch(e) { challenges = []; }
  }
}

/* =============================================
   LOGIN
   ============================================= */
function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('role-' + role).classList.add('active');

  const hint = document.getElementById('login-hint');
  if (role === 'professor') {
    hint.innerHTML = 'Professor: matrícula <strong>prof01</strong>, senha <strong>prof2025</strong>';
  } else {
    hint.innerHTML = 'Aluno: matrícula <strong>2025001</strong>, senha <strong>aluno123</strong>';
  }
}

function doLogin() {
  const matricula = document.getElementById('login-matricula').value.trim();
  const senha     = document.getElementById('login-senha').value.trim();
  const errEl     = document.getElementById('login-error');
  errEl.textContent = '';

  if (!matricula || !senha) {
    errEl.textContent = 'Preencha matrícula e senha.';
    return;
  }

  const user = USERS[matricula];
  if (!user || user.senha !== senha) {
    errEl.textContent = 'Matrícula ou senha incorretos.';
    return;
  }
  if (user.tipo !== selectedRole) {
    errEl.textContent = `Essa matrícula é de ${user.tipo === 'aluno' ? 'aluno' : 'professor'}. Selecione o tipo correto.`;
    return;
  }

  currentUser      = user;
  currentMatricula = matricula;

  if (user.tipo === 'aluno') {
    // Carregar resgates do aluno do localStorage
    const savedResgates = localStorage.getItem('eq_resgates_' + matricula);
    resgates = savedResgates ? JSON.parse(savedResgates) : [];

    populateStudentUI();
    showPage('student');
    setTab(document.querySelector('[data-tab="desafios"]'), 'desafios');
  } else {
    document.getElementById('nav-teacher-name').textContent = user.nome;
    renderTeacherView();
    showPage('teacher');
  }
}

function doLogout() {
  currentUser      = null;
  currentMatricula = null;
  resgates         = [];
  document.getElementById('login-matricula').value = '';
  document.getElementById('login-senha').value     = '';
  document.getElementById('login-error').textContent = '';
  showPage('login');
}

/* =============================================
   NAVEGAÇÃO
   ============================================= */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
}

function setTab(el, tabId) {
  // Atualiza nav items (apenas dentro da sidebar do aluno)
  document.querySelectorAll('#page-student .nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');

  // Mostra tab correta
  document.querySelectorAll('#page-student .tab').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById('tab-' + tabId);
  if (tab) tab.classList.add('active');

  // Fecha sidebar no mobile
  closeSidebar();

  // Renderiza conteúdo dinâmico ao mudar de aba
  if (tabId === 'progresso') renderProgresso();
  if (tabId === 'ranking')   renderRanking();
}

/* ===== SIDEBAR MOBILE ===== */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

/* =============================================
   LÓGICA DE NÍVEL
   ============================================= */
function calcLevel(pts) {
  // Cada nível requer pts_base * nivel pontos (ex: nv1=100, nv2=200, nv3=300...)
  const PTS_POR_NIVEL = 100;
  const nivel = Math.floor(pts / PTS_POR_NIVEL) + 1;
  const ptsNoNivel    = pts % PTS_POR_NIVEL;
  const ptsParaProx   = PTS_POR_NIVEL;
  const pct           = Math.round((ptsNoNivel / ptsParaProx) * 100);
  const nome          = NIVEL_NOMES[Math.min(nivel, NIVEL_NOMES.length - 1)] || 'Lendário';
  return { nivel, ptsNoNivel, ptsParaProx, pct, nome };
}

/* =============================================
   ÁREA DO ALUNO — populateStudentUI
   ============================================= */
function populateStudentUI() {
  const u = currentUser;

  // Sidebar
  document.getElementById('sb-iniciais').textContent = u.iniciais;
  document.getElementById('sb-name').textContent     = u.nome.split(' ')[0] + ' ' + (u.nome.split(' ')[1] || '');
  document.getElementById('sb-class').textContent    = u.turma;
  document.getElementById('pts-display').textContent = u.pts;

  const lv = calcLevel(u.pts);
  document.getElementById('sb-level').textContent    = 'Nv.' + lv.nivel;

  // Nav user
  document.getElementById('nav-user-name').textContent = u.nome.split(' ')[0];

  // Configs
  document.getElementById('config-nome').value      = u.nome;
  document.getElementById('config-matricula').value = currentMatricula;
  document.getElementById('config-turma').value     = u.turma.split(' · ')[0];

  renderDesafios();
  renderRecompensas();
}

/* =============================================
   TAB: DESAFIOS
   ============================================= */
function renderDesafios() {
  const gridAtivos     = document.getElementById('grid-ativos');
  const gridConcluidos = document.getElementById('grid-concluidos');
  const badgeAtivos    = document.getElementById('badge-ativos');
  const badgeConcl    = document.getElementById('badge-concluidos');

  const doneKey = 'eq_done_' + currentMatricula;
  const doneSet = JSON.parse(localStorage.getItem(doneKey) || '{}');

  const ativos     = challenges.filter(c => !doneSet[c.id]);
  const concluidos = challenges.filter(c => doneSet[c.id]);

  badgeAtivos.textContent = ativos.length + ' disponíve' + (ativos.length === 1 ? 'l' : 'is');
  badgeConcl.textContent  = concluidos.length + ' completo' + (concluidos.length !== 1 ? 's' : '');

  // Ativos
  gridAtivos.innerHTML = '';
  if (ativos.length === 0) {
    gridAtivos.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div>Nenhum desafio ativo no momento.</div>';
  } else {
    ativos.forEach(ch => {
      gridAtivos.appendChild(buildChallengeCard(ch, false));
    });
  }

  // Concluídos
  gridConcluidos.innerHTML = '';
  if (concluidos.length === 0) {
    gridConcluidos.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div>Você ainda não concluiu nenhum desafio.</div>';
  } else {
    concluidos.forEach(ch => {
      gridConcluidos.appendChild(buildChallengeCard(ch, true));
    });
  }
}

function buildChallengeCard(ch, done) {
  const card = document.createElement('div');
  card.className = 'challenge-card' + (done ? ' done' : '');
  card.style.cursor = 'default'; // aluno não pode clicar

  const deadline = ch.deadline ? `Vence em ${ch.deadline} dias` : 'Sem prazo definido';

  card.innerHTML = `
    ${done ? '<div class="done-check">✓</div>' : ''}
    <div class="ch-icon">${ch.icon || '🏆'}</div>
    <div class="ch-title">${ch.titulo}</div>
    <div class="ch-desc">${ch.descricao || ''}</div>
    <div class="ch-footer">
      <div class="ch-pts">${ch.pontos} pts</div>
      ${done
        ? '<span style="font-size:10px;color:#0e6640;font-weight:800">Concluído ✓</span>'
        : `<div class="ch-bar"><div class="ch-fill" style="width:0%"></div></div>`
      }
    </div>
    ${!done
      ? `<div style="font-size:10px;color:var(--muted);margin-top:8px">${deadline}</div>`
      : ''
    }
  `;

  return card;
}

/* =============================================
   TAB: RECOMPENSAS
   ============================================= */
function renderRecompensas() {
  const grid       = document.getElementById('rewards-grid');
  const badge      = document.getElementById('badge-rewards');
  const historyEl  = document.getElementById('history-list');

  const disponiveis = DEFAULT_REWARDS.filter(r => currentUser.pts >= r.custo);
  badge.textContent = disponiveis.length + ' disponíve' + (disponiveis.length === 1 ? 'l' : 'is');

  grid.innerHTML = '';
  DEFAULT_REWARDS.forEach(r => {
    const canAfford = currentUser.pts >= r.custo;
    const card = document.createElement('div');
    card.className = 'reward-card' + (canAfford ? '' : ' locked');
    card.innerHTML = `
      <div class="rw-emoji">${r.emoji}</div>
      <div class="rw-name">${r.nome}</div>
      <div class="rw-cost"><strong>${r.custo} pts</strong></div>
      ${!canAfford ? '<div class="lock-overlay">🔒</div>' : ''}
    `;
    if (canAfford) {
      card.addEventListener('click', () => resgatar(r));
    }
    grid.appendChild(card);
  });

  // Histórico
  historyEl.innerHTML = '';
  if (resgates.length === 0) {
    historyEl.innerHTML = '<div class="history-empty">Nenhum resgate ainda. Troque seus pontos acima!</div>';
  } else {
    resgates.slice().reverse().forEach(r => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <span class="history-emoji">${r.emoji}</span>
        <span class="history-name">${r.nome}</span>
        <span class="history-cost">−${r.custo} pts</span>
        <span class="history-date">${r.data}</span>
      `;
      historyEl.appendChild(item);
    });
  }

  // Atualizar contagem no progresso
  const progEl = document.getElementById('prog-resgates');
  if (progEl) progEl.textContent = resgates.length;
}

function resgatar(reward) {
  if (currentUser.pts < reward.custo) {
    showToast('Pontos insuficientes!');
    return;
  }
  if (!confirm(`Resgatar "${reward.nome}" por ${reward.custo} pts?`)) return;

  currentUser.pts -= reward.custo;
  document.getElementById('pts-display').textContent = currentUser.pts;

  const lv = calcLevel(currentUser.pts);
  document.getElementById('sb-level').textContent = 'Nv.' + lv.nivel;

  const now = new Date();
  const dataStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  resgates.push({ ...reward, data: dataStr });
  localStorage.setItem('eq_resgates_' + currentMatricula, JSON.stringify(resgates));

  showToast(`${reward.emoji} "${reward.nome}" resgatado com sucesso!`);
  renderRecompensas();
}

/* =============================================
   TAB: PROGRESSO
   ============================================= */
function renderProgresso() {
  const u  = currentUser;
  const lv = calcLevel(u.pts);

  // Stats
  document.getElementById('prog-pts').textContent        = u.pts;
  document.getElementById('prog-resgates').textContent   = resgates.length;

  const doneKey = 'eq_done_' + currentMatricula;
  const doneSet = JSON.parse(localStorage.getItem(doneKey) || '{}');
  const nConcl  = challenges.filter(c => doneSet[c.id]).length;
  document.getElementById('prog-concluidos').textContent = nConcl;

  // Posição no ranking
  const rankingDados = buildRankingData();
  const posIdx = rankingDados.findIndex(r => r.matricula === currentMatricula);
  document.getElementById('prog-ranking').textContent = posIdx >= 0 ? (posIdx + 1) + 'º' : '—';

  // Nível
  document.getElementById('level-name').innerHTML    = `Nível ${lv.nivel} — <span style="color:var(--purple)">${lv.nome}</span>`;
  document.getElementById('level-sub').textContent   = `${lv.ptsNoNivel} / ${lv.ptsParaProx} pts para o próximo nível`;
  document.getElementById('level-badge-big').textContent = 'Nv.' + lv.nivel;
  document.getElementById('level-bar').style.width   = lv.pct + '%';
  document.getElementById('level-prev').textContent  = 'Nv. ' + (lv.nivel - 1);
  document.getElementById('level-next').textContent  = 'Nv. ' + (lv.nivel + 1);
  document.getElementById('level-pct').textContent   = lv.pct + '% completo';

  // Desafios detalhamento
  renderProgChallenges(doneSet);

  // Conquistas
  renderBadges(u.pts, nConcl);
}

function renderProgChallenges(doneSet) {
  const container = document.getElementById('prog-challenges-list');
  container.innerHTML = '';

  if (challenges.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>Nenhum desafio disponível ainda.</div>';
    return;
  }

  challenges.forEach(ch => {
    const done = !!doneSet[ch.id];
    const row  = document.createElement('div');
    row.className = 'prog-ch-row';
    row.innerHTML = `
      <div class="prog-ch-icon">${ch.icon || '🏆'}</div>
      <div class="prog-ch-info">
        <div class="prog-ch-title">${ch.titulo}</div>
        <div class="prog-ch-bar-wrap">
          <div class="prog-ch-bar">
            <div class="prog-ch-fill ${done ? 'done-fill' : ''}" style="width:${done ? 100 : 0}%"></div>
          </div>
          <span class="prog-ch-pct ${done ? 'done-text' : ''}">${done ? 'Concluído' : '0%'}</span>
        </div>
      </div>
      <div class="prog-ch-pts ${done ? 'earned' : 'pending'}">+${ch.pontos} pts</div>
    `;
    container.appendChild(row);
  });
}

function renderBadges(pts, nConcl) {
  const BADGES = [
    { icon: '🌟', nome: 'Primeiro ponto',    cond: pts >= 1 },
    { icon: '🏆', nome: '100 pontos',         cond: pts >= 100 },
    { icon: '✅', nome: '1 desafio',           cond: nConcl >= 1 },
    { icon: '🎯', nome: '5 desafios',          cond: nConcl >= 5 },
    { icon: '👑', nome: 'Líder',              cond: false },
    { icon: '🚀', nome: 'Nv. 10',             cond: pts >= 900 },
  ];

  const grid = document.getElementById('badges-grid');
  grid.innerHTML = '';

  BADGES.forEach(b => {
    const el = document.createElement('div');
    el.className = 'badge-item' + (b.cond ? ' earned-badge' : '');
    el.innerHTML = `
      <div class="badge-icon" style="${!b.cond ? 'opacity:0.3' : ''}">${b.icon}</div>
      <div class="badge-name" style="${!b.cond ? 'opacity:0.4' : ''}">${b.nome}</div>
    `;
    grid.appendChild(el);
  });
}

/* =============================================
   TAB: RANKING
   ============================================= */
function buildRankingData() {
  // Mescla usuários cadastrados com RANKING_BASE, atualizando pontos se logado
  const data = RANKING_BASE.map(r => {
    if (r.matricula === currentMatricula) {
      return { ...r, pts: currentUser.pts, nome: currentUser.nome.split(' ').slice(0,2).join(' ') + ' S.' };
    }
    return { ...r };
  });
  return data.sort((a, b) => b.pts - a.pts);
}

function renderRanking() {
  const data = buildRankingData();
  const maxPts = data[0]?.pts || 1;

  // Pódio (top 3)
  const podium = document.getElementById('podium-container');
  podium.innerHTML = '';
  const top3 = data.slice(0, 3);
  const PODIUM_ORDER = [1, 0, 2]; // 2º, 1º, 3º (ordem visual)
  const podiumClasses = ['p2', 'p1', 'p3'];
  const blockClasses  = ['b2', 'b1', 'b3'];

  PODIUM_ORDER.forEach((idx, visualPos) => {
    const p = top3[idx];
    if (!p) return;
    const slot = document.createElement('div');
    slot.className = 'podium-slot ' + podiumClasses[visualPos];
    const isFirst = idx === 0;
    slot.innerHTML = `
      ${isFirst ? '<div class="podium-crown">👑</div>' : ''}
      <div class="podium-avatar ${p.avatarClass}">${p.iniciais}</div>
      <div class="podium-name">${p.nome.split(' ')[0]}</div>
      <div class="podium-pts">${p.pts} pts</div>
      <div class="podium-block ${blockClasses[visualPos]}"><span>${idx + 1}</span></div>
    `;
    podium.appendChild(slot);
  });

  // Lista completa
  const list = document.getElementById('ranking-list');
  list.innerHTML = '';
  data.forEach((p, i) => {
    const isMe = p.matricula === currentMatricula;
    const row  = document.createElement('div');
    row.className = 'ranking-row' + (isMe ? ' me' : '');

    let posClass = '';
    if (i === 0) posClass = 'gold';
    else if (i === 1) posClass = 'silver';
    else if (i === 2) posClass = 'bronze';

    const barPct = Math.round((p.pts / maxPts) * 100);

    row.innerHTML = `
      <div class="rank-pos ${posClass}">${i + 1}</div>
      <div class="s-av ${p.avatarClass}">${p.iniciais}</div>
      <div class="s-info">
        <div class="s-info-name">${p.nome} ${isMe ? '<span class="you-tag">Você</span>' : ''}</div>
        <div class="s-info-meta">Nível ${p.nivel}</div>
      </div>
      <div class="rank-pts-bar-wrap">
        <div class="rank-pts-bar"><div class="rank-pts-fill" style="width:${barPct}%"></div></div>
      </div>
      <div class="pts-badge">${p.pts} pts</div>
    `;
    list.appendChild(row);
  });
}

/* =============================================
   TAB: CONFIG
   ============================================= */
function saveConfig() {
  const novaSenha = document.getElementById('config-nova-senha').value;
  const confSenha = document.getElementById('config-conf-senha').value;

  if (novaSenha || confSenha) {
    if (novaSenha.length < 6) {
      showToast('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confSenha) {
      showToast('As senhas não coincidem!');
      return;
    }
    USERS[currentMatricula].senha = novaSenha;
    document.getElementById('config-nova-senha').value = '';
    document.getElementById('config-conf-senha').value = '';
  }

  const novoNome = document.getElementById('config-nome').value.trim();
  if (novoNome) {
    currentUser.nome = novoNome;
    USERS[currentMatricula].nome = novoNome;
    document.getElementById('sb-name').textContent    = novoNome.split(' ')[0] + ' ' + (novoNome.split(' ')[1] || '');
    document.getElementById('nav-user-name').textContent = novoNome.split(' ')[0];
  }

  showToast('✅ Configurações salvas com sucesso!');
}

/* =============================================
   PAINEL DO PROFESSOR
   ============================================= */
function renderTeacherView() {
  renderTeacherRanking();
  renderTeacherChallenges();
  updateTeacherStats();
}

function updateTeacherStats() {
  document.getElementById('teacher-stat-desafios').textContent = challenges.length;
}

function renderTeacherRanking() {
  // Lê pontos ao vivo de USERS para refletir marcações imediatas
  const data = RANKING_BASE.map(p => {
    if (p.matricula && USERS[p.matricula]) {
      return { ...p, pts: USERS[p.matricula].pts };
    }
    return { ...p };
  }).sort((a, b) => b.pts - a.pts);

  const container = document.getElementById('teacher-ranking-list');
  container.innerHTML = '';

  data.forEach((p, i) => {
    let posClass = '';
    if (i === 0) posClass = 'gold';
    else if (i === 1) posClass = 'silver';
    else if (i === 2) posClass = 'bronze';

    const lv = calcLevel(p.pts);
    const row = document.createElement('div');
    row.className = 'student-row';
    row.innerHTML = `
      <div class="rank-pos ${posClass}">${i + 1}</div>
      <div class="s-av ${p.avatarClass}">${p.iniciais}</div>
      <div class="s-info">
        <div class="s-info-name">${p.nome}</div>
        <div class="s-info-meta">8º A · Nível ${lv.nivel}</div>
      </div>
      <div class="pts-badge">${p.pts} pts</div>
    `;
    container.appendChild(row);
  });
}

function renderTeacherChallenges() {
  const container = document.getElementById('teacher-challenges-list');
  const emptyEl   = document.getElementById('teacher-challenges-empty');
  container.innerHTML = '';

  if (challenges.length === 0) {
    emptyEl.style.display = 'block';
    updateTeacherStats();
    return;
  }
  emptyEl.style.display = 'none';

  // Alunos que têm matrícula cadastrada
  const alunosCadastrados = Object.entries(USERS)
    .filter(([, u]) => u.tipo === 'aluno')
    .map(([matricula, u]) => ({ matricula, ...u }));

  challenges.forEach(ch => {
    // Cabeçalho do desafio
    const header = document.createElement('div');
    header.className = 'ch-admin-row';
    header.style.background = '#f8f6ff';
    header.innerHTML = `
      <div class="ch-admin-icon">${ch.icon || '🏆'}</div>
      <div class="ch-admin-info">
        <div class="ch-admin-title">${ch.titulo}</div>
        <div class="ch-admin-meta">${ch.deadline ? 'Vence em ' + ch.deadline + ' dias' : 'Sem prazo'} · ${ch.pontos} pts</div>
      </div>
      <span class="status-pill s-active">Ativo</span>
      <button class="delete-btn" onclick="deleteChallenge(${ch.id})">Excluir</button>
    `;
    container.appendChild(header);

    // Uma linha por aluno
    alunosCadastrados.forEach(aluno => {
      const doneKey = 'eq_done_' + aluno.matricula;
      const doneSet = JSON.parse(localStorage.getItem(doneKey) || '{}');
      const done    = !!doneSet[ch.id];

      const row = document.createElement('div');
      row.className = 'ch-admin-row';
      row.style.paddingLeft = '32px';
      row.id = `row_${ch.id}_${aluno.matricula}`;
      row.innerHTML = `
        <div class="s-av ${aluno.avatarClass}" style="width:28px;height:28px;font-size:10px">${aluno.iniciais}</div>
        <div class="ch-admin-info">
          <div class="ch-admin-title" style="font-weight:700">${aluno.nome}</div>
        </div>
        ${done
          ? `<span class="status-pill s-active">✓ Concluído</span>`
          : `<button class="save-btn" style="margin-top:0;padding:5px 12px;font-size:11px"
               onclick="professorMarcarConcluido(${ch.id}, '${aluno.matricula}', ${ch.pontos})">
               Marcar concluído
             </button>`
        }
      `;
      container.appendChild(row);
    });

    // Separador visual entre desafios
    const sep = document.createElement('div');
    sep.style.height = '1px';
    sep.style.background = 'var(--border)';
    sep.style.margin = '0';
    container.appendChild(sep);
  });

  updateTeacherStats();
}

function professorMarcarConcluido(challengeId, matricula, pontos) {
  const ch    = challenges.find(c => c.id === challengeId);
  const aluno = USERS[matricula];
  if (!ch || !aluno) return;

  if (!confirm(`Marcar "${ch.titulo}" como concluído para ${aluno.nome}?\n\nEle(a) receberá ${pontos} pontos.`)) return;

  // Salva como concluído
  const doneKey = 'eq_done_' + matricula;
  const doneSet = JSON.parse(localStorage.getItem(doneKey) || '{}');
  doneSet[challengeId] = true;
  localStorage.setItem(doneKey, JSON.stringify(doneSet));

  // Adiciona pontos ao usuário
  USERS[matricula].pts += pontos;

  // Se o aluno logado for esse, atualiza a UI dele também
  if (currentMatricula === matricula && currentUser) {
    currentUser.pts = USERS[matricula].pts;
    document.getElementById('pts-display').textContent = currentUser.pts;
    const lv = calcLevel(currentUser.pts);
    document.getElementById('sb-level').textContent = 'Nv.' + lv.nivel;
  }

  showToast(`✅ ${aluno.nome} recebeu +${pontos} pts pelo desafio "${ch.titulo}"!`);

  // Atualiza só a linha afetada no painel
  renderTeacherChallenges();
  renderTeacherRanking();
}

function filterRanking() {
  const q = document.getElementById('search-aluno').value.toLowerCase();
  document.querySelectorAll('#teacher-ranking-list .student-row').forEach(row => {
    const nome = row.querySelector('.s-info-name')?.textContent.toLowerCase() || '';
    row.style.display = nome.includes(q) ? '' : 'none';
  });
}

/* =============================================
   MODAL — NOVO DESAFIO
   ============================================= */
function openNewChallengeModal() {
  document.getElementById('modal-overlay').classList.add('open');
  const modal = document.getElementById('modal-challenge');
  modal.style.display = 'block';
  // Trigger reflow para animação
  requestAnimationFrame(() => modal.classList.add('open'));
  document.getElementById('new-title').focus();
}

function closeModal() {
  const modal = document.getElementById('modal-challenge');
  modal.classList.remove('open');
  document.getElementById('modal-overlay').classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
}

function handleAddChallenge() {
  const titulo   = document.getElementById('new-title').value.trim();
  const descricao= document.getElementById('new-desc').value.trim();
  const icon     = document.getElementById('new-icon').value.trim() || '🏆';
  const pontos   = parseInt(document.getElementById('new-points').value);
  const deadline = parseInt(document.getElementById('new-deadline').value) || null;

  if (!titulo) { showToast('Informe o título do desafio.'); return; }
  if (!pontos || pontos < 1) { showToast('Informe uma quantidade válida de pontos.'); return; }

  challenges.push({
    id: Date.now(),
    titulo,
    descricao,
    icon,
    pontos,
    deadline,
  });

  saveData();
  renderTeacherChallenges();
  closeModal();
  showToast(`✅ Desafio "${titulo}" criado com sucesso!`);

  // Limpa campos
  ['new-title','new-desc','new-icon','new-points','new-deadline'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function deleteChallenge(id) {
  const ch = challenges.find(c => c.id === id);
  if (!ch) return;
  if (!confirm(`Excluir o desafio "${ch.titulo}"?`)) return;

  challenges = challenges.filter(c => c.id !== id);
  saveData();
  renderTeacherChallenges();
  showToast('Desafio excluído.');
}

/* =============================================
   TOAST
   ============================================= */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}


/* =============================================
   TABS DO PROFESSOR
   ============================================= */
function setTeacherTab(tab) {
  ['painel', 'usuarios'].forEach(t => {
    document.getElementById('tpanel-' + t).style.display  = t === tab ? 'block' : 'none';
    document.getElementById('ttab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'usuarios') renderUsersPanel();
}

/* =============================================
   PAINEL DE USUÁRIOS
   ============================================= */
// Paleta de avatares para novos alunos
const AVATAR_CLASSES = ['av-y', 'av-b', 'av-g', 'av-p', 'av-v'];

function getInitials(nome) {
  const parts = nome.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderUsersPanel() {
  const alunosEl    = document.getElementById('users-alunos-list');
  const profsEl     = document.getElementById('users-profs-list');
  const alunosEmpty = document.getElementById('users-alunos-empty');
  const profsEmpty  = document.getElementById('users-profs-empty');

  const alunos = Object.entries(USERS).filter(([, u]) => u.tipo === 'aluno');
  const profs  = Object.entries(USERS).filter(([m, u]) => u.tipo === 'professor' && m !== currentMatricula);

  document.getElementById('count-alunos').textContent = alunos.length + ' aluno' + (alunos.length !== 1 ? 's' : '');
  document.getElementById('count-profs').textContent  = profs.length + ' professor' + (profs.length !== 1 ? 'es' : '');

  // --- Alunos ---
  alunosEl.innerHTML = '';
  if (alunos.length === 0) {
    alunosEmpty.style.display = 'block';
  } else {
    alunosEmpty.style.display = 'none';
    alunos.forEach(([matricula, u]) => {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.innerHTML = `
        <div class="s-av ${u.avatarClass || 'av-b'}">${u.iniciais || getInitials(u.nome)}</div>
        <div class="user-info">
          <div class="user-info-name">${u.nome}</div>
          <div class="user-info-meta">Mat: ${matricula} · ${u.turma || '—'}</div>
        </div>
        <div class="pts-badge">${u.pts} pts</div>
        <button class="delete-btn" onclick="removeUser('${matricula}')">Remover</button>
      `;
      alunosEl.appendChild(row);
    });
  }

  // --- Professores ---
  profsEl.innerHTML = '';
  if (profs.length === 0) {
    profsEmpty.style.display = 'block';
  } else {
    profsEmpty.style.display = 'none';
    profs.forEach(([matricula, u]) => {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.innerHTML = `
        <div class="s-av av-p" style="background:#e8e4ff;color:var(--purple)">${getInitials(u.nome)}</div>
        <div class="user-info">
          <div class="user-info-name">${u.nome}</div>
          <div class="user-info-meta">Mat: ${matricula}</div>
        </div>
        <button class="delete-btn" onclick="removeUser('${matricula}')">Remover</button>
      `;
      profsEl.appendChild(row);
    });
  }
}

function removeUser(matricula) {
  const u = USERS[matricula];
  if (!u) return;
  if (!confirm(`Remover ${u.tipo === 'aluno' ? 'o aluno' : 'o professor'} "${u.nome}"?

Essa ação não pode ser desfeita.`)) return;

  // Remove do USERS e do RANKING_BASE se for aluno
  delete USERS[matricula];
  const idx = RANKING_BASE.findIndex(r => r.matricula === matricula);
  if (idx !== -1) RANKING_BASE.splice(idx, 1);

  showToast(`Usuário "${u.nome}" removido.`);
  renderUsersPanel();
  renderTeacherRanking();
  updateTeacherStats();
}

/* =============================================
   MODAL: NOVO USUÁRIO
   ============================================= */
let newUserRole = 'aluno';

function openUserModal() {
  newUserRole = 'aluno';
  document.getElementById('new-user-role-aluno').classList.add('active');
  document.getElementById('new-user-role-professor').classList.remove('active');
  document.getElementById('new-user-turma-group').style.display = 'flex';
  ['new-user-nome','new-user-matricula','new-user-senha','new-user-turma'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('modal-user-overlay').classList.add('open');
  const modal = document.getElementById('modal-user');
  modal.style.display = 'block';
  requestAnimationFrame(() => modal.classList.add('open'));
  document.getElementById('new-user-nome').focus();
}

function closeUserModal() {
  const modal = document.getElementById('modal-user');
  modal.classList.remove('open');
  document.getElementById('modal-user-overlay').classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 220);
}

function selectNewUserRole(role) {
  newUserRole = role;
  document.getElementById('new-user-role-aluno').classList.toggle('active', role === 'aluno');
  document.getElementById('new-user-role-professor').classList.toggle('active', role === 'professor');
  document.getElementById('new-user-turma-group').style.display = role === 'aluno' ? 'flex' : 'none';
}

function handleAddUser() {
  const nome      = document.getElementById('new-user-nome').value.trim();
  const matricula = document.getElementById('new-user-matricula').value.trim();
  const senha     = document.getElementById('new-user-senha').value.trim();
  const turma     = document.getElementById('new-user-turma').value.trim();

  if (!nome)      { showToast('Informe o nome completo.'); return; }
  if (!matricula) { showToast('Informe a matrícula.'); return; }
  if (USERS[matricula]) { showToast('Essa matrícula já está cadastrada!'); return; }
  if (senha.length < 6) { showToast('A senha deve ter pelo menos 6 caracteres.'); return; }
  if (newUserRole === 'aluno' && !turma) { showToast('Informe a turma do aluno.'); return; }

  const iniciais    = getInitials(nome);
  const avatarClass = AVATAR_CLASSES[Object.keys(USERS).filter(k => USERS[k].tipo === 'aluno').length % AVATAR_CLASSES.length];

  if (newUserRole === 'aluno') {
    USERS[matricula] = { senha, tipo: 'aluno', nome, turma, iniciais, avatarClass, nivel: 1, pts: 0 };
    // Adicionar ao RANKING_BASE para aparecer no ranking
    RANKING_BASE.push({ nome: nome.split(' ').slice(0,2).join(' '), iniciais, avatarClass, pts: 0, nivel: 1, matricula });
  } else {
    USERS[matricula] = { senha, tipo: 'professor', nome };
  }

  closeUserModal();
  showToast(`✅ ${newUserRole === 'aluno' ? 'Aluno' : 'Professor'} "${nome}" cadastrado com sucesso!`);
  renderUsersPanel();
  renderTeacherRanking();
  updateTeacherStats();
}

/* =============================================
   INIT
   ============================================= */
loadData();

// Fechar modal com ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeUserModal(); }
});