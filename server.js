// server.js - Express serves /public, Socket.io relays messages between 2 people per room.
// State is in memory: rooms vanish if the server restarts.
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e6 }); // allow ~5MB image payloads
app.use(express.static('public'));

const rooms = {}; // passkey -> { users: { socketId: {name, cid} }, history: [] }
const clip = (v, n) => String(v || '').slice(0, n);

io.on('connection', (socket) => {
  let code = null, me = null;

  socket.on('join', ({ name, room, cid }, cb) => {
    name = clip(name, 24).trim();
    room = clip(room, 64).trim();
    if (!name || room.length < 4) return cb({ error: 'Enter a name and a passkey of 4+ characters.' });

    const r = (rooms[room] = rooms[room] || { users: {}, history: [] });

    // Same browser tab reconnecting: drop its stale socket first
    for (const id of Object.keys(r.users)) {
      if (r.users[id].cid === cid) {
        delete r.users[id];
        const old = io.sockets.sockets.get(id);
        if (old) old.disconnect(true);
      }
    }
    if (Object.keys(r.users).length >= 2) return cb({ error: 'This room already has 2 people.' });

    me = { name, cid };
    code = room;
    r.users[socket.id] = me;
    socket.join(room);

    const peer = Object.values(r.users).find((u) => u.cid !== cid);
    cb({ ok: true, history: r.history, peer: peer ? peer.name : null });

    // Tell the friend we are online, and mark their pending messages delivered
    socket.to(room).emit('presence', { online: true, name });
    const ids = r.history.filter((m) => m.from !== cid && m.status === 'sent').map((m) => (m.status = 'delivered', m.id));
    if (ids.length) socket.to(room).emit('status', { ids, status: 'delivered' });
  });

  socket.on('msg', (m, cb) => {
    if (!code || !me) return;
    const r = rooms[code];
    const peerOnline = Object.keys(r.users).length > 1;
    const clean = {
      id: clip(m.id, 40),
      from: me.cid,
      name: me.name,
      text: clip(m.text, 4000),
      image: typeof m.image === 'string' && m.image.startsWith('data:image/') ? m.image : null,
      reply: m.reply ? { name: clip(m.reply.name, 24), text: clip(m.reply.text, 120) } : null,
      time: Date.now(),
      status: peerOnline ? 'delivered' : 'sent',
    };
    r.history.push(clean);
    if (r.history.length > 200) r.history.shift();
    socket.to(code).emit('msg', clean);
    cb && cb(clean.status);
  });

  socket.on('seen', (ids) => {
    if (!code || !Array.isArray(ids)) return;
    rooms[code].history.forEach((m) => { if (ids.includes(m.id) && m.from !== me.cid) m.status = 'seen'; });
    socket.to(code).emit('status', { ids, status: 'seen' });
  });

  socket.on('typing', (v) => code && socket.to(code).emit('typing', !!v));

  socket.on('clear', () => {
    if (!code) return;
    rooms[code].history = [];
    io.to(code).emit('clear');
  });

  socket.on('disconnect', () => {
    if (!code || !rooms[code] || !rooms[code].users[socket.id]) return;
    delete rooms[code].users[socket.id];
    socket.to(code).emit('typing', false);
    socket.to(code).emit('presence', { online: false });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Duo Chat running on http://localhost:${PORT}`));
