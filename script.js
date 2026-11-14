const $ = id => document.getElementById(id);
const socket = io({ autoConnect: false });

const state = {
  token: sessionStorage.getItem('dc_token') || '',
  mode: 'login',
  roomSubMode: 'create',
  generatedRoomCode: '',
  isRoomSession: false,
  activeRoomCode: '',
  user: null,
  avatar: 'brother-1',
  avatarGroup: 'male',
  friends: [],
  requests: [],
  activeFriend: null,
  messages: [],
  replyTo: null,
  vanish: false,
  spoiler: false,
  typingTimer: null,
  activeGame: null,
  weather: 'clear',
  myMood: '',
  myAura: '',
  voiceRecorder: null,
  voiceStream: null,
  voiceChunks: [],
  voiceSeconds: 0,
  voiceTimer: null,
  hbHoldTimer: null,
  hbActive: false
};

// Clean SVG Symbol Maps (Zero emojis in UI controls, moods, weather, or games)
const MOOD_ICONS = {
  'Chilling': '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg>',
  'Studying': '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  'Coffee': '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>',
  'Vibing': '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  'Dua & Peace': '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  'Busy': '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  'Affectionate': '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
};

const WEATHER_ICONS = {
  clear: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2m-13.66 5.66-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  rain: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6M8 14v6M12 16v6"/></svg>',
  storm: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>',
  snow: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4M4 8l4 4-4 4"/></svg>',
  stars: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  petals: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/></svg>'
};

const GAME_SVGS = {
  tictactoe: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="10" y2="10"/><line x1="10" y1="4" x2="4" y2="10"/><circle cx="17" cy="17" r="3.5"/><line x1="12" y1="3" x2="12" y2="21" opacity="0.35"/><line x1="3" y1="12" x2="21" y2="12" opacity="0.35"/></svg>',
  rps: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  connect4: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="3" fill="currentColor" fill-opacity="0.25"/><circle cx="17" cy="8" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3" fill="currentColor" fill-opacity="0.25"/></svg>'
};

const RPS_SVGS = {
  rock: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
  paper: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="12" y1="1" x2="12" y2="4"/></svg>',
  scissors: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>'
};

const AVATARS = {
  'brother-1': { group: 'male', label: 'Brother 1', bg: ['#1d4ed8', '#38bdf8'], skin: '#f1c27d', hair: '#1e293b', beard: true, kufi: '#f8fafc', shirt: '#0f172a' },
  'brother-2': { group: 'male', label: 'Brother 2', bg: ['#0f766e', '#2dd4bf'], skin: '#d99b66', hair: '#0f172a', beard: true, kufi: '#e2e8f0', shirt: '#134e4a' },
  'brother-3': { group: 'male', label: 'Brother 3', bg: ['#4338ca', '#818cf8'], skin: '#f6d2a2', hair: '#334155', beard: false, kufi: '', shirt: '#1e1b4b' },
  'brother-4': { group: 'male', label: 'Brother 4', bg: ['#0369a1', '#7dd3fc'], skin: '#c68642', hair: '#111827', beard: true, kufi: '#fef3c7', shirt: '#1e293b' },
  'sister-1': { group: 'female', label: 'Sister 1', bg: ['#be185d', '#f472b6'], skin: '#f7d5b1', hijab: '#fdf2f8', hijabTrim: '#f9a8d4', shirt: '#831843' },
  'sister-2': { group: 'female', label: 'Sister 2', bg: ['#6d28d9', '#c084fc'], skin: '#e8b48a', hijab: '#ede9fe', hijabTrim: '#c4b5fd', shirt: '#4c1d95' },
  'sister-3': { group: 'female', label: 'Sister 3', bg: ['#0f766e', '#5eead4'], skin: '#f3c697', hijab: '#ecfeff', hijabTrim: '#99f6e4', shirt: '#115e59' },
  'sister-4': { group: 'female', label: 'Sister 4', bg: ['#b45309', '#fbbf24'], skin: '#d59663', hijab: '#fffbeb', hijabTrim: '#fde68a', shirt: '#78350f' }
};

const EMOJIS = [
  '❤️','🥰','😍','😘','🥺','😭','😂','🤣','😊','😉','😎','🥳','🤗','🤔','😴','😡',
  '👍','👏','🙌','🤝','🙏','🫶','✌️','🤞','💪','🎉','✨','💫','🔥','💯','🌹','🌸',
  '☕','🍕','🍔','🍟','🍫','🍰','🍓','🍉','🌙','⭐','🌈','☀️','🌧️','🎵','🎮','🏆'
];

const REACTS = ['❤️','😂','😮','😢','👍','😡'];

const escapeHtml = s => String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

function avatarSvg(id) {
  const a = AVATARS[id] || AVATARS['brother-1'];
  const uid = `${id}-${Math.random().toString(36).slice(2, 6)}`;
  if (a.group === 'female') {
    return `<svg viewBox="0 0 80 80" aria-label="${a.label}">
      <defs><linearGradient id="g-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a.bg[0]}"/><stop offset="100%" stop-color="${a.bg[1]}"/></linearGradient></defs>
      <rect width="80" height="80" rx="22" fill="url(#g-${uid})"/>
      <path d="M16 74c2-16 12-23 24-23s22 7 24 23" fill="${a.shirt}"/>
      <path d="M21 39c0-14 8-23 19-23s19 9 19 23c0 13-5 24-19 27-14-3-19-14-19-27Z" fill="${a.hijab}" stroke="${a.hijabTrim}" stroke-width="2"/>
      <ellipse cx="40" cy="40" rx="12.5" ry="14.5" fill="${a.skin}"/>
      <path d="M27.5 36c3-7 22-7 25 0-3-10-22-10-25 0Z" fill="${a.hijabTrim}"/>
      <circle cx="35.5" cy="39" r="1.6" fill="#1e293b"/><circle cx="44.5" cy="39" r="1.6" fill="#1e293b"/>
      <path d="M36.5 45.5c2.2 2 4.8 2 7 0" stroke="#9f1239" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 80 80" aria-label="${a.label}">
    <defs><linearGradient id="g-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a.bg[0]}"/><stop offset="100%" stop-color="${a.bg[1]}"/></linearGradient></defs>
    <rect width="80" height="80" rx="22" fill="url(#g-${uid})"/>
    <path d="M16 74c3-15 12-21 24-21s21 6 24 21" fill="${a.shirt}"/>
    <rect x="35" y="48" width="10" height="9" rx="4" fill="${a.skin}"/>
    <ellipse cx="40" cy="38" rx="13" ry="15" fill="${a.skin}"/>
    <path d="M27 34c0-9 6-14 13-14s13 5 13 14c-3-4-23-4-26 0Z" fill="${a.hair}"/>
    ${a.kufi ? `<path d="M28 28c2-7 22-7 24 0v3H28v-3Z" fill="${a.kufi}"/>` : ''}
    ${a.beard ? `<path d="M28 40c1 10 6 14 12 14s11-4 12-14c-3 4-6 5-12 5s-9-1-12-5Z" fill="${a.hair}" opacity=".9"/>` : ''}
    <circle cx="35.5" cy="37.5" r="1.6" fill="#1e293b"/><circle cx="44.5" cy="37.5" r="1.6" fill="#1e293b"/>
    <path d="M36.5 44c2.2 1.8 4.8 1.8 7 0" stroke="#7c2d12" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  </svg>`;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  state.generatedRoomCode = code;
  if ($('generatedRoomCode')) $('generatedRoomCode').textContent = code;
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add('hidden'), 2600);
}

function triggerBlast(emoji) {
  const overlay = $('fxOverlay');
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('span');
    p.className = 'fx-particle';
    p.textContent = emoji;
    p.style.left = `${10 + Math.random() * 80}%`;
    p.style.bottom = `${10 + Math.random() * 20}%`;
    p.style.animationDelay = `${Math.random() * 0.35}s`;
    overlay.appendChild(p);
    setTimeout(() => p.remove(), 1900);
  }
}

/* =========================================================
   WEB AUDIO ENGINE (Voice Morphing Only: Normal, Female, Old, Baby)
   ========================================================= */
let sharedAudioCtx = null;
function getAudioCtx() {
  if (!sharedAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

async function applyVoiceMorphFilter(blob, effect) {
  if (!effect || effect === 'normal') return blob;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return blob;
    const arrayBuf = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);

    // Pitch & tempo multipliers for Female, Old, and Baby voices
    let rate = 1.0;
    if (effect === 'female') rate = 1.24;     // Higher bright feminine pitch
    else if (effect === 'old') rate = 0.84;   // Deeper slower elderly timbre
    else if (effect === 'baby') rate = 1.48;  // High playful baby voice

    const outLength = Math.max(1, Math.floor(audioBuf.length / rate));
    const offline = new OfflineAudioContext(audioBuf.numberOfChannels, outLength, audioBuf.sampleRate);

    const src = offline.createBufferSource();
    src.buffer = audioBuf;
    src.playbackRate.value = rate;

    if (effect === 'female') {
      const highShelf = offline.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 1800;
      highShelf.gain.value = 5;
      src.connect(highShelf);
      highShelf.connect(offline.destination);
    } else if (effect === 'old') {
      const bandpass = offline.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 950;
      bandpass.Q.value = 0.9;
      src.connect(bandpass);
      bandpass.connect(offline.destination);
    } else if (effect === 'baby') {
      const treble = offline.createBiquadFilter();
      treble.type = 'peaking';
      treble.frequency.value = 2400;
      treble.gain.value = 6;
      src.connect(treble);
      treble.connect(offline.destination);
    } else {
      src.connect(offline.destination);
    }

    src.start(0);
    const rendered = await offline.startRendering();
    return audioBufferToWavBlob(rendered);
  } catch (e) {
    return blob;
  }
}

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/* =========================================================
   LIVE WEATHER CANVAS ENGINE
   ========================================================= */
let weatherParticles = [];
let lightningAlpha = 0;
function setWeather(type, broadcast = false) {
  state.weather = type || 'clear';
  $('weatherIcon').innerHTML = WEATHER_ICONS[state.weather] || WEATHER_ICONS.clear;
  const canvas = $('weatherCanvas');
  if (!canvas) return;
  const w = canvas.width = canvas.offsetWidth || 400;
  const h = canvas.height = canvas.offsetHeight || 600;
  weatherParticles = [];

  if (state.weather === 'rain' || state.weather === 'storm') {
    const count = state.weather === 'storm' ? 95 : 55;
    for (let i = 0; i < count; i++) {
      weatherParticles.push({ x: Math.random() * w, y: Math.random() * h, l: 12 + Math.random() * 14, v: 9 + Math.random() * 7 });
    }
  } else if (state.weather === 'snow') {
    for (let i = 0; i < 50; i++) {
      weatherParticles.push({ x: Math.random() * w, y: Math.random() * h, r: 1.5 + Math.random() * 2.5, v: 1 + Math.random() * 1.5, d: Math.random() * Math.PI * 2 });
    }
  } else if (state.weather === 'stars') {
    for (let i = 0; i < 45; i++) {
      weatherParticles.push({ x: Math.random() * w, y: Math.random() * h * 0.75, r: 0.8 + Math.random() * 1.6, a: Math.random(), s: 0.02 + Math.random() * 0.03 });
    }
  } else if (state.weather === 'petals') {
    for (let i = 0; i < 28; i++) {
      weatherParticles.push({ x: Math.random() * w, y: Math.random() * h, r: 3 + Math.random() * 3, v: 1.1 + Math.random() * 1.2, d: Math.random() * 6 });
    }
  }

  if (broadcast && state.activeFriend) {
    socket.emit('chat:weather', { to: state.activeFriend.username, weather: state.weather });
  }
}

function startWeatherLoop() {
  const canvas = $('weatherCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  function frame() {
    if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (state.weather === 'rain' || state.weather === 'storm') {
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const p of weatherParticles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 2, p.y + p.l);
        p.x -= 1.2;
        p.y += p.v;
        if (p.y > h) { p.y = -20; p.x = Math.random() * w; }
      }
      ctx.stroke();

      if (state.weather === 'storm') {
        if (Math.random() < 0.008) lightningAlpha = 0.28;
        if (lightningAlpha > 0) {
          ctx.fillStyle = `rgba(224, 242, 254, ${lightningAlpha})`;
          ctx.fillRect(0, 0, w, h);
          lightningAlpha -= 0.025;
        }
      }
    } else if (state.weather === 'snow') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      for (const p of weatherParticles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.d += 0.02;
        p.x += Math.sin(p.d) * 0.6;
        p.y += p.v;
        if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
      }
    } else if (state.weather === 'stars') {
      for (const p of weatherParticles) {
        p.a += p.s;
        const alpha = 0.25 + Math.abs(Math.sin(p.a)) * 0.75;
        ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (state.weather === 'petals') {
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      for (const p of weatherParticles) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, p.d, 0, Math.PI * 2);
        ctx.fill();
        p.d += 0.03;
        p.x += Math.sin(p.d) * 1.1;
        p.y += p.v;
        if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* =========================================================
   LIVE HEARTBEAT PULSE ENGINE
   ========================================================= */
function triggerHeartbeatPulse(isSender = false) {
  const overlay = $('heartbeatOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  $('heartbeatBtn')?.classList.add('active');
  if (navigator.vibrate) {
    try { navigator.vibrate([70, 50, 110]); } catch (e) {}
  }
  clearTimeout(triggerHeartbeatPulse.t);
  triggerHeartbeatPulse.t = setTimeout(() => {
    overlay.classList.add('hidden');
    $('heartbeatBtn')?.classList.remove('active');
  }, 1450);

  if (isSender && state.activeFriend) {
    socket.emit('chat:heartbeat', { to: state.activeFriend.username });
  }
}

/* =========================================================
   AUTHENTICATION & QUICK ROOMS
   ========================================================= */
function renderAvatarGallery() {
  const ids = Object.keys(AVATARS).filter(id => AVATARS[id].group === state.avatarGroup);
  if (!ids.includes(state.avatar)) state.avatar = ids[0];
  $('avatarGallery').innerHTML = ids.map(id => `
    <button type="button" class="avatar-choice ${state.avatar === id ? 'selected' : ''}" data-avatar="${id}" title="${AVATARS[id].label}">
      ${avatarSvg(id)}
    </button>
  `).join('');
  $('maleAvatars').classList.toggle('primary-action', state.avatarGroup === 'male');
  $('femaleAvatars').classList.toggle('primary-action', state.avatarGroup === 'female');
}

function setAuthMode(mode) {
  state.mode = mode;
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isRoom = mode === 'room';

  $('loginTab').classList.toggle('primary-action', isLogin || isRegister);
  $('roomTab').classList.toggle('primary-action', isRoom);

  $('accountAuthFields').classList.toggle('hidden', isRoom);
  $('roomModeFields').classList.toggle('hidden', !isRoom);
  $('profileSetupFields').classList.toggle('hidden', isLogin);
  $('authSwitchFooter').classList.toggle('hidden', isRoom);

  $('username').required = !isRoom;
  $('password').required = !isRoom;
  $('accountName').required = isRegister || isRoom;

  if (isLogin) {
    $('authDescription').textContent = 'Sign in to access your friends & private conversations.';
    $('password').autocomplete = 'current-password';
    $('authSubmitText').textContent = 'Sign in';
    $('authSwitchPrompt').textContent = "Don't have an account?";
    $('registerTabText').textContent = 'Create new account';
    $('registerTab').classList.remove('active-register');
  } else if (isRegister) {
    $('authDescription').textContent = 'Create your account and pick a minimalist portrait.';
    $('password').autocomplete = 'new-password';
    $('accountName').placeholder = 'Display name (e.g. Ahmad)';
    $('authSubmitText').textContent = 'Create account';
    $('authSwitchPrompt').textContent = 'Already have an account?';
    $('registerTabText').textContent = 'Back to Sign in';
    $('registerTab').classList.add('active-register');
    renderAvatarGallery();
  } else {
    $('authDescription').textContent = 'Create or join a private room instantly using a 6-digit code.';
    $('accountName').placeholder = 'Your nickname in room';
    setRoomSubMode(state.roomSubMode);
    renderAvatarGallery();
  }
  $('authError').textContent = '';
}

function setRoomSubMode(sub) {
  state.roomSubMode = sub;
  const isCreate = sub === 'create';
  $('createRoomSubTab').classList.toggle('active', isCreate);
  $('joinRoomSubTab').classList.toggle('active', !isCreate);
  $('createRoomBox').classList.toggle('hidden', !isCreate);
  $('joinRoomBox').classList.toggle('hidden', isCreate);
  $('joinRoomCodeInput').required = !isCreate && state.mode === 'room';

  if (isCreate) {
    if (!state.generatedRoomCode) generateRoomCode();
    $('authSubmitText').textContent = 'Create & Enter Room';
  } else {
    $('authSubmitText').textContent = 'Join Room';
  }
}

async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

$('loginTab').onclick = () => setAuthMode('login');
$('registerTab').onclick = () => setAuthMode(state.mode === 'register' ? 'login' : 'register');
$('roomTab').onclick = () => setAuthMode('room');
$('createRoomSubTab').onclick = () => setRoomSubMode('create');
$('joinRoomSubTab').onclick = () => setRoomSubMode('join');

$('regenRoomCodeBtn').onclick = () => {
  generateRoomCode();
  toast('New room code generated');
};

$('copyRoomCodeBtn').onclick = async () => {
  try {
    await navigator.clipboard.writeText(state.generatedRoomCode);
    toast(`Room code ${state.generatedRoomCode} copied`);
  } catch (e) {
    toast(`Room code: ${state.generatedRoomCode}`);
  }
};

$('maleAvatars').onclick = () => { state.avatarGroup = 'male'; renderAvatarGallery(); };
$('femaleAvatars').onclick = () => { state.avatarGroup = 'female'; renderAvatarGallery(); };
$('avatarGallery').onclick = e => {
  const btn = e.target.closest('[data-avatar]');
  if (btn) {
    state.avatar = btn.dataset.avatar;
    renderAvatarGallery();
  }
};

$('authForm').onsubmit = async e => {
  e.preventDefault();
  $('authError').textContent = '';
  try {
    if (state.mode === 'room') {
      const displayName = $('accountName').value.trim();
      if (!displayName) throw new Error('Please enter your nickname.');
      const code = state.roomSubMode === 'create'
        ? state.generatedRoomCode
        : $('joinRoomCodeInput').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Enter a valid 6-character room code.');

      const guestId = 'guest_' + Math.random().toString(36).slice(2, 8);
      state.isRoomSession = true;
      state.activeRoomCode = code;
      state.user = { username: guestId, name: displayName, avatar: state.avatar, isGuest: true };
      enterQuickRoomWorkspace();
      return;
    }

    const payload = {
      username: $('username').value.trim(),
      password: $('password').value,
      name: $('accountName').value.trim(),
      avatar: state.avatar
    };
    const data = await api(`/api/${state.mode}`, { method: 'POST', body: JSON.stringify(payload) });
    state.isRoomSession = false;
    state.token = data.token;
    state.user = data.user;
    sessionStorage.setItem('dc_token', data.token);
    enterMessenger();
  } catch (err) {
    $('authError').textContent = err.message;
  }
};

function enterQuickRoomWorkspace() {
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');

  $('sidebarMyAvatar').innerHTML = avatarSvg(state.user.avatar);
  $('sidebarMyName').textContent = state.user.name;
  $('sidebarMyHandle').textContent = `Room ${state.activeRoomCode}`;

  $('activeRoomCodeBadge').classList.remove('hidden');
  $('activeRoomCodeText').textContent = `ROOM: ${state.activeRoomCode}`;
  $('leaveRoomBtn').classList.remove('hidden');

  state.friends = [];
  state.requests = [];
  const waitingPeer = {
    username: `room:${state.activeRoomCode}`,
    name: `Room ${state.activeRoomCode}`,
    avatar: state.avatar === 'brother-1' ? 'sister-1' : 'brother-1',
    online: false,
    isRoomChannel: true
  };
  state.activeFriend = waitingPeer;
  state.messages = [];

  renderInbox();
  openConversation(waitingPeer);

  socket.auth = {
    roomCode: state.activeRoomCode,
    guestUser: state.user
  };
  socket.connect();
}

async function enterMessenger() {
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('activeRoomCodeBadge').classList.add('hidden');
  $('leaveRoomBtn').classList.add('hidden');

  $('sidebarMyAvatar').innerHTML = avatarSvg(state.user.avatar);
  $('sidebarMyName').textContent = state.user.name;
  $('sidebarMyHandle').textContent = `@${state.user.username}`;

  socket.auth = { token: state.token };
  socket.connect();
  await refreshInbox();
}

async function refreshInbox() {
  if (state.isRoomSession) return;
  try {
    const data = await api('/api/inbox');
    state.friends = data.friends || [];
    state.requests = data.requests || [];
    renderRequests();
    renderInbox();

    if (state.activeFriend) {
      const updated = state.friends.find(f => f.username === state.activeFriend.username);
      if (updated) {
        state.activeFriend = updated;
        updateActiveHeader();
      }
    }
  } catch (e) {}
}

function renderRequests() {
  const sec = $('requestsSection');
  const list = $('requestsList');
  if (!state.requests.length) {
    sec.classList.add('hidden');
    return;
  }
  sec.classList.remove('hidden');
  $('requestCountBadge').textContent = state.requests.length;
  list.innerHTML = state.requests.map(r => `
    <div class="user-row">
      <div class="avatar sm">${avatarSvg(r.avatar)}</div>
      <div class="user-row-info">
        <div class="user-row-top"><b>${escapeHtml(r.name)}</b></div>
        <div class="user-row-sub"><span>@${escapeHtml(r.username)}</span></div>
      </div>
      <div class="row-actions">
        <button class="mini-pill-btn solid" data-accept="${escapeHtml(r.username)}">Accept</button>
        <button class="mini-pill-btn decline" data-decline="${escapeHtml(r.username)}" aria-label="Decline">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function renderInbox() {
  const list = $('inboxList');
  if (state.isRoomSession) {
    $('friendCountLabel').textContent = '1';
    const f = state.activeFriend;
    list.innerHTML = `
      <button class="user-row active" data-open-chat="${escapeHtml(f.username)}">
        <div class="avatar-wrap">
          <div class="avatar sm">${avatarSvg(f.avatar)}</div>
          <span class="online-dot ${f.online ? 'on' : ''}"></span>
        </div>
        <div class="user-row-info">
          <div class="user-row-top">
            <b>${escapeHtml(f.name)}</b>
            <small>Code: ${state.activeRoomCode}</small>
          </div>
          <div class="user-row-sub">
            <span>${f.online ? 'Partner connected in room' : 'Waiting for partner to join…'}</span>
          </div>
        </div>
      </button>
    `;
    return;
  }

  $('friendCountLabel').textContent = state.friends.length;
  if (!state.friends.length) {
    list.innerHTML = `<div class="empty-list-note">No friends yet.<br>Search a username above to send a friend request.</div>`;
    return;
  }
  list.innerHTML = state.friends.map(f => {
    const active = state.activeFriend && state.activeFriend.username === f.username;
    const preview = f.lastMessage
      ? (f.lastMessage.sender === state.user.username ? `You: ${f.lastMessage.preview}` : f.lastMessage.preview)
      : `@${f.username}`;
    const timeStr = f.lastMessage ? formatTime(f.lastMessage.at) : '';
    return `
      <button class="user-row ${active ? 'active' : ''}" data-open-chat="${escapeHtml(f.username)}">
        <div class="avatar-wrap aura-ring-wrap" ${f.aura ? `data-aura="${escapeHtml(f.aura)}"` : ''}>
          <div class="avatar sm">${avatarSvg(f.avatar)}</div>
          <span class="online-dot ${f.online ? 'on' : ''}"></span>
        </div>
        <div class="user-row-info">
          <div class="user-row-top">
            <b>${escapeHtml(f.name)}</b>
            <small>${timeStr}</small>
          </div>
          <div class="user-row-sub">
            <span>${escapeHtml(preview)}</span>
            ${f.unread > 0 ? `<span class="unread-pill">${f.unread}</span>` : ''}
          </div>
        </div>
      </button>
    `;
  }).join('');
}

let searchDebounce = null;
$('userSearchInput').oninput = () => {
  const q = $('userSearchInput').value.trim();
  $('clearSearchBtn').classList.toggle('hidden', !q);
  clearTimeout(searchDebounce);
  if (!q) {
    $('searchResultsBox').classList.add('hidden');
    return;
  }
  if (state.isRoomSession) {
    toast('Friend search is available when signed in with an account');
    return;
  }
  searchDebounce = setTimeout(async () => {
    try {
      const data = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(data.users || []);
    } catch (e) {}
  }, 220);
};

$('clearSearchBtn').onclick = () => {
  $('userSearchInput').value = '';
  $('clearSearchBtn').classList.add('hidden');
  $('searchResultsBox').classList.add('hidden');
};

function renderSearchResults(users) {
  const box = $('searchResultsBox');
  const list = $('searchResultsList');
  box.classList.remove('hidden');
  if (!users.length) {
    list.innerHTML = `<div class="empty-list-note">No user found with that username.</div>`;
    return;
  }
  list.innerHTML = users.map(u => {
    let actionHtml = '';
    if (u.relation === 'friend') {
      actionHtml = `<button class="mini-pill-btn solid" data-open-chat="${escapeHtml(u.username)}">Message</button>`;
    } else if (u.relation === 'outgoing') {
      actionHtml = `<span class="mini-pill-btn">Requested</span>`;
    } else if (u.relation === 'incoming') {
      actionHtml = `<button class="mini-pill-btn solid" data-accept="${escapeHtml(u.username)}">Accept</button>`;
    } else {
      actionHtml = `<button class="mini-pill-btn solid" data-add-friend="${escapeHtml(u.username)}">+ Add Friend</button>`;
    }
    return `
      <div class="user-row">
        <div class="avatar sm">${avatarSvg(u.avatar)}</div>
        <div class="user-row-info">
          <div class="user-row-top"><b>${escapeHtml(u.name)}</b></div>
          <div class="user-row-sub"><span>@${escapeHtml(u.username)}</span></div>
        </div>
        <div class="row-actions">${actionHtml}</div>
      </div>
    `;
  }).join('');
}

document.addEventListener('click', async e => {
  const addBtn = e.target.closest('[data-add-friend]');
  if (addBtn) {
    const to = addBtn.dataset.addFriend;
    try {
      await api('/api/friends/request', { method: 'POST', body: JSON.stringify({ to }) });
      toast(`Friend request sent to @${to}`);
      $('userSearchInput').dispatchEvent(new Event('input'));
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  const accBtn = e.target.closest('[data-accept]');
  if (accBtn) {
    const from = accBtn.dataset.accept;
    try {
      await api('/api/friends/accept', { method: 'POST', body: JSON.stringify({ from }) });
      toast(`You are now friends with @${from}`);
      $('clearSearchBtn').click();
      await refreshInbox();
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  const decBtn = e.target.closest('[data-decline]');
  if (decBtn) {
    const from = decBtn.dataset.decline;
    try {
      await api('/api/friends/decline', { method: 'POST', body: JSON.stringify({ from }) });
      await refreshInbox();
    } catch (err) {}
    return;
  }

  const openBtn = e.target.closest('[data-open-chat]');
  if (openBtn) {
    const username = openBtn.dataset.openChat;
    const friend = state.isRoomSession
      ? state.activeFriend
      : state.friends.find(f => f.username === username);
    if (friend) openConversation(friend);
  }
});

async function openConversation(friend) {
  state.activeFriend = friend;
  state.replyTo = null;
  $('replyBar').classList.add('hidden');
  $('typingBubble').classList.add('hidden');

  $('emptyChatState').classList.add('hidden');
  $('activeChatView').classList.remove('hidden');
  $('messengerShell').classList.add('mobile-chat-open');

  updateActiveHeader();
  renderInbox();

  if (state.isRoomSession) {
    renderMessages();
    return;
  }

  try {
    const data = await api(`/api/messages/${encodeURIComponent(friend.username)}`);
    state.messages = data.messages || [];
    renderMessages();
    socket.emit('chat:seen', { withUser: friend.username });
    await refreshInbox();
  } catch (err) {
    toast(err.message);
  }
}

function updateActiveHeader() {
  const f = state.activeFriend;
  if (!f) return;

  $('myPortrait').innerHTML = avatarSvg(state.user.avatar);
  $('myDisplayName').textContent = state.user.name;

  $('peerPortrait').innerHTML = avatarSvg(f.avatar);
  $('friendDisplayName').textContent = f.name;
  $('avatar').innerHTML = avatarSvg(f.avatar);
  $('peerName').textContent = f.name;

  const badge = $('peerMoodBadge');
  if (f.mood) {
    const svg = MOOD_ICONS[f.mood] || '';
    badge.innerHTML = `${svg}<span>${escapeHtml(f.mood)}</span>`;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  if (f.aura) $('headerPeerAuraWrap').dataset.aura = f.aura;
  else delete $('headerPeerAuraWrap').dataset.aura;

  setOnlineStatus(f.online, f.lastSeen);
}

function setOnlineStatus(online, lastSeen) {
  $('onlineDot').classList.toggle('on', !!online);
  $('status').className = online ? 'on' : 'off';
  if (state.isRoomSession && !online) {
    $('status').textContent = `Share code ${state.activeRoomCode} to connect`;
  } else {
    $('status').textContent = online ? 'Active now' : `Last seen ${formatTime(lastSeen)}`;
  }
  $('connectionLabel').classList.toggle('live', !!online);
  $('connectionLabel').textContent = online ? 'Live Connected' : (state.isRoomSession ? 'Waiting in Room' : 'Offline');
}

$('backToInboxBtn').onclick = () => {
  $('messengerShell').classList.remove('mobile-chat-open');
};

$('activeRoomCodeBadge').onclick = async () => {
  if (!state.activeRoomCode) return;
  try {
    await navigator.clipboard.writeText(state.activeRoomCode);
    toast(`Room code ${state.activeRoomCode} copied`);
  } catch (e) {
    toast(`Room code: ${state.activeRoomCode}`);
  }
};

$('leaveRoomBtn').onclick = () => {
  socket.disconnect();
  state.isRoomSession = false;
  state.activeRoomCode = '';
  state.activeFriend = null;
  $('app').classList.add('hidden');
  $('auth').classList.remove('hidden');
  setAuthMode('room');
};

/* =========================================================
   VOICE NOTE RECORDING & VOICE MORPHING (Normal, Female, Old, Baby)
   ========================================================= */
$('voiceBtn').onclick = async () => {
  if (!state.activeFriend) return;
  if (state.voiceRecorder && state.voiceRecorder.state === 'recording') {
    stopAndSendVoice();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.voiceStream = stream;
    state.voiceChunks = [];
    state.voiceSeconds = 0;

    const recorder = new MediaRecorder(stream);
    state.voiceRecorder = recorder;
    recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) state.voiceChunks.push(e.data);
    };
    recorder.start();

    $('voiceRecBar').classList.remove('hidden');
    $('voiceBtn').classList.add('active');
    $('voiceRecTimer').textContent = '0:00';
    state.voiceTimer = setInterval(() => {
      state.voiceSeconds++;
      const m = Math.floor(state.voiceSeconds / 60);
      const s = String(state.voiceSeconds % 60).padStart(2, '0');
      $('voiceRecTimer').textContent = `${m}:${s}`;
      if (state.voiceSeconds >= 60) stopAndSendVoice();
    }, 1000);
  } catch (err) {
    toast('Microphone permission denied or unavailable');
  }
};

function cleanupVoiceRecording() {
  clearInterval(state.voiceTimer);
  if (state.voiceStream) {
    state.voiceStream.getTracks().forEach(t => t.stop());
    state.voiceStream = null;
  }
  state.voiceRecorder = null;
  $('voiceRecBar').classList.add('hidden');
  $('voiceBtn').classList.remove('active');
}

$('cancelVoiceBtn').onclick = () => {
  if (state.voiceRecorder && state.voiceRecorder.state !== 'inactive') {
    state.voiceRecorder.onstop = null;
    state.voiceRecorder.stop();
  }
  cleanupVoiceRecording();
  toast('Voice recording cancelled');
};

async function stopAndSendVoice() {
  const recorder = state.voiceRecorder;
  if (!recorder || recorder.state === 'inactive') return;
  const durationSec = Math.max(1, state.voiceSeconds);
  const morphEffect = $('voiceMorphSelect').value || 'normal';

  recorder.onstop = async () => {
    const rawBlob = new Blob(state.voiceChunks, { type: recorder.mimeType || 'audio/webm' });
    cleanupVoiceRecording();

    const finalBlob = await applyVoiceMorphFilter(rawBlob, morphEffect);
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('chat:send', {
        to: state.activeFriend.username,
        type: 'voice',
        audio: reader.result,
        voiceDuration: durationSec,
        voiceEffect: morphEffect,
        vanish: state.vanish,
        spoiler: state.spoiler,
        replyTo: state.replyTo
      });
      state.replyTo = null;
      $('replyBar').classList.add('hidden');
    };
    reader.readAsDataURL(finalBlob);
  };
  recorder.stop();
}

$('sendVoiceBtn').onclick = stopAndSendVoice;

/* =========================================================
   MESSAGES RENDERING & INTERACTIONS
   ========================================================= */
const formatTime = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const formatDay = ts => {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
const isOnlyEmoji = str => /^(\p{Extended_Pictographic}|\s){1,6}$/u.test(str.trim());

function renderVoicePlayer(m) {
  const dur = m.voiceDuration || 3;
  const mStr = Math.floor(dur / 60);
  const sStr = String(dur % 60).padStart(2, '0');
  const effectLabels = { female: 'Female', old: 'Old', baby: 'Baby' };
  const effectLabel = m.voiceEffect && m.voiceEffect !== 'normal' ? (effectLabels[m.voiceEffect] || m.voiceEffect) : '';
  const bars = [35, 65, 90, 50, 80, 40, 95, 60, 75, 45, 85, 55, 70, 40, 60]
    .map((h, idx) => `<i style="height:${h}%;animation-delay:${(idx * 0.06).toFixed(2)}s"></i>`).join('');
  return `
    <div class="voice-bubble" data-audio-src="${escapeHtml(m.audio)}">
      <button type="button" class="voice-play-btn" aria-label="Play voice note">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
      </button>
      <div class="voice-wave-wrap">
        <div class="voice-bars">${bars}</div>
        <div class="voice-meta-row">
          <span>${mStr}:${sStr}</span>
          ${effectLabel ? `<span class="voice-tag-pill">${escapeHtml(effectLabel)}</span>` : '<span>Voice</span>'}
        </div>
      </div>
    </div>
  `;
}

function renderMessages() {
  const box = $('msgs');
  let lastDay = '';
  box.innerHTML = state.messages.map(m => {
    if (m.type === 'system') {
      return `<div class="sys-banner">${escapeHtml(m.text)}</div>`;
    }
    const mine = m.sender === state.user.username;
    const day = formatDay(m.at);
    const sep = day !== lastDay ? `<div class="day-sep">${day}</div>` : '';
    lastDay = day;

    if (m.deleted) {
      return `${sep}<div class="msg ${mine ? 'me' : 'peer'}"><div class="bubble"><span class="txt" style="opacity:.6;font-style:italic">Message unsent</span></div></div>`;
    }

    const emojiClass = m.type === 'text' && !m.replyTo && isOnlyEmoji(m.text) ? 'emoji-only' : '';
    const reacts = Object.entries(m.reactions || {});
    const reactHtml = reacts.length ? `<div class="reacts">${reacts.map(([u, em]) => `<span class="react" title="${escapeHtml(u)}">${em}</span>`).join('')}</div>` : '';
    const ticks = mine ? `<span class="ticks ${m.seen ? 'seen' : ''}">${m.seen ? '✓✓' : '✓'}</span>` : '';
    const replyHtml = m.replyTo ? `<div class="quote"><b>${escapeHtml(m.replyTo.senderName)}</b><div>${escapeHtml(m.replyTo.text)}</div></div>` : '';

    let bodyHtml = '';
    if (m.type === 'image') {
      bodyHtml = `<img src="${m.image}" alt="Shared photo">`;
    } else if (m.type === 'voice') {
      bodyHtml = renderVoicePlayer(m);
    } else if (m.type === 'game-invite') {
      const gameNames = { tictactoe: 'Tic-Tac-Toe', rps: 'Rock Paper Scissors', connect4: 'Connect Four' };
      const title = gameNames[m.game] || m.game;
      const gSvg = GAME_SVGS[m.game] || '';
      bodyHtml = `<div class="txt">${escapeHtml(m.text)}</div>
        <div class="game-invite-card">
          <div style="display:flex;align-items:center;gap:6px">
            <span class="icon-svg-wrap">${gSvg}</span>
            <b>${escapeHtml(title)}</b>
          </div>
          <button class="game-action primary-action" data-launch-game="${escapeHtml(m.game)}">Join &amp; Play</button>
        </div>`;
    } else {
      bodyHtml = `<div class="txt">${escapeHtml(m.text)}</div>`;
    }

    const vanishBadge = m.vanish ? `<div class="vanish-badge"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/></svg><span>Vanish</span></div>` : '';

    return `${sep}
      <div class="msg ${mine ? 'me' : 'peer'} ${emojiClass}" data-id="${m.id}">
        <div class="acts">
          ${REACTS.map(em => `<button data-react="${em}">${em}</button>`).join('')}
          <button data-reply="${m.id}" title="Reply" aria-label="Reply"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></button>
          ${mine ? `<button data-del="${m.id}" title="Unsend" aria-label="Unsend"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>` : ''}
        </div>
        <div class="bubble ${m.spoiler ? 'spoiler' : ''}">${vanishBadge}${replyHtml}${bodyHtml}</div>
        ${reactHtml}
        <div class="meta"><span>${formatTime(m.at)}</span>${ticks}</div>
      </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function sendMessage() {
  if (!state.activeFriend) return;
  const text = $('input').value.trim();
  if (!text) return;
  socket.emit('chat:send', {
    to: state.activeFriend.username,
    type: 'text',
    text,
    vanish: state.vanish,
    spoiler: state.spoiler,
    replyTo: state.replyTo
  });
  $('input').value = '';
  $('input').style.height = 'auto';
  state.replyTo = null;
  $('replyBar').classList.add('hidden');
  socket.emit('chat:typing', { to: state.activeFriend.username, typing: false });
}

$('send').onclick = sendMessage;
$('input').onkeydown = e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};
$('input').oninput = () => {
  if (!state.activeFriend) return;
  $('input').style.height = 'auto';
  $('input').style.height = Math.min($('input').scrollHeight, 96) + 'px';
  socket.emit('chat:typing', { to: state.activeFriend.username, typing: true });
  clearTimeout(state.typingTimer);
  state.typingTimer = setTimeout(() => {
    if (state.activeFriend) socket.emit('chat:typing', { to: state.activeFriend.username, typing: false });
  }, 1200);
};

// Voice Note Playback
let currentAudioEl = null;
let currentPlayBtn = null;
$('msgs').onclick = e => {
  const voicePlay = e.target.closest('.voice-play-btn');
  if (voicePlay) {
    const wrap = voicePlay.closest('.voice-bubble');
    const bars = wrap.querySelector('.voice-bars');
    const src = wrap.dataset.audioSrc;

    if (currentAudioEl && currentPlayBtn === voicePlay) {
      currentAudioEl.pause();
      currentAudioEl = null;
      bars.classList.remove('playing');
      voicePlay.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
      return;
    }
    if (currentAudioEl) {
      currentAudioEl.pause();
      document.querySelectorAll('.voice-bars.playing').forEach(b => b.classList.remove('playing'));
      document.querySelectorAll('.voice-play-btn').forEach(b => b.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>');
    }
    const audio = new Audio(src);
    currentAudioEl = audio;
    currentPlayBtn = voicePlay;
    bars.classList.add('playing');
    voicePlay.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    audio.play().catch(() => toast('Unable to play audio'));
    audio.onended = () => {
      bars.classList.remove('playing');
      voicePlay.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
      currentAudioEl = null;
    };
    return;
  }

  const spoiler = e.target.closest('.bubble.spoiler');
  if (spoiler) spoiler.classList.toggle('revealed');

  const reactBtn = e.target.closest('[data-react]');
  if (reactBtn && state.activeFriend) {
    const id = reactBtn.closest('.msg').dataset.id;
    socket.emit('chat:react', { to: state.activeFriend.username, id, emoji: reactBtn.dataset.react });
  }

  const replyBtn = e.target.closest('[data-reply]');
  if (replyBtn) {
    const m = state.messages.find(x => x.id === replyBtn.dataset.reply);
    if (m) {
      state.replyTo = {
        id: m.id,
        senderName: m.sender === state.user.username ? state.user.name : state.activeFriend.name,
        text: m.type === 'image' ? 'Photo' : m.type === 'voice' ? 'Voice Note' : m.text
      };
      $('rName').textContent = state.replyTo.senderName;
      $('rText').textContent = state.replyTo.text;
      $('replyBar').classList.remove('hidden');
      $('input').focus();
    }
  }

  const delBtn = e.target.closest('[data-del]');
  if (delBtn && state.activeFriend) {
    socket.emit('chat:delete', { to: state.activeFriend.username, id: delBtn.dataset.del });
  }

  const gameBtn = e.target.closest('[data-launch-game]');
  if (gameBtn) {
    openGameModal(gameBtn.dataset.launchGame);
  }
};

// Long-Press Empty Chat Background -> Live Heartbeat Tap
$('msgs').addEventListener('pointerdown', e => {
  if (e.target.closest('.msg') || !state.activeFriend) return;
  clearTimeout(state.hbHoldTimer);
  state.hbHoldTimer = setTimeout(() => {
    triggerHeartbeatPulse(true);
    toast('Live Heartbeat sent');
  }, 480);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => {
  $('msgs').addEventListener(ev, () => clearTimeout(state.hbHoldTimer));
});

$('heartbeatBtn').onclick = () => {
  if (!state.activeFriend) return;
  triggerHeartbeatPulse(true);
};

$('rClose').onclick = () => {
  state.replyTo = null;
  $('replyBar').classList.add('hidden');
};

$('imgBtn').onclick = () => $('file').click();
$('file').onchange = () => {
  const f = $('file').files[0];
  if (!f || !state.activeFriend) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      c.width = img.width * scale;
      c.height = img.height * scale;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      socket.emit('chat:send', {
        to: state.activeFriend.username,
        type: 'image',
        image: c.toDataURL('image/jpeg', 0.82),
        vanish: state.vanish,
        spoiler: state.spoiler,
        replyTo: state.replyTo
      });
      state.replyTo = null;
      $('replyBar').classList.add('hidden');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
  $('file').value = '';
};

function updateModeStrip() {
  $('vanishBtn').classList.toggle('active', state.vanish);
  $('spoilerBtn').classList.toggle('active', state.spoiler);
  $('vanishTag').classList.toggle('hidden', !state.vanish);
  $('spoilerTag').classList.toggle('hidden', !state.spoiler);
  $('modeStrip').classList.toggle('hidden', !state.vanish && !state.spoiler);
}
$('vanishBtn').onclick = () => { state.vanish = !state.vanish; updateModeStrip(); };
$('spoilerBtn').onclick = () => { state.spoiler = !state.spoiler; updateModeStrip(); };

$('emojis').innerHTML = EMOJIS.map(e => `<button type="button">${e}</button>`).join('');
$('emojiBtn').onclick = () => $('emojis').classList.toggle('hidden');
$('emojis').onclick = e => {
  if (e.target.tagName === 'BUTTON') {
    $('input').value += e.target.textContent;
    $('input').focus();
  }
};

/* =========================================================
   HEADER CONTROLS & AURA / MOOD RING
   ========================================================= */
$('moodBtn').onclick = e => {
  e.stopPropagation();
  $('moodMenu').classList.toggle('hidden');
  $('moreMenu').classList.add('hidden');
  $('weatherMenu').classList.add('hidden');
};
$('roomMoodBtn').onclick = e => {
  e.stopPropagation();
  $('moreMenu').classList.add('hidden');
  $('moodMenu').classList.remove('hidden');
};

$('moodMenu').onclick = e => {
  const btn = e.target.closest('[data-mood]');
  if (!btn) return;
  const mood = btn.dataset.mood;
  const aura = btn.dataset.aura || '';
  state.myMood = mood;
  state.myAura = aura;
  $('myMoodIcon').innerHTML = mood ? (MOOD_ICONS[mood] || MOOD_ICONS['Chilling']) : MOOD_ICONS['Chilling'];
  if (aura) $('sidebarMyAuraWrap').dataset.aura = aura;
  else delete $('sidebarMyAuraWrap').dataset.aura;

  $('moodMenu').classList.add('hidden');
  socket.emit('chat:mood', { mood, aura });
  toast(mood ? `Aura set to ${mood}` : 'Aura cleared');
};

$('weatherBtn').onclick = e => {
  e.stopPropagation();
  $('weatherMenu').classList.toggle('hidden');
  $('moreMenu').classList.add('hidden');
  $('moodMenu').classList.add('hidden');
};

$('weatherMenu').onclick = e => {
  const btn = e.target.closest('[data-weather]');
  if (!btn) return;
  const w = btn.dataset.weather;
  $('weatherMenu').classList.add('hidden');
  setWeather(w, true);
  toast(`Synced atmosphere: ${btn.textContent.trim()}`);
};

$('moreBtn').onclick = e => {
  e.stopPropagation();
  $('moreMenu').classList.toggle('hidden');
  $('moodMenu').classList.add('hidden');
  $('weatherMenu').classList.add('hidden');
};

document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown-wrap')) {
    $('moodMenu').classList.add('hidden');
    $('moreMenu').classList.add('hidden');
    $('weatherMenu').classList.add('hidden');
  }
});

$('themeBtn').onclick = () => {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('dc_light', document.documentElement.classList.contains('light') ? '1' : '');
  $('moreMenu').classList.add('hidden');
};

const openThemes = () => {
  $('moreMenu').classList.add('hidden');
  $('themesModal').classList.remove('hidden');
};
$('themePresetsBtn').onclick = openThemes;
$('sidebarThemeBtn').onclick = openThemes;

document.querySelectorAll('[data-theme-choice]').forEach(btn => {
  btn.onclick = () => {
    const t = btn.dataset.themeChoice;
    document.documentElement.dataset.theme = t;
    localStorage.setItem('dc_theme', t);
    document.querySelectorAll('.theme-swatch').forEach(x => x.classList.toggle('active', x.dataset.themeChoice === t));
    $('themesModal').classList.add('hidden');
  };
});

$('clearBtn').onclick = () => {
  if (!state.activeFriend) return;
  if (confirm(`Clear chat history with ${state.activeFriend.name}?`)) {
    socket.emit('chat:clear', { withUser: state.activeFriend.username });
  }
  $('moreMenu').classList.add('hidden');
};

$('logoutBtn').onclick = () => {
  sessionStorage.removeItem('dc_token');
  location.reload();
};

document.querySelectorAll('[data-close]').forEach(b => {
  b.onclick = () => $(b.dataset.close).classList.add('hidden');
});

/* =========================================================
   DUOPLAY MINI-GAMES (Original 3 Games with Clean SVG Symbols)
   ========================================================= */
$('gamesBtn').onclick = () => openGameModal(null);

function openGameModal(gameType) {
  if (!state.activeFriend) return;
  $('gamesModal').classList.remove('hidden');
  if (!gameType) {
    $('gamePickerGrid').classList.remove('hidden');
    $('gameStage').classList.add('hidden');
  } else {
    startOrShowGame(gameType, true);
  }
}

$('gamePickerGrid').onclick = e => {
  const tile = e.target.closest('[data-game]');
  if (tile) startOrShowGame(tile.dataset.game, true);
};

function startOrShowGame(type, announce) {
  $('gamePickerGrid').classList.add('hidden');
  $('gameStage').classList.remove('hidden');

  if (!state.activeGame || state.activeGame.type !== type) {
    if (type === 'tictactoe') {
      state.activeGame = {
        type: 'tictactoe',
        board: Array(9).fill(''),
        turn: state.user.username,
        roles: { [state.user.username]: 'X', [state.activeFriend.username]: 'O' },
        winner: null
      };
    } else if (type === 'rps') {
      state.activeGame = {
        type: 'rps',
        picks: {},
        scores: { [state.user.username]: 0, [state.activeFriend.username]: 0 },
        roundNote: 'Pick your move!'
      };
    } else if (type === 'connect4') {
      state.activeGame = {
        type: 'connect4',
        grid: Array.from({ length: 6 }, () => Array(7).fill(0)),
        turn: state.user.username,
        roles: { [state.user.username]: 1, [state.activeFriend.username]: 2 },
        winner: null
      };
    }
    syncGame();
    if (announce) {
      const gameNames = { tictactoe: 'Tic-Tac-Toe', rps: 'Rock Paper Scissors', connect4: 'Connect Four' };
      socket.emit('chat:send', {
        to: state.activeFriend.username,
        type: 'game-invite',
        game: type,
        text: `Invited you to play ${gameNames[type] || type}`
      });
    }
  }
  renderGameStage();
}

function syncGame() {
  if (!state.activeFriend) return;
  socket.emit('game:sync', { to: state.activeFriend.username, game: state.activeGame });
}

function renderGameStage() {
  const g = state.activeGame;
  if (!g) return;
  const stage = $('gameStage');

  if (g.type === 'tictactoe') {
    const myMark = g.roles[state.user.username] || 'O';
    const myTurn = g.turn === state.user.username && !g.winner;
    const statusText = g.winner
      ? (g.winner === 'draw' ? "It's a draw!" : `${g.winner === state.user.username ? 'You' : state.activeFriend.name} won!`)
      : (myTurn ? `Your turn (${myMark})` : `Waiting for ${state.activeFriend.name}…`);

    stage.innerHTML = `
      <div class="stage-top">
        <b>Tic-Tac-Toe</b>
        <button class="game-action" id="backGames">All Games</button>
      </div>
      <div class="stage-status">${statusText}</div>
      <div class="ttt-board">
        ${g.board.map((v, i) => `<button class="ttt-cell ${v.toLowerCase()}" data-ttt="${i}">${v}</button>`).join('')}
      </div>
      <div style="text-align:center"><button class="game-action primary-action" id="resetGame">New Round</button></div>
    `;
  } else if (g.type === 'rps') {
    const myPick = g.picks[state.user.username];
    const peerPick = g.picks[state.activeFriend.username];
    const myScore = g.scores[state.user.username] || 0;
    const peerScore = g.scores[state.activeFriend.username] || 0;
    const statusText = myPick && !peerPick
      ? `You locked ${myPick.toUpperCase()} — waiting for ${state.activeFriend.name}…`
      : g.roundNote;

    stage.innerHTML = `
      <div class="stage-top">
        <b>Rock Paper Scissors (${myScore} – ${peerScore})</b>
        <button class="game-action" id="backGames">All Games</button>
      </div>
      <div class="stage-status">${escapeHtml(statusText)}</div>
      <div class="rps-choices">
        ${['rock', 'paper', 'scissors'].map(c => `
          <button class="rps-btn ${myPick === c ? 'picked' : ''}" data-rps="${c}">
            ${RPS_SVGS[c]}
            <span style="text-transform:capitalize">${c}</span>
          </button>
        `).join('')}
      </div>
      <div style="text-align:center"><button class="game-action primary-action" id="resetGame">Reset Match</button></div>
    `;
  } else if (g.type === 'connect4') {
    const myTurn = g.turn === state.user.username && !g.winner;
    const statusText = g.winner
      ? (g.winner === 'draw' ? 'Board full — Draw!' : `${g.winner === state.user.username ? 'You' : state.activeFriend.name} connected 4!`)
      : (myTurn ? 'Your turn — tap any column' : `Waiting for ${state.activeFriend.name}…`);

    stage.innerHTML = `
      <div class="stage-top">
        <b>Connect Four</b>
        <button class="game-action" id="backGames">All Games</button>
      </div>
      <div class="stage-status">${statusText}</div>
      <div class="c4-board">
        ${g.grid.map((row, r) => row.map((v, c) => `<button class="c4-cell ${v === 1 ? 'r1' : v === 2 ? 'r2' : ''}" data-c4="${c}" aria-label="Row ${r + 1} Col ${c + 1}"></button>`).join('')).join('')}
      </div>
      <div style="text-align:center"><button class="game-action primary-action" id="resetGame">New Board</button></div>
    `;
  }
}

$('gameStage').onclick = e => {
  if (e.target.id === 'backGames') {
    $('gameStage').classList.add('hidden');
    $('gamePickerGrid').classList.remove('hidden');
    return;
  }
  const g = state.activeGame;
  if (!g) return;

  if (e.target.id === 'resetGame') {
    const type = g.type;
    state.activeGame = null;
    startOrShowGame(type, false);
    return;
  }

  if (g.type === 'tictactoe' && e.target.dataset.ttt !== undefined) {
    const idx = Number(e.target.dataset.ttt);
    if (g.winner || g.turn !== state.user.username || g.board[idx]) return;
    g.board[idx] = g.roles[state.user.username] || 'X';
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const won = wins.some(([a,b,c]) => g.board[a] && g.board[a] === g.board[b] && g.board[a] === g.board[c]);
    if (won) {
      g.winner = state.user.username;
      triggerBlast('🏆');
    } else if (g.board.every(Boolean)) {
      g.winner = 'draw';
    } else {
      g.turn = state.activeFriend.username;
    }
    syncGame();
    renderGameStage();
  }

  const rpsBtn = e.target.closest('[data-rps]');
  if (g.type === 'rps' && rpsBtn) {
    const pick = rpsBtn.dataset.rps;
    g.picks[state.user.username] = pick;
    const p1 = g.picks[state.user.username];
    const p2 = g.picks[state.activeFriend.username];
    if (p1 && p2) {
      if (p1 === p2) {
        g.roundNote = `Both chose ${p1.toUpperCase()} — Tie round!`;
      } else if ((p1 === 'rock' && p2 === 'scissors') || (p1 === 'paper' && p2 === 'rock') || (p1 === 'scissors' && p2 === 'paper')) {
        g.scores[state.user.username] = (g.scores[state.user.username] || 0) + 1;
        g.roundNote = `${p1.toUpperCase()} beats ${p2.toUpperCase()} — You won the round!`;
        triggerBlast('🎉');
      } else {
        g.scores[state.activeFriend.username] = (g.scores[state.activeFriend.username] || 0) + 1;
        g.roundNote = `${p2.toUpperCase()} beats ${p1.toUpperCase()} — ${state.activeFriend.name} won the round!`;
      }
      g.picks = {};
    }
    syncGame();
    renderGameStage();
  }

  if (g.type === 'connect4' && e.target.dataset.c4 !== undefined) {
    const col = Number(e.target.dataset.c4);
    if (g.winner || g.turn !== state.user.username) return;
    let placedRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (g.grid[r][col] === 0) {
        placedRow = r;
        break;
      }
    }
    if (placedRow === -1) return;
    const disc = g.roles[state.user.username] || 1;
    g.grid[placedRow][col] = disc;

    const checkWin = (r, c) => {
      const dirs = [[0,1],[1,0],[1,1],[1,-1]];
      return dirs.some(([dr, dc]) => {
        let count = 1;
        for (const sign of [-1, 1]) {
          let nr = r + dr * sign, nc = c + dc * sign;
          while (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && g.grid[nr][nc] === disc) {
            count++;
            nr += dr * sign;
            nc += dc * sign;
          }
        }
        return count >= 4;
      });
    };

    if (checkWin(placedRow, col)) {
      g.winner = state.user.username;
      triggerBlast('🏆');
    } else if (g.grid[0].every(v => v !== 0)) {
      g.winner = 'draw';
    } else {
      g.turn = state.activeFriend.username;
    }
    syncGame();
    renderGameStage();
  }
};

/* =========================================================
   SOCKET.IO REAL-TIME LISTENERS
   ========================================================= */
socket.on('room:peer', ({ peer }) => {
  if (!state.isRoomSession) return;
  if (peer) {
    state.activeFriend = {
      username: peer.username,
      name: peer.name,
      avatar: peer.avatar,
      online: true,
      mood: peer.mood || '',
      aura: peer.aura || '',
      isRoomChannel: true
    };
    toast(`${peer.name} joined the room`);
  } else {
    state.activeFriend = {
      username: `room:${state.activeRoomCode}`,
      name: `Room ${state.activeRoomCode}`,
      avatar: state.avatar === 'brother-1' ? 'sister-1' : 'brother-1',
      online: false,
      isRoomChannel: true
    };
    toast('Partner left the room');
  }
  updateActiveHeader();
  renderInbox();
});

socket.on('chat:message', m => {
  const involvesActive = state.activeFriend && (
    state.isRoomSession ||
    m.sender === state.activeFriend.username ||
    m.recipient === state.activeFriend.username
  );

  if (involvesActive) {
    state.messages.push(m);
    renderMessages();
    if (m.sender !== state.user.username && !state.isRoomSession) {
      socket.emit('chat:seen', { withUser: state.activeFriend.username });
    }
  } else if (m.sender !== state.user.username && m.type !== 'system') {
    toast(`New message from ${m.senderName || m.sender}`);
  }

  if (m.type === 'text' && isOnlyEmoji(m.text) && involvesActive) {
    triggerBlast(m.text.trim());
  }
  refreshInbox();
});

socket.on('chat:seen', ({ by }) => {
  if (state.activeFriend && (state.isRoomSession || state.activeFriend.username === by)) {
    state.messages.forEach(m => {
      if (m.sender === state.user.username) m.seen = true;
    });
    renderMessages();
  }
});

socket.on('chat:vanished', ({ ids }) => {
  state.messages = state.messages.filter(m => !ids.includes(m.id));
  if (state.activeFriend) renderMessages();
  refreshInbox();
});

socket.on('chat:react', ({ id, reactions }) => {
  const m = state.messages.find(x => x.id === id);
  if (m) {
    m.reactions = reactions;
    renderMessages();
  }
});

socket.on('chat:delete', ({ id }) => {
  const m = state.messages.find(x => x.id === id);
  if (m) {
    m.deleted = true;
    renderMessages();
  }
  refreshInbox();
});

socket.on('chat:clear', ({ withUser }) => {
  if (state.activeFriend && (state.isRoomSession || state.activeFriend.username === withUser)) {
    state.messages = [];
    renderMessages();
  }
  refreshInbox();
});

socket.on('chat:typing', ({ from, typing }) => {
  if (state.activeFriend && (state.isRoomSession || state.activeFriend.username === from)) {
    $('typingBubble').classList.toggle('hidden', !typing);
  }
});

socket.on('chat:heartbeat', ({ from }) => {
  if (state.activeFriend && (state.isRoomSession || state.activeFriend.username === from)) {
    triggerHeartbeatPulse(false);
  }
});

socket.on('chat:weather', ({ from, weather }) => {
  if (state.activeFriend && (state.isRoomSession || state.activeFriend.username === from)) {
    setWeather(weather, false);
    toast(`Atmosphere changed to ${weather}`);
  }
});

socket.on('user:presence', ({ username, online, lastSeen }) => {
  const f = state.friends.find(x => x.username === username);
  if (f) {
    f.online = online;
    f.lastSeen = lastSeen;
    renderInbox();
  }
  if (state.activeFriend && state.activeFriend.username === username) {
    state.activeFriend.online = online;
    state.activeFriend.lastSeen = lastSeen;
    setOnlineStatus(online, lastSeen);
  }
});

socket.on('user:mood', ({ username, mood, aura }) => {
  const f = state.friends.find(x => x.username === username);
  if (f) {
    f.mood = mood;
    f.aura = aura;
    renderInbox();
  }
  if (state.activeFriend && state.activeFriend.username === username) {
    state.activeFriend.mood = mood;
    state.activeFriend.aura = aura;
    updateActiveHeader();
  }
});

socket.on('friend:request', ({ from }) => {
  toast(`Friend request from ${from.name} (@${from.username})`);
  refreshInbox();
});

socket.on('friend:accepted', ({ friend }) => {
  toast(`${friend.name} accepted your friend request`);
  refreshInbox();
});

socket.on('game:sync', ({ from, game }) => {
  if (!state.activeFriend || (!state.isRoomSession && state.activeFriend.username !== from)) return;
  state.activeGame = game;
  if (!$('gamesModal').classList.contains('hidden')) {
    $('gamePickerGrid').classList.add('hidden');
    $('gameStage').classList.remove('hidden');
    renderGameStage();
  } else {
    toast(`${state.activeFriend.name} made a move in ${game.type}`);
  }
});

/* =========================================================
   BOOT INITIALIZATION
   ========================================================= */
(async function init() {
  if (localStorage.getItem('dc_light')) document.documentElement.classList.add('light');
  const savedTheme = localStorage.getItem('dc_theme') || 'midnight';
  document.documentElement.dataset.theme = savedTheme;
  document.querySelectorAll('.theme-swatch').forEach(x => x.classList.toggle('active', x.dataset.themeChoice === savedTheme));

  $('devInfoBtn').onclick = () => $('devModal').classList.remove('hidden');

  generateRoomCode();
  setAuthMode('login');
  startWeatherLoop();

  if (state.token) {
    try {
      const data = await api('/api/me');
      state.user = data.user;
      await enterMessenger();
      return;
    } catch (e) {
      sessionStorage.removeItem('dc_token');
      state.token = '';
    }
  }
})();
