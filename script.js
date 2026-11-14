// script.js - DuoChat v5 (Multi-Inbox Messenger, Friend Requests, Islamic & Modest Flat Vector Avatars, Real-time Mini-Games)
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

/* ---------- Minimalist Flat Vector Avatars (Islamic & Modest Faceless Collection) ---------- */
const AVATAR_NAMES = {
  female: [
    'Olive Hijab',
    'Dusty Rose',
    'Teal Drape',
    'Classic Black',
    'Navy Modest',
    'Niqab Pearl'
  ],
  male: [
    'White Thobe & Kufi',
    'Emerald Panjabi',
    'Red Ghutra & Agal',
    'Royal Navy Bisht',
    'Sunnah Amamah',
    'Olive & Keffiyeh'
  ]
};

function avatarArt(gender, variant = 0) {
  if (!gender) {
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#e2e8f0"/>
      <circle cx="50" cy="39" r="15" fill="#94a3b8"/>
      <path d="M22 100V80a28 28 0 0 1 56 0v20" fill="#94a3b8"/>
    </svg>`;
  }

  const n = Math.max(0, Math.min(5, Number(variant) || 0));
  const female = gender === 'female';

  if (female) {
    const bg = ['#e7efe8', '#f6e6ea', '#e1f0ef', '#e9ebf0', '#e4e8f3', '#efeae4'][n];
    const hijabMain = ['#5f7863', '#c88294', '#3d7d7a', '#242730', '#2d3f63', '#23262e'][n];
    const hijabShadow = ['#4c6250', '#b06b7d', '#2e6360', '#181a20', '#202e4a', '#16181e'][n];
    const abaya = ['#3a4a3d', '#8c5363', '#275452', '#171920', '#1e2b45', '#15171d'][n];
    const skin = ['#e8be9e', '#dfb08c', '#ecc5a7', '#d8a47f', '#e5ba98', '#dfb08c'][n];

    let svg = `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="${bg}"/>
      <path d="M18 100C19 77 32 69 50 69s31 8 32 31Z" fill="${abaya}"/>
      <path d="M26 46c0-17 10-29 24-29s24 12 24 29c0 17-6 31-24 35-18-4-24-18-24-35Z" fill="${hijabMain}"/>
      <path d="M28 58c6 12 18 19 36 17-6 8-15 12-23 12-10 0-16-9-13-29Z" fill="${hijabShadow}"/>
      <rect x="37" y="27" width="26" height="33" rx="13" fill="${skin}"/>
      <path d="M37 38c0-8 6-13 13-13s13 5 13 13c-3-4-8-6-13-6s-10 2-13 6Z" fill="${hijabShadow}"/>`;

    if (n === 5) {
      svg += `<path d="M37 42h26v6c0 7-6 12-13 12s-13-5-13-12Z" fill="${hijabMain}"/>
              <path d="M37 42h26" stroke="${hijabShadow}" stroke-width="1.8"/>`;
    }

    svg += `<path d="M40 72l10 11 10-11" fill="none" stroke="${hijabMain}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    return svg;
  } else {
    // 6 Refined Faceless Islamic Male Avatars (Rich Variety, Clean Flat Vector)
    const bg = ['#e4edf4', '#e3efe8', '#f5eae6', '#e7e9f5', '#f2ece2', '#e8efe6'][n];
    const skin = ['#e6b997', '#dca782', '#ecc3a3', '#d6a079', '#e3b490', '#deb08c'][n];
    const skinShade = ['#d5a582', '#c9936e', '#dbb08e', '#c28b64', '#d1a07c', '#cc9c78'][n];
    const beard = ['#262022', '#2d2527', '#211c1e', '#2f2729', '#251f21', '#2a2224'][n];

    // 0: Classic White Thobe & Embroidered Kufi
    if (n === 0) {
      return `<svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="50" fill="${bg}"/>
        <!-- Crisp White Thobe -->
        <path d="M18 100c2-22 14-30 32-30s30 8 32 30Z" fill="#ffffff"/>
        <path d="M43 70h14v24H43Z" fill="#f1f5f9"/>
        <line x1="50" y1="70" x2="50" y2="94" stroke="#cbd5e1" stroke-width="2"/>
        <circle cx="50" cy="77" r="1.4" fill="#94a3b8"/>
        <circle cx="50" cy="84" r="1.4" fill="#94a3b8"/>
        <!-- Neck & Faceless Head -->
        <rect x="44" y="55" width="12" height="16" rx="6" fill="${skinShade}"/>
        <rect x="36" y="25" width="28" height="35" rx="14" fill="${skin}"/>
        <!-- Full Neat Beard -->
        <path d="M36 43c0 11 6 17 14 17s14-6 14-17c-3 5-8 7-14 7s-11-2-14-7Z" fill="${beard}"/>
        <!-- White Prayer Kufi with Subtle Geometric Band -->
        <path d="M36 31c0-9 6-14 14-14s14 5 14 14Z" fill="#ffffff"/>
        <rect x="36" y="28" width="28" height="3.5" fill="#e2e8f0"/>
        <path d="M38 29.8h24" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="2 2"/>
      </svg>`;
    }

    // 1: Emerald Green Panjabi & Gold-Trimmed Kufi
    if (n === 1) {
      return `<svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="50" fill="${bg}"/>
        <!-- Emerald Panjabi -->
        <path d="M18 100c2-22 14-30 32-30s30 8 32 30Z" fill="#235c47"/>
        <!-- Golden Placket Embroidery -->
        <path d="M44 70h12v23H44Z" fill="#1b4737"/>
        <path d="M44 70v23M56 70v23M50 70v23" stroke="#d4af37" stroke-width="1.4"/>
        <path d="M42 70q8 6 16 0" fill="none" stroke="#d4af37" stroke-width="2.2" stroke-linecap="round"/>
        <!-- Neck & Faceless Head -->
        <rect x="44" y="55" width="12" height="16" rx="6" fill="${skinShade}"/>
        <rect x="36" y="25" width="28" height="35" rx="14" fill="${skin}"/>
        <!-- Full Neat Beard -->
        <path d="M36 43c0 11 6 17 14 17s14-6 14-17c-3 5-8 7-14 7s-11-2-14-7Z" fill="${beard}"/>
        <!-- Emerald & Gold Kufi -->
        <path d="M36 31c0-9 6-14 14-14s14 5 14 14Z" fill="#1b4737"/>
        <rect x="36" y="28" width="28" height="3" fill="#d4af37"/>
      </svg>`;
    }

    // 2: Traditional Red & White Shemagh / Ghutra with Black Agal
    if (n === 2) {
      return `<svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="50" fill="${bg}"/>
        <!-- Dark Slate Thobe Underlay -->
        <path d="M18 100c2-22 14-30 32-30s30 8 32 30Z" fill="#28303d"/>
        <!-- Flowing Red-Patterned Ghutra -->
        <path d="M26 42c0-16 10-26 24-26s24 10 24 26l5 44H21Z" fill="#ffffff"/>
        <path d="M27 33h46M25 40h50M23 48h54" stroke="#c53030" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.72"/>
        <!-- Faceless Head -->
        <rect x="37" y="28" width="26" height="32" rx="13" fill="${skin}"/>
        <path d="M37 45c0 9 6 15 13 15s13-6 13-15c-3 4-7 6-13 6s-10-2-13-6Z" fill="${beard}"/>
        <!-- Double Black Agal Cord -->
        <rect x="32" y="21" width="36" height="3.2" rx="1.6" fill="#18191f"/>
        <rect x="32" y="25" width="36" height="3.2" rx="1.6" fill="#18191f"/>
      </svg>`;
    }

    // 3: Royal Navy Bisht Cloak with Gold Trim & White Kufi
    if (n === 3) {
      return `<svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="50" fill="${bg}"/>
        <!-- Inner Cream Thobe -->
        <path d="M22 100c2-21 13-29 28-29s26 8 28 29Z" fill="#f8fafc"/>
        <!-- Royal Navy Bisht Outer Cloak -->
        <path d="M17 100c2-22 12-30 25-30l8 30H17Zm66 0c-2-22-12-30-25-30l-8 30h33Z" fill="#1e293b"/>
        <!-- Gold Zari Bisht Borders -->
        <path d="M42 70l8 30M58 70l-8 30" stroke="#eab308" stroke-width="2.4"/>
        <!-- Neck & Faceless Head -->
        <rect x="44" y="55" width="12" height="16" rx="6" fill="${skinShade}"/>
        <rect x="36" y="25" width="28" height="35" rx="14" fill="${skin}"/>
        <path d="M36 43c0 11 6 17 14 17s14-6 14-17c-3 5-8 7-14 7s-11-2-14-7Z" fill="${beard}"/>
        <!-- Crisp White Kufi -->
        <path d="M36 31c0-9 6-14 14-14s14 5 14 14Z" fill="#ffffff"/>
        <line x1="36" y1="31" x2="64" y2="31" stroke="#cbd5e1" stroke-width="2"/>
      </svg>`;
    }

    // 4: Sunnah Amamah (Wrapped Turban) & Warm Sand Jubbah
    if (n === 4) {
      return `<svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="50" fill="${bg}"/>
        <!-- Warm Sand / Cream Jubbah -->
        <path d="M18 100c2-22 14-30 32-30s30 8 32 30Z" fill="#7c5e42"/>
        <path d="M43 70q7 7 14 0" fill="none" stroke="#f5ebe0" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="50" y1="73" x2="50" y2="93" stroke="#f5ebe0" stroke-width="2"/>
        <!-- Neck & Faceless Head -->
        <rect x="44" y="55" width="12" height="16" rx="6" fill="${skinShade}"/>
        <rect x="36" y="27" width="28" height="33" rx="14" fill="${skin}"/>
        <path d="M36 44c0 10 6 16 14 16s14-6 14-16c-3 5-8 7-14 7s-11-2-14-7Z" fill="${beard}"/>
        <!-- Layered Wrapped Turban (Amamah) -->
        <path d="M30 32c0-13 9-20 20-20s20 7 20 20c-6-4-13-5-20-5s-14 1-20 5Z" fill="#f8f5f0"/>
        <path d="M31 25c12 5 26 5 38 0M32 30c12-4 24-4 36 0" fill="none" stroke="#d6ccc2" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    }

    // 5: Olive Panjabi with Draped Palestinian Keffiyeh Scarf & Kufi
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="${bg}"/>
      <!-- Deep Olive Panjabi -->
      <path d="M18 100c2-22 14-30 32-30s30 8 32 30Z" fill="#3f5243"/>
      <!-- Draped Black & White Keffiyeh Scarf -->
      <path d="M35 70l7 30h-8l-5-26Zm30 0l-7 30h8l5-26Z" fill="#ffffff"/>
      <path d="M33 76h6M34 83h6M35 90h6M61 76h6M60 83h6M59 90h6" stroke="#1e2028" stroke-width="1.6" stroke-dasharray="2 2"/>
      <!-- Neck & Faceless Head -->
      <rect x="44" y="55" width="12" height="16" rx="6" fill="${skinShade}"/>
      <rect x="36" y="25" width="28" height="35" rx="14" fill="${skin}"/>
      <path d="M36 43c0 11 6 17 14 17s14-6 14-17c-3 5-8 7-14 7s-11-2-14-7Z" fill="${beard}"/>
      <!-- Charcoal & White Kufi -->
      <path d="M36 31c0-9 6-14 14-14s14 5 14 14Z" fill="#2c3531"/>
      <rect x="36" y="28" width="28" height="3" fill="#cbd5e1"/>
    </svg>`;
  }
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
$('moodMenu').querySelectorAll('button').forEach((btn) => {
  btn.onclick = () => {
    myMood = btn.dataset.mood;
    $('moodBtn').classList.toggle('active-symbol', !!myMood);
    socket.emit('mood', myMood);
    showToast(myMood ? `Mood set to ${myMood}` : 'Mood cleared');
  };
});

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
    const acceptBtn = el('button', 'mini-pill-btn solid', 'Accept');
    acceptBtn.onclick = () => {
      socket.emit('friend-accept', u.id, (res) => {
        if (res.error) return showToast(res.error);
        inboxData = res.inbox;
        renderSidebar();
        showToast(`You and ${u.name} are now friends!`);
      });
    };
    const declineBtn = el('button', 'mini-pill-btn decline', 'Decline');
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
      const chatBtn = el('button', 'mini-pill-btn', 'Chat');
      chatBtn.onclick = () => {
        $('clearSearchBtn').click();
        openConversation(u.id);
      };
      acts.append(chatBtn);
    } else if (u.relation === 'incoming') {
      const accBtn = el('button', 'mini-pill-btn solid', 'Accept');
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
      const pendBtn = el('button', 'mini-pill-btn', 'Requested');
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
      const addBtn = el('button', 'mini-pill-btn solid', '+ Add');
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
  if (mood) {
    badge.textContent = mood;
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
  showToast(`👋 ${from.name} (@${from.username}) sent you a friend request!`);
});

socket.on('friend-accepted', ({ by }) => {
  beep(880);
  showToast(`🎉 ${by.name} accepted your friend request!`);
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
    activePeer.online = online;
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

socket.on('nudge', ({ fromId, fromName }) => {
  beep(620);
  showToast(`🔔 ${fromName} nudged you!`);
  if (activePeer && activePeer.id === fromId) {
    triggerShake();
  }
});

$('nudgeBtn').onclick = () => {
  if (!activePeer) return;
  socket.emit('nudge', { peerId: activePeer.id });
  triggerShake();
  showToast(`🔔 You nudged ${activePeer.name}!`);
};

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
const TICKS = { sending: '🕒', sent: '✓', delivered: '✓✓', seen: '✓✓' };
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
  ['❤️', '😂', '👍', '😮', '😢', '🔥', '🤲'].forEach((emo) => {
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
    const sb = el('div', 'spoiler-badge', '👁️‍🗨️ Tap to reveal spoiler');
    d.append(sb);
    d.onclick = (e) => {
      if (e.target.closest('button')) return;
      d.classList.toggle('revealed');
      sb.textContent = d.classList.contains('revealed') ? '👁️ Spoiler revealed' : '👁️‍🗨️ Tap to reveal spoiler';
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
    d.append(buildVoicePlayer(m.audio, m.audioDuration || 0));
  }

  if (m.text) d.append(el('div', 'txt', m.text));

  const meta = el('div', 'meta');
  if (m.vanish) {
    meta.append(el('span', 'vanish-indicator', '⏱️ 10s'));
  }

  const rb = el('button', 'act-btn');
  rb.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';
  rb.title = 'Reply';
  rb.onclick = (e) => {
    e.stopPropagation();
    setReply({ name: m.name, text: m.spoiler ? '🔒 Spoiler message' : m.audio ? '🎤 Voice message' : m.text || '📷 Photo' });
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

  render({ ...m, from: cid, name: currentAccount.name, time: now, status: 'sending' });
  updateSidebarPreview(activePeer.id, spoilerMode ? '🔒 Spoiler message' : image ? '📷 Photo' : text, now, true, false);

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
    m.spoiler ? '🔒 Spoiler message' : m.audio ? '🎤 Voice message' : m.image ? '📷 Photo' : m.text,
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
    showToast(`💬 ${m.name}: ${m.spoiler ? 'Spoiler message' : m.audio ? 'Sent a voice message' : m.image ? 'Sent a photo' : m.text.slice(0, 40)}`);
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

function buildVoicePlayer(audioSrc, initialDuration) {
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

  const metaRow = el('div', 'voice-meta-row');
  const timeLbl = el('span', '', fmtDuration(initialDuration));
  const tagLbl = el('span', '', '🎤 Voice');
  metaRow.append(timeLbl, tagLbl);

  waveWrap.append(barsRow, metaRow);
  wrap.append(playBtn, waveWrap);

  const audioObj = new Audio(audioSrc);
  audioObj.preload = 'metadata';

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
  const now = Date.now();
  const m = {
    id: cid.slice(0, 6) + rnd(),
    to: activePeer.id,
    text: '',
    image: null,
    audio: audioDataUrl,
    audioDuration: Math.max(1, Math.round(durationSec)),
    reply: replyTo,
    vanish: vanishMode,
    spoiler: spoilerMode
  };

  render({ ...m, from: cid, name: currentAccount.name, time: now, status: 'sending' });
  updateSidebarPreview(activePeer.id, spoilerMode ? '🔒 Spoiler message' : '🎤 Voice message', now, true, false);

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

Array.from('😀😁😂🤣😊😍😘😎🤔😅😭😡🥳😴🤗🙄😉😇🥺😢🤲👍👎👏🙌🙏💪👋🤝❤️💔🔥✨🎉🎂🍕☕🌹⭐💯✅❌👀🚀🌙☀️🎵').forEach(
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
    rps: '✊ Rock Paper Scissors',
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
      const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
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
      ['rock', '✊', 'Rock'],
      ['paper', '✋', 'Paper'],
      ['scissors', '✌️', 'Scissors']
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
        el('div', 'game-prompt', g.matchWinner === cid ? '🏆 You won the match!' : `🏆 ${peerLabel} won the match!`)
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
function beep(freq = 880) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.07, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.22);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.22);
  } catch (e) {}
}

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
  for (let i = 0; i < 6; i++) {
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
  $('createRoomSubTab').classList.toggle('primary-action', sub === 'create');
  $('joinRoomSubTab').classList.toggle('primary-action', sub === 'join');
  $('createRoomBox').classList.toggle('hidden', sub !== 'create');
  $('joinRoomBox').classList.toggle('hidden', sub !== 'join');
  $('joinRoomCodeInput').required = authMode === 'room' && sub === 'join';
  $('authSubmit').textContent = sub === 'create' ? 'Create & Enter Room' : 'Join Room';
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

  // Bottom Facebook-style toggle footer
  if (mode === 'register') {
    $('authSwitchPrompt').textContent = 'Already have an account?';
    $('registerTab').textContent = 'Sign in to account';
  } else {
    $('authSwitchPrompt').textContent = "Don't have an account?";
    $('registerTab').textContent = 'Create new account';
  }

  if (mode === 'login') {
    $('authSubmit').textContent = 'Sign in';
    $('password').autocomplete = 'current-password';
  } else if (mode === 'register') {
    $('authSubmit').textContent = 'Create account';
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
  showToast(`🎉 ${peer.name} joined the room!`);
  updatePeerMood(peer.mood || '');
  updateChatHeader();
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
