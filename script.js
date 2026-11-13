// script.js - client logic: join, send/receive, ticks, typing, presence, replies, images, emoji, theme
const $ = (id) => document.getElementById(id);
const socket = io();

// Per-tab identity so reconnects are recognised and "mine vs theirs" survives socket id changes
const rnd = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const cid = sessionStorage.getItem('cid') || (sessionStorage.cid = rnd());

let creds = null;      // {name, room, cid} used for (re)joining
let peerName = '';
let peerOnline = false, peerTyping = false;
let replyTo = null;
const items = {};      // message id -> { m, tick, seenSent }

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

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
  socket.emit('join', creds, (res) => {
    if (res.error) return onDone(res.error);
    $('msgs').innerHTML = '';
    Object.keys(items).forEach((k) => delete items[k]);
    const other = [...res.history].reverse().find((m) => m.from !== cid);
    peerName = res.peer || (other && other.name) || '';
    peerOnline = !!res.peer;
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
// Automatically rejoin after a network drop
socket.on('connect', () => { if (creds) doJoin(() => {}); });
socket.on('disconnect', () => { peerOnline = false; peerTyping = false; updateHeader(true); });

/* ---------- Header / presence ---------- */
function updateHeader(reconnecting) {
  $('peerName').textContent = peerName || 'Waiting for your friend…';
  $('avatar').textContent = (peerName || '?')[0].toUpperCase();
  const s = $('status');
  s.textContent = reconnecting ? 'Reconnecting…' : peerTyping ? 'typing…' : peerOnline ? 'Online' : 'Offline';
  s.className = peerOnline && !reconnecting ? 'on' : 'off';
}
socket.on('presence', ({ online, name }) => {
  peerOnline = online;
  if (name) peerName = name;
  if (!online) peerTyping = false;
  updateHeader();
});
socket.on('typing', (v) => { peerTyping = v; updateHeader(); });

/* ---------- Rendering ---------- */
const TICKS = { sending: '🕒', sent: '✓', delivered: '✓✓', seen: '✓✓' };
function setStatus(id, status) {
  const it = items[id];
  if (!it || !it.tick) return;
  it.tick.textContent = TICKS[status] || '✓';
  it.tick.className = 'tick ' + status;
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
  const d = el('div', 'm ' + (mine ? 'me' : 'them'));
  if (m.reply) {
    const q = el('div', 'q');
    q.append(el('b', '', m.reply.name), el('span', '', m.reply.text));
    d.append(q);
  }
  if (m.image) {
    const i = el('img', 'pic');
    i.src = m.image;
    i.onclick = () => openImage(m.image);
    i.onload = scrollDown;
    d.append(i);
  }
  if (m.text) d.append(el('div', 'txt', m.text)); // textContent => no HTML injection

  const meta = el('div', 'meta');
  const rb = el('button', 'rb', '↩');
  rb.title = 'Reply';
  rb.onclick = () => setReply({ name: m.name, text: m.text || '📷 Photo' });
  meta.append(rb, el('span', '', fmtTime(m.time)));
  let tick = null;
  if (mine) { tick = el('span', 'tick'); meta.append(tick); }
  d.append(meta);

  $('msgs').append(d);
  items[m.id] = { m, tick, seenSent: false };
  if (mine) setStatus(m.id, m.status);
  scrollDown();
}
function scrollDown() { const c = $('msgs'); c.scrollTop = c.scrollHeight; }

/* ---------- Sending ---------- */
function send(image) {
  const input = $('input');
  const text = image ? '' : input.value.trim();
  if (!text && !image) return;
  const m = { id: cid.slice(0, 6) + rnd(), text, image: image || null, reply: replyTo };
  render({ ...m, from: cid, name: creds.name, time: Date.now(), status: 'sending' });
  socket.emit('msg', m, (status) => setStatus(m.id, status));
  if (!image) { input.value = ''; input.style.height = 'auto'; }
  setReply(null);
  stopTyping();
}
$('send').onclick = () => send();
$('input').addEventListener('keydown', (e) => {
  // Enter sends, Shift+Enter makes a new line
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

/* ---------- Receiving, status, seen ---------- */
socket.on('msg', (m) => {
  render(m);
  if (document.hidden || !document.hasFocus()) beep();
  markSeen();
});
socket.on('status', ({ ids, status }) => ids.forEach((id) => setStatus(id, status)));
function markSeen() {
  if (document.hidden || !document.hasFocus()) return;
  const ids = Object.values(items).filter((it) => it.m.from !== cid && !it.seenSent).map((it) => (it.seenSent = true, it.m.id));
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

/* ---------- Emoji picker ---------- */
Array.from('😀😁😂🤣😊😍😘😎🤔😅😭😡🥳😴🤗🙄😉😇🥺😢👍👎👏🙌🙏💪👋🤝❤️💔🔥✨🎉🎂🍕☕🌹⭐💯✅❌👀🚀🌙☀️🎵').forEach((ch) => {
  const b = el('button', '', ch);
  b.onclick = () => { $('input').value += ch; $('input').focus(); };
  $('emojis').append(b);
});
$('emojiBtn').onclick = () => $('emojis').classList.toggle('hidden');

/* ---------- Images (resized client-side to keep payloads small) ---------- */
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

/* ---------- Clear chat (wipes for both people) ---------- */
$('clearBtn').onclick = () => { if (confirm('Clear the whole conversation for both of you?')) socket.emit('clear'); };
socket.on('clear', () => { $('msgs').innerHTML = ''; Object.keys(items).forEach((k) => delete items[k]); });

/* ---------- Notification sound (only when the tab is inactive) ---------- */
let audio;
function beep() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.25);
  } catch (e) {}
}
