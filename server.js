// server.js - DuoChat v4 Backend (DuoPlay, Message Management, Synced Weather Atmosphere)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e6 });
app.use(express.static(__dirname));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const rooms = {}; // passkey -> { users: { socketId: {name, cid, mood} }, history: [], weather: 'clear' }
const clip = (v, n) => String(v || '').slice(0, n);
const VALID_WEATHERS = ['clear', 'rain', 'storm', 'snow', 'stars', 'petals'];

io.on('connection', (socket) => {
  let code = null, me = null;

  socket.on('join', ({ name, room, cid, mood }, cb) => {
    name = clip(name, 24).trim();
    room = clip(room, 64).trim();
    if (!name || room.length < 4) return cb({ error: 'Enter a name and a passkey of 4+ characters.' });

    const r = (rooms[room] = rooms[room] || { users: {}, history: [], weather: 'clear', game: null });

    for (const id of Object.keys(r.users)) {
      if (r.users[id].cid === cid) {
        delete r.users[id];
        const old = io.sockets.sockets.get(id);
        if (old) old.disconnect(true);
      }
    }
    if (Object.keys(r.users).length >= 2) return cb({ error: 'This room already has 2 people.' });

    me = { name, cid, mood: clip(mood, 32) };
    code = room;
    r.users[socket.id] = me;
    socket.join(room);

    const peer = Object.values(r.users).find((u) => u.cid !== cid);
    cb({
      ok: true,
      history: r.history,
      peer: peer ? peer.name : null,
      peerMood: peer ? peer.mood : '',
      weather: r.weather || 'clear',
      game: r.game || null
    });

    socket.to(room).emit('presence', { online: true, name, mood: me.mood });
    const ids = r.history.filter((m) => m.from !== cid && m.status === 'sent').map((m) => (m.status = 'delivered', m.id));
    if (ids.length) socket.to(room).emit('status', { ids, status: 'delivered' });
  });

  socket.on('weather', (w) => {
    if (!code || !me) return;
    const cleanW = VALID_WEATHERS.includes(w) ? w : 'clear';
    rooms[code].weather = cleanW;
    socket.to(code).emit('weather', { weather: cleanW, by: me.name });
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
      vanish: !!m.vanish,
      spoiler: !!m.spoiler,
      reaction: null,
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
    const r = rooms[code];
    r.history.forEach((m) => {
      if (ids.includes(m.id) && m.from !== me.cid) {
        m.status = 'seen';
        if (m.vanish) {
          setTimeout(() => {
            r.history = r.history.filter((item) => item.id !== m.id);
          }, 10000);
        }
      }
    });
    socket.to(code).emit('status', { ids, status: 'seen' });
  });

  socket.on('react', ({ id, emoji }) => {
    if (!code || !id) return;
    const cleanEmoji = clip(emoji, 8);
    const msg = rooms[code].history.find((m) => m.id === id);
    if (msg) msg.reaction = cleanEmoji;
    socket.to(code).emit('react', { id, emoji: cleanEmoji });
  });

  socket.on('edit-message', ({ id, text }, cb) => {
    if (!code || !me || !id) return;
    const r = rooms[code];
    const msg = r.history.find((item) => item.id === id);
    if (!msg || msg.from !== me.cid || msg.vanish || msg.image) return cb && cb({ error: 'This message cannot be edited.' });
    const cleanText = clip(text, 4000).trim();
    if (!cleanText) return cb && cb({ error: 'Message cannot be empty.' });
    msg.text = cleanText;
    msg.edited = true;
    io.to(code).emit('message-edited', { id, text: cleanText, edited: true });
    cb && cb({ ok: true });
  });

  socket.on('delete-message', ({ id }, cb) => {
    if (!code || !me || !id) return;
    const r = rooms[code];
    const index = r.history.findIndex((item) => item.id === id);
    if (index < 0 || r.history[index].from !== me.cid) return cb && cb({ error: 'You can only delete your own message for everyone.' });
    r.history.splice(index, 1);
    io.to(code).emit('message-deleted', { id });
    cb && cb({ ok: true });
  });

  // DuoPlay events: the server is authoritative for turn order and results.
  socket.on('game-start', ({ type }, cb) => {
    if (!code || !me) return;
    const valid = ['truth', 'tictactoe', 'rps'];
    if (!valid.includes(type)) return cb && cb({ error: 'Unknown game.' });
    const r = rooms[code];
    if (Object.keys(r.users).length < 2) return cb && cb({ error: 'Your friend must join before starting a game.' });
    if (type === 'tictactoe') {
      r.game = { type, board: Array(9).fill(''), turn: me.cid, players: Object.values(r.users).map(u => u.cid), marks: { [me.cid]: 'X' } };
      const peer = Object.values(r.users).find(u => u.cid !== me.cid);
      r.game.marks[peer.cid] = 'O';
    } else if (type === 'rps') {
      r.game = { type, round: 1, choices: {}, scores: {} };
    } else {
      r.game = { type, turn: me.cid, prompt: null, completed: false };
    }
    io.to(code).emit('game-state', r.game);
    cb && cb({ ok: true });
  });

  socket.on('game-action', (payload, cb) => {
    if (!code || !me || !payload) return;
    const r = rooms[code], g = r.game;
    if (!g || g.type !== payload.type) return cb && cb({ error: 'No active game.' });
    if (g.type === 'tictactoe') {
      const i = Number(payload.index);
      if (!Number.isInteger(i) || i < 0 || i > 8 || g.turn !== me.cid || g.board[i]) return cb && cb({ error: 'That move is not available.' });
      g.board[i] = g.marks[me.cid];
      const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const winner = lines.some(line => line.every(n => g.board[n] === g.board[line[0]])) ? me.cid : null;
      const draw = !winner && g.board.every(Boolean);
      g.result = winner ? `${me.name} wins!` : draw ? 'It is a draw!' : null;
      if (!winner && !draw) g.turn = g.players.find(id => id !== me.cid);
      io.to(code).emit('game-state', g);
    } else if (g.type === 'rps') {
      const choice = payload.choice;
      if (!['rock', 'paper', 'scissors'].includes(choice)) return cb && cb({ error: 'Invalid choice.' });
      if (g.choices[me.cid]) return cb && cb({ error: 'You already chose this round.' });
      g.choices[me.cid] = choice;
      const playerIds = Object.keys(r.users).map(id => r.users[id].cid);
      if (playerIds.every(id => g.choices[id])) {
        const [a, b] = playerIds;
        const ca = g.choices[a], cbChoice = g.choices[b];
        let winner = ca === cbChoice ? null : ((ca === 'rock' && cbChoice === 'scissors') || (ca === 'paper' && cbChoice === 'rock') || (ca === 'scissors' && cbChoice === 'paper') ? a : b);
        g.scores[a] = (g.scores[a] || 0) + (winner === a ? 1 : 0);
        g.scores[b] = (g.scores[b] || 0) + (winner === b ? 1 : 0);
        g.lastRound = { choices: { [a]: ca, [b]: cbChoice }, winner };
        g.choices = {};
        g.round += 1;
      }
      io.to(code).emit('game-state', g);
    } else if (g.type === 'truth') {
      if (g.turn !== me.cid) return cb && cb({ error: 'Wait for your turn.' });
      const action = payload.action;
      if (!['truth', 'dare', 'skip', 'next'].includes(action)) return cb && cb({ error: 'Invalid action.' });
      g.prompt = clip(payload.prompt, 240);
      g.lastAction = action;
      g.turn = Object.values(r.users).map(u => u.cid).find(id => id !== me.cid);
      io.to(code).emit('game-state', g);
    }
    cb && cb({ ok: true });
  });

  socket.on('game-reset', () => {
    if (!code || !me) return;
    const g = rooms[code].game;
    if (!g) return;
    if (g.type === 'tictactoe') {
      g.board = Array(9).fill('');
      g.turn = me.cid;
      g.result = null;
    } else if (g.type === 'rps') {
      g.round = 1; g.choices = {}; g.scores = {}; g.lastRound = null;
    } else {
      g.turn = me.cid; g.prompt = null; g.lastAction = null;
    }
    io.to(code).emit('game-state', g);
  });

  socket.on('mood', (mood) => {
    if (!code || !me) return;
    me.mood = clip(mood, 32);
    socket.to(code).emit('mood', me.mood);
  });

  socket.on('nudge', () => {
    if (!code) return;
    socket.to(code).emit('nudge');
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
