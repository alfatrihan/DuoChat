// script.js - DuoChat v5 (Multi-Inbox Messenger, Friend Requests, Minimalist Faceless Vector Avatars, Real-time Mini-Games)
const $ = (id) => document.getElementById(id);
const socket = io();

const rnd = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
let cid = '';
let accountToken = sessionStorage.getItem('accountToken') || '';
let currentAccount = null;

let inboxData = { friends: [], incoming: [], outgoing: [] };
let activePeer = null;   // { id, username, name, gender, avatar, online, mood }
let activeRoomKey = '';
let replyTo = null;
let vanishMode = false;
let spoilerMode = false;
let myMood = '';
let currentWeather = 'clear';
let activeGame = null;
let gameState = null;

const items = {}; // id -> { m, el, tick, seenSent, vanishTimer }

/* ---------- Minimalist Faceless Portraits ---------- */
const AVATAR_NAMES = {
  male: ['Classic Tee', 'Smart Blazer', 'Denim Jacket', 'Soft Hoodie', 'Side Part', 'Curly Casual', 'Swept Hair', 'Crewneck'],
  female: ['Long Waves', 'Chic Bob', 'High Ponytail', 'Soft Bun', 'Curly Hair', 'Side Braid', 'Short Pixie', 'Half Up']
};
function avatarArt(gender, variant = 0) {
  if (!gender) return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="#e2e8f0"/><circle cx="50" cy="39" r="15" fill="#94a3b8"/><path d="M22 100V80a28 28 0 0 1 56 0v20" fill="#94a3b8"/></svg>`;
  const n = Math.max(0, Math.min(7, Number(variant) || 0));
  const female = gender === 'female';
  const bg = ['#e9dff5','#dae7f3','#dcece4','#f0dfe5','#e1e1f2','#f1e5d6','#e3dceb','#dce7eb'][n];
  const skin = ['#e7ba99','#dba57e','#edc9ad','#cc9672','#e3b390','#bc8565','#efc7a5','#d6a07d'][n];
  const hair = ['#30231f','#241e20','#654733','#342a30','#3c2923','#54372a','#28242d','#7c5140'][n];
  const cloth = ['#66518b','#33455f','#547a7b','#9b6375','#7e7967','#9b7057','#44405f','#607a92'][n];
  const backHair = [
    'M29 42C27 8 73 8 72 42L78 86H23Z',
    'M29 43C26 10 74 10 73 43L72 65Q50 77 28 65Z',
    'M62 23C84 17 85 43 73 66L66 77 67 39Z',
    'M38 23C24 7 52 0 57 17 74 5 81 27 65 31Z',
    'M30 29C18 22 17 42 24 48 12 55 24 69 30 65 20 83 39 86 43 75L65 79C83 84 87 65 77 59 91 53 79 40 79 35 81 19 66 15 60 18 50 8 34 14 30 29Z',
    'M28 42C27 13 69 10 73 38L72 64 63 70 33 64Z',
    'M31 39C24 18 52 7 68 23L73 45 64 55 33 50Z',
    'M28 43C26 13 72 9 73 42L77 84 25 84Z'
  ];
  let svg = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="${bg}"/>`;
  if (female) svg += `<path d="${backHair[n]}" fill="${hair}"/>`;
  svg += `<path d="M15 100C17 78 30 70 50 70S83 78 85 100Z" fill="${cloth}"/><path d="M43 56H57V73Q50 82 43 73Z" fill="${skin}"/>`;
  if (n === 1 || n === 6) svg += `<path d="M38 72L50 95 62 72" fill="#f6f1ed"/><path d="M35 72L44 88 37 93 29 77M65 72L56 88 63 93 71 77" fill="${cloth}" stroke="${bg}" stroke-width="1"/>`;
  else if (n === 3) svg += `<path d="M35 73Q28 88 50 88Q72 88 65 73M41 86V96M59 86V96" fill="none" stroke="${bg}" stroke-width="2"/>`;
  else if (n === 2) svg += `<path d="M31 76L40 87 47 77M69 76L60 87 53 77M50 82V100" fill="none" stroke="${bg}" stroke-width="1.6"/>`;
  else svg += `<path d="M38 73Q50 84 62 73" fill="none" stroke="${bg}" stroke-width="2"/>`;
  svg += `<ellipse cx="35" cy="43" rx="3" ry="5" fill="${skin}"/><ellipse cx="65" cy="43" rx="3" ry="5" fill="${skin}"/><rect x="35" y="24" width="30" height="39" rx="15" fill="${skin}"/>`;
  const frontFemale = [
    'M32 38C28 13 65 9 70 32L67 54 62 42 59 25Q48 37 32 38Z',
    'M31 40C25 12 69 9 70 40L62 33 57 26Q48 35 31 40Z',
    'M32 37C29 12 70 13 68 38L61 29Q48 35 32 37Z',
    'M32 37C30 13 68 13 68 37Q55 35 48 26 41 35 32 37Z',
    'M30 36Q24 22 37 21 44 11 53 20 66 13 71 30L65 39 58 28 48 33 39 28Z',
    'M31 38C28 11 69 13 70 37L61 28Q50 39 31 38Z',
    'M30 40C24 14 62 7 70 29L61 40 60 26Q45 39 30 40Z',
    'M31 38C28 13 69 12 70 37L60 28Q50 35 31 38Z'
  ];
  const frontMale = [
    'M33 38L33 27Q34 13 51 16 70 13 67 35L60 28 42 30 36 39Z',
    'M33 37Q27 15 53 15 71 16 67 37L60 26 43 31 36 37Z',
    'M33 37L31 27 38 19 47 22 53 16 64 21 69 30 65 39 59 29 41 31Z',
    'M33 37Q29 16 50 17 72 17 67 38L60 29 38 29Z',
    'M33 38Q28 17 48 16 68 10 68 34L62 30 55 24 37 35Z',
    'M33 39Q24 32 31 25 28 15 40 17 47 9 54 17 65 10 67 22 77 28 66 39L60 30 40 31Z',
    'M33 38Q24 15 46 15 53 7 67 17 77 29 65 36L59 24Q48 35 33 38Z',
    'M34 35L34 24Q50 13 65 24L66 36 60 29 40 29Z'
  ];
  svg += `<path d="${female ? frontFemale[n] : frontMale[n]}" fill="${hair}"/>`;
  if (female && n === 5) svg += `<path d="M66 47Q77 55 68 62 78 68 67 75 75 81 66 87" fill="none" stroke="${hair}" stroke-width="8" stroke-linecap="round"/><path d="M63 87H69" stroke="${cloth}" stroke-width="3"/>`;
  if (female && n === 7) svg += `<path d="M63 21Q72 17 76 25L73 33 66 31Z" fill="${hair}"/><path d="M67 28L73 30" stroke="${cloth}" stroke-width="2"/>`;
  return svg + '</svg>';
}

/* ---------- Utility Helpers ---------- */
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

/* ---------- Theme System ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) {}
}
let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
setTheme(savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'light'));

$('themeBtn').onclick = () => {
  const current = document.documentElement.dataset.theme;
  setTheme(['light', 'sakura'].includes(current) ? 'midnight' : 'light');
  showToast('Theme switched');
};

function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

$('themePresetsBtn').onclick = () => { closeAllMenus(); openModal('themesModal'); };
if ($('devInfoBtn')) $('devInfoBtn').onclick = () => openModal('devModal');
$('sidebarThemeBtn').onclick = () => { closeAllMenus(); openModal('themesModal'); };

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
    closeAllMenus();
  }
});
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => closeModal(b.dataset.close)));
document.querySelectorAll('.modal').forEach((m) =>
  m.addEventListener('click', (e) => {
    if (e.target === m) m.classList.add('hidden');
  })
);
document.querySelectorAll('[data-theme-choice]').forEach((b) => {
  b.onclick = () => {
    setTheme(b.dataset.themeChoice);
    closeModal('themesModal');
    showToast(`${b.querySelector('b').textContent} theme applied ✦`);
  };
});

/* ---------- Synced Weather Atmosphere Engine ---------- */
const WEATHER_META = {
  clear:  { icon: '☀️', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>', label: 'Clear Sky' },
  rain:   { icon: '🌧️', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>', label: 'Cozy Rain' },
  storm:  { icon: '⛈️', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>', label: 'Thunder Storm' },
  snow:   { icon: '❄️', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>', label: 'Soft Snow' },
  stars:  { icon: '🌌', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>', label: 'Starry Night' },
  petals: { icon: '🌸', svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/></svg>', label: 'Cherry Blossom' }
};

const canvas = $('weatherCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animFrame = null;
let lightningTimer = null;

function resizeCanvas() {
  const pane = $('activeChatView');
  canvas.width = pane.clientWidth || window.innerWidth;
  canvas.height = pane.clientHeight || window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

function initParticles(type) {
  resizeCanvas();
  particles = [];
  const count = type === 'rain' ? 95 : type === 'storm' ? 140 : type === 'snow' ? 75 : type === 'stars' ? 65 : type === 'petals' ? 35 : 0;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: type === 'snow' ? Math.random() * 2.8 + 1.2 : type === 'stars' ? Math.random() * 1.8 + 0.5 : type === 'petals' ? Math.random() * 4 + 3 : Math.random() * 1.2 + 0.8,
      len: type === 'rain' ? Math.random() * 14 + 10 : type === 'storm' ? Math.random() * 20 + 14 : 0,
      vy: type === 'rain' ? Math.random() * 6 + 9 : type === 'storm' ? Math.random() * 9 + 13 : type === 'snow' ? Math.random() * 1.4 + 0.6 : type === 'petals' ? Math.random() * 1.5 + 0.8 : 0,
      vx: type === 'storm' ? -2.8 : type === 'rain' ? -1.1 : type === 'snow' ? Math.random() * 0.8 - 0.4 : type === 'petals' ? Math.random() * 1.4 - 0.5 : 0,
      alpha: Math.random() * 0.6 + 0.25,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function drawWeather() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (currentWeather === 'clear') return;

  for (const p of particles) {
    if (currentWeather === 'rain' || currentWeather === 'storm') {
      ctx.strokeStyle = `rgba(174, 214, 241, ${p.alpha})`;
      ctx.lineWidth = currentWeather === 'storm' ? 1.4 : 1.1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 1.5, p.y + p.len);
      ctx.stroke();
      p.x += p.vx;
      p.y += p.vy;
    } else if (currentWeather === 'snow') {
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha + 0.2})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.phase += 0.02;
      p.x += p.vx + Math.sin(p.phase) * 0.4;
      p.y += p.vy;
    } else if (currentWeather === 'stars') {
      p.phase += 0.03;
      const twinkle = 0.3 + Math.abs(Math.sin(p.phase)) * 0.7;
      ctx.fillStyle = `rgba(243, 232, 255, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (currentWeather === 'petals') {
      ctx.fillStyle = `rgba(251, 113, 133, ${p.alpha + 0.15})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, p.phase, 0, Math.PI * 2);
      ctx.fill();
      p.phase += 0.03;
      p.x += p.vx + Math.sin(p.phase) * 0.7;
      p.y += p.vy;
    }

    if (p.y > canvas.height + 20) {
      p.y = -15;
      p.x = Math.random() * canvas.width;
    }
    if (p.x < -20) p.x = canvas.width + 10;
    if (p.x > canvas.width + 20) p.x = -10;
  }

  animFrame = requestAnimationFrame(drawWeather);
}

function applyWeather(weather, announceBy) {
  if (!WEATHER_META[weather]) weather = 'clear';
  currentWeather = weather;
  $('weatherIcon').innerHTML = WEATHER_META[weather].svg;

  $('weatherMenu').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active-opt', b.dataset.weather === weather);
  });

  if (animFrame) cancelAnimationFrame(animFrame);
  clearInterval(lightningTimer);

  if (weather === 'clear') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else {
    initParticles(weather);
    drawWeather();
  }

  if (weather === 'storm') {
    lightningTimer = setInterval(() => {
      if (Math.random() > 0.45) {
        const c = $('activeChatView');
        c.classList.remove('lightning-flash');
        void c.offsetWidth;
        c.classList.add('lightning-flash');
      }
    }, 4500);
  }

  if (announceBy) {
    showToast(`${WEATHER_META[weather].icon} ${announceBy} changed weather to ${WEATHER_META[weather].label}`);
  }
}

/* ---------- Dropdown Menus ---------- */
function closeAllMenus() {
  $('weatherMenu').classList.add('hidden');
  $('moodMenu').classList.add('hidden');
  $('moreMenu').classList.add('hidden');
}
document.addEventListener('click', (e) => {
  closeAllMenus();
  if (!e.target.closest('.message-actions') && !e.target.closest('.message-menu-btn')) {
    document.querySelectorAll('.message-actions').forEach((x) => x.classList.add('hidden'));
  }
});

$('weatherBtn').onclick = (e) => {
  e.stopPropagation();
  const isHidden = $('weatherMenu').classList.contains('hidden');
  closeAllMenus();
  if (isHidden) $('weatherMenu').classList.remove('hidden');
};
$('weatherMenu').querySelectorAll('button').forEach((btn) => {
  btn.onclick = () => {
    if (!activePeer) return;
    const w = btn.dataset.weather;
    applyWeather(w, 'You');
    socket.emit('weather', { peerId: activePeer.id, weather: w });
  };
});

$('moodBtn').onclick = (e) => {
  e.stopPropagation();
  const isHidden = $('moodMenu').classList.contains('hidden');
  closeAllMenus();
  if (isHidden) $('moodMenu').classList.remove('hidden');
};
const AURA_KEYS = ['chill', 'focus', 'cozy', 'vibe', 'peace', 'fire', 'love'];
function inferAuraFromMood(moodStr) {
  if (!moodStr) return '';
  if (moodStr.includes('Chilling')) return 'chill';
  if (moodStr.includes('Studying')) return 'focus';
  if (moodStr.includes('Coffee')) return 'cozy';
  if (moodStr.includes('Vibing')) return 'vibe';
  if (moodStr.includes('Dua')) return 'peace';
  if (moodStr.includes('Busy')) return 'fire';
  if (moodStr.includes('Affectionate')) return 'love';
  return 'chill';
}
function applyAuraClass(elTarget, aura) {
  if (!elTarget) return;
  AURA_KEYS.forEach((k) => elTarget.classList.remove('aura-' + k));
  if (aura && AURA_KEYS.includes(aura)) elTarget.classList.add('aura-' + aura);
}
function applyMyAura(moodStr) {
  const aura = inferAuraFromMood(moodStr);
  applyAuraClass($('sidebarMyAuraWrap'), aura);
  applyAuraClass($('myPortrait'), aura);
}

$('moodMenu').querySelectorAll('button').forEach((btn) => {
  btn.onclick = () => {
    myMood = btn.dataset.mood;
    $('moodBtn').classList.toggle('active-symbol', !!myMood);
    applyMyAura(myMood);
    socket.emit('mood', myMood);
    showToast(myMood ? `Aura & Mood set to ${myMood}` : 'Aura cleared');
  };
});
if ($('roomMoodBtn')) {
  $('roomMoodBtn').onclick = (e) => {
    e.stopPropagation();
    closeAllMenus();
    $('moodMenu').classList.remove('hidden');
  };
}

$('moreBtn').onclick = (e) => {
  e.stopPropagation();
  const isHidden = $('moreMenu').classList.contains('hidden');
  closeAllMenus();
  if (isHidden) $('moreMenu').classList.remove('hidden');
};

/* ---------- Multi-Inbox Sidebar, Search & Friend Requests ---------- */
function renderSidebar() {
  // Pending Friend Requests
  const incoming = inboxData.incoming || [];
  $('requestsSection').classList.toggle('hidden', incoming.length === 0);
  $('requestCountBadge').textContent = String(incoming.length);
  $('requestsList').replaceChildren();

  incoming.forEach((u) => {
    const row = el('div', 'user-row');
    const av = el('div', 'avatar sm');
    av.innerHTML = avatarArt(u.gender, u.avatar);

    const info = el('div', 'user-row-info');
    const top = el('div', 'user-row-top');
    top.append(el('b', '', u.name));
    const sub = el('div', 'user-row-sub');
    sub.append(el('span', '', `@${u.username}`));
    info.append(top, sub);

    const acts = el('div', 'row-actions');
    const acceptBtn = el('button', 'mini-pill-btn solid icon-only-pill'); acceptBtn.title = 'Accept'; acceptBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    acceptBtn.onclick = () => {
      socket.emit('friend-accept', u.id, (res) => {
        if (res.error) return showToast(res.error);
        inboxData = res.inbox;
        renderSidebar();
        showToast(`You and ${u.name} are now friends!`);
      });
    };
    const declineBtn = el('button', 'mini-pill-btn decline icon-only-pill'); declineBtn.title = 'Decline'; declineBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    declineBtn.onclick = () => {
      socket.emit('friend-decline', u.id, (res) => {
        if (res.error) return showToast(res.error);
        inboxData = res.inbox;
        renderSidebar();
        showToast('Request declined');
      });
    };
    acts.append(acceptBtn, declineBtn);
    row.append(av, info, acts);
    $('requestsList').append(row);
  });

  // Accepted Friends Inbox
  const friends = inboxData.friends || [];
  $('friendCountLabel').textContent = String(friends.length);
  $('inboxList').replaceChildren();

  if (!friends.length) {
    $('inboxList').append(
      el('div', 'empty-list-hint', 'No conversations yet. Search a username above to send a friend request!')
    );
    return;
  }

  friends.forEach((f) => {
    const row = el('button', 'user-row' + (activePeer && activePeer.id === f.id ? ' active' : ''));
    row.type = 'button';

    const avWrap = el('div', 'avatar-wrap');
    const av = el('div', 'avatar sm');
    av.innerHTML = avatarArt(f.gender, f.avatar);
    const dot = el('span', 'online-dot' + (f.online ? ' on' : ''));
    avWrap.append(av, dot);

    const info = el('div', 'user-row-info');
    const top = el('div', 'user-row-top');
    top.append(el('b', '', f.name));
    if (f.lastMessage) {
      top.append(el('span', 'user-row-time', fmtTime(f.lastMessage.time)));
    }

    const sub = el('div', 'user-row-sub');
    const previewText = f.lastMessage
      ? `${f.lastMessage.fromMe ? 'You: ' : ''}${f.lastMessage.text}`
      : `@${f.username} · Tap to chat`;
    sub.append(el('span', '', previewText));
    if (f.unread > 0) {
      sub.append(el('span', 'unread-pill', String(f.unread)));
    }

    info.append(top, sub);
    row.append(avWrap, info);
    row.onclick = () => openConversation(f.id);
    $('inboxList').append(row);
  });
}

let searchDebounce = null;
$('userSearchInput').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  $('clearSearchBtn').classList.toggle('hidden', !q);
  clearTimeout(searchDebounce);
  if (!q) {
    $('searchResultsBox').classList.add('hidden');
    return;
  }
  searchDebounce = setTimeout(() => {
    socket.emit('users-search', q, (res) => {
      if (res.error) return;
      renderSearchResults(res.results || []);
    });
  }, 200);
});

$('clearSearchBtn').onclick = () => {
  $('userSearchInput').value = '';
  $('clearSearchBtn').classList.add('hidden');
  $('searchResultsBox').classList.add('hidden');
};

function renderSearchResults(results) {
  $('searchResultsBox').classList.remove('hidden');
  $('searchResultsList').replaceChildren();

  if (!results.length) {
    $('searchResultsList').append(el('div', 'empty-list-hint', 'No matching users found.'));
    return;
  }

  results.forEach((u) => {
    const row = el('div', 'user-row');
    const av = el('div', 'avatar sm');
    av.innerHTML = avatarArt(u.gender, u.avatar);

    const info = el('div', 'user-row-info');
    const top = el('div', 'user-row-top');
    top.append(el('b', '', u.name));
    const sub = el('div', 'user-row-sub');
    sub.append(el('span', '', `@${u.username}`));
    info.append(top, sub);

    const acts = el('div', 'row-actions');
    if (u.relation === 'friend') {
      const chatBtn = el('button', 'mini-pill-btn icon-only-pill'); chatBtn.title = 'Open Chat'; chatBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
      chatBtn.onclick = () => {
        $('clearSearchBtn').click();
        openConversation(u.id);
      };
      acts.append(chatBtn);
    } else if (u.relation === 'incoming') {
      const accBtn = el('button', 'mini-pill-btn solid icon-only-pill'); accBtn.title = 'Accept'; accBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      accBtn.onclick = () => {
        socket.emit('friend-accept', u.id, (res) => {
          if (res.error) return showToast(res.error);
          inboxData = res.inbox;
          renderSidebar();
          $('userSearchInput').dispatchEvent(new Event('input'));
          showToast(`Accepted ${u.name}'s request!`);
        });
      };
      acts.append(accBtn);
    } else if (u.relation === 'outgoing') {
      const pendBtn = el('button', 'mini-pill-btn icon-only-pill'); pendBtn.title = 'Cancel Request'; pendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
      pendBtn.onclick = () => {
        socket.emit('friend-cancel', u.id, (res) => {
          if (res.error) return showToast(res.error);
          inboxData = res.inbox;
          renderSidebar();
          $('userSearchInput').dispatchEvent(new Event('input'));
          showToast('Request cancelled');
        });
      };
      acts.append(pendBtn);
    } else {
      const addBtn = el('button', 'mini-pill-btn solid icon-only-pill'); addBtn.title = 'Add Friend'; addBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
      addBtn.onclick = () => {
        socket.emit('friend-request', u.username, (res) => {
          if (res.error) return showToast(res.error);
          inboxData = res.inbox;
          renderSidebar();
          $('userSearchInput').dispatchEvent(new Event('input'));
          showToast(res.status === 'accepted' ? `You and ${u.name} are now friends!` : `Friend request sent to ${u.name}`);
        });
      };
      acts.append(addBtn);
    }

    row.append(av, info, acts);
    $('searchResultsList').append(row);
  });
}

/* ---------- Open Conversation & Mobile Slide Toggle ---------- */
function openConversation(peerId) {
  socket.emit('open-chat', peerId, (res) => {
    if (res.error) return showToast(res.error);

    activePeer = res.peer;
    activeRoomKey = res.roomKey;
    peerTyping = false;
    setReply(null);

    // Clear unread badge locally
    const fEntry = inboxData.friends.find((f) => f.id === peerId);
    if (fEntry) fEntry.unread = 0;
    renderSidebar();

    // Switch mobile view to full-screen chat
    $('messengerShell').classList.add('mobile-chat-open');
    $('emptyChatState').classList.add('hidden');
    $('activeChatView').classList.remove('hidden');

    Object.values(items).forEach((it) => clearTimeout(it.vanishTimer));
    $('msgs').innerHTML = '';
    Object.keys(items).forEach((k) => delete items[k]);

    res.history.forEach(render);
    applyWeather(res.weather || 'clear', null);
    updatePeerMood(activePeer.mood || '');
    updateChatHeader();
    if (activePeer.online) triggerPresenceConfetti(activePeer.name);
    markSeen();

    if (res.game) {
      gameState = res.game;
      activeGame = res.game.type;
      renderGame(res.game);
    } else {
      gameState = null;
      activeGame = null;
      $('gameStage').classList.add('hidden');
    }

    resizeCanvas();
    if (window.innerWidth > 768) $('input').focus();
  });
}

$('backToInboxBtn').onclick = () => {
  if (isQuickRoomMode) {
    leaveQuickRoomSession();
    return;
  }
  $('messengerShell').classList.remove('mobile-chat-open');
  if (activePeer) {
    socket.emit('typing', { peerId: activePeer.id, typing: false });
  }
  activePeer = null;
  activeRoomKey = '';
  renderSidebar();
};

/* ---------- Chat Header & Presence ---------- */
let peerTyping = false;

function updateChatHeader(reconnecting) {
  if (!activePeer) return;
  $('peerName').textContent = activePeer.name;
  $('avatar').innerHTML = avatarArt(activePeer.gender, activePeer.avatar);
  $('myPortrait').innerHTML = avatarArt(currentAccount?.gender, currentAccount?.avatar);
  $('peerPortrait').innerHTML = avatarArt(activePeer.gender, activePeer.avatar);
  $('myDisplayName').textContent = currentAccount?.name || 'You';
  $('friendDisplayName').textContent = activePeer.name;

  const connected = socket.connected && activePeer.online && !reconnecting;
  $('duoConnection').classList.toggle('connected', connected);
  $('connectionLabel').textContent = !socket.connected ? 'Reconnecting…' : connected ? 'Connected' : 'Offline';

  const s = $('status');
  s.textContent = reconnecting ? 'Reconnecting…' : peerTyping ? 'typing…' : activePeer.online ? 'Online' : 'Offline';
  s.className = activePeer.online && !reconnecting ? 'on' : 'off';
  $('onlineDot').className = 'online-dot' + (activePeer.online && !reconnecting ? ' on' : '');
  $('typingBubble').classList.toggle('hidden', !peerTyping);
  if (peerTyping) scrollDown();
}

function updatePeerMood(mood) {
  const badge = $('peerMoodBadge');
  const aura = inferAuraFromMood(mood);
  applyAuraClass($('headerPeerAuraWrap'), aura);
  applyAuraClass($('peerPortrait'), aura);
  AURA_KEYS.forEach((k) => badge.classList.remove('aura-badge-' + k));
  if (mood) {
    badge.textContent = mood;
    if (aura) badge.classList.add('aura-badge-' + aura);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/* ---------- Socket Real-Time Social & Chat Events ---------- */
socket.on('inbox-sync', (data) => {
  inboxData = data;
  renderSidebar();
});

socket.on('friend-request-received', ({ from }) => {
  beep(740);
  showToast(`↗ ${from.name} (@${from.username}) sent you a friend request!`);
});

socket.on('friend-accepted', ({ by }) => {
  beep(880);
  showToast(`✦ ${by.name} accepted your friend request!`);
});

socket.on('friend-presence', ({ userId, online, mood, name, gender, avatar }) => {
  const f = inboxData.friends.find((item) => item.id === userId);
  if (f) {
    f.online = online;
    if (mood !== undefined) f.mood = mood;
    if (name) f.name = name;
    if (gender) f.gender = gender;
    if (avatar !== undefined) f.avatar = avatar;
    renderSidebar();
  }
  if (activePeer && activePeer.id === userId) {
    const wasOffline = !activePeer.online;
    activePeer.online = online;
    if (online && wasOffline) {
      triggerPresenceConfetti(activePeer.name);
    }
    if (name) activePeer.name = name;
    if (gender) activePeer.gender = gender;
    if (avatar !== undefined) activePeer.avatar = avatar;
    if (mood !== undefined) {
      activePeer.mood = mood;
      updatePeerMood(online ? mood : '');
    }
    if (!online) peerTyping = false;
    updateChatHeader();
    if (gameState) renderGame(gameState);
  }
});

socket.on('typing', ({ from, typing }) => {
  if (activePeer && activePeer.id === from) {
    peerTyping = typing;
    updateChatHeader();
  }
});

socket.on('weather', ({ roomKey, weather, by }) => {
  if (roomKey === activeRoomKey) {
    applyWeather(weather, by || activePeer?.name || 'Your friend');
  }
});


function triggerShake() {
  const c = $('activeChatView');
  c.classList.remove('shake');
  void c.offsetWidth;
  c.classList.add('shake');
}

/* ---------- Vanish & Spoiler Toggles ---------- */
function updateModeStrip() {
  $('vanishBtn').classList.toggle('active', vanishMode);
  $('spoilerBtn').classList.toggle('active', spoilerMode);
  $('vanishTag').classList.toggle('hidden', !vanishMode);
  $('spoilerTag').classList.toggle('hidden', !spoilerMode);
  $('modeStrip').classList.toggle('hidden', !vanishMode && !spoilerMode);
}
$('vanishBtn').onclick = () => { vanishMode = !vanishMode; updateModeStrip(); };
$('spoilerBtn').onclick = () => { spoilerMode = !spoilerMode; updateModeStrip(); };

/* ---------- Rendering Messages ---------- */
const TICKS = { sending: '◷', sent: '✓', delivered: '✓✓', seen: '✓✓' };
function setStatus(id, status) {
  const it = items[id];
  if (!it) return;
  it.m.status = status;
  if (it.tick) {
    it.tick.textContent = TICKS[status] || '✓';
    it.tick.className = 'tick ' + status;
  }
  if (status === 'seen' && it.m.vanish && !it.vanishTimer) {
    startVanishCountdown(id);
  }
}

function startVanishCountdown(id) {
  const it = items[id];
  if (!it || it.vanishTimer) return;
  it.vanishTimer = setTimeout(() => {
    it.el.classList.add('vanishing');
    setTimeout(() => {
      it.el.remove();
      delete items[id];
    }, 500);
  }, 10000);
}

function openImage(src) {
  const o = el('div', 'lb');
  const i = el('img');
  i.src = src;
  o.append(i);
  o.onclick = () => o.remove();
  document.body.append(o);
}

function render(m) {
  if (items[m.id]) return;
  const mine = m.from === cid;
  const d = el(
    'div',
    'm ' + (mine ? 'me' : 'them') + (m.spoiler ? ' spoiler' : '') + (m.reaction ? ' has-react' : '')
  );
  d.dataset.id = m.id;

  const rBar = el('div', 'react-bar');
  ['❤️', '😂', '👍', '😮', '😢', '😡', '🤲'].forEach((emo) => {
    const rb = el('button', '', emo);
    rb.onclick = (e) => {
      e.stopPropagation();
      if (!activePeer) return;
      socket.emit('react', { peerId: activePeer.id, id: m.id, emoji: emo });
      applyReaction(m.id, emo);
    };
    rBar.append(rb);
  });
  d.append(rBar);

  if (m.spoiler) {
    const sb = el('div', 'spoiler-badge', 'Tap to reveal spoiler');
    d.append(sb);
    d.onclick = (e) => {
      if (e.target.closest('button')) return;
      d.classList.toggle('revealed');
      sb.textContent = d.classList.contains('revealed') ? '◉ Spoiler revealed' : 'Tap to reveal spoiler';
    };
  }

  if (m.reply) {
    const q = el('div', 'q');
    q.append(el('b', '', m.reply.name), el('span', '', m.reply.text));
    d.append(q);
  }

  if (m.image) {
    const i = el('img', 'pic');
    i.src = m.image;
    i.onclick = (e) => {
      if (m.spoiler && !d.classList.contains('revealed')) return;
      e.stopPropagation();
      openImage(m.image);
    };
    i.onload = scrollDown;
    d.append(i);
  }

  if (m.audio) {
    d.append(buildVoicePlayer(m.audio, m.audioDuration || 0, m.audioMorph || 'normal'));
  }
  if (m.widget) {
    d.append(buildInteractiveWidget(m));
  }

  if (m.text) d.append(el('div', 'txt', m.text));

  const meta = el('div', 'meta');
  if (m.vanish) {
    meta.append(el('span', 'vanish-indicator', '10s'));
  }

  const rb = el('button', 'act-btn');
  rb.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';
  rb.title = 'Reply';
  rb.onclick = (e) => {
    e.stopPropagation();
    setReply({ name: m.name, text: m.spoiler ? '▣ Spoiler message' : m.audio ? 'Voice message' : m.text || '▧ Photo' });
  };
  meta.append(rb);
  if (m.edited) meta.append(el('span', 'edited-label', 'edited'));
  meta.append(el('span', '', fmtTime(m.time)));

  const menuBtn = el('button', 'act-btn message-menu-btn', '⋯');
  menuBtn.title = 'Message actions';
  const actionMenu = el('div', 'message-actions hidden');
  const addAction = (label, fn, danger = false) => {
    const b = el('button', danger ? 'danger-text' : '', label);
    b.onclick = (e) => {
      e.stopPropagation();
      actionMenu.classList.add('hidden');
      fn();
    };
    actionMenu.append(b);
  };
  if (mine && m.text && !m.image && !m.vanish) {
    addAction('✎ Edit message', () => editMessage(m.id));
  }
  if (mine) {
    addAction(
      '⌫ Delete for everyone',
      () => {
        if (activePeer && confirm('Delete this message for both people?')) {
          socket.emit('delete-message', { peerId: activePeer.id, id: m.id }, (res) => {
            if (res && res.error) showToast(res.error);
          });
        }
      },
      true
    );
  }
  addAction('Hide for me', () => {
    d.remove();
    delete items[m.id];
  });
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.message-actions').forEach((x) => {
      if (x !== actionMenu) x.classList.add('hidden');
    });
    actionMenu.classList.toggle('hidden');
  };
  meta.append(menuBtn);
  d.append(actionMenu);

  let tick = null;
  if (mine) {
    tick = el('span', 'tick');
    meta.append(tick);
  }
  d.append(meta);

  if (m.reaction) {
    const rp = el('div', 'reaction-pill', m.reaction);
    d.append(rp);
  }

  $('msgs').append(d);
  items[m.id] = { m, el: d, tick, seenSent: false, vanishTimer: null };
  if (mine) setStatus(m.id, m.status);
  if (m.status === 'seen' && m.vanish) startVanishCountdown(m.id);
  scrollDown();
}

function editMessage(id) {
  const it = items[id];
  if (!it || !activePeer || it.m.from !== cid || !it.m.text) return;
  const next = prompt('Edit your message:', it.m.text);
  if (next === null || !next.trim() || next.trim() === it.m.text) return;
  socket.emit('edit-message', { peerId: activePeer.id, id, text: next.trim() }, (res) => {
    if (res && res.error) showToast(res.error);
    else showToast('Message updated ✦');
  });
}

socket.on('message-edited', ({ roomKey, id, text, edited }) => {
  if (roomKey !== activeRoomKey) return;
  const it = items[id];
  if (!it) return;
  it.m.text = text;
  it.m.edited = edited;
  const txt = it.el.querySelector('.txt');
  if (txt) txt.textContent = text;
  let label = it.el.querySelector('.edited-label');
  if (!label) {
    label = el('span', 'edited-label', 'edited');
    const meta = it.el.querySelector('.meta');
    meta.insertBefore(label, meta.querySelector('.tick'));
  }
});

socket.on('message-deleted', ({ roomKey, id }) => {
  if (roomKey !== activeRoomKey) return;
  const it = items[id];
  if (it) {
    it.el.remove();
    delete items[id];
  }
  showToast('Message deleted');
});

function applyReaction(id, emoji) {
  const it = items[id];
  if (!it) return;
  it.m.reaction = emoji;
  triggerReactionBlast(emoji);
  let pill = it.el.querySelector('.reaction-pill');
  if (!pill) {
    pill = el('div', 'reaction-pill', emoji);
    it.el.append(pill);
    it.el.classList.add('has-react');
  } else {
    pill.textContent = emoji;
  }
}

function scrollDown() {
  const c = $('msgs');
  c.scrollTop = c.scrollHeight;
}

/* ---------- Sending & Receiving Messages ---------- */
function updateSidebarPreview(peerId, text, time, fromMe, incrementUnread) {
  const f = inboxData.friends.find((item) => item.id === peerId);
  if (!f) return;
  f.lastMessage = { text, time, fromMe };
  if (incrementUnread) f.unread = (f.unread || 0) + 1;
  inboxData.friends.sort((a, b) => (b.lastMessage?.time || 0) - (a.lastMessage?.time || 0));
  renderSidebar();
}

function send(image) {
  if (!activePeer || !socket.connected) return showToast('Select an online friend or wait to reconnect.');
  const input = $('input');
  const text = image ? '' : input.value.trim();
  if (!text && !image) return;

  const now = Date.now();
  const m = {
    id: cid.slice(0, 6) + rnd(),
    to: activePeer.id,
    text,
    image: image || null,
    reply: replyTo,
    vanish: vanishMode,
    spoiler: spoilerMode
  };

  playSendSound();
  render({ ...m, from: cid, name: currentAccount.name, time: now, status: 'sending' });
  updateSidebarPreview(activePeer.id, spoilerMode ? '▣ Spoiler message' : image ? '▧ Photo' : text, now, true, false);

  socket.emit('msg', m, (status) => {
    if (status && status.error) return showToast(status.error);
    setStatus(m.id, status);
  });

  if (!image) {
    input.value = '';
    input.style.height = '40px';
  }
  setReply(null);
  stopTyping();
}

$('send').onclick = () => send();
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
});
let typingTimer;
$('input').addEventListener('input', (e) => {
  playKeyTick();
  e.target.style.height = '40px';
  e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px';
  if (!activePeer) return;
  socket.emit('typing', { peerId: activePeer.id, typing: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 1500);
});
function stopTyping() {
  clearTimeout(typingTimer);
  if (activePeer) socket.emit('typing', { peerId: activePeer.id, typing: false });
}

socket.on('msg', (m) => {
  const peerId = m.from === cid ? m.to : m.from;
  const isCurrentChat = activePeer && activePeer.id === peerId && !$('activeChatView').classList.contains('hidden');

  updateSidebarPreview(
    peerId,
    m.spoiler ? '▣ Spoiler message' : m.audio ? 'Voice message' : m.image ? '▧ Photo' : m.text,
    m.time,
    m.from === cid,
    !isCurrentChat && m.from !== cid
  );

  if (isCurrentChat) {
    render(m);
    if (document.hidden || !document.hasFocus()) beep(880);
    markSeen();
  } else if (m.from !== cid) {
    beep(880);
    showToast(`◇ ${m.name}: ${m.spoiler ? 'Spoiler message' : m.audio ? 'Sent a voice message' : m.image ? 'Sent a photo' : m.text.slice(0, 40)}`);
  }
});

socket.on('status', ({ roomKey, ids, status }) => {
  if (roomKey === activeRoomKey) {
    ids.forEach((id) => setStatus(id, status));
  }
});

socket.on('react', ({ roomKey, id, emoji }) => {
  if (roomKey === activeRoomKey) applyReaction(id, emoji);
});

function markSeen() {
  if (!activePeer || document.hidden || !document.hasFocus()) return;
  const ids = Object.values(items)
    .filter((it) => it.m.from === activePeer.id && !it.seenSent)
    .map((it) => {
      it.seenSent = true;
      if (it.m.vanish) startVanishCountdown(it.m.id);
      return it.m.id;
    });
  if (ids.length) socket.emit('seen', { peerId: activePeer.id, ids });
}
addEventListener('focus', markSeen);
document.addEventListener('visibilitychange', markSeen);

/* ---------- Voice Note Recorder & Custom Waveform Audio Player ---------- */
function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

function buildVoicePlayer(audioSrc, initialDuration, morph = 'normal') {
  const wrap = el('div', 'voice-note-player');
  const playBtn = el('button', 'voice-play-btn', '▶');
  playBtn.type = 'button';
  playBtn.title = 'Play voice note';

  const waveWrap = el('div', 'voice-wave-wrap');
  const barsRow = el('div', 'voice-bars');
  const heights = [38, 65, 92, 54, 80, 100, 46, 74, 88, 60, 95, 50, 72, 85, 42, 68, 90, 56, 76, 48];
  const barEls = heights.map((h) => {
    const bar = document.createElement('i');
    bar.style.height = `${h}%`;
    barsRow.append(bar);
    return bar;
  });

  const morphLabels = {
    normal: 'Voice',
    female: 'Female',
    old: 'Old',
    baby: 'Baby',
    chipmunk: 'Helium',
    deep: 'Deep',
    robot: 'Echo',
    radio: 'Retro'
  };
  const metaRow = el('div', 'voice-meta-row');
  const timeLbl = el('span', '', fmtDuration(initialDuration));
  const tagLbl = el('span', morph !== 'normal' ? 'voice-morph-badge' : '', morphLabels[morph] || 'Voice');
  metaRow.append(timeLbl, tagLbl);

  waveWrap.append(barsRow, metaRow);
  wrap.append(playBtn, waveWrap);

  const audioObj = new Audio(audioSrc);
  audioObj.preload = 'metadata';
  if (['female', 'old', 'baby'].includes(morph)) {
    audioObj.preservesPitch = false;
    audioObj.playbackRate = { female: 1.18, old: 0.86, baby: 1.48 }[morph];
  } else if (morph === 'chipmunk') {
    audioObj.preservesPitch = false;
    audioObj.playbackRate = 1.38;
  } else if (morph === 'deep') {
    audioObj.preservesPitch = false;
    audioObj.playbackRate = 0.76;
  } else if (morph === 'robot') {
    audioObj.preservesPitch = false;
    audioObj.playbackRate = 0.92;
  } else if (morph === 'radio') {
    audioObj.playbackRate = 1.06;
  }

  audioObj.addEventListener('loadedmetadata', () => {
    if (isFinite(audioObj.duration) && audioObj.duration > 0) {
      timeLbl.textContent = fmtDuration(audioObj.duration);
    }
  });

  audioObj.addEventListener('timeupdate', () => {
    const dur = isFinite(audioObj.duration) && audioObj.duration > 0 ? audioObj.duration : initialDuration || 1;
    const ratio = Math.min(1, audioObj.currentTime / dur);
    const activeCount = Math.round(ratio * barEls.length);
    barEls.forEach((b, idx) => b.classList.toggle('played', idx < activeCount));
    timeLbl.textContent = fmtDuration(audioObj.currentTime);
  });

  audioObj.addEventListener('ended', () => {
    playBtn.textContent = '▶';
    barEls.forEach((b) => b.classList.remove('played'));
    const dur = isFinite(audioObj.duration) && audioObj.duration > 0 ? audioObj.duration : initialDuration;
    timeLbl.textContent = fmtDuration(dur);
  });

  barsRow.onclick = (e) => {
    e.stopPropagation();
    const rect = barsRow.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (isFinite(audioObj.duration) && audioObj.duration > 0) {
      audioObj.currentTime = pct * audioObj.duration;
    }
  };

  playBtn.onclick = (e) => {
    e.stopPropagation();
    if (audioObj.paused) {
      document.querySelectorAll('audio').forEach((a) => a.pause());
      audioObj.play().then(() => {
        playBtn.textContent = '⏸';
      }).catch(() => showToast('Could not play voice message.'));
    } else {
      audioObj.pause();
      playBtn.textContent = '▶';
    }
  };

  return wrap;
}

function sendVoiceNote(audioDataUrl, durationSec) {
  if (!activePeer || !socket.connected) return showToast('Select an online partner or wait to reconnect.');
  const morph = $('voiceMorphSelect') ? $('voiceMorphSelect').value : 'normal';
  const now = Date.now();
  const m = {
    id: cid.slice(0, 6) + rnd(),
    to: activePeer.id,
    text: '',
    image: null,
    audio: audioDataUrl,
    audioDuration: Math.max(1, Math.round(durationSec)),
    audioMorph: morph,
    reply: replyTo,
    vanish: vanishMode,
    spoiler: spoilerMode
  };

  playSendSound();
  render({ ...m, from: cid, name: currentAccount.name, time: now, status: 'sending' });
  updateSidebarPreview(activePeer.id, spoilerMode ? '▣ Spoiler message' : 'Voice message', now, true, false);

  socket.emit('msg', m, (status) => {
    if (status && status.error) return showToast(status.error);
    setStatus(m.id, status);
  });
  setReply(null);
}

let mediaRecorder = null;
let voiceChunks = [];
let voiceStream = null;
let voiceStartTime = 0;
let voiceTimerInterval = null;
let voiceShouldSend = false;

function stopVoiceUI() {
  clearInterval(voiceTimerInterval);
  $('voiceRecBar').classList.add('hidden');
  $('voiceBtn').classList.remove('active');
  if (voiceStream) {
    voiceStream.getTracks().forEach((t) => t.stop());
    voiceStream = null;
  }
}

$('voiceBtn').onclick = async () => {
  if (!activePeer || !socket.connected) return showToast('Open a chat first to send a voice note.');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    voiceShouldSend = true;
    mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return showToast('Microphone is not supported in this browser.');
  }
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    voiceShouldSend = false;
    mediaRecorder = new MediaRecorder(voiceStream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) voiceChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const durationSec = (Date.now() - voiceStartTime) / 1000;
      const shouldSend = voiceShouldSend;
      const mimeType = mediaRecorder.mimeType || 'audio/webm';
      stopVoiceUI();
      if (!shouldSend || !voiceChunks.length) return;
      if (durationSec < 0.6) return showToast('Voice note too short.');

      const blob = new Blob(voiceChunks, { type: mimeType });
      if (blob.size > 2.4 * 1024 * 1024) {
        return showToast('Voice note is too long (max ~60 seconds).');
      }
      const reader = new FileReader();
      reader.onload = () => sendVoiceNote(reader.result, durationSec);
      reader.readAsDataURL(blob);
    };

    voiceStartTime = Date.now();
    $('voiceRecTimer').textContent = '0:00';
    $('voiceRecBar').classList.remove('hidden');
    $('voiceBtn').classList.add('active');

    voiceTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - voiceStartTime) / 1000);
      $('voiceRecTimer').textContent = fmtDuration(elapsed);
      if (elapsed >= 60 && mediaRecorder && mediaRecorder.state === 'recording') {
        voiceShouldSend = true;
        mediaRecorder.stop();
      }
    }, 300);

    mediaRecorder.start();
  } catch (err) {
    stopVoiceUI();
    showToast('Microphone permission denied.');
  }
};

$('cancelVoiceBtn').onclick = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    voiceShouldSend = false;
    mediaRecorder.stop();
  } else {
    stopVoiceUI();
  }
};

$('sendVoiceBtn').onclick = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    voiceShouldSend = true;
    mediaRecorder.stop();
  }
};

/* ---------- Reply, Emoji & Image Upload ---------- */
function setReply(r) {
  replyTo = r;
  $('replyBar').classList.toggle('hidden', !r);
  if (r) {
    $('rName').textContent = r.name;
    $('rText').textContent = r.text.slice(0, 120);
    $('input').focus();
  }
}
$('rClose').onclick = () => setReply(null);

Array.from('😀😁😂🤣😊😍😘😎🤔😅😭😡🥳😴🤗🙄😉😇🥺😢🤲👍👎👏🙌🙏💪↗🤝❤️💔🔥✨✦🎂🍕☕🌹⭐💯✅❌👀🚀🌙☀️🎵').forEach(
  (ch) => {
    const b = el('button', '', ch);
    b.type = 'button';
    b.onclick = () => {
      $('input').value += ch;
      $('input').focus();
    };
    $('emojis').append(b);
  }
);
$('emojiBtn').onclick = () => $('emojis').classList.toggle('hidden');

$('imgBtn').onclick = () => $('file').click();
$('file').onchange = (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (!f.type.startsWith('image/') || f.size > 15 * 1024 * 1024) {
    return showToast('Choose an image smaller than 15 MB.');
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      send(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => showToast('This image could not be opened.');
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
};

$('clearBtn').onclick = () => {
  if (activePeer && confirm('Clear the whole conversation for both of you?')) {
    socket.emit('clear', { peerId: activePeer.id });
  }
};
socket.on('clear', ({ roomKey }) => {
  if (roomKey === activeRoomKey) {
    $('msgs').innerHTML = '';
    Object.keys(items).forEach((k) => delete items[k]);
  }
});

/* ---------- DuoPlay Mini-Games (Tic-Tac-Toe, Rock Paper Scissors, Connect Four) ---------- */
$('gamesBtn').onclick = () => {
  if (!activePeer) return;
  openModal('gamesModal');
  if (gameState) {
    $('gamePickerGrid').classList.add('hidden');
    $('gameStage').classList.remove('hidden');
    renderGame(gameState);
  } else {
    $('gamePickerGrid').classList.remove('hidden');
    $('gameStage').classList.add('hidden');
  }
};

document.querySelectorAll('[data-game]').forEach((b) => {
  b.onclick = () => {
    if (!activePeer) return;
    const type = b.dataset.game;
    if (['secretvault', 'duoquiz', 'duopoll'].includes(type)) {
      openInteractiveCreatorInStage(type);
      return;
    }
    socket.emit('game-start', { peerId: activePeer.id, type }, (res) => {
      if (res && res.error) return showToast(res.error);
    });
  };
});

socket.on('game-state', ({ roomKey, game }) => {
  if (roomKey !== activeRoomKey) return;
  gameState = game;
  activeGame = game ? game.type : null;

  if (!game) {
    $('gameStage').classList.add('hidden');
    $('gamePickerGrid').classList.remove('hidden');
    return;
  }

  closeModal('themesModal');
  openModal('gamesModal');
  $('gamePickerGrid').classList.add('hidden');
  $('gameStage').classList.remove('hidden');
  renderGame(game);
});

function gameButton(label, action, primary = false) {
  const b = el('button', 'game-action' + (primary ? ' primary-action' : ''), label);
  b.type = 'button';
  b.onclick = action;
  return b;
}

function renderGame(g) {
  gameState = g;
  const stage = $('gameStage');
  stage.innerHTML = '';

  const peerId = activePeer?.id;
  const peerLabel = activePeer?.name || 'Friend';
  const myScore = g.scores?.[cid] || 0;
  const peerScore = g.scores?.[peerId] || 0;

  const head = el('div', 'game-stage-head');
  const titleMap = {
    tictactoe: '✕ Tic-Tac-Toe',
    rps: '◇ Rock Paper Scissors',
    connect4: '● Connect Four'
  };
  head.append(
    el('h3', '', titleMap[g.type] || 'DuoPlay'),
    el('span', 'score-pill', `You ${myScore} — ${peerScore} ${peerLabel}`)
  );
  stage.append(head);

  if (g.type === 'tictactoe') {
    const myMark = g.marks?.[cid] || 'X';
    const oppMark = myMark === 'X' ? 'O' : 'X';
    const statusText = g.result
      ? g.result
      : g.turn === cid
      ? `Your turn (${myMark})`
      : `${peerLabel}'s turn (${oppMark})`;
    stage.append(el('p', '', statusText));

    const board = el('div', 'game-board');
    (g.board || Array(9).fill('')).forEach((val, idx) => {
      const cell = el('button', 'game-cell' + (g.winLine && g.winLine.includes(idx) ? ' win-cell' : ''), val);
      cell.type = 'button';
      cell.disabled = !socket.connected || !!val || !!g.result || g.turn !== cid;
      cell.setAttribute('aria-label', `Cell ${idx + 1}: ${val || 'empty'}`);
      cell.onclick = () => {
        socket.emit('game-action', { peerId, type: 'tictactoe', index: idx }, (res) => {
          if (res && res.error) showToast(res.error);
        });
      };
      board.append(cell);
    });

    const acts = el('div', 'game-actions');
    acts.append(
      gameButton(g.result ? '↻ Play Again' : '↻ Restart', () => socket.emit('game-reset', { peerId }), true),
      gameButton('Switch Game', () => socket.emit('game-close', { peerId }))
    );
    stage.append(board, acts);
  } else if (g.type === 'rps') {
    stage.append(el('p', '', `Round ${g.round || 1} · First to 2 points wins the match`));

    if (g.lastRound) {
      const emojiMap = { rock: '◇', paper: '▱', scissors: '✂' };
      const mine = g.lastRound.choices?.[cid];
      const other = g.lastRound.choices?.[peerId];
      const outcome =
        g.lastRound.winner === null
          ? 'Round Draw!'
          : g.lastRound.winner === cid
          ? 'You won that round!'
          : `${peerLabel} won that round!`;
      stage.append(el('div', 'game-prompt', `${emojiMap[mine] || '—'}  vs  ${emojiMap[other] || '—'} · ${outcome}`));
    }

    const myLocked = g.choices && g.choices[cid] && g.choices[cid] !== 'locked';
    const peerLocked = g.choices && g.choices[peerId] === 'locked';

    const choices = el('div', 'rps-choices');
    [
      ['rock', '◇', 'Rock'],
      ['paper', '▱', 'Paper'],
      ['scissors', '✂', 'Scissors']
    ].forEach(([val, emo, label]) => {
      const b = el('button', myLocked === val ? 'selected-choice' : '', emo);
      b.type = 'button';
      b.append(el('small', '', label));
      b.disabled = !socket.connected || !!g.matchWinner || !!myLocked;
      b.onclick = () => {
        socket.emit('game-action', { peerId, type: 'rps', choice: val }, (res) => {
          if (res && res.error) showToast(res.error);
        });
      };
      choices.append(b);
    });
    stage.append(choices);

    if (g.matchWinner) {
      stage.append(
        el('div', 'game-prompt', g.matchWinner === cid ? '☆ You won the match!' : `☆ ${peerLabel} won the match!`)
      );
    } else if (myLocked) {
      stage.append(el('div', 'game-wait', `Choice locked in — waiting for ${peerLabel}…`));
    } else if (peerLocked) {
      stage.append(el('div', 'game-wait', `${peerLabel} has chosen — pick your move!`));
    }

    const acts = el('div', 'game-actions');
    acts.append(
      gameButton('↻ New Match', () => socket.emit('game-reset', { peerId }), true),
      gameButton('Switch Game', () => socket.emit('game-close', { peerId }))
    );
    stage.append(acts);
  } else if (g.type === 'connect4') {
    const myColor = g.colors?.[cid] || 'R';
    const myDiscLabel = myColor === 'R' ? 'Red' : 'Gold';
    const oppDiscLabel = myColor === 'R' ? 'Gold' : 'Red';
    const statusText = g.result
      ? g.result
      : g.turn === cid
      ? `Your turn (${myDiscLabel} disc)`
      : `${peerLabel}'s turn (${oppDiscLabel} disc)`;
    stage.append(el('p', '', statusText));

    const board = el('div', 'c4-board');
    for (let idx = 0; idx < 42; idx++) {
      const val = g.board[idx];
      const col = idx % 7;
      const isWin = g.winCells && g.winCells.includes(idx);
      const cell = el('button', 'c4-cell' + (val ? ` disc-${val}` : '') + (isWin ? ' win-disc' : ''));
      cell.type = 'button';
      cell.disabled = !socket.connected || !!g.result || g.turn !== cid || !!g.board[col];
      cell.setAttribute('aria-label', `Column ${col + 1}`);
      cell.onclick = () => {
        socket.emit('game-action', { peerId, type: 'connect4', col }, (res) => {
          if (res && res.error) showToast(res.error);
        });
      };
      board.append(cell);
    }

    const acts = el('div', 'game-actions');
    acts.append(
      gameButton(g.result ? '↻ Play Again' : '↻ Restart', () => socket.emit('game-reset', { peerId }), true),
      gameButton('Switch Game', () => socket.emit('game-close', { peerId }))
    );
    stage.append(board, acts);
  }
}

/* ---------- Notification Sound ---------- */
let audio;
function beep() {}

/* ---------- Authentication, Quick Rooms & Avatar Gallery ---------- */
let authMode = 'login'; // 'login' | 'register' | 'room'
let roomSubMode = 'create'; // 'create' | 'join'
let isQuickRoomMode = false;
let currentRoomCode = '';
let selectedGender = 'male';
let selectedAvatar = 0;

function makeClientRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

let draftRoomCode = makeClientRoomCode();
$('generatedRoomCode').textContent = draftRoomCode;

$('regenRoomCodeBtn').onclick = () => {
  draftRoomCode = makeClientRoomCode();
  $('generatedRoomCode').textContent = draftRoomCode;
};

$('copyRoomCodeBtn').onclick = () => {
  navigator.clipboard?.writeText(draftRoomCode).catch(() => {});
  showToast(`Room code ${draftRoomCode} copied!`);
};

$('activeRoomCodeBadge').onclick = () => {
  if (!currentRoomCode) return;
  navigator.clipboard?.writeText(currentRoomCode).catch(() => {});
  showToast(`Room code ${currentRoomCode} copied!`);
};

function renderAvatarGallery() {
  $('avatarGallery').replaceChildren();
  for (let i = 0; i < 8; i++) {
    const button = el('button', 'avatar-option');
    button.type = 'button';
    button.innerHTML = avatarArt(selectedGender, i);
    button.append(el('span', 'avatar-name', AVATAR_NAMES[selectedGender][i]));
    button.title = AVATAR_NAMES[selectedGender][i];
    button.setAttribute('aria-pressed', String(i === selectedAvatar));
    button.onclick = () => {
      selectedAvatar = i;
      renderAvatarGallery();
    };
    $('avatarGallery').append(button);
  }
  $('maleAvatars').setAttribute('aria-pressed', String(selectedGender === 'male'));
  $('femaleAvatars').setAttribute('aria-pressed', String(selectedGender === 'female'));
}

function setRoomSubMode(sub) {
  roomSubMode = sub;
  $('createRoomSubTab').classList.toggle('active', sub === 'create');
  $('joinRoomSubTab').classList.toggle('active', sub === 'join');
  $('createRoomBox').classList.toggle('hidden', sub !== 'create');
  $('joinRoomBox').classList.toggle('hidden', sub !== 'join');
  $('joinRoomCodeInput').required = authMode === 'room' && sub === 'join';
  ($('authSubmitText') || $('authSubmit')).textContent = sub === 'create' ? 'Create & Enter Room' : 'Join Room';
  $('authError').textContent = '';
}

function setAuthMode(mode) {
  authMode = mode;
  const isAccount = mode === 'login' || mode === 'register';
  const showProfile = mode === 'register' || mode === 'room';

  $('accountAuthFields').classList.toggle('hidden', !isAccount);
  $('roomModeFields').classList.toggle('hidden', mode !== 'room');
  $('profileSetupFields').classList.toggle('hidden', !showProfile);

  $('username').required = isAccount;
  $('password').required = isAccount;
  $('accountName').required = showProfile;
  $('joinRoomCodeInput').required = mode === 'room' && roomSubMode === 'join';

  // Top tabs highlight: Sign in (active for both login & register) vs Chat Room
  $('loginTab').classList.toggle('primary-action', isAccount);
  $('roomTab').classList.toggle('primary-action', mode === 'room');

  // Hide 'Create account' footer completely when Chat Room mode is selected
  if ($('authSwitchFooter')) {
    $('authSwitchFooter').classList.toggle('hidden', mode === 'room');
  }

  // Bottom toggle footer text for Sign in / Register
  if (mode === 'register') {
    $('authSwitchPrompt').textContent = 'Already have an account?';
    if ($('registerTabText')) $('registerTabText').textContent = 'Sign in to account';
  } else {
    $('authSwitchPrompt').textContent = "Don't have an account?";
    if ($('registerTabText')) $('registerTabText').textContent = 'Create new account';
  }

  const submitSpan = $('authSubmitText') || $('authSubmit');
  if (mode === 'login') {
    submitSpan.textContent = 'Sign in';
    $('password').autocomplete = 'current-password';
  } else if (mode === 'register') {
    submitSpan.textContent = 'Create account';
    $('password').autocomplete = 'new-password';
  } else {
    setRoomSubMode(roomSubMode);
  }
  $('authError').textContent = '';
}

function leaveQuickRoomSession() {
  socket.emit('quick-room-leave');
  isQuickRoomMode = false;
  currentRoomCode = '';
  activePeer = null;
  activeRoomKey = '';
  currentAccount = null;
  $('messengerShell').classList.remove('quick-room-mode', 'mobile-chat-open');
  $('activeRoomCodeBadge').classList.add('hidden');
  $('leaveRoomBtn').classList.add('hidden');
  $('app').classList.add('hidden');
  $('auth').classList.remove('hidden');
  draftRoomCode = makeClientRoomCode();
  $('generatedRoomCode').textContent = draftRoomCode;
}

$('leaveRoomBtn').onclick = () => {
  closeAllMenus();
  leaveQuickRoomSession();
};

function enterQuickRoom(res) {
  isQuickRoomMode = true;
  currentRoomCode = res.roomCode;
  currentAccount = res.user;
  cid = res.user.id;
  activePeer = res.peer;
  activeRoomKey = res.roomKey;
  peerTyping = false;
  setReply(null);

  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('messengerShell').classList.add('quick-room-mode', 'mobile-chat-open');
  $('emptyChatState').classList.add('hidden');
  $('activeChatView').classList.remove('hidden');

  $('activeRoomCodeBadge').textContent = `ROOM: ${currentRoomCode}`;
  $('activeRoomCodeBadge').classList.remove('hidden');
  $('leaveRoomBtn').classList.remove('hidden');

  Object.values(items).forEach((it) => clearTimeout(it.vanishTimer));
  $('msgs').innerHTML = '';
  Object.keys(items).forEach((k) => delete items[k]);

  (res.history || []).forEach(render);
  applyWeather(res.weather || 'clear', null);
  updatePeerMood(activePeer.mood || '');
  updateChatHeader();

  if (res.game) {
    gameState = res.game;
    activeGame = res.game.type;
    renderGame(res.game);
  } else {
    gameState = null;
    activeGame = null;
    $('gameStage').classList.add('hidden');
  }

  resizeCanvas();
  if (window.innerWidth > 768) $('input').focus();
}

socket.on('quick-room-peer-joined', ({ roomKey, peer }) => {
  if (!isQuickRoomMode || roomKey !== activeRoomKey) return;
  activePeer = peer;
  beep(880);
  showToast(`✦ ${peer.name} joined the room!`);
  updatePeerMood(peer.mood || '');
  updateChatHeader();
  triggerPresenceConfetti(peer.name);
});

function enterApp(user) {
  isQuickRoomMode = false;
  currentRoomCode = '';
  $('messengerShell').classList.remove('quick-room-mode');
  $('activeRoomCodeBadge').classList.add('hidden');
  $('leaveRoomBtn').classList.add('hidden');

  currentAccount = user;
  cid = user.id;
  $('sidebarMyAvatar').innerHTML = avatarArt(user.gender, user.avatar);
  $('sidebarMyName').textContent = user.name;
  $('sidebarMyHandle').textContent = '@' + user.username;
  $('password').value = '';

  socket.emit('session-init', accountToken, (res) => {
    if (res.error) {
      sessionStorage.removeItem('accountToken');
      accountToken = '';
      currentAccount = null;
      $('app').classList.add('hidden');
      $('auth').classList.remove('hidden');
      $('authError').textContent = res.error;
      return;
    }
    inboxData = res.inbox;
    $('auth').classList.add('hidden');
    $('app').classList.remove('hidden');
    renderSidebar();
  });
}

$('loginTab').onclick = () => setAuthMode('login');
$('registerTab').onclick = () => setAuthMode(authMode === 'register' ? 'login' : 'register');
$('roomTab').onclick = () => setAuthMode('room');
$('createRoomSubTab').onclick = () => setRoomSubMode('create');
$('joinRoomSubTab').onclick = () => setRoomSubMode('join');

$('maleAvatars').onclick = () => {
  selectedGender = 'male';
  renderAvatarGallery();
};
$('femaleAvatars').onclick = () => {
  selectedGender = 'female';
  renderAvatarGallery();
};

$('authForm').onsubmit = (e) => {
  e.preventDefault();
  if (!socket.connected) {
    $('authError').textContent = 'Connecting… please try again in a moment.';
    return;
  }
  $('authSubmit').disabled = true;
  $('authError').textContent = '';

  if (authMode === 'room') {
    const code = roomSubMode === 'create' ? draftRoomCode : $('joinRoomCodeInput').value.trim();
    socket.timeout(15000).emit(
      'quick-room-auth',
      {
        action: roomSubMode,
        code,
        name: $('accountName').value,
        gender: selectedGender,
        avatar: selectedAvatar
      },
      (err, res) => {
        $('authSubmit').disabled = false;
        if (err || res?.error) {
          $('authError').textContent = res?.error || 'Could not enter room. Please try again.';
          return;
        }
        enterQuickRoom(res);
        if (roomSubMode === 'create') {
          showToast(`Room ${res.roomCode} created! Share the code to chat.`);
        } else {
          showToast(`Joined room ${res.roomCode}!`);
        }
      }
    );
    return;
  }

  socket.timeout(15000).emit(
    'account-auth',
    {
      mode: authMode,
      username: $('username').value,
      password: $('password').value,
      name: $('accountName').value,
      gender: selectedGender,
      avatar: selectedAvatar
    },
    (err, res) => {
      $('authSubmit').disabled = false;
      if (err || res?.error) {
        $('authError').textContent = res?.error || 'Request timed out. Please try again.';
        return;
      }
      accountToken = res.token;
      sessionStorage.setItem('accountToken', accountToken);
      enterApp(res.user);
    }
  );
};

$('logoutBtn').onclick = () => {
  sessionStorage.removeItem('accountToken');
  socket.emit('account-logout', accountToken);
  location.reload();
};

socket.on('connect', () => {
  if (accountToken && !isQuickRoomMode) {
    socket.emit('account-resume', accountToken, (res) => {
      if (res.user) {
        enterApp(res.user);
        if (activePeer) openConversation(activePeer.id);
      } else {
        accountToken = '';
        sessionStorage.removeItem('accountToken');
      }
    });
  }
});

socket.on('disconnect', () => {
  if (activePeer) {
    peerTyping = false;
    updateChatHeader(true);
    if (gameState) renderGame(gameState);
  }
});

renderAvatarGallery();
setAuthMode('login');


/* ==========================================================================
   DuoChat v7 New Features Implementation (3, 9, 18, 21, 22, 24, 26)
   ========================================================================== */

/* ---------- Feature 24: Subtle Typing & Send Sound Effects + Haptics ---------- */
function playKeyTick() {}
function playSendSound() {}

/* ---------- Feature 3: Live Heartbeat Tap (Long-Press Screen or Header Heart) ---------- */
function playHeartbeatPulse(senderName, isOutgoing = false) {
  if (navigator.vibrate) {
    navigator.vibrate([90, 70, 140]);
  }

  const ov = $('heartbeatOverlay');
  if (ov) {
    ov.classList.remove('hidden');
    ov.style.animation = 'none';
    void ov.offsetWidth;
    ov.style.animation = '';
    clearTimeout(ov._timer);
    ov._timer = setTimeout(() => ov.classList.add('hidden'), 1500);
  }

  if (isOutgoing) {
    showToast(`Heartbeat pulse sent to ${senderName}`);
  } else {
    showToast(`${senderName} sent a Live Heartbeat pulse!`);
  }
}

function sendLiveHeartbeat() {
  if (!activePeer || !socket.connected) return showToast('Partner must be connected to feel your heartbeat.');
  socket.emit('heartbeat', { peerId: activePeer.id });
  playHeartbeatPulse(activePeer.name, true);
}

socket.on('heartbeat', ({ roomKey, fromName }) => {
  if (roomKey === activeRoomKey) {
    playHeartbeatPulse(fromName || activePeer?.name || 'Partner', false);
  }
});

// Long-press on header heartbeat button OR empty chat area triggers Live Heartbeat Tap
let hbHoldTimer = null;
const hbBtn = $('heartbeatBtn');
if (hbBtn) {
  hbBtn.addEventListener('pointerdown', () => {
    hbBtn.classList.add('holding');
    hbHoldTimer = setTimeout(() => {
      hbBtn.classList.remove('holding');
      sendLiveHeartbeat();
    }, 450);
  });
  hbBtn.addEventListener('pointerup', () => {
    hbBtn.classList.remove('holding');
    clearTimeout(hbHoldTimer);
  });
  hbBtn.addEventListener('pointerleave', () => {
    hbBtn.classList.remove('holding');
    clearTimeout(hbHoldTimer);
  });
  hbBtn.onclick = () => sendLiveHeartbeat();
}

let msgAreaHoldTimer = null;
$('msgs').addEventListener('pointerdown', (e) => {
  if (e.target.closest('.m') || e.target.closest('button') || e.target.closest('input')) return;
  msgAreaHoldTimer = setTimeout(() => {
    sendLiveHeartbeat();
  }, 600);
});
['pointerup', 'pointerleave', 'pointermove'].forEach((ev) => {
  $('msgs').addEventListener(ev, () => clearTimeout(msgAreaHoldTimer));
});

/* ---------- Feature 9: Screenshot Detection Alert ---------- */
let lastScreenshotAt = 0;
function reportScreenshotTaken() {
  if (!activePeer || !socket.connected || $('activeChatView').classList.contains('hidden')) return;
  const now = Date.now();
  if (now - lastScreenshotAt < 3000) return;
  lastScreenshotAt = now;
  socket.emit('screenshot-taken', { peerId: activePeer.id });
}

document.addEventListener('keyup', (e) => {
  if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))) {
    reportScreenshotTaken();
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
    reportScreenshotTaken();
  }
});

socket.on('screenshot-alert', ({ roomKey, byId, byName }) => {
  if (roomKey !== activeRoomKey) return;
  const label = byId === cid ? 'You took a screenshot of the chat' : `${byName} took a screenshot!`;
  const banner = el('div', 'system-alert-pill');
  banner.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span>${label}</span>`;
  $('msgs').append(banner);
  scrollDown();
  if (byId !== cid) {
    beep(960);
    showToast(`▧ ${label}`);
  }
});

/* ---------- Feature 22: Custom Blast Reactions ---------- */
function triggerReactionBlast(emoji) {
  const overlay = $('fxOverlay');
  if (!overlay || !emoji) return;
  const burstMap = {
    '❤️': ['❤️', '💖', '💕', '💗', '💓'],
    '😡': ['😡', '😠', '💢'],
    '😂': ['😂', '🤣', '😆', '✨'],
    '🤲': ['🤲', '✨', '🌙', '💫'],
    '😮': ['😮', '✨', '🌟', '💫'],
    '😢': ['😢', '💧', '🫂'],
    '👍': ['👍', '✨', '⭐']
  };
  const pool = burstMap[emoji] || [emoji, '✨'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('span');
    p.className = 'fx-particle';
    p.textContent = pool[i % pool.length];
    p.style.left = `${12 + Math.random() * 76}%`;
    p.style.bottom = `${10 + Math.random() * 25}%`;
    p.style.setProperty('--dx1', `${(Math.random() - 0.5) * 90}px`);
    p.style.setProperty('--dx2', `${(Math.random() - 0.5) * 180}px`);
    p.style.setProperty('--rot1', `${(Math.random() - 0.5) * 40}deg`);
    p.style.setProperty('--rot2', `${(Math.random() - 0.5) * 80}deg`);
    p.style.setProperty('--dur', `${1.3 + Math.random() * 0.8}s`);
    overlay.append(p);
    setTimeout(() => p.remove(), 2200);
  }
}

/* ---------- Feature 26: Dual-Online Presence Confetti Celebration ---------- */
let lastConfettiPeerId = '';
let lastConfettiTime = 0;
function triggerPresenceConfetti(peerName) {
  const now = Date.now();
  if (activePeer && lastConfettiPeerId === activePeer.id && now - lastConfettiTime < 25000) return;
  lastConfettiPeerId = activePeer ? activePeer.id : '';
  lastConfettiTime = now;

  const overlay = $('fxOverlay');
  if (!overlay) return;
  const colors = ['#8b5cf6', '#38bdf8', '#f43f5e', '#10b981', '#f59e0b', '#ec4899'];
  for (let i = 0; i < 36; i++) {
    const c = document.createElement('span');
    c.className = 'fx-confetti';
    c.style.left = `${Math.random() * 100}%`;
    c.style.backgroundColor = colors[i % colors.length];
    c.style.setProperty('--drift', `${(Math.random() - 0.5) * 140}px`);
    c.style.setProperty('--dur', `${1.8 + Math.random() * 1.2}s`);
    c.style.animationDelay = `${Math.random() * 0.35}s`;
    overlay.append(c);
    setTimeout(() => c.remove(), 3400);
  }
  showToast(`✨ You and ${peerName} are both online together!`);
}

/* ---------- Features 18 & 21: Quick Duo Poll, Secret Passcode Vault & Duo Mini-Quiz ---------- */
function sendWidgetMessage(widgetObj, previewLabel) {
  if (!activePeer || !socket.connected) return showToast('Connect with your partner first.');
  const now = Date.now();
  const m = {
    id: cid.slice(0, 6) + rnd(),
    to: activePeer.id,
    text: '',
    image: null,
    widget: widgetObj,
    reply: replyTo,
    vanish: false,
    spoiler: false
  };
  playSendSound();
  render({ ...m, from: cid, name: currentAccount.name, time: now, status: 'sending' });
  updateSidebarPreview(activePeer.id, previewLabel, now, true, false);
  socket.emit('msg', m, (status) => {
    if (status && status.error) return showToast(status.error);
    setStatus(m.id, status);
  });
  closeModal('gamesModal');
}

function openInteractiveCreatorInStage(type) {
  $('gamePickerGrid').classList.add('hidden');
  const stage = $('gameStage');
  stage.classList.remove('hidden');
  stage.innerHTML = '';

  const backToMenuBtn = gameButton('← Back to Arcade', () => {
    stage.classList.add('hidden');
    $('gamePickerGrid').classList.remove('hidden');
  });

  if (type === 'duopoll') {
    stage.append(
      el('h3', '', '📊 Quick Duo Poll'),
      el('p', '', 'Ask a quick question so you both can vote & decide right in chat.')
    );
    const form = el('div', 'stage-form');
    const qIn = el('input');
    qIn.placeholder = 'Question (e.g. What should we eat tonight?)';
    const o1 = el('input');
    o1.placeholder = 'Option 1 (e.g. Biryani)';
    const o2 = el('input');
    o2.placeholder = 'Option 2 (e.g. Pizza)';
    const o3 = el('input');
    o3.placeholder = 'Option 3 (optional)';
    const sendBtn = gameButton('Send Poll to Chat ↗', () => {
      const question = qIn.value.trim();
      const options = [o1.value.trim(), o2.value.trim(), o3.value.trim()].filter(Boolean);
      if (!question || options.length < 2) return showToast('Enter a question and at least 2 options.');
      sendWidgetMessage({ kind: 'poll', question, options, votes: {} }, '📊 Quick Poll');
    }, true);
    const acts = el('div', 'game-actions');
    acts.append(sendBtn, backToMenuBtn);
    form.append(qIn, o1, o2, o3, acts);
    stage.append(form);
  } else if (type === 'secretvault') {
    stage.append(
      el('h3', '', '🔐 Secret Passcode Lock'),
      el('p', '', 'Send a locked secret message with a clue and 4-digit PIN.')
    );
    const form = el('div', 'stage-form');
    const clueIn = el('input');
    clueIn.placeholder = 'Hint / Clue (e.g. Year we first met)';
    const pinIn = el('input');
    pinIn.placeholder = 'Secret Passcode (2–6 digits/letters, e.g. 2024)';
    pinIn.maxLength = 6;
    const secretIn = el('input');
    secretIn.placeholder = 'Hidden secret message inside…';
    const sendBtn = gameButton('Lock & Send Secret ↗', () => {
      const pin = pinIn.value.trim();
      const secret = secretIn.value.trim();
      if (pin.length < 2 || !secret) return showToast('Enter a passcode (2+ chars) and secret message.');
      sendWidgetMessage(
        { kind: 'vault', clue: clueIn.value.trim() || 'Unlock with passcode', pin, secret, unlockedBy: [] },
        '🔐 Secret Passcode'
      );
    }, true);
    const acts = el('div', 'game-actions');
    acts.append(sendBtn, backToMenuBtn);
    form.append(clueIn, pinIn, secretIn, acts);
    stage.append(form);
  } else if (type === 'duoquiz') {
    stage.append(
      el('h3', '', '❓ Duo Mini-Quiz'),
      el('p', '', 'Challenge your partner with a quick custom trivia question!')
    );
    const form = el('div', 'stage-form');
    const qIn = el('input');
    qIn.placeholder = 'Quiz Question (e.g. What is my favorite coffee?)';
    const o1 = el('input');
    o1.placeholder = 'Choice A';
    const o2 = el('input');
    o2.placeholder = 'Choice B';
    const o3 = el('input');
    o3.placeholder = 'Choice C (optional)';
    const ansSel = el('select');
    ansSel.innerHTML = '<option value="0">Correct Answer: Choice A</option><option value="1">Correct Answer: Choice B</option><option value="2">Correct Answer: Choice C</option>';
    const sendBtn = gameButton('Send Mini-Quiz ↗', () => {
      const question = qIn.value.trim();
      const options = [o1.value.trim(), o2.value.trim(), o3.value.trim()].filter(Boolean);
      if (!question || options.length < 2) return showToast('Enter a question and at least 2 choices.');
      const answerIdx = Math.min(options.length - 1, Number(ansSel.value) || 0);
      sendWidgetMessage({ kind: 'quiz', question, options, answerIdx, answers: {} }, '❓ Duo Mini-Quiz');
    }, true);
    const acts = el('div', 'game-actions');
    acts.append(sendBtn, backToMenuBtn);
    form.append(qIn, o1, o2, o3, ansSel, acts);
    stage.append(form);
  }
}



function buildInteractiveWidget(m) {
  const w = m.widget;
  const box = el('div', 'interactive-card');

  if (w.kind === 'poll') {
    box.append(el('div', 'ic-badge', '📊 QUICK DUO POLL'), el('div', 'ic-title', w.question));
    const votes = w.votes || {};
    const totalVotes = Object.keys(votes).length;
    w.options.forEach((optText, idx) => {
      const count = Object.values(votes).filter((v) => v === idx).length;
      const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
      const isMine = votes[cid] === idx;
      const btn = el('button', 'poll-opt-btn' + (isMine ? ' voted' : ''));
      btn.type = 'button';
      const fill = el('span', 'poll-opt-fill');
      fill.style.width = `${pct}%`;
      const lbl = el('span', 'poll-opt-label', `${isMine ? '✓ ' : ''}${optText}`);
      const cnt = el('span', 'poll-opt-count', `${count} (${pct}%)`);
      btn.append(fill, lbl, cnt);
      btn.onclick = (e) => {
        e.stopPropagation();
        if (!activePeer) return;
        socket.emit('widget-interact', { peerId: activePeer.id, id: m.id, action: 'vote', value: idx }, (res) => {
          if (res?.error) showToast(res.error);
        });
      };
      box.append(btn);
    });
  } else if (w.kind === 'vault') {
    const unlocked = (w.unlockedBy || []).includes(cid) || m.from === cid;
    box.append(el('div', 'ic-badge', unlocked ? '🔓 UNLOCKED SECRET' : '🔐 SECRET PASSCODE'), el('div', 'ic-title', `Clue: ${w.clue}`));
    if (unlocked) {
      box.append(el('div', 'vault-secret-box', w.secret));
    } else {
      const row = el('div', 'vault-pin-row');
      const pinInput = el('input', 'vault-pin-input');
      pinInput.placeholder = 'PIN';
      pinInput.maxLength = 6;
      pinInput.onclick = (e) => e.stopPropagation();
      const unlockBtn = el('button', 'mini-pill-btn solid', 'Unlock');
      unlockBtn.type = 'button';
      unlockBtn.onclick = (e) => {
        e.stopPropagation();
        if (!activePeer) return;
        socket.emit('widget-interact', { peerId: activePeer.id, id: m.id, action: 'unlock', value: pinInput.value }, (res) => {
          if (res?.error) showToast(res.error);
          else showToast('🔓 Secret unlocked!');
        });
      };
      row.append(pinInput, unlockBtn);
      box.append(row);
    }
  } else if (w.kind === 'quiz') {
    box.append(el('div', 'ic-badge', '❓ DUO MINI-QUIZ'), el('div', 'ic-title', w.question));
    const answers = w.answers || {};
    const myAns = answers[cid];
    w.options.forEach((optText, idx) => {
      const isCorrect = idx === w.answerIdx;
      const pickedByMe = myAns === idx;
      let suffix = '';
      if (myAns !== undefined) {
        if (isCorrect) suffix = ' ✅';
        else if (pickedByMe) suffix = ' ❌';
      }
      const btn = el('button', 'poll-opt-btn' + (pickedByMe ? ' voted' : ''));
      btn.type = 'button';
      btn.append(el('span', 'poll-opt-label', optText + suffix));
      btn.onclick = (e) => {
        e.stopPropagation();
        if (!activePeer) return;
        socket.emit('widget-interact', { peerId: activePeer.id, id: m.id, action: 'answer', value: idx }, (res) => {
          if (res?.error) showToast(res.error);
          else showToast(idx === w.answerIdx ? '✦ Correct answer!' : '😅 Nice try!');
        });
      };
      box.append(btn);
    });
  }
  return box;
}

socket.on('widget-updated', ({ roomKey, id, widget }) => {
  if (roomKey !== activeRoomKey) return;
  const it = items[id];
  if (!it) return;
  it.m.widget = widget;
  const oldCard = it.el.querySelector('.interactive-card');
  const newCard = buildInteractiveWidget(it.m);
  if (oldCard) oldCard.replaceWith(newCard);
});
