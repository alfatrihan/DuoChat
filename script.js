const socket = io();

// Application State
let avatarsCatalog = [];
let currentUser = null;
let dashboardState = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: []
};
let activePartner = null;
let currentGame = null;
let selectedRegGender = 'male';
let selectedRegAvatarId = 'm_modest_1';
let selectedEditAvatarId = 'm_modest_1';
let soundEnabled = true;
let typingTimeout = null;

// Web Audio API Synthesizer for subtle UI & Game feedback
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(type = 'msg') {
  if (!soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'msg') {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.09);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'win') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(660, now + 0.08);
      osc.frequency.setValueAtTime(880, now + 0.16);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  } catch (_) {}
}

// Toast Notification Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const item = document.createElement('div');
  item.className = `toast-item ${type}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => {
    item.style.opacity = '0';
    setTimeout(() => item.remove(), 250);
  }, 3400);
}

function getAvatarSvg(avatarId) {
  const found = avatarsCatalog.find(a => a.id === avatarId) || avatarsCatalog[0];
  return found ? found.svg : '';
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- INITIALIZATION ---
async function initApp() {
  try {
    const res = await fetch('/api/avatars');
    const data = await res.json();
    avatarsCatalog = data.avatars || [];
  } catch (err) {
    console.error('Failed to load avatars:', err);
  }

  renderAvatarPicker('regAvatarGrid', selectedRegGender, selectedRegAvatarId, id => {
    selectedRegAvatarId = id;
  });

  // Restore saved session if present
  const savedUser = localStorage.getItem('duochat_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      enterMessengerDashboard();
    } catch (_) {
      localStorage.removeItem('duochat_user');
    }
  }
}

function renderAvatarPicker(containerId, genderFilter, activeId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const list = genderFilter
    ? avatarsCatalog.filter(a => a.gender === genderFilter)
    : avatarsCatalog;

  list.forEach(av => {
    const card = document.createElement('div');
    card.className = `avatar-option-card ${av.id === activeId ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="avatar-svg-wrap">${av.svg}</div>
      <div class="avatar-title">${av.name}</div>
      <span class="avatar-tag">${av.style === 'modest' ? '🕌 Modest' : '✨ Casual'}</span>
    `;
    card.addEventListener('click', () => {
      onSelect(av.id);
      renderAvatarPicker(containerId, genderFilter, av.id, onSelect);
    });
    container.appendChild(card);
  });
}

// --- AUTHENTICATION UI EVENTS ---
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  });
});

document.querySelectorAll('#regGenderPills .gender-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#regGenderPills .gender-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    selectedRegGender = pill.dataset.gender;
    const firstMatch = avatarsCatalog.find(a => a.gender === selectedRegGender);
    if (firstMatch) selectedRegAvatarId = firstMatch.id;
    renderAvatarPicker('regAvatarGrid', selectedRegGender, selectedRegAvatarId, id => {
      selectedRegAvatarId = id;
    });
  });
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    showToast(data.error || 'Login failed', 'error');
    return;
  }
  currentUser = data.user;
  localStorage.setItem('duochat_user', JSON.stringify(currentUser));
  showToast(`Welcome back, ${currentUser.displayName}!`, 'success');
  enterMessengerDashboard();
});

document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const displayName = document.getElementById('regDisplayName').value.trim();
  const password = document.getElementById('regPassword').value;

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      displayName,
      password,
      gender: selectedRegGender,
      avatarId: selectedRegAvatarId
    })
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    showToast(data.error || 'Registration failed', 'error');
    return;
  }
  currentUser = data.user;
  localStorage.setItem('duochat_user', JSON.stringify(currentUser));
  showToast(`Account @${currentUser.username} created!`, 'success');
  enterMessengerDashboard();
});

function enterMessengerDashboard() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('messengerApp').classList.remove('hidden');
  updateMyHeaderUI();
  socket.emit('auth:bind', { username: currentUser.username });
}

function updateMyHeaderUI() {
  if (!currentUser) return;
  document.getElementById('myAvatarBox').innerHTML = getAvatarSvg(currentUser.avatarId);
  document.getElementById('myDisplayName').textContent = currentUser.displayName;
  document.getElementById('myUsernameHandle').textContent = `@${currentUser.username}`;
}

// --- SIDEBAR NAVIGATION & SEARCH ---
function switchSidebarTab(viewName) {
  document.querySelectorAll('.sidebar-nav-tabs .nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === viewName);
  });
  document.getElementById('chatsView').classList.toggle('hidden', viewName !== 'chats');
  document.getElementById('requestsView').classList.toggle('hidden', viewName !== 'requests');
  document.getElementById('searchView').classList.toggle('hidden', viewName !== 'search');
}

document.querySelectorAll('.sidebar-nav-tabs .nav-tab').forEach(tab => {
  tab.addEventListener('click', () => switchSidebarTab(tab.dataset.view));
});

const searchInput = document.getElementById('userSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearSearchBtn.classList.toggle('hidden', !q);
  if (q.length > 0) {
    switchSidebarTab('search');
    socket.emit('users:search', { query: q });
  } else {
    document.getElementById('searchResultsList').innerHTML =
      `<div class="empty-state-small">Type a username above to find and add friends.</div>`;
  }
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchBtn.classList.add('hidden');
  switchSidebarTab('chats');
});

// --- RENDER DASHBOARD LISTS ---
function renderDashboard() {
  // 1. Friends Inbox List
  const inboxEl = document.getElementById('friendsInboxList');
  inboxEl.innerHTML = '';

  let totalUnread = 0;
  if (dashboardState.friends.length === 0) {
    inboxEl.innerHTML = `
      <div class="empty-state-small">
        No friends in your inbox yet.<br/>Use the search bar above to find friends by <strong>@username</strong>!
      </div>`;
  } else {
    dashboardState.friends.forEach(friend => {
      totalUnread += friend.unreadCount || 0;
      const item = document.createElement('div');
      item.className = `inbox-item ${activePartner === friend.username ? 'active' : ''}`;
      const lastPreview = friend.lastMessage
        ? (friend.lastMessage.from === currentUser.username ? `You: ${friend.lastMessage.text}` : friend.lastMessage.text)
        : 'Tap to start chatting & playing!';

      item.innerHTML = `
        <div class="inbox-left">
          <div class="avatar-circle sm">${getAvatarSvg(friend.avatarId)}</div>
          <div class="inbox-text">
            <div class="inbox-name-row">
              <span>${escapeHtml(friend.displayName)}</span>
              <span class="status-dot ${friend.online ? 'online' : ''}"></span>
            </div>
            <div class="inbox-preview">${escapeHtml(lastPreview)}</div>
          </div>
        </div>
        <div class="inbox-meta">
          <span class="inbox-time">${friend.lastMessage ? formatTime(friend.lastMessage.timestamp) : ''}</span>
          ${friend.unreadCount > 0 ? `<span class="pill-badge">${friend.unreadCount}</span>` : ''}
        </div>
      `;
      item.addEventListener('click', () => openConversation(friend.username));
      inboxEl.appendChild(item);
    });
  }

  const unreadBadge = document.getElementById('unreadTotalBadge');
  unreadBadge.textContent = totalUnread;
  unreadBadge.classList.toggle('hidden', totalUnread === 0);

  // 2. Incoming & Outgoing Friend Requests
  const reqBadge = document.getElementById('requestsCountBadge');
  const incCount = dashboardState.incomingRequests.length;
  reqBadge.textContent = incCount;
  reqBadge.classList.toggle('hidden', incCount === 0);

  const incEl = document.getElementById('incomingRequestsList');
  incEl.innerHTML = '';
  if (incCount === 0) {
    incEl.innerHTML = `<div class="empty-state-small">No pending incoming friend requests.</div>`;
  } else {
    dashboardState.incomingRequests.forEach(req => {
      const row = document.createElement('div');
      row.className = 'user-card-item';
      row.innerHTML = `
        <div class="inbox-left">
          <div class="avatar-circle sm">${getAvatarSvg(req.avatarId)}</div>
          <div class="inbox-text">
            <div class="inbox-name-row">${escapeHtml(req.displayName)}</div>
            <div class="inbox-preview">@${escapeHtml(req.username)}</div>
          </div>
        </div>
        <div class="action-btn-group">
          <button class="mini-btn accept" data-user="${req.username}" data-act="accept">Accept</button>
          <button class="mini-btn decline" data-user="${req.username}" data-act="decline">Decline</button>
        </div>
      `;
      row.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          socket.emit('friends:respond', {
            requesterUsername: btn.dataset.user,
            action: btn.dataset.act
          });
        });
      });
      incEl.appendChild(row);
    });
  }

  const outEl = document.getElementById('outgoingRequestsList');
  outEl.innerHTML = '';
  if (dashboardState.outgoingRequests.length === 0) {
    outEl.innerHTML = `<div class="empty-state-small">No outgoing requests waiting.</div>`;
  } else {
    dashboardState.outgoingRequests.forEach(req => {
      const row = document.createElement('div');
      row.className = 'user-card-item';
      row.innerHTML = `
        <div class="inbox-left">
          <div class="avatar-circle sm">${getAvatarSvg(req.avatarId)}</div>
          <div class="inbox-text">
            <div class="inbox-name-row">${escapeHtml(req.displayName)}</div>
            <div class="inbox-preview">@${escapeHtml(req.username)}</div>
          </div>
        </div>
        <span class="mini-btn neutral">Pending...</span>
      `;
      outEl.appendChild(row);
    });
  }

  // Refresh active partner topbar if currently chatting
  if (activePartner) {
    const partnerObj = dashboardState.friends.find(f => f.username === activePartner);
    if (partnerObj) {
      updatePartnerHeader(partnerObj);
    }
  }
}

// --- CONVERSATION & MESSAGING ---
function openConversation(partnerUsername) {
  activePartner = partnerUsername;
  const partnerObj = dashboardState.friends.find(f => f.username === partnerUsername);
  if (!partnerObj) {
    showToast('You can only chat with accepted friends.', 'error');
    return;
  }

  document.getElementById('noChatSelected').classList.add('hidden');
  document.getElementById('activeChatView').classList.remove('hidden');
  document.getElementById('messengerApp').classList.add('chat-open');

  updatePartnerHeader(partnerObj);
  renderDashboard();
  socket.emit('chat:open', { partnerUsername });
}

function updatePartnerHeader(partnerObj) {
  document.getElementById('partnerAvatarBox').innerHTML = getAvatarSvg(partnerObj.avatarId);
  document.getElementById('partnerDisplayName').textContent = partnerObj.displayName;
  document.getElementById('partnerHandleBadge').textContent = `@${partnerObj.username}`;
  const dot = document.getElementById('partnerStatusDot');
  const txt = document.getElementById('partnerStatusText');
  dot.className = `status-dot ${partnerObj.online ? 'online' : ''}`;
  txt.textContent = partnerObj.online ? 'Active Now' : 'Offline';
}

document.getElementById('mobileBackBtn').addEventListener('click', () => {
  activePartner = null;
  document.getElementById('messengerApp').classList.remove('chat-open');
  renderDashboard();
});

function renderMessagesList(messages) {
  const listEl = document.getElementById('messagesList');
  listEl.innerHTML = '';
  messages.forEach(msg => appendSingleMessage(msg, false));
  scrollToBottom();
}

function appendSingleMessage(msg, animate = true) {
  const listEl = document.getElementById('messagesList');
  const isMine = msg.from === currentUser.username;
  const row = document.createElement('div');
  row.className = `msg-row ${isMine ? 'mine' : 'theirs'}`;
  row.innerHTML = `
    <div class="msg-bubble">${escapeHtml(msg.text)}</div>
    <div class="msg-meta">
      <span>${formatTime(msg.timestamp)}</span>
      ${isMine ? `<span class="read-flag">${msg.read ? '✓✓ Seen' : '✓ Sent'}</span>` : ''}
    </div>
  `;
  listEl.appendChild(row);
  if (animate) scrollToBottom();
}

function scrollToBottom() {
  const vp = document.getElementById('messagesViewport');
  vp.scrollTop = vp.scrollHeight;
}

const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

messageForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!activePartner) return;
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('chat:send', { to: activePartner, text });
  socket.emit('chat:typing', { to: activePartner, isTyping: false });
  messageInput.value = '';
});

messageInput.addEventListener('input', () => {
  if (!activePartner) return;
  socket.emit('chat:typing', { to: activePartner, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (activePartner) socket.emit('chat:typing', { to: activePartner, isTyping: false });
  }, 1400);
});

document.querySelectorAll('.vibe-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (!activePartner) return;
    socket.emit('chat:send', { to: activePartner, text: chip.dataset.text });
  });
});

// --- REAL-TIME MINI-GAMES RENDERING ---
document.querySelectorAll('.game-launch-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!activePartner) return;
    socket.emit('game:start', {
      partnerUsername: activePartner,
      gameType: btn.dataset.game
    });
  });
});

document.getElementById('gameRematchBtn').addEventListener('click', () => {
  if (!activePartner || !currentGame) return;
  socket.emit('game:action', {
    partnerUsername: activePartner,
    action: { type: 'rematch' }
  });
});

document.getElementById('gameCloseBtn').addEventListener('click', () => {
  if (!activePartner) return;
  socket.emit('game:action', {
    partnerUsername: activePartner,
    action: { type: 'close' }
  });
});

function renderGameArena(game) {
  const drawer = document.getElementById('gameArenaDrawer');
  if (!game) {
    drawer.classList.add('hidden');
    return;
  }
  drawer.classList.remove('hidden');

  const meta = {
    rps: { icon: '✊', title: 'Rock Paper Scissors' },
    ttt: { icon: '❌', title: 'Tic-Tac-Toe Duel' },
    c4: { icon: '🔴', title: 'Connect Four' },
    math: { icon: '🧮', title: 'Quick Math Duel' }
  }[game.gameType] || { icon: '🎮', title: 'Mini-Game' };

  document.getElementById('gameArenaIcon').textContent = meta.icon;
  document.getElementById('gameArenaTitle').textContent = meta.title;
  document.getElementById('gameStatusBanner').textContent = game.message || '';

  const [p1, p2] = game.players;
  document.getElementById('gameScoreBoard').innerHTML = `
    <span>@${p1}: ${game.scores[p1] || 0}</span>
    <span>•</span>
    <span>@${p2}: ${game.scores[p2] || 0}</span>
  `;

  const stage = document.getElementById('gameStageBody');
  stage.innerHTML = '';

  // 1. Rock Paper Scissors UI
  if (game.gameType === 'rps') {
    const myMove = game.choices ? game.choices[currentUser.username] : null;
    const row = document.createElement('div');
    row.className = 'rps-picks-row';
    [
      { id: 'rock', emoji: '🪨', label: 'Rock' },
      { id: 'paper', emoji: '📄', label: 'Paper' },
      { id: 'scissors', emoji: '✂️', label: 'Scissors' }
    ].forEach(opt => {
      const btn = document.createElement('button');
      btn.className = `rps-btn ${myMove === opt.id ? 'selected' : ''}`;
      btn.innerHTML = `<span class="emoji">${opt.emoji}</span><span>${opt.label}</span>`;
      btn.disabled = Boolean(myMove);
      btn.addEventListener('click', () => {
        socket.emit('game:action', {
          partnerUsername: activePartner,
          action: { type: 'pick', move: opt.id }
        });
      });
      row.appendChild(btn);
    });
    stage.appendChild(row);
    return;
  }

  // 2. Tic-Tac-Toe UI
  if (game.gameType === 'ttt') {
    const grid = document.createElement('div');
    grid.className = 'ttt-grid';
    game.board.forEach((cellVal, idx) => {
      const btn = document.createElement('button');
      const isWin = game.winningLine && game.winningLine.includes(idx);
      btn.className = `ttt-cell ${isWin ? 'win-cell' : ''}`;
      btn.textContent = cellVal || '';
      btn.disabled = game.status !== 'active' || game.turn !== currentUser.username || cellVal !== null;
      btn.addEventListener('click', () => {
        socket.emit('game:action', {
          partnerUsername: activePartner,
          action: { type: 'cell', index: idx }
        });
      });
      grid.appendChild(btn);
    });
    stage.appendChild(grid);
    return;
  }

  // 3. Connect Four UI
  if (game.gameType === 'c4') {
    const boardEl = document.createElement('div');
    boardEl.className = 'c4-board';
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const owner = game.board[r][c];
        const colorClass = owner ? game.colors[owner] : '';
        const isWinDisc = (game.winningCells || []).some(([wr, wc]) => wr === r && wc === c);
        const cell = document.createElement('button');
        cell.className = `c4-cell ${colorClass} ${isWinDisc ? 'win-disc' : ''}`;
        cell.disabled = game.status !== 'active' || game.turn !== currentUser.username;
        cell.addEventListener('click', () => {
          socket.emit('game:action', {
            partnerUsername: activePartner,
            action: { type: 'drop', col: c }
          });
        });
        boardEl.appendChild(cell);
      }
    }
    stage.appendChild(boardEl);
    return;
  }

  // 4. Quick Math Duel UI
  if (game.gameType === 'math' && game.question) {
    const wrap = document.createElement('div');
    wrap.className = 'math-duel-box';
    wrap.innerHTML = `<div class="math-expression">${game.question.expression} = ?</div>`;
    const optsGrid = document.createElement('div');
    optsGrid.className = 'math-options-grid';

    (game.question.options || []).forEach(val => {
      const btn = document.createElement('button');
      btn.className = 'math-opt-btn';
      btn.textContent = val;
      btn.disabled = game.status !== 'active' || game.answeredThisRound;
      btn.addEventListener('click', () => {
        socket.emit('game:action', {
          partnerUsername: activePartner,
          action: { type: 'answer', value: val }
        });
      });
      optsGrid.appendChild(btn);
    });
    wrap.appendChild(optsGrid);
    stage.appendChild(wrap);
  }
}

// --- SOCKET LISTENERS ---
socket.on('toast', ({ type, message }) => {
  showToast(message, type);
});

socket.on('dashboard:update', data => {
  if (data.me) {
    currentUser = data.me;
    localStorage.setItem('duochat_user', JSON.stringify(currentUser));
    updateMyHeaderUI();
  }
  dashboardState.friends = data.friends || [];
  dashboardState.incomingRequests = data.incomingRequests || [];
  dashboardState.outgoingRequests = data.outgoingRequests || [];
  renderDashboard();
});

socket.on('users:searchResults', ({ results }) => {
  const container = document.getElementById('searchResultsList');
  container.innerHTML = '';
  if (!results || results.length === 0) {
    container.innerHTML = `<div class="empty-state-small">No matching users found.</div>`;
    return;
  }

  results.forEach(u => {
    const row = document.createElement('div');
    row.className = 'user-card-item';

    let actionHTML = '';
    if (u.relation === 'friends') {
      actionHTML = `<button class="mini-btn accept" data-chat="${u.username}">Message</button>`;
    } else if (u.relation === 'outgoing') {
      actionHTML = `<span class="mini-btn neutral">Request Sent</span>`;
    } else if (u.relation === 'incoming') {
      actionHTML = `<button class="mini-btn accept" data-accept="${u.username}">Accept Request</button>`;
    } else {
      actionHTML = `<button class="mini-btn accept" data-add="${u.username}">+ Add Friend</button>`;
    }

    row.innerHTML = `
      <div class="inbox-left">
        <div class="avatar-circle sm">${getAvatarSvg(u.avatarId)}</div>
        <div class="inbox-text">
          <div class="inbox-name-row">
            <span>${escapeHtml(u.displayName)}</span>
            <span class="status-dot ${u.online ? 'online' : ''}"></span>
          </div>
          <div class="inbox-preview">@${escapeHtml(u.username)}</div>
        </div>
      </div>
      <div>${actionHTML}</div>
    `;

    const addBtn = row.querySelector('[data-add]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        socket.emit('friends:request', { toUsername: addBtn.dataset.add });
        addBtn.textContent = 'Sent ✓';
        addBtn.disabled = true;
      });
    }

    const accBtn = row.querySelector('[data-accept]');
    if (accBtn) {
      accBtn.addEventListener('click', () => {
        socket.emit('friends:respond', {
          requesterUsername: accBtn.dataset.accept,
          action: 'accept'
        });
      });
    }

    const chatBtn = row.querySelector('[data-chat]');
    if (chatBtn) {
      chatBtn.addEventListener('click', () => {
        switchSidebarTab('chats');
        openConversation(chatBtn.dataset.chat);
      });
    }

    container.appendChild(row);
  });
});

socket.on('chat:history', ({ partner, messages }) => {
  if (partner === activePartner) {
    renderMessagesList(messages || []);
  }
});

socket.on('chat:message', msg => {
  const isCurrentChat =
    activePartner && (msg.from === activePartner || msg.to === activePartner);

  if (isCurrentChat) {
    appendSingleMessage(msg, true);
    if (msg.from === activePartner) {
      playTone('msg');
      socket.emit('chat:markRead', { partnerUsername: activePartner });
    }
  } else if (msg.to === currentUser?.username) {
    playTone('msg');
  }
});

socket.on('chat:typing', ({ from, isTyping }) => {
  if (from !== activePartner) return;
  const ind = document.getElementById('typingIndicator');
  document.getElementById('typingUserText').textContent = `@${from} is typing`;
  ind.classList.toggle('hidden', !isTyping);
});

socket.on('chat:readReceipt', ({ reader }) => {
  if (reader === activePartner) {
    document.querySelectorAll('.msg-row.mine .read-flag').forEach(el => {
      el.textContent = '✓✓ Seen';
    });
  }
});

socket.on('game:state', ({ partner, game }) => {
  if (partner !== activePartner) return;
  currentGame = game;
  if (game && game.winner === currentUser.username) {
    playTone('win');
  }
  renderGameArena(game);
});

// --- PROFILE MODAL, THEME & SOUND CONTROLS ---
document.getElementById('openProfileModalBtn').addEventListener('click', () => {
  if (!currentUser) return;
  document.getElementById('editDisplayName').value = currentUser.displayName;
  document.getElementById('editBio').value = currentUser.bio || '';
  selectedEditAvatarId = currentUser.avatarId;
  renderAvatarPicker('editAvatarGrid', null, selectedEditAvatarId, id => {
    selectedEditAvatarId = id;
  });
  document.getElementById('profileModal').classList.remove('hidden');
});

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden');
}

document.getElementById('closeProfileModalBtn').addEventListener('click', closeProfileModal);
document.getElementById('cancelProfileBtn').addEventListener('click', closeProfileModal);

document.getElementById('profileUpdateForm').addEventListener('submit', e => {
  e.preventDefault();
  socket.emit('profile:update', {
    displayName: document.getElementById('editDisplayName').value.trim(),
    bio: document.getElementById('editBio').value.trim(),
    avatarId: selectedEditAvatarId
  });
  closeProfileModal();
});

document.getElementById('themeToggleBtn').addEventListener('click', () => {
  document.body.classList.toggle('theme-day');
});

document.getElementById('soundToggleBtn').addEventListener('click', e => {
  soundEnabled = !soundEnabled;
  e.currentTarget.textContent = soundEnabled ? '🔊' : '🔇';
  showToast(soundEnabled ? 'Sound effects enabled' : 'Sound effects muted', 'info');
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('duochat_user');
  window.location.reload();
});

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

initApp();