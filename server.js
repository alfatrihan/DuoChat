// server.js - DuoChat v5 Backend (Multi-Inbox Messenger, Friend Requests, Real-time Mini-Games, Synced Weather)
const express = require('express');
const http = require('http');
const fs = require('node:fs');
const path = require('node:path');
const accounts = require('./accounts');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e6 });

for (const file of ['index.html', 'style.css', 'script.js']) {
  app.get(file === 'index.html' ? '/' : '/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const convFile = path.join(dataDir, 'conversations.json');
const conversations = fs.existsSync(convFile) ? JSON.parse(fs.readFileSync(convFile, 'utf8')) : Object.create(null);

let savingConvs = Promise.resolve();
function persistConversations() {
  savingConvs = savingConvs.catch(() => {}).then(async () => {
    const serializable = {};
    for (const [key, conv] of Object.entries(conversations)) {
      serializable[key] = {
        history: conv.history || [],
        weather: conv.weather || 'clear'
      };
    }
    await fs.promises.writeFile(convFile + '.tmp', JSON.stringify(serializable), { mode: 0o600 });
    await fs.promises.rename(convFile + '.tmp', convFile);
  });
  return savingConvs;
}

const activeGames = Object.create(null); // roomKey -> game object
const onlineUsers = new Map(); // userId -> { sockets: Set<string>, mood: string }

const clip = (v, n) => String(v || '').slice(0, n);
const VALID_WEATHERS = ['clear', 'rain', 'storm', 'snow', 'stars', 'petals'];

function getRoomKey(idA, idB) {
  return [String(idA), String(idB)].sort().join('::');
}

function getConversation(roomKey) {
  if (!conversations[roomKey]) {
    conversations[roomKey] = { history: [], weather: 'clear' };
  }
  return conversations[roomKey];
}

function isUserOnline(userId) {
  const entry = onlineUsers.get(userId);
  return !!(entry && entry.sockets.size > 0);
}

function emitToUser(userId, event, payload) {
  io.to('user:' + userId).emit(event, payload);
}

function publicGame(g, cid) {
  if (!g) return null;
  if (g.type !== 'rps') return g;
  return {
    ...g,
    choices: Object.fromEntries(
      Object.entries(g.choices || {}).map(([id, val]) => [id, id === cid ? val : 'locked'])
    )
  };
}

function broadcastGame(roomKey, players) {
  const g = activeGames[roomKey] || null;
  for (const pid of players) {
    emitToUser(pid, 'game-state', { roomKey, game: publicGame(g, pid) });
  }
}

function buildInboxList(userId) {
  const social = accounts.getSocialState(userId);
  const friends = social.friends.map((f) => {
    const rk = getRoomKey(userId, f.id);
    const conv = getConversation(rk);
    const lastMsg = conv.history[conv.history.length - 1] || null;
    const unread = conv.history.filter((m) => m.from === f.id && m.status !== 'seen').length;
    const onlineEntry = onlineUsers.get(f.id);
    return {
      ...f,
      roomKey: rk,
      online: isUserOnline(f.id),
      mood: onlineEntry ? onlineEntry.mood : '',
      lastMessage: lastMsg
        ? {
            text: lastMsg.spoiler ? '🔒 Spoiler message' : lastMsg.image ? '📷 Photo' : lastMsg.text,
            time: lastMsg.time,
            fromMe: lastMsg.from === userId
          }
        : null,
      unread
    };
  });

  // Sort by most recent activity
  friends.sort((a, b) => {
    const ta = a.lastMessage ? a.lastMessage.time : 0;
    const tb = b.lastMessage ? b.lastMessage.time : 0;
    return tb - ta;
  });

  return {
    friends,
    incoming: social.incoming,
    outgoing: social.outgoing
  };
}

function notifyFriendsPresence(userId) {
  const me = accounts.getById(userId);
  if (!me) return;
  const online = isUserOnline(userId);
  const mood = onlineUsers.get(userId)?.mood || '';
  for (const fid of me.friends) {
    emitToUser(fid, 'friend-presence', {
      userId,
      online,
      mood,
      name: me.name,
      gender: me.gender,
      avatar: me.avatar
    });
  }
}

io.on('connection', (socket) => {
  accounts.install(socket);
  let currentUser = null;
  let activePeerId = null;

  function bindUser(user) {
    if (currentUser && currentUser.id !== user.id) {
      cleanupSocket();
    }
    currentUser = user;
    socket.join('user:' + user.id);
    let entry = onlineUsers.get(user.id);
    if (!entry) {
      entry = { sockets: new Set(), mood: '' };
      onlineUsers.set(user.id, entry);
    }
    entry.sockets.add(socket.id);
    notifyFriendsPresence(user.id);
  }

  function cleanupSocket() {
    if (!currentUser) return;
    const uid = currentUser.id;
    const entry = onlineUsers.get(uid);
    if (entry) {
      entry.sockets.delete(socket.id);
      if (entry.sockets.size === 0) {
        onlineUsers.delete(uid);
        notifyFriendsPresence(uid);
      }
    }
    if (activePeerId) {
      emitToUser(activePeerId, 'typing', { from: uid, typing: false });
    }
  }

  socket.on('session-init', (token, cb = () => {}) => {
    const user = accounts.lookup(token);
    if (!user) return cb({ error: 'Please sign in again.' });
    bindUser(user);
    cb({
      ok: true,
      user: accounts.publicUser(user),
      inbox: buildInboxList(user.id)
    });
  });

  socket.on('users-search', (query, cb = () => {}) => {
    if (!currentUser) return cb({ error: 'Not signed in.' });
    const results = accounts.searchUsers(query, currentUser.id);
    cb({ results });
  });

  socket.on('friend-request', async (targetUsername, cb = () => {}) => {
    if (!currentUser) return cb({ error: 'Not signed in.' });
    try {
      const res = await accounts.sendFriendRequest(currentUser.id, targetUsername);
      if (res.status === 'accepted') {
        emitToUser(res.friend.id, 'friend-accepted', { by: accounts.publicUser(currentUser) });
        emitToUser(res.friend.id, 'inbox-sync', buildInboxList(res.friend.id));
      } else {
        emitToUser(res.target.id, 'friend-request-received', { from: res.from });
        emitToUser(res.target.id, 'inbox-sync', buildInboxList(res.target.id));
      }
      cb({ ok: true, status: res.status, inbox: buildInboxList(currentUser.id) });
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on('friend-accept', async (requesterId, cb = () => {}) => {
    if (!currentUser) return cb({ error: 'Not signed in.' });
    try {
      const res = await accounts.acceptFriendRequest(currentUser.id, requesterId);
      emitToUser(requesterId, 'friend-accepted', { by: res.me });
      emitToUser(requesterId, 'inbox-sync', buildInboxList(requesterId));
      cb({ ok: true, inbox: buildInboxList(currentUser.id), friend: res.friend });
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on('friend-decline', async (requesterId, cb = () => {}) => {
    if (!currentUser) return cb({ error: 'Not signed in.' });
    try {
      await accounts.declineFriendRequest(currentUser.id, requesterId);
      emitToUser(requesterId, 'inbox-sync', buildInboxList(requesterId));
      cb({ ok: true, inbox: buildInboxList(currentUser.id) });
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on('friend-cancel', async (targetId, cb = () => {}) => {
    if (!currentUser) return cb({ error: 'Not signed in.' });
    try {
      await accounts.cancelFriendRequest(currentUser.id, targetId);
      emitToUser(targetId, 'inbox-sync', buildInboxList(targetId));
      cb({ ok: true, inbox: buildInboxList(currentUser.id) });
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on('open-chat', (peerId, cb = () => {}) => {
    if (!currentUser) return cb({ error: 'Not signed in.' });
    const me = accounts.getById(currentUser.id);
    const peer = accounts.getById(peerId);
    if (!me || !peer || !me.friends.includes(peer.id)) {
      return cb({ error: 'You can only chat with accepted friends.' });
    }

    activePeerId = peer.id;
    const roomKey = getRoomKey(me.id, peer.id);
    const conv = getConversation(roomKey);

    // Mark undelivered peer messages as delivered
    const deliveredIds = [];
    for (const m of conv.history) {
      if (m.from === peer.id && m.status === 'sent') {
        m.status = 'delivered';
        deliveredIds.push(m.id);
      }
    }
    if (deliveredIds.length) {
      persistConversations();
      emitToUser(peer.id, 'status', { roomKey, ids: deliveredIds, status: 'delivered' });
    }

    const peerEntry = onlineUsers.get(peer.id);
    cb({
      ok: true,
      roomKey,
      peer: {
        ...accounts.publicUser(peer),
        online: isUserOnline(peer.id),
        mood: peerEntry ? peerEntry.mood : ''
      },
      history: conv.history,
      weather: conv.weather || 'clear',
      game: publicGame(activeGames[roomKey] || null, me.id)
    });
  });

  socket.on('weather', ({ peerId, weather } = {}) => {
    if (!currentUser || !peerId) return;
    const me = accounts.getById(currentUser.id);
    if (!me || !me.friends.includes(peerId)) return;

    const cleanW = VALID_WEATHERS.includes(weather) ? weather : 'clear';
    const roomKey = getRoomKey(me.id, peerId);
    const conv = getConversation(roomKey);
    conv.weather = cleanW;
    persistConversations();

    emitToUser(peerId, 'weather', { roomKey, weather: cleanW, by: me.name });
  });

  socket.on('msg', (m = {}, cb = () => {}) => {
    if (!currentUser || !m || typeof m !== 'object') return;
    const peerId = String(m.to || '');
    const me = accounts.getById(currentUser.id);
    if (!me || !me.friends.includes(peerId)) return cb({ error: 'You can only message accepted friends.' });

    const roomKey = getRoomKey(me.id, peerId);
    const conv = getConversation(roomKey);
    const peerOnline = isUserOnline(peerId);

    const clean = {
      id: clip(m.id, 40),
      roomKey,
      from: me.id,
      to: peerId,
      name: me.name,
      text: clip(m.text, 4000),
      image: typeof m.image === 'string' && m.image.startsWith('data:image/') ? m.image : null,
      reply: m.reply ? { name: clip(m.reply.name, 24), text: clip(m.reply.text, 120) } : null,
      vanish: !!m.vanish,
      spoiler: !!m.spoiler,
      reaction: null,
      time: Date.now(),
      status: peerOnline ? 'delivered' : 'sent'
    };

    if (!clean.id || (!clean.text.trim() && !clean.image)) return;
    if (conv.history.some((item) => item.id === clean.id)) return cb(clean.status);

    conv.history.push(clean);
    if (conv.history.length > 250) conv.history.shift();
    persistConversations();

    emitToUser(peerId, 'msg', clean);
    // Also notify sender's other tabs if open
    socket.to('user:' + me.id).emit('msg', clean);
    cb(clean.status);
  });

  socket.on('seen', ({ peerId, ids } = {}) => {
    if (!currentUser || !peerId || !Array.isArray(ids) || !ids.length) return;
    const roomKey = getRoomKey(currentUser.id, peerId);
    const conv = getConversation(roomKey);
    let changed = false;

    conv.history.forEach((m) => {
      if (ids.includes(m.id) && m.from === peerId && m.status !== 'seen') {
        m.status = 'seen';
        changed = true;
        if (m.vanish) {
          setTimeout(() => {
            const c = getConversation(roomKey);
            c.history = c.history.filter((item) => item.id !== m.id);
            persistConversations();
          }, 10000);
        }
      }
    });

    if (changed) persistConversations();
    emitToUser(peerId, 'status', { roomKey, ids, status: 'seen' });
  });

  socket.on('react', ({ peerId, id, emoji } = {}) => {
    if (!currentUser || !peerId || !id) return;
    const roomKey = getRoomKey(currentUser.id, peerId);
    const conv = getConversation(roomKey);
    const cleanEmoji = clip(emoji, 8);
    const msg = conv.history.find((m) => m.id === id);
    if (msg) {
      msg.reaction = cleanEmoji;
      persistConversations();
    }
    emitToUser(peerId, 'react', { roomKey, id, emoji: cleanEmoji });
  });

  socket.on('edit-message', ({ peerId, id, text } = {}, cb = () => {}) => {
    if (!currentUser || !peerId || !id) return;
    const roomKey = getRoomKey(currentUser.id, peerId);
    const conv = getConversation(roomKey);
    const msg = conv.history.find((item) => item.id === id);
    if (!msg || msg.from !== currentUser.id || msg.vanish || msg.image) {
      return cb({ error: 'This message cannot be edited.' });
    }
    const cleanText = clip(text, 4000).trim();
    if (!cleanText) return cb({ error: 'Message cannot be empty.' });
    msg.text = cleanText;
    msg.edited = true;
    persistConversations();

    const payload = { roomKey, id, text: cleanText, edited: true };
    emitToUser(peerId, 'message-edited', payload);
    emitToUser(currentUser.id, 'message-edited', payload);
    cb({ ok: true });
  });

  socket.on('delete-message', ({ peerId, id } = {}, cb = () => {}) => {
    if (!currentUser || !peerId || !id) return;
    const roomKey = getRoomKey(currentUser.id, peerId);
    const conv = getConversation(roomKey);
    const index = conv.history.findIndex((item) => item.id === id);
    if (index < 0 || conv.history[index].from !== currentUser.id) {
      return cb({ error: 'You can only delete your own message for everyone.' });
    }
    conv.history.splice(index, 1);
    persistConversations();

    const payload = { roomKey, id };
    emitToUser(peerId, 'message-deleted', payload);
    emitToUser(currentUser.id, 'message-deleted', payload);
    cb({ ok: true });
  });

  socket.on('clear', ({ peerId } = {}) => {
    if (!currentUser || !peerId) return;
    const roomKey = getRoomKey(currentUser.id, peerId);
    const conv = getConversation(roomKey);
    conv.history = [];
    persistConversations();
    emitToUser(peerId, 'clear', { roomKey });
    emitToUser(currentUser.id, 'clear', { roomKey });
  });

  socket.on('mood', (mood) => {
    if (!currentUser) return;
    const cleanMood = clip(mood, 32);
    const entry = onlineUsers.get(currentUser.id);
    if (entry) entry.mood = cleanMood;
    notifyFriendsPresence(currentUser.id);
  });

  socket.on('nudge', ({ peerId } = {}) => {
    if (!currentUser || !peerId) return;
    const me = accounts.getById(currentUser.id);
    if (!me || !me.friends.includes(peerId)) return;
    emitToUser(peerId, 'nudge', { fromId: me.id, fromName: me.name });
  });

  socket.on('typing', ({ peerId, typing } = {}) => {
    if (!currentUser || !peerId) return;
    emitToUser(peerId, 'typing', { from: currentUser.id, typing: !!typing });
  });

  // ---------- Authoritative Real-Time Mini-Games (Tic-Tac-Toe, RPS, Connect Four) ----------
  socket.on('game-start', ({ peerId, type } = {}, cb = () => {}) => {
    if (!currentUser || !peerId) return;
    const me = accounts.getById(currentUser.id);
    if (!me || !me.friends.includes(peerId)) return cb({ error: 'Friends only.' });
    if (!['tictactoe', 'rps', 'connect4'].includes(type)) return cb({ error: 'Unknown game.' });
    if (!isUserOnline(peerId)) return cb({ error: 'Your friend must be online to start a game.' });

    const roomKey = getRoomKey(me.id, peerId);
    const players = [me.id, peerId];

    if (type === 'tictactoe') {
      activeGames[roomKey] = {
        type: 'tictactoe',
        players,
        board: Array(9).fill(''),
        winLine: null,
        turn: me.id,
        marks: { [me.id]: 'X', [peerId]: 'O' },
        scores: { [me.id]: 0, [peerId]: 0 },
        result: null,
        winnerId: null
      };
    } else if (type === 'rps') {
      activeGames[roomKey] = {
        type: 'rps',
        players,
        round: 1,
        choices: {},
        scores: { [me.id]: 0, [peerId]: 0 },
        lastRound: null,
        matchWinner: null
      };
    } else if (type === 'connect4') {
      // 6 rows x 7 cols = 42 cells (row 0 = top, row 5 = bottom)
      activeGames[roomKey] = {
        type: 'connect4',
        players,
        board: Array(42).fill(''),
        winCells: null,
        lastCol: null,
        lastRow: null,
        turn: me.id,
        colors: { [me.id]: 'R', [peerId]: 'Y' },
        scores: { [me.id]: 0, [peerId]: 0 },
        result: null,
        winnerId: null
      };
    }

    broadcastGame(roomKey, players);
    cb({ ok: true });
  });

  socket.on('game-action', (payload = {}, cb = () => {}) => {
    if (!currentUser || !payload || !payload.peerId) return;
    const peerId = String(payload.peerId);
    const roomKey = getRoomKey(currentUser.id, peerId);
    const g = activeGames[roomKey];
    if (!g || g.type !== payload.type) return cb({ error: 'No active game found.' });
    if (!g.players.includes(currentUser.id)) return cb({ error: 'Not a participant.' });

    const me = accounts.getById(currentUser.id);
    const peer = accounts.getById(peerId);

    if (g.type === 'tictactoe') {
      if (g.result) return cb({ error: 'Round already ended.' });
      if (g.turn !== currentUser.id) return cb({ error: 'Wait for your turn.' });
      const i = payload.index;
      if (!Number.isInteger(i) || i < 0 || i > 8 || g.board[i]) {
        return cb({ error: 'Cell is unavailable.' });
      }
      g.board[i] = g.marks[currentUser.id];
      const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];
      const hit = lines.find((line) => g.board[line[0]] && line.every((n) => g.board[n] === g.board[line[0]]));
      if (hit) {
        g.winLine = hit;
        g.winnerId = currentUser.id;
        g.scores[currentUser.id] = (g.scores[currentUser.id] || 0) + 1;
        g.result = `${me ? me.name : 'Player'} wins!`;
      } else if (g.board.every(Boolean)) {
        g.result = 'Draw match!';
      } else {
        g.turn = peerId;
      }
      broadcastGame(roomKey, g.players);
    } else if (g.type === 'rps') {
      if (g.matchWinner) return cb({ error: 'Match finished. Start a new match!' });
      const choice = payload.choice;
      if (!['rock', 'paper', 'scissors'].includes(choice)) return cb({ error: 'Invalid move.' });
      if (g.choices[currentUser.id]) return cb({ error: 'Choice already locked in.' });

      g.choices[currentUser.id] = choice;
      if (g.players.every((id) => g.choices[id])) {
        const [a, b] = g.players;
        const ca = g.choices[a];
        const cbChoice = g.choices[b];
        let winner = null;
        if (ca !== cbChoice) {
          const aWins =
            (ca === 'rock' && cbChoice === 'scissors') ||
            (ca === 'paper' && cbChoice === 'rock') ||
            (ca === 'scissors' && cbChoice === 'paper');
          winner = aWins ? a : b;
        }
        if (winner) g.scores[winner] = (g.scores[winner] || 0) + 1;
        g.matchWinner = g.players.find((id) => (g.scores[id] || 0) >= 2) || null;
        g.lastRound = {
          round: g.round,
          choices: { [a]: ca, [b]: cbChoice },
          winner
        };
        g.choices = {};
        if (!g.matchWinner) g.round += 1;
      }
      broadcastGame(roomKey, g.players);
    } else if (g.type === 'connect4') {
      if (g.result) return cb({ error: 'Round already ended.' });
      if (g.turn !== currentUser.id) return cb({ error: 'Wait for your turn.' });
      const col = payload.col;
      if (!Number.isInteger(col) || col < 0 || col > 6) return cb({ error: 'Invalid column.' });

      // Find lowest empty row in column (rows 5 down to 0)
      let targetRow = -1;
      for (let r = 5; r >= 0; r--) {
        if (!g.board[r * 7 + col]) {
          targetRow = r;
          break;
        }
      }
      if (targetRow === -1) return cb({ error: 'That column is full!' });

      const color = g.colors[currentUser.id];
      g.board[targetRow * 7 + col] = color;
      g.lastCol = col;
      g.lastRow = targetRow;

      const winCells = checkConnect4Win(g.board, targetRow, col, color);
      if (winCells) {
        g.winCells = winCells;
        g.winnerId = currentUser.id;
        g.scores[currentUser.id] = (g.scores[currentUser.id] || 0) + 1;
        g.result = `${me ? me.name : 'Player'} connects four!`;
      } else if (g.board.every(Boolean)) {
        g.result = 'Board full — Draw!';
      } else {
        g.turn = peerId;
      }
      broadcastGame(roomKey, g.players);
    }

    cb({ ok: true });
  });

  socket.on('game-reset', ({ peerId } = {}) => {
    if (!currentUser || !peerId) return;
    const roomKey = getRoomKey(currentUser.id, peerId);
    const g = activeGames[roomKey];
    if (!g) return;

    if (g.type === 'tictactoe') {
      // Swap X and O on rematch for fairness
      const [p1, p2] = g.players;
      const prevP1Mark = g.marks[p1];
      g.marks[p1] = prevP1Mark === 'X' ? 'O' : 'X';
      g.marks[p2] = prevP1Mark;
      g.board = Array(9).fill('');
      g.winLine = null;
      g.result = null;
      g.winnerId = null;
      g.turn = g.marks[p1] === 'X' ? p1 : p2;
    } else if (g.type === 'rps') {
      g.round = 1;
      g.choices = {};
      g.scores = { [g.players[0]]: 0, [g.players[1]]: 0 };
      g.lastRound = null;
      g.matchWinner = null;
    } else if (g.type === 'connect4') {
      g.board = Array(42).fill('');
      g.winCells = null;
      g.lastCol = null;
      g.lastRow = null;
      g.result = null;
      g.winnerId = null;
      g.turn = currentUser.id;
    }
    broadcastGame(roomKey, g.players);
  });

  socket.on('game-close', ({ peerId } = {}) => {
    if (!currentUser || !peerId) return;
    const roomKey = getRoomKey(currentUser.id, peerId);
    const g = activeGames[roomKey];
    if (!g) return;
    const players = g.players;
    delete activeGames[roomKey];
    broadcastGame(roomKey, players);
  });

  socket.on('disconnect', () => {
    cleanupSocket();
  });
});

function checkConnect4Win(board, row, col, color) {
  const dirs = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal down-right
    [1, -1]  // diagonal down-left
  ];
  for (const [dr, dc] of dirs) {
    const cells = [row * 7 + col];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r * 7 + c] === color) {
        cells.push(r * 7 + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`DuoChat v5 running on http://localhost:${PORT}`));
