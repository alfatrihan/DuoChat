// script.js - DuoChat v3 (Synced Weather Atmosphere, Vanish Messages, Spoiler Blur, Reactions, Moods, Nudge)
const $ = (id) => document.getElementById(id);
const socket = io();

const rnd = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const cid = sessionStorage.getItem('cid') || (sessionStorage.cid = rnd());

let creds = null;
let peerName = '';
let peerOnline = false, peerTyping = false;
let replyTo = null;
let vanishMode = false;
let spoilerMode = false;
let myMood = '';
let currentWeather = 'clear';
const items = {}; // id -> { m, el, tick, seenSent, vanishTimer }

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
  t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

/* ---------- Auto-fill Room from URL Invite Link ---------- */
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('room')) {
  $('room').value = urlParams.get('room');
}

$('genRoomBtn').onclick = () => {
  const randomKey = 'duo-' + Math.random().toString(36).substring(2, 8);
  $('room').value = randomKey;
  $('room').type = 'text';
  showToast('Generated random passkey!');
};

/* ---------- Light / Dark Base Theme ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) {}
}
let saved = null;
try { saved = localStorage.getItem('theme'); } catch (e) {}
setTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'light'));
$('themeBtn').onclick = () => {
  const current = document.documentElement.dataset.theme;
  setTheme(['light','sakura'].includes(current) ? 'midnight' : 'light');
  showToast('Theme updated');
};
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }
$('themePresetsBtn').onclick = () => { closeAllMenus(); openModal('themesModal'); };
document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => closeModal(b.dataset.close));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); }));
document.querySelectorAll('[data-theme-choice]').forEach((b) => b.onclick = () => {
  setTheme(b.dataset.themeChoice);
  closeModal('themesModal');
  showToast(`${b.querySelector('b').textContent} theme applied ✦`);
});

/* ---------- Synced Weather Atmosphere Engine ---------- */
const WEATHER_META = {
  clear:  { icon: '🌤️', label: 'Clear Sky' },
  rain:   { icon: '🌧️', label: 'Cozy Rain' },
  storm:  { icon: '⛈️', label: 'Thunder Storm' },
  snow:   { icon: '❄️', label: 'Soft Snow' },
  stars:  { icon: '🌌', label: 'Starry Night' },
  petals: { icon: '🌸', label: 'Cherry Blossom' }
};

const canvas = $('weatherCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animFrame = null;
let lightningTimer = null;

function resizeCanvas() {
  const chatEl = $('chat');
  canvas.width = chatEl.clientWidth || window.innerWidth;
  canvas.height = chatEl.clientHeight || window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

function initParticles(type) {
  resizeCanvas();
  particles = [];
  const count = type === 'rain' ? 95 : type === 'storm' ? 145 : type === 'snow' ? 75 : type === 'stars' ? 65 : type === 'petals' ? 35 : 0;
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
  document.documentElement.dataset.weather = weather;
  $('weatherIcon').textContent = WEATHER_META[weather].icon;

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
        const c = $('chat');
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

/* ---------- Dropdown Menu Handlers ---------- */
function closeAllMenus() {
  $('weatherMenu').classList.add('hidden');
  $('moodMenu').classList.add('hidden');
  $('moreMenu').classList.add('hidden');
}
document.addEventListener('click', (e) => { closeAllMenus(); if (!e.target.closest('.message-actions') && !e.target.closest('.message-menu-btn')) document.querySelectorAll('.message-actions').forEach(x => x.classList.add('hidden')); });

$('weatherBtn').onclick = (e) => {
  e.stopPropagation();
  const isHidden = $('weatherMenu').classList.contains('hidden');
  closeAllMenus();
  if (isHidden) $('weatherMenu').classList.remove('hidden');
};
$('weatherMenu').querySelectorAll('button').forEach((btn) => {
  btn.onclick = () => {
    const w = btn.dataset.weather;
    applyWeather(w, 'You');
    socket.emit('weather', w);
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
    $('myMoodIcon').textContent = myMood ? myMood.split(' ')[0] : '😊';
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

/* ---------- Join ---------- */
function doJoin(onDone) {
  socket.emit('join', { ...creds, mood: myMood }, (res) => {
    if (res.error) return onDone(res.error);
    $('msgs').innerHTML = '';
    Object.keys(items).forEach((k) => delete items[k]);
    const other = [...res.history].reverse().find((m) => m.from !== cid);
    peerName = res.peer || (other && other.name) || '';
    peerOnline = !!res.peer;
    if (res.peerMood) updatePeerMood(res.peerMood);
    res.history.forEach(render);
    if (res.game) {
      activeGame = res.game.type;
      $('gameStage').classList.remove('hidden');
      renderGame(res.game);
    }
    updateHeader();
    markSeen();
    onDone(null, res.weather || 'clear');
  });
}

$('joinForm').onsubmit = (e) => {
  e.preventDefault();
  creds = { name: $('name').value.trim(), room: $('room').value.trim(), cid };
  doJoin((err, roomWeather) => {
    if (err) { creds = null; $('err').textContent = err; return; }
    $('join').classList.add('hidden');
    $('chat').classList.remove('hidden');
    resizeCanvas();
    applyWeather(roomWeather, null);
    $('input').focus();
  });
};

socket.on('connect', () => { if (creds) doJoin((err, w) => { if (!err && w) applyWeather(w, null); }); });
socket.on('disconnect', () => { peerOnline = false; peerTyping = false; updateHeader(true); });

/* ---------- Header / Presence / Mood / Synced Weather ---------- */
function updateHeader(reconnecting) {
  $('peerName').textContent = peerName || 'Waiting for friend…';
  $('avatar').textContent = (peerName || '?')[0].toUpperCase();
  const s = $('status');
  s.textContent = reconnecting ? 'Reconnecting…' : peerTyping ? 'typing…' : peerOnline ? 'Online' : 'Offline';
  s.className = peerOnline && !reconnecting ? 'on' : 'off';
  $('onlineDot').className = 'online-dot' + (peerOnline && !reconnecting ? ' on' : '');
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

socket.on('presence', ({ online, name, mood }) => {
  peerOnline = online;
  if (name) peerName = name;
  if (mood !== undefined) updatePeerMood(mood);
  if (!online) { peerTyping = false; updatePeerMood(''); }
  updateHeader();
});
socket.on('typing', (v) => { peerTyping = v; updateHeader(); });
socket.on('mood', (mood) => updatePeerMood(mood));
socket.on('weather', ({ weather, by }) => {
  applyWeather(weather, by || peerName || 'Your friend');
});

/* ---------- Nudge / Buzz ---------- */
$('nudgeBtn').onclick = () => {
  socket.emit('nudge');
  triggerShake();
  showToast('🔔 You nudged your friend!');
};
socket.on('nudge', () => {
  triggerShake();
  beep(620);
  showToast('🔔 Your friend nudged you!');
});
function triggerShake() {
  const c = $('chat');
  c.classList.remove('shake');
  void c.offsetWidth;
  c.classList.add('shake');
}

/* ---------- Copy Invite Link ---------- */
$('inviteBtn').onclick = () => {
  if (!creds) return;
  const link = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(creds.room)}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('🔗 Invite link copied!');
  }).catch(() => {
    showToast(`Passkey: ${creds.room}`);
  });
};

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
  const mine = m.from === cid;
  const d = el('div', 'm ' + (mine ? 'me' : 'them') + (m.spoiler ? ' spoiler' : '') + (m.reaction ? ' has-react' : ''));
  d.dataset.id = m.id;

  const rBar = el('div', 'react-bar');
  ['❤️', '😂', '👍', '😮', '😢', '🔥'].forEach((emo) => {
    const rb = el('button', '', emo);
    rb.onclick = (e) => {
      e.stopPropagation();
      socket.emit('react', { id: m.id, emoji: emo });
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

  if (m.text) d.append(el('div', 'txt', m.text));

  const meta = el('div', 'meta');
  if (m.vanish) {
    meta.append(el('span', 'vanish-indicator', '⏱️ 10s'));
  }

  const rb = el('button', 'act-btn', '↩');
  rb.title = 'Reply';
  rb.onclick = (e) => {
    e.stopPropagation();
    setReply({ name: m.name, text: m.spoiler ? '🔒 Spoiler message' : (m.text || '📷 Photo') });
  };
  meta.append(rb);
  if (m.edited) meta.append(el('span', 'edited-label', 'edited'));
  meta.append(el('span', '', fmtTime(m.time)));

  const menuBtn = el('button', 'act-btn message-menu-btn', '⋯');
  menuBtn.title = 'Message actions';
  const actionMenu = el('div', 'message-actions hidden');
  const addAction = (label, fn, danger = false) => {
    const b = el('button', danger ? 'danger-text' : '', label);
    b.onclick = (e) => { e.stopPropagation(); actionMenu.classList.add('hidden'); fn(); };
    actionMenu.append(b);
  };
  if (mine && m.text && !m.image && !m.vanish) {
    addAction('✎ Edit message', () => editMessage(m.id));
    addAction('⌫ Delete for everyone', () => {
      if (confirm('Delete this message for both people?')) socket.emit('delete-message', { id: m.id }, (res) => { if (res && res.error) showToast(res.error); });
    }, true);
  }
  addAction('Hide for me (this session)', () => {
    d.remove();
    delete items[m.id];
  });
  menuBtn.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.message-actions').forEach(x => { if (x !== actionMenu) x.classList.add('hidden'); }); actionMenu.classList.toggle('hidden'); };
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
  if (!it || it.m.from !== cid || !it.m.text) return;
  const next = prompt('Edit your message:', it.m.text);
  if (next === null || !next.trim() || next.trim() === it.m.text) return;
  socket.emit('edit-message', { id, text: next.trim() }, (res) => {
    if (res && res.error) showToast(res.error);
    else showToast('Message updated ✦');
  });
}
socket.on('message-edited', ({ id, text, edited }) => {
  const it = items[id];
  if (!it) return;
  it.m.text = text; it.m.edited = edited;
  const txt = it.el.querySelector('.txt');
  if (txt) txt.textContent = text;
  else it.el.insertBefore(el('div','txt',text), it.el.querySelector('.meta'));
  let label = it.el.querySelector('.edited-label');
  if (!label) {
    label = el('span','edited-label','edited');
    const meta = it.el.querySelector('.meta');
    meta.insertBefore(label, meta.querySelector('.tick'));
  }
});
socket.on('message-deleted', ({ id }) => {
  const it = items[id];
  if (it) { it.el.remove(); delete items[id]; }
  showToast('Message deleted for everyone');
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

function scrollDown() { const c = $('msgs'); c.scrollTop = c.scrollHeight; }

/* ---------- Sending ---------- */
function send(image) {
  const input = $('input');
  const text = image ? '' : input.value.trim();
  if (!text && !image) return;
  const m = {
    id: cid.slice(0, 6) + rnd(),
    text,
    image: image || null,
    reply: replyTo,
    vanish: vanishMode,
    spoiler: spoilerMode
  };
  render({ ...m, from: cid, name: creds.name, time: Date.now(), status: 'sending' });
  socket.emit('msg', m, (status) => setStatus(m.id, status));
  if (!image) { input.value = ''; input.style.height = '40px'; }
  setReply(null);
  stopTyping();
}

$('send').onclick = () => send();
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
});
$('input').addEventListener('input', (e) => {
  e.target.style.height = '40px';
  e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px';
  socket.emit('typing', true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 1500);
});
let typingTimer;
function stopTyping() { clearTimeout(typingTimer); socket.emit('typing', false); }

/* ---------- Receiving, Status, Seen, Reactions ---------- */
socket.on('msg', (m) => {
  render(m);
  if (document.hidden || !document.hasFocus()) beep(880);
  markSeen();
});
socket.on('status', ({ ids, status }) => ids.forEach((id) => setStatus(id, status)));
socket.on('react', ({ id, emoji }) => applyReaction(id, emoji));

function markSeen() {
  if (document.hidden || !document.hasFocus()) return;
  const ids = Object.values(items)
    .filter((it) => it.m.from !== cid && !it.seenSent)
    .map((it) => {
      it.seenSent = true;
      if (it.m.vanish) startVanishCountdown(it.m.id);
      return it.m.id;
    });
  if (ids.length) socket.emit('seen', ids);
}
addEventListener('focus', markSeen);
document.addEventListener('visibilitychange', markSeen);

/* ---------- Reply ---------- */
function setReply(r) {
  replyTo = r;
  $('replyBar').classList.toggle('hidden', !r);
  if (r) { $('rName').textContent = r.name; $('rText').textContent = r.text.slice(0, 120); $('input').focus(); }
}
$('rClose').onclick = () => setReply(null);

/* ---------- Emoji Picker ---------- */
Array.from('😀😁😂🤣😊😍😘😎🤔😅😭😡🥳😴🤗🙄😉😇🥺😢👍👎👏🙌🙏💪👋🤝❤️💔🔥✨🎉🎂🍕☕🌹⭐💯✅❌👀🚀🌙☀️🎵').forEach((ch) => {
  const b = el('button', '', ch);
  b.type = 'button';
  b.onclick = () => { $('input').value += ch; $('input').focus(); };
  $('emojis').append(b);
});
$('emojiBtn').onclick = () => $('emojis').classList.toggle('hidden');

/* ---------- Images ---------- */
$('imgBtn').onclick = () => $('file').click();
$('file').onchange = (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
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
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
};

/* ---------- Clear Chat ---------- */
$('clearBtn').onclick = () => { if (confirm('Clear the whole conversation for both of you?')) socket.emit('clear'); };
socket.on('clear', () => { $('msgs').innerHTML = ''; Object.keys(items).forEach((k) => delete items[k]); });

/* ---------- DuoPlay: Truth or Dare, Tic-Tac-Toe, Rock Paper Scissors ---------- */
const TRUTHS = [
  'What is one thing you have never told me?',
  'What was your first impression of me?',
  'What is a habit you want to change?',
  'What is your funniest recent memory?',
  'What is one thing you are secretly proud of?',
  'If you could revisit one day, which would it be?'
];
const DARES = [
  'Send your best silly selfie (or draw one).',
  'Describe the other player using only three emojis.',
  'Write a 10-word compliment.',
  'Send a voice note saying a tongue twister.',
  'Use only emojis in your next three messages.',
  'Make up a funny nickname for the other player.'
];
let activeGame = null;
$('gamesBtn').onclick = () => { openModal('gamesModal'); $('gameStage').classList.add('hidden'); };
document.querySelectorAll('[data-game]').forEach((b) => b.onclick = () => {
  const type = b.dataset.game;
  socket.emit('game-start', { type }, (res) => {
    if (res && res.error) return showToast(res.error);
    activeGame = type;
    $('gameStage').classList.remove('hidden');
    renderGame({ type });
  });
});
socket.on('game-state', (state) => {
  activeGame = state.type;
  $('gameStage').classList.remove('hidden');
  renderGame(state);
});
function gameButton(label, action, primary=false) {
  const b = el('button', 'game-action' + (primary ? ' primary-action' : ''), label);
  b.onclick = action;
  return b;
}
function gameTitle(title, desc) {
  const stage = $('gameStage');
  stage.innerHTML = '';
  stage.append(el('h3','',title), el('p','',desc));
  return stage;
}
function renderGame(g) {
  const stage = $('gameStage');
  if (g.type === 'truth') {
    const myTurn = g.turn === cid;
    const node = gameTitle('♡ Truth or Dare', myTurn ? 'Your turn — choose honestly or boldly.' : 'Your friend is choosing. Get ready!');
    if (g.prompt) node.append(el('div','game-prompt',`${g.lastAction === 'dare' ? '⚡ Dare' : g.lastAction === 'truth' ? '♡ Truth' : '↷'}: ${g.prompt}`));
    const actions = el('div','game-actions');
    if (myTurn) {
      actions.append(
        gameButton('♡ Truth', () => sendTruthDare('truth', TRUTHS[Math.floor(Math.random()*TRUTHS.length)]), true),
        gameButton('⚡ Dare', () => sendTruthDare('dare', DARES[Math.floor(Math.random()*DARES.length)])),
        gameButton('↷ Skip', () => sendTruthDare('skip','Turn skipped'))
      );
    } else actions.append(el('span','game-wait','Waiting for your friend…'));
    node.append(actions, gameButton('↻ New round', () => socket.emit('game-reset')));
  } else if (g.type === 'tictactoe') {
    const mark = g.marks && g.marks[cid];
    const opponentMark = mark === 'X' ? 'O' : 'X';
    const node = gameTitle('✕ Tic-Tac-Toe', g.result || (g.turn === cid ? `Your turn (${mark})` : `Friend's turn (${opponentMark})`));
    const board = el('div','game-board');
    (g.board || Array(9).fill('')).forEach((value, index) => {
      const b = el('button','game-cell',value);
      b.disabled = !!value || !!g.result || g.turn !== cid;
      b.onclick = () => socket.emit('game-action',{type:'tictactoe',index},(res)=>res&&res.error&&showToast(res.error));
      board.append(b);
    });
    node.append(board, gameButton(g.result ? '↻ Play again' : '↻ Restart round', () => socket.emit('game-reset'), true));
  } else if (g.type === 'rps') {
    const node = gameTitle('✊ Rock Paper Scissors', `Round ${Math.max(1,(g.round||1) - (g.lastRound ? 1 : 0))} · You ${g.scores?.[cid]||0} — Friend ${Object.entries(g.scores||{}).filter(([id])=>id!==cid).reduce((n,[,v])=>n+v,0)}`);
    if (g.lastRound) {
      const mine = g.lastRound.choices?.[cid];
      const other = Object.entries(g.lastRound.choices||{}).find(([id])=>id!==cid)?.[1];
      node.append(el('div','game-prompt',`${({rock:'✊',paper:'✋',scissors:'✌️'})[mine]||'—'}  vs  ${({rock:'✊',paper:'✋',scissors:'✌️'})[other]||'—'} · ${g.lastRound.winner === null ? 'Draw!' : g.lastRound.winner === cid ? 'You won this round!' : 'Friend won this round!'}`));
    }
    const choices = el('div','rps-choices');
    [['rock','✊','Rock'],['paper','✋','Paper'],['scissors','✌️','Scissors']].forEach(([v,emo,label])=>{
      const b=el('button','',emo); b.append(el('small','',label));
      b.disabled=!!(g.choices && g.choices[cid]);
      b.onclick=()=>socket.emit('game-action',{type:'rps',choice:v},(res)=>res&&res.error&&showToast(res.error));
      choices.append(b);
    });
    node.append(choices);
    if (g.choices && Object.keys(g.choices).length) node.append(el('p','game-wait','Choice locked in — waiting for the other player…'));
    node.append(gameButton('↻ Reset match',()=>socket.emit('game-reset'),true));
  }
}
function sendTruthDare(action,prompt) {
  socket.emit('game-action',{type:'truth',action,prompt},(res)=>res&&res.error&&showToast(res.error));
}

/* ---------- Notification Sound ---------- */
let audio;
function beep(freq = 880) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.25);
  } catch (e) {}
}
