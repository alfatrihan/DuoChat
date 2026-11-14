const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 12 * 1e6 });

const DATA_FILE = path.join(__dirname, 'chat-store.json');

function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return {
        users: parsed.users || {},
        requests: parsed.requests || [],
        messages: parsed.messages || []
      };
    }
  } catch (e) {}
  return { users: {}, requests: [], messages: [] };
}

const store = loadStore();
function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (e) {}
}

const sessions = new Map();
const onlineUsers = new Map(); // username -> Set<socket.id>
const quickRooms = new Map();  // roomCode -> Map<socket.id, guestUser>

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  const [salt, orig] = String(stored || '').split(':');
  if (!salt || !orig) return false;
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(orig, 'hex'));
}

function publicUser(u) {
  return {
    username: u.username,
    name: u.name,
    avatar: u.avatar || 'brother-1',
    mood: u.mood || '',
    aura: u.aura || '',
    online: onlineUsers.has(u.username),
    lastSeen: u.lastSeen || Date.now()
  };
}

function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const username = sessions.get(token);
  if (!username || !store.users[username]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = store.users[username];
  next();
}

/* =========================================================
   AUTHENTICATION & FRIEND ROUTES
   ========================================================= */
app.post('/api/register', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim() || username;
  const avatar = String(req.body.avatar || 'brother-1');

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–24 characters (letters, numbers, underscore).' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (store.users[username]) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  store.users[username] = {
    username,
    name: name.slice(0, 24),
    avatar,
    passwordHash: hashPassword(password),
    friends: [],
    mood: '',
    aura: '',
    lastSeen: Date.now()
  };
  saveStore();

  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, username);
  res.json({ token, user: publicUser(store.users[username]) });
});

app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = store.users[username];
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, username);
  res.json({ token, user: publicUser(user) });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/users/search', authMiddleware, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ users: [] });

  const me = req.user;
  const results = Object.values(store.users)
    .filter(u => u.username !== me.username && (u.username.includes(q) || u.name.toLowerCase().includes(q)))
    .slice(0, 15)
    .map(u => {
      let relation = 'none';
      if ((me.friends || []).includes(u.username)) relation = 'friend';
      else if (store.requests.some(r => r.from === me.username && r.to === u.username)) relation = 'outgoing';
      else if (store.requests.some(r => r.from === u.username && r.to === me.username)) relation = 'incoming';
      return { ...publicUser(u), relation };
    });

  res.json({ users: results });
});

app.post('/api/friends/request', authMiddleware, (req, res) => {
  const from = req.user.username;
  const to = String(req.body.to || '').trim().toLowerCase();
  if (!store.users[to] || to === from) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if ((req.user.friends || []).includes(to)) {
    return res.status(400).json({ error: 'Already friends.' });
  }
  if (store.requests.some(r => r.from === from && r.to === to)) {
    return res.status(400).json({ error: 'Friend request already sent.' });
  }

  const reverse = store.requests.findIndex(r => r.from === to && r.to === from);
  if (reverse !== -1) {
    store.requests.splice(reverse, 1);
    req.user.friends.push(to);
    store.users[to].friends.push(from);
    saveStore();
    io.to(`user:${to}`).emit('friend:accepted', { friend: publicUser(req.user) });
    return res.json({ ok: true, accepted: true });
  }

  store.requests.push({ from, to, at: Date.now() });
  saveStore();
  io.to(`user:${to}`).emit('friend:request', { from: publicUser(req.user) });
  res.json({ ok: true });
});

app.post('/api/friends/accept', authMiddleware, (req, res) => {
  const me = req.user.username;
  const from = String(req.body.from || '').trim().toLowerCase();
  const idx = store.requests.findIndex(r => r.from === from && r.to === me);
  if (idx === -1) return res.status(404).json({ error: 'Request not found.' });

  store.requests.splice(idx, 1);
  if (!req.user.friends.includes(from)) req.user.friends.push(from);
  if (store.users[from] && !store.users[from].friends.includes(me)) {
    store.users[from].friends.push(me);
  }
  saveStore();

  io.to(`user:${from}`).emit('friend:accepted', { friend: publicUser(req.user) });
  res.json({ ok: true });
});

app.post('/api/friends/decline', authMiddleware, (req, res) => {
  const me = req.user.username;
  const from = String(req.body.from || '').trim().toLowerCase();
  store.requests = store.requests.filter(r => !(r.from === from && r.to === me));
  saveStore();
  res.json({ ok: true });
});

app.get('/api/inbox', authMiddleware, (req, res) => {
  const me = req.user;
  const incoming = store.requests
    .filter(r => r.to === me.username && store.users[r.from])
    .map(r => publicUser(store.users[r.from]));

  const friends = (me.friends || [])
    .filter(uname => store.users[uname])
    .map(uname => {
      const f = store.users[uname];
      const thread = store.messages.filter(m =>
        (m.sender === me.username && m.recipient === uname) ||
        (m.sender === uname && m.recipient === me.username)
      );
      const last = thread[thread.length - 1];
      const unread = thread.filter(m => m.sender === uname && !m.seen && !m.deleted).length;
      let preview = '';
      if (last) {
        if (last.deleted) preview = 'Message unsent';
        else if (last.type === 'image') preview = 'Photo';
        else if (last.type === 'voice') preview = 'Voice note';
        else if (last.type === 'game-invite') preview = 'DuoPlay Invite';
        else preview = last.text;
      }
      return {
        ...publicUser(f),
        unread,
        lastMessage: last ? { sender: last.sender, preview, at: last.at } : null
      };
    })
    .sort((a, b) => (b.lastMessage?.at || 0) - (a.lastMessage?.at || 0));

  res.json({ friends, requests: incoming });
});

app.get('/api/messages/:peer', authMiddleware, (req, res) => {
  const me = req.user.username;
  const peer = String(req.params.peer || '').trim().toLowerCase();
  const thread = store.messages.filter(m =>
    (m.sender === me && m.recipient === peer) ||
    (m.sender === peer && m.recipient === me)
  );
  res.json({ messages: thread });
});

/* =========================================================
   SOCKET.IO REAL-TIME ENGINE (DM + QUICK ROOMS)
   ========================================================= */
io.use((socket, next) => {
  const { token, roomCode, guestUser } = socket.handshake.auth || {};
  if (roomCode && guestUser) {
    const cleanCode = String(roomCode).trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) return next(new Error('Invalid room code'));
    socket.data.isRoom = true;
    socket.data.roomCode = cleanCode;
    socket.data.user = {
      username: String(guestUser.username || 'guest_' + socket.id.slice(0, 5)),
      name: String(guestUser.name || 'Guest').slice(0, 24),
      avatar: String(guestUser.avatar || 'brother-1'),
      mood: '',
      aura: ''
    };
    return next();
  }

  const username = sessions.get(token);
  if (!username || !store.users[username]) {
    return next(new Error('Authentication error'));
  }
  socket.data.isRoom = false;
  socket.data.username = username;
  next();
});

io.on('connection', socket => {
  /* ---------------------------------------------------------
     MODE A: INSTANT 6-DIGIT QUICK ROOM SESSION
     --------------------------------------------------------- */
  if (socket.data.isRoom) {
    const code = socket.data.roomCode;
    const me = socket.data.user;
    if (!quickRooms.has(code)) quickRooms.set(code, new Map());
    const members = quickRooms.get(code);

    if (members.size >= 2) {
      socket.emit('chat:message', {
        id: crypto.randomUUID(),
        type: 'system',
        text: 'This room already has 2 participants.',
        at: Date.now()
      });
      socket.disconnect(true);
      return;
    }

    socket.join(`room:${code}`);
    const existingPeer = Array.from(members.values())[0] || null;
    members.set(socket.id, me);

    if (existingPeer) {
      socket.emit('room:peer', { peer: existingPeer });
      socket.to(`room:${code}`).emit('room:peer', { peer: me });
      io.to(`room:${code}`).emit('chat:message', {
        id: crypto.randomUUID(),
        type: 'system',
        text: `${me.name} joined the private room.`,
        at: Date.now()
      });
    } else {
      socket.emit('chat:message', {
        id: crypto.randomUUID(),
        type: 'system',
        text: `Room ${code} created. Share the code with your partner to start.`,
        at: Date.now()
      });
    }

    socket.on('chat:send', payload => {
      const msg = {
        id: crypto.randomUUID(),
        sender: me.username,
        senderName: me.name,
        recipient: `room:${code}`,
        type: payload.type || 'text',
        text: String(payload.text || '').slice(0, 4000),
        image: payload.image || null,
        audio: payload.audio || null,
        voiceDuration: payload.voiceDuration || 0,
        voiceEffect: payload.voiceEffect || 'normal',
        game: payload.game || null,
        vanish: !!payload.vanish,
        spoiler: !!payload.spoiler,
        replyTo: payload.replyTo || null,
        reactions: {},
        seen: false,
        deleted: false,
        at: Date.now()
      };
      io.to(`room:${code}`).emit('chat:message', msg);
    });

    socket.on('chat:typing', ({ typing }) => {
      socket.to(`room:${code}`).emit('chat:typing', { from: me.username, typing: !!typing });
    });

    socket.on('chat:heartbeat', () => {
      socket.to(`room:${code}`).emit('chat:heartbeat', { from: me.username });
    });

    socket.on('chat:weather', ({ weather }) => {
      socket.to(`room:${code}`).emit('chat:weather', { from: me.username, weather });
    });

    socket.on('chat:mood', ({ mood, aura }) => {
      me.mood = mood || '';
      me.aura = aura || '';
      socket.to(`room:${code}`).emit('user:mood', { username: me.username, mood: me.mood, aura: me.aura });
    });

    socket.on('chat:react', ({ id, emoji }) => {
      io.to(`room:${code}`).emit('chat:react', { id, reactions: { [me.name]: emoji } });
    });

    socket.on('chat:delete', ({ id }) => {
      io.to(`room:${code}`).emit('chat:delete', { id });
    });

    socket.on('chat:clear', () => {
      io.to(`room:${code}`).emit('chat:clear', { withUser: `room:${code}` });
    });

    socket.on('game:sync', ({ game }) => {
      socket.to(`room:${code}`).emit('game:sync', { from: me.username, game });
    });

    socket.on('disconnect', () => {
      const m = quickRooms.get(code);
      if (m) {
        m.delete(socket.id);
        socket.to(`room:${code}`).emit('room:peer', { peer: null });
        if (m.size === 0) quickRooms.delete(code);
      }
    });
    return;
  }

  /* ---------------------------------------------------------
     MODE B: AUTHENTICATED DIRECT MESSENGER
     --------------------------------------------------------- */
  const username = socket.data.username;
  const user = store.users[username];
  socket.join(`user:${username}`);

  if (!onlineUsers.has(username)) onlineUsers.set(username, new Set());
  onlineUsers.get(username).add(socket.id);

  (user.friends || []).forEach(f => {
    io.to(`user:${f}`).emit('user:presence', { username, online: true, lastSeen: Date.now() });
  });

  socket.on('chat:send', payload => {
    const to = String(payload.to || '').trim().toLowerCase();
    if (!store.users[to]) return;

    const msg = {
      id: crypto.randomUUID(),
      sender: username,
      senderName: user.name,
      recipient: to,
      type: payload.type || 'text',
      text: String(payload.text || '').slice(0, 4000),
      image: payload.image || null,
      audio: payload.audio || null,
      voiceDuration: payload.voiceDuration || 0,
      voiceEffect: payload.voiceEffect || 'normal',
      game: payload.game || null,
      vanish: !!payload.vanish,
      spoiler: !!payload.spoiler,
      replyTo: payload.replyTo || null,
      reactions: {},
      seen: false,
      deleted: false,
      at: Date.now()
    };

    store.messages.push(msg);
    if (store.messages.length > 2500) store.messages = store.messages.slice(-2500);
    saveStore();

    io.to(`user:${username}`).to(`user:${to}`).emit('chat:message', msg);
  });

  socket.on('chat:seen', ({ withUser }) => {
    const peer = String(withUser || '').trim().toLowerCase();
    const vanishedIds = [];
    let changed = false;

    store.messages.forEach(m => {
      if (m.sender === peer && m.recipient === username && !m.seen) {
        m.seen = true;
        changed = true;
        if (m.vanish) vanishedIds.push(m.id);
      }
    });

    if (changed) {
      saveStore();
      io.to(`user:${peer}`).emit('chat:seen', { by: username });
    }

    if (vanishedIds.length) {
      setTimeout(() => {
        store.messages = store.messages.filter(m => !vanishedIds.includes(m.id));
        saveStore();
        io.to(`user:${username}`).to(`user:${peer}`).emit('chat:vanished', { ids: vanishedIds });
      }, 10000);
    }
  });

  socket.on('chat:react', ({ to, id, emoji }) => {
    const msg = store.messages.find(m => m.id === id);
    if (!msg) return;
    msg.reactions = msg.reactions || {};
    if (msg.reactions[user.name] === emoji) delete msg.reactions[user.name];
    else msg.reactions[user.name] = emoji;
    saveStore();
    io.to(`user:${username}`).to(`user:${to}`).emit('chat:react', { id, reactions: msg.reactions });
  });

  socket.on('chat:delete', ({ to, id }) => {
    const msg = store.messages.find(m => m.id === id && m.sender === username);
    if (!msg) return;
    msg.deleted = true;
    msg.text = '';
    msg.image = null;
    msg.audio = null;
    saveStore();
    io.to(`user:${username}`).to(`user:${to}`).emit('chat:delete', { id });
  });

  socket.on('chat:clear', ({ withUser }) => {
    const peer = String(withUser || '').trim().toLowerCase();
    store.messages = store.messages.filter(m =>
      !((m.sender === username && m.recipient === peer) || (m.sender === peer && m.recipient === username))
    );
    saveStore();
    io.to(`user:${username}`).to(`user:${peer}`).emit('chat:clear', { withUser: peer });
  });

  socket.on('chat:typing', ({ to, typing }) => {
    io.to(`user:${to}`).emit('chat:typing', { from: username, typing: !!typing });
  });

  socket.on('chat:heartbeat', ({ to }) => {
    io.to(`user:${to}`).emit('chat:heartbeat', { from: username });
  });

  socket.on('chat:weather', ({ to, weather }) => {
    io.to(`user:${to}`).emit('chat:weather', { from: username, weather });
  });

  socket.on('chat:mood', ({ mood, aura }) => {
    user.mood = String(mood || '').slice(0, 24);
    user.aura = String(aura || '').slice(0, 16);
    saveStore();
    (user.friends || []).forEach(f => {
      io.to(`user:${f}`).emit('user:mood', { username, mood: user.mood, aura: user.aura });
    });
  });

  socket.on('game:sync', ({ to, game }) => {
    io.to(`user:${to}`).emit('game:sync', { from: username, game });
  });

  socket.on('disconnect', () => {
    const set = onlineUsers.get(username);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsers.delete(username);
        user.lastSeen = Date.now();
        saveStore();
        (user.friends || []).forEach(f => {
          io.to(`user:${f}`).emit('user:presence', { username, online: false, lastSeen: user.lastSeen });
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`DuoChat running on http://localhost:${PORT}`);
});
