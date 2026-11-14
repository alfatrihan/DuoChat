// script.js - Enhanced DuoChat Client (Vanish Messages, Spoiler Blur, Reactions, Moods, Nudge, Invite Link, Panic Mode)
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
  t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
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

/* ---------- Theme ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) {}
}
let saved = null;
try { saved = localStorage.getItem('theme'); } catch (e) {}
setTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

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
    updateHeader();
    markSeen();
    onDone();
  });
}

$('joinForm').onsubmit = (e) => {
  e.preventDefault();
  creds = { name: $('name').value.trim(), room: $('room').value.trim(), cid };
  doJoin((err) => {
    if (err) { creds = null; $('err').textContent = err; return; }
    $('join').classList.add('hidden');
    $('chat').classList.remove('hidden');
    $('input').focus();
  });
};

socket.on('connect', () => { if (creds) doJoin(() => {}); });
socket.on('disconnect', () => { peerOnline = false; peerTyping = false; updateHeader(true); });

/* ---------- Header / Presence / Mood ---------- */
function updateHeader(reconnecting) {
  $('peerName').textContent = peerName || 'Waiting for your friend…';
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

/* ---------- Mood Selector ---------- */
$('moodBtn').onclick = (e) => {
  e.stopPropagation();
  $('moodMenu').classList.toggle('hidden');
};
document.addEventListener('click', () => $('moodMenu').classList.add('hidden'));
$('moodMenu').querySelectorAll('button').forEach((btn) => {
  btn.onclick = () => {
    myMood = btn.dataset.mood;
    $('myMoodIcon').textContent = myMood ? myMood.split(' ')[0] : '😊';
    socket.emit('mood', myMood);
    showToast(myMood ? `Mood set to ${myMood}` : 'Mood cleared');
  };
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
    showToast('🔗 Invite link copied to clipboard!');
  }).catch(() => {
    showToast(`Room Passkey: ${creds.room}`);
  });
};

/* ---------- Panic Mode (Esc Key or Button) ---------- */
function togglePanic() {
  $('panicScreen').classList.toggle('hidden');
}
$('panicBtn').onclick = togglePanic;
$('exitPanicBtn').onclick = togglePanic;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') togglePanic();
});

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
  }, 10000); // Vanishes 10 seconds after being seen
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

  // Quick hover reaction bar
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
  meta.append(rb, el('span', '', fmtTime(m.time)));

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
  if (!image) { input.value = ''; input.style.height = 'auto'; }
  setReply(null);
  stopTyping();
}

$('send').onclick = () => send();
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
});
$('input').addEventListener('input', (e) => {
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
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
