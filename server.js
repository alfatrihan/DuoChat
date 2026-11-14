// server.js - DuoChat v6 Backend (Multi-Inbox Messenger + Instant Code-Based Chat Rooms + Real-time Mini-Games + Synced Weather)
const express = require('express');
const http = require('http');
const fs = require('node:fs');
const path = require('node:path');
const accounts = require('./accounts');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e6 });

for (const file of ['index.html', 'style.css', 'script.js', 'developer-photo.png', 'logo.png', 'favicon-32.png', 'favicon.ico', 'apple-touch-icon.png']) {
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
      if (key.startsWith('quick:')) continue; // Quick rooms are ephemeral in memory
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

// Instant Code-Based Quick Rooms: code -> { code, members: Map<guestId, { id, name, gender, avatar, socketId, online, mood }>, history: [], weather: 'clear' }
const quickRooms = new Map();

const clip = (v, n) => String(v || '').slice(0, n);
const VALID_WEATHERS = ['clear', 'rain', 'storm', 'snow', 'stars', 'petals'];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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
            text: lastMsg.spoiler ? '🔒 Spoiler message' : lastMsg.widget ? (lastMsg.widget.kind === 'poll' ? '📊 Quick Poll' : lastMsg.widget.kind === 'vault' ? '🔐 Secret Passcode' : '❓ Duo Mini-Quiz') : lastMsg.audio ? '🎤 Voice message' : lastMsg.image ? '📷 Photo' : lastMsg.text,
            time: lastMsg.time,
            fromMe: lastMsg.from === userId
          }
        : null,
      unread
    };
  });

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

function getQuickRoomPeer(room, myId) {
  for (const [mid, member] of room.members.entries()) {
    if (mid !== myId) return member;
  }
  return null;
}

io.on('connection', (socket) => {
  accounts.install(socket);
  let currentUser = null;
  let activePeerId = null;

  // Guest Quick-Room State per Socket
  let quickGuest = null; // { id, name, gender, avatar, roomCode }

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

  function leaveQuickRoom() {
    if (!quickGuest) return;
    const { id, roomCode } = quickGuest;
    const room = quickRooms.get(roomCode);
    if (room) {
      const peer = getQuickRoomPeer(room, id);
      room.members.delete(id);
      if (peer) {
        emitToUser(peer.id, 'friend-presence', {
          userId: id,
          online: false,
          mood: '',
          name: quickGuest.name,
          gender: quickGuest.gender,
          avatar: quickGuest.avatar
        });
      }
      if (room.members.size === 0) {
        delete activeGames['quick:' + roomCode];
        quickRooms.delete(roomCode);
      }
    }
    socket.leave('user:' + id);
    quickGuest = null;
  }

  function cleanupSocket() {
    if (quickGuest) {
      leaveQuickRoom();
    }
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

  /* ---------- Quick Room Create / Join ---------- */
  socket.on('quick-room-auth', (payload = {}, cb = () => {}) => {
    const action = payload.action; // 'create' | 'join'
    const name = clip(payload.name, 24).trim();
    const gender = payload.gender === 'female' ? 'female' : 'male';
    const avatar = Math.max(0, Math.min(7, Number(payload.avatar) || 0));

    if (!name) return cb({ error: 'Please enter your display name.' });

    if (quickGuest) leaveQuickRoom();

    let code = String(payload.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    let room = null;

    if (action === 'create') {
      if (!code || code.length < 4) code = generateRoomCode();
      while (quickRooms.has(code)) {
        code = generateRoomCode();
      }
      room = {
        code,
        members: new Map(),
        history: [],
        weather: 'clear'
      };
      quickRooms.set(code, room);
    } else if (action === 'join') {
      if (!code) return cb({ error: 'Please enter a valid room code.' });
      room = quickRooms.get(code);
      if (!room) return cb({ error: 'Room not found. Check the code and try again.' });
      if (room.members.size >= 2) return cb({ error: 'This room is already full (2/2 members).' });
    } else {
      return cb({ error: 'Invalid room action.' });
    }

    const guestId = 'guest_' + Math.random().toString(36).slice(2, 10);
    const memberObj = {
      id: guestId,
      username: 'room_' + code.toLowerCase(),
      name,
      gender,
      avatar,
      online: true,
      mood: ''
    };

    room.members.set(guestId, memberObj);
    quickGuest = { id: guestId, name, gender, avatar, roomCode: code };
    socket.join('user:' + guestId);

    const roomKey = 'quick:' + code;
    const peer = getQuickRoomPeer(room, guestId);

    if (peer) {
      // Notify existing room creator that partner joined
      emitToUser(peer.id, 'quick-room-peer-joined', {
        roomKey,
        peer: memberObj
      });
    }

    cb({
      ok: true,
      roomCode: code,
      roomKey,
      user: memberObj,
      peer: peer || {
        id: 'waiting_' + code,
        username: 'waiting',
        name: 'Waiting for partner…',
        gender: gender === 'male' ? 'female' : 'male',
        avatar: 0,
        online: false,
        mood: ''
      },
      history: room.history,
      weather: room.weather,
      game: publicGame(activeGames[roomKey] || null, guestId)
    });
  });

  socket.on('quick-room-leave', () => {
    leaveQuickRoom();
  });

  /* ---------- Standard Account Session ---------- */
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

  /* ---------- Unified Chat & Game Events (Account Friends + Quick Room Guests) ---------- */
  function resolveActiveContext(peerId) {
    if (quickGuest) {
      const room = quickRooms.get(quickGuest.roomCode);
      if (!room) return null;
      const roomKey = 'quick:' + quickGuest.roomCode;
      const peer = getQuickRoomPeer(room, quickGuest.id);
      return {
        isQuick: true,
        me: quickGuest,
        peer,
        peerId: peer ? peer.id : null,
        roomKey,
        conv: room
      };
    }
    if (currentUser && peerId) {
      const me = accounts.getById(currentUser.id);
      if (!me || !me.friends.includes(peerId)) return null;
      const roomKey = getRoomKey(me.id, peerId);
      return {
        isQuick: false,
        me,
        peer: accounts.getById(peerId),
        peerId,
        roomKey,
        conv: getConversation(roomKey)
      };
    }
    return null;
  }

  socket.on('weather', ({ peerId, weather } = {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx) return;

    const cleanW = VALID_WEATHERS.includes(weather) ? weather : 'clear';
    ctx.conv.weather = cleanW;
    if (!ctx.isQuick) persistConversations();

    if (ctx.peerId) {
      emitToUser(ctx.peerId, 'weather', { roomKey: ctx.roomKey, weather: cleanW, by: ctx.me.name });
    }
  });

  socket.on('msg', (m = {}, cb = () => {}) => {
    if (!m || typeof m !== 'object') return;
    const ctx = resolveActiveContext(String(m.to || ''));
    if (!ctx) return cb({ error: 'Session unavailable.' });
    if (ctx.isQuick && !ctx.peerId) return cb({ error: 'Share your room code and wait for your partner to join.' });

    const peerOnline = ctx.isQuick ? true : isUserOnline(ctx.peerId);
    let cleanWidget = null;
    if (m.widget && typeof m.widget === 'object') {
      if (m.widget.kind === 'poll') {
        const q = clip(m.widget.question, 160).trim();
        const opts = Array.isArray(m.widget.options)
          ? m.widget.options.map((o) => clip(o, 60).trim()).filter(Boolean).slice(0, 4)
          : [];
        if (q && opts.length >= 2) {
          cleanWidget = { kind: 'poll', question: q, options: opts, votes: {} };
        }
      } else if (m.widget.kind === 'vault') {
        const clue = clip(m.widget.clue, 120).trim();
        const secret = clip(m.widget.secret, 400).trim();
        const pin = String(m.widget.pin || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 6);
        if (secret && pin.length >= 2) {
          cleanWidget = { kind: 'vault', clue: clue || 'Enter passcode to unlock', secret, pin, unlockedBy: [] };
        }
      } else if (m.widget.kind === 'quiz') {
        const question = clip(m.widget.question, 180).trim();
        const options = Array.isArray(m.widget.options)
          ? m.widget.options.map((o) => clip(o, 60).trim()).filter(Boolean).slice(0, 4)
          : [];
        const answerIdx = Math.max(0, Math.min(options.length - 1, Number(m.widget.answerIdx) || 0));
        if (question && options.length >= 2) {
          cleanWidget = { kind: 'quiz', question, options, answerIdx, answers: {} };
        }
      }
    }

    const validMorphs = ['normal', 'chipmunk', 'deep', 'robot', 'radio', 'female', 'old', 'baby'];
    const clean = {
      id: clip(m.id, 40),
      roomKey: ctx.roomKey,
      from: ctx.me.id,
      to: ctx.peerId,
      name: ctx.me.name,
      text: clip(m.text, 4000),
      image: typeof m.image === 'string' && m.image.startsWith('data:image/') ? m.image : null,
      audio: typeof m.audio === 'string' && m.audio.startsWith('data:audio/') && m.audio.length < 3_500_000 ? m.audio : null,
      audioDuration: typeof m.audioDuration === 'number' ? Math.max(1, Math.min(180, Math.round(m.audioDuration))) : null,
      audioMorph: validMorphs.includes(m.audioMorph) ? m.audioMorph : 'normal',
      widget: cleanWidget,
      reply: m.reply ? { name: clip(m.reply.name, 24), text: clip(m.reply.text, 120) } : null,
      vanish: !!m.vanish,
      spoiler: !!m.spoiler,
      reaction: null,
      time: Date.now(),
      status: peerOnline ? 'delivered' : 'sent'
    };

    if (!clean.id || (!clean.text.trim() && !clean.image && !clean.audio && !clean.widget)) return;
    if (ctx.conv.history.some((item) => item.id === clean.id)) return cb(clean.status);

    ctx.conv.history.push(clean);
    if (ctx.conv.history.length > 250) ctx.conv.history.shift();
    if (!ctx.isQuick) persistConversations();

    emitToUser(ctx.peerId, 'msg', clean);
    socket.to('user:' + ctx.me.id).emit('msg', clean);
    cb(clean.status);
  });

  socket.on('seen', ({ peerId, ids } = {}) => {
    if (!Array.isArray(ids) || !ids.length) return;
    const ctx = resolveActiveContext(peerId);
    if (!ctx || !ctx.peerId) return;

    let changed = false;
    ctx.conv.history.forEach((m) => {
      if (ids.includes(m.id) && m.from === ctx.peerId && m.status !== 'seen') {
        m.status = 'seen';
        changed = true;
        if (m.vanish) {
          setTimeout(() => {
            ctx.conv.history = ctx.conv.history.filter((item) => item.id !== m.id);
            if (!ctx.isQuick) persistConversations();
          }, 10000);
        }
      }
    });

    if (changed && !ctx.isQuick) persistConversations();
    emitToUser(ctx.peerId, 'status', { roomKey: ctx.roomKey, ids, status: 'seen' });
  });

  socket.on('react', ({ peerId, id, emoji } = {}) => {
    if (!id) return;
    const ctx = resolveActiveContext(peerId);
    if (!ctx) return;

    const cleanEmoji = clip(emoji, 8);
    const msg = ctx.conv.history.find((m) => m.id === id);
    if (msg) {
      msg.reaction = cleanEmoji;
      if (!ctx.isQuick) persistConversations();
    }
    if (ctx.peerId) {
      emitToUser(ctx.peerId, 'react', { roomKey: ctx.roomKey, id, emoji: cleanEmoji });
    }
  });

  socket.on('edit-message', ({ peerId, id, text } = {}, cb = () => {}) => {
    if (!id) return;
    const ctx = resolveActiveContext(peerId);
    if (!ctx) return;

    const msg = ctx.conv.history.find((item) => item.id === id);
    if (!msg || msg.from !== ctx.me.id || msg.vanish || msg.image) {
      return cb({ error: 'This message cannot be edited.' });
    }
    const cleanText = clip(text, 4000).trim();
    if (!cleanText) return cb({ error: 'Message cannot be empty.' });
    msg.text = cleanText;
    msg.edited = true;
    if (!ctx.isQuick) persistConversations();

    const payload = { roomKey: ctx.roomKey, id, text: cleanText, edited: true };
    if (ctx.peerId) emitToUser(ctx.peerId, 'message-edited', payload);
    emitToUser(ctx.me.id, 'message-edited', payload);
    cb({ ok: true });
  });

  socket.on('delete-message', ({ peerId, id } = {}, cb = () => {}) => {
    if (!id) return;
    const ctx = resolveActiveContext(peerId);
    if (!ctx) return;

    const index = ctx.conv.history.findIndex((item) => item.id === id);
    if (index < 0 || ctx.conv.history[index].from !== ctx.me.id) {
      return cb({ error: 'You can only delete your own message for everyone.' });
    }
    ctx.conv.history.splice(index, 1);
    if (!ctx.isQuick) persistConversations();

    const payload = { roomKey: ctx.roomKey, id };
    if (ctx.peerId) emitToUser(ctx.peerId, 'message-deleted', payload);
    emitToUser(ctx.me.id, 'message-deleted', payload);
    cb({ ok: true });
  });

  socket.on('clear', ({ peerId } = {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx) return;

    ctx.conv.history = [];
    if (!ctx.isQuick) persistConversations();
    if (ctx.peerId) emitToUser(ctx.peerId, 'clear', { roomKey: ctx.roomKey });
    emitToUser(ctx.me.id, 'clear', { roomKey: ctx.roomKey });
  });

  socket.on('mood', (mood) => {
    const cleanMood = clip(mood, 32);
    if (quickGuest) {
      const room = quickRooms.get(quickGuest.roomCode);
      if (room) {
        const selfMember = room.members.get(quickGuest.id);
        if (selfMember) selfMember.mood = cleanMood;
        const peer = getQuickRoomPeer(room, quickGuest.id);
        if (peer) {
          emitToUser(peer.id, 'friend-presence', {
            userId: quickGuest.id,
            online: true,
            mood: cleanMood,
            name: quickGuest.name,
            gender: quickGuest.gender,
            avatar: quickGuest.avatar
          });
        }
      }
      return;
    }
    if (!currentUser) return;
    const entry = onlineUsers.get(currentUser.id);
    if (entry) entry.mood = cleanMood;
    notifyFriendsPresence(currentUser.id);
  });


  /* ---------- Feature 3: Live Heartbeat Tap ---------- */
  socket.on('heartbeat', ({ peerId } = {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx || !ctx.peerId) return;
    emitToUser(ctx.peerId, 'heartbeat', {
      roomKey: ctx.roomKey,
      fromId: ctx.me.id,
      fromName: ctx.me.name
    });
  });

  /* ---------- Feature 9: Screenshot Detection Alert ---------- */
  socket.on('screenshot-taken', ({ peerId } = {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx || !ctx.peerId) return;
    const payload = {
      roomKey: ctx.roomKey,
      byId: ctx.me.id,
      byName: ctx.me.name,
      time: Date.now()
    };
    emitToUser(ctx.peerId, 'screenshot-alert', payload);
    emitToUser(ctx.me.id, 'screenshot-alert', payload);
  });

  /* ---------- Features 18 & 21: In-Chat Interactive Widget Updates (Poll, Passcode Vault, Mini-Quiz) ---------- */
  socket.on('widget-interact', ({ peerId, id, action, value } = {}, cb = () => {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx || !id) return cb({ error: 'Session unavailable.' });
    const msg = ctx.conv.history.find((item) => item.id === id);
    if (!msg || !msg.widget) return cb({ error: 'Item not found.' });

    if (msg.widget.kind === 'poll' && action === 'vote') {
      const idx = Number(value);
      if (!Number.isInteger(idx) || idx < 0 || idx >= msg.widget.options.length) {
        return cb({ error: 'Invalid option.' });
      }
      msg.widget.votes[ctx.me.id] = idx;
    } else if (msg.widget.kind === 'vault' && action === 'unlock') {
      const attempt = String(value || '').trim();
      if (attempt.toLowerCase() !== String(msg.widget.pin).toLowerCase()) {
        return cb({ error: 'Incorrect passcode! Try again.' });
      }
      if (!msg.widget.unlockedBy.includes(ctx.me.id)) {
        msg.widget.unlockedBy.push(ctx.me.id);
      }
    } else if (msg.widget.kind === 'quiz' && action === 'answer') {
      const idx = Number(value);
      if (!Number.isInteger(idx) || idx < 0 || idx >= msg.widget.options.length) {
        return cb({ error: 'Invalid answer.' });
      }
      msg.widget.answers[ctx.me.id] = idx;
    } else {
      return cb({ error: 'Unsupported action.' });
    }

    if (!ctx.isQuick) persistConversations();
    const updatePayload = { roomKey: ctx.roomKey, id, widget: msg.widget };
    if (ctx.peerId) emitToUser(ctx.peerId, 'widget-updated', updatePayload);
    emitToUser(ctx.me.id, 'widget-updated', updatePayload);
    cb({ ok: true });
  });

  socket.on('nudge', ({ peerId } = {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx || !ctx.peerId) return;
    emitToUser(ctx.peerId, 'nudge', { fromId: ctx.me.id, fromName: ctx.me.name });
  });

  socket.on('typing', ({ peerId, typing } = {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx || !ctx.peerId) return;
    emitToUser(ctx.peerId, 'typing', { from: ctx.me.id, typing: !!typing });
  });

  // ---------- Authoritative Real-Time Mini-Games (Tic-Tac-Toe, RPS, Connect Four) ----------
  socket.on('game-start', ({ peerId, type } = {}, cb = () => {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx) return cb({ error: 'Session unavailable.' });
    if (!['tictactoe', 'rps', 'connect4'].includes(type)) return cb({ error: 'Unknown game.' });

    const peerOnline = ctx.isQuick ? !!ctx.peerId : isUserOnline(ctx.peerId);
    if (!peerOnline || !ctx.peerId) return cb({ error: 'Your partner must be online in the chat to start a game.' });

    const roomKey = ctx.roomKey;
    const players = [ctx.me.id, ctx.peerId];

    if (type === 'tictactoe') {
      activeGames[roomKey] = {
        type: 'tictactoe',
        players,
        board: Array(9).fill(''),
        winLine: null,
        turn: ctx.me.id,
        marks: { [ctx.me.id]: 'X', [ctx.peerId]: 'O' },
        scores: { [ctx.me.id]: 0, [ctx.peerId]: 0 },
        result: null,
        winnerId: null
      };
    } else if (type === 'rps') {
      activeGames[roomKey] = {
        type: 'rps',
        players,
        round: 1,
        choices: {},
        scores: { [ctx.me.id]: 0, [ctx.peerId]: 0 },
        lastRound: null,
        matchWinner: null
      };
    } else if (type === 'connect4') {
      activeGames[roomKey] = {
        type: 'connect4',
        players,
        board: Array(42).fill(''),
        winCells: null,
        lastCol: null,
        lastRow: null,
        turn: ctx.me.id,
        colors: { [ctx.me.id]: 'R', [ctx.peerId]: 'Y' },
        scores: { [ctx.me.id]: 0, [ctx.peerId]: 0 },
        result: null,
        winnerId: null
      };
    }

    broadcastGame(roomKey, players);
    cb({ ok: true });
  });

  socket.on('game-action', (payload = {}, cb = () => {}) => {
    const ctx = resolveActiveContext(String(payload.peerId || ''));
    if (!ctx) return cb({ error: 'Session unavailable.' });

    const roomKey = ctx.roomKey;
    const g = activeGames[roomKey];
    if (!g || g.type !== payload.type) return cb({ error: 'No active game found.' });
    if (!g.players.includes(ctx.me.id)) return cb({ error: 'Not a participant.' });

    const myId = ctx.me.id;
    const oppId = g.players.find((id) => id !== myId);

    if (g.type === 'tictactoe') {
      if (g.result) return cb({ error: 'Round already ended.' });
      if (g.turn !== myId) return cb({ error: 'Wait for your turn.' });
      const i = payload.index;
      if (!Number.isInteger(i) || i < 0 || i > 8 || g.board[i]) {
        return cb({ error: 'Cell is unavailable.' });
      }
      g.board[i] = g.marks[myId];
      const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];
      const hit = lines.find((line) => g.board[line[0]] && line.every((n) => g.board[n] === g.board[line[0]]));
      if (hit) {
        g.winLine = hit;
        g.winnerId = myId;
        g.scores[myId] = (g.scores[myId] || 0) + 1;
        g.result = `${ctx.me.name} wins!`;
      } else if (g.board.every(Boolean)) {
        g.result = 'Draw match!';
      } else {
        g.turn = oppId;
      }
      broadcastGame(roomKey, g.players);
    } else if (g.type === 'rps') {
      if (g.matchWinner) return cb({ error: 'Match finished. Start a new match!' });
      const choice = payload.choice;
      if (!['rock', 'paper', 'scissors'].includes(choice)) return cb({ error: 'Invalid move.' });
      if (g.choices[myId]) return cb({ error: 'Choice already locked in.' });

      g.choices[myId] = choice;
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
      if (g.turn !== myId) return cb({ error: 'Wait for your turn.' });
      const col = payload.col;
      if (!Number.isInteger(col) || col < 0 || col > 6) return cb({ error: 'Invalid column.' });

      let targetRow = -1;
      for (let r = 5; r >= 0; r--) {
        if (!g.board[r * 7 + col]) {
          targetRow = r;
          break;
        }
      }
      if (targetRow === -1) return cb({ error: 'That column is full!' });

      const color = g.colors[myId];
      g.board[targetRow * 7 + col] = color;
      g.lastCol = col;
      g.lastRow = targetRow;

      const winCells = checkConnect4Win(g.board, targetRow, col, color);
      if (winCells) {
        g.winCells = winCells;
        g.winnerId = myId;
        g.scores[myId] = (g.scores[myId] || 0) + 1;
        g.result = `${ctx.me.name} connects four!`;
      } else if (g.board.every(Boolean)) {
        g.result = 'Board full — Draw!';
      } else {
        g.turn = oppId;
      }
      broadcastGame(roomKey, g.players);
    }

    cb({ ok: true });
  });

  socket.on('game-reset', ({ peerId } = {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx) return;
    const roomKey = ctx.roomKey;
    const g = activeGames[roomKey];
    if (!g) return;

    if (g.type === 'tictactoe') {
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
      g.turn = ctx.me.id;
    }
    broadcastGame(roomKey, g.players);
  });

  socket.on('game-close', ({ peerId } = {}) => {
    const ctx = resolveActiveContext(peerId);
    if (!ctx) return;
    const roomKey = ctx.roomKey;
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
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
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
server.listen(PORT, () => console.log(`DuoChat v6 running on http://localhost:${PORT}`));
