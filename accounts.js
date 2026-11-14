const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 12 High-Quality Vector SVG Avatars (Modest/Islamic Vibe + Casual Modern Options)
const AVATARS = [
  // --- MALE MODEST / ISLAMIC VIBE ---
  {
    id: 'm_modest_1',
    name: 'Tariq (Kufi & Beard)',
    gender: 'male',
    style: 'modest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#0f766e"/><path d="M20 95 C20 72 80 72 80 95" fill="#f8fafc"/><path d="M42 73 L50 85 L58 73 Z" fill="#0f766e"/><circle cx="50" cy="48" r="20" fill="#f1c27d"/><path d="M30 48 C30 66 40 73 50 73 C60 73 70 66 70 48 C70 55 64 62 50 62 C36 62 30 55 30 48 Z" fill="#1e293b"/><path d="M43 58 Q50 61 57 58" stroke="#f1c27d" stroke-width="2" fill="none"/><path d="M30 42 C30 24 70 24 70 42 Z" fill="#ffffff"/><rect x="30" y="37" width="40" height="5" rx="2" fill="#e2e8f0"/><circle cx="43" cy="46" r="2.2" fill="#1e293b"/><circle cx="57" cy="46" r="2.2" fill="#1e293b"/></svg>`
  },
  {
    id: 'm_modest_2',
    name: 'Zayd (Emerald Panjabi & Cap)',
    gender: 'male',
    style: 'modest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#1e3a8a"/><path d="M18 96 C18 73 82 73 82 96" fill="#065f46"/><rect x="47" y="73" width="6" height="16" rx="2" fill="#d97706"/><circle cx="50" cy="48" r="20" fill="#e0ac69"/><path d="M31 50 C32 67 42 72 50 72 C58 72 68 67 69 50 C67 57 60 62 50 62 C40 62 33 57 31 50 Z" fill="#0f172a"/><path d="M30 41 C30 23 70 23 70 41 Z" fill="#f8fafc"/><path d="M32 37 L68 37" stroke="#cbd5e1" stroke-width="2"/><circle cx="43" cy="46" r="2.3" fill="#0f172a"/><circle cx="57" cy="46" r="2.3" fill="#0f172a"/><path d="M45 56 Q50 59 55 56" stroke="#ffffff" stroke-width="1.8" fill="none"/></svg>`
  },
  {
    id: 'm_modest_3',
    name: 'Omar (Scholar Glasses & Beard)',
    gender: 'male',
    style: 'modest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#312e81"/><path d="M20 96 C20 73 80 73 80 96" fill="#334155"/><path d="M45 73 L50 88 L55 73 Z" fill="#f8fafc"/><circle cx="50" cy="48" r="20" fill="#f1c27d"/><path d="M31 50 C31 65 40 71 50 71 C60 71 69 65 69 50 C66 56 60 60 50 60 C40 60 34 56 31 50 Z" fill="#27272a"/><path d="M30 41 C30 24 70 24 70 41 Z" fill="#1e293b"/><rect x="36" y="42" width="11" height="8" rx="2" stroke="#d97706" stroke-width="2" fill="none"/><rect x="53" y="42" width="11" height="8" rx="2" stroke="#d97706" stroke-width="2" fill="none"/><line x1="47" y1="46" x2="53" y2="46" stroke="#d97706" stroke-width="2"/><circle cx="41.5" cy="46" r="1.8" fill="#1e293b"/><circle cx="58.5" cy="46" r="1.8" fill="#1e293b"/></svg>`
  },
  {
    id: 'm_modest_4',
    name: 'Hamza (Keffiyeh Scarf & Jubilant)',
    gender: 'male',
    style: 'modest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#064e3b"/><path d="M18 96 C18 72 82 72 82 96" fill="#1e293b"/><path d="M32 72 L50 86 L68 72" stroke="#f8fafc" stroke-width="4" fill="none"/><circle cx="50" cy="48" r="20" fill="#e0ac69"/><path d="M32 52 C34 65 42 70 50 70 C58 70 66 65 68 52 C64 57 58 60 50 60 C42 60 36 57 32 52 Z" fill="#1c1917"/><path d="M29 40 C30 22 70 22 71 40 Z" fill="#f1f5f9"/><circle cx="43" cy="46" r="2.2" fill="#1c1917"/><circle cx="57" cy="46" r="2.2" fill="#1c1917"/><path d="M45 55 Q50 58 55 55" stroke="#fef3c7" stroke-width="1.8" fill="none"/></svg>`
  },

  // --- MALE CASUAL MODERN ---
  {
    id: 'm_casual_1',
    name: 'Rayan (Smart Casual Hoodie)',
    gender: 'male',
    style: 'casual',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2563eb"/><path d="M18 96 C18 73 82 73 82 96" fill="#1e293b"/><circle cx="50" cy="49" r="20" fill="#f1c27d"/><path d="M29 43 C28 24 45 21 56 24 C67 27 72 34 70 44 C65 36 55 34 42 36 C35 37 32 40 29 43 Z" fill="#0f172a"/><circle cx="43" cy="48" r="2.3" fill="#0f172a"/><circle cx="57" cy="48" r="2.3" fill="#0f172a"/><path d="M44 57 Q50 62 56 57" stroke="#0f172a" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: 'm_casual_2',
    name: 'Farhan (Tech Glasses & Jacket)',
    gender: 'male',
    style: 'casual',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#4f46e5"/><path d="M18 96 C18 73 82 73 82 96" fill="#0f172a"/><path d="M43 74 L50 92 L57 74 Z" fill="#38bdf8"/><circle cx="50" cy="49" r="20" fill="#e0ac69"/><path d="M30 42 C31 23 69 23 70 42 C64 34 36 34 30 42 Z" fill="#27272a"/><rect x="35" y="44" width="12" height="8" rx="2" stroke="#0f172a" stroke-width="2.2" fill="#e0f2fe" fill-opacity="0.3"/><rect x="53" y="44" width="12" height="8" rx="2" stroke="#0f172a" stroke-width="2.2" fill="#e0f2fe" fill-opacity="0.3"/><line x1="47" y1="48" x2="53" y2="48" stroke="#0f172a" stroke-width="2.2"/><path d="M45 58 Q50 62 55 58" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`
  },

  // --- FEMALE MODEST / ISLAMIC VIBE (HIJAB / NIQAB) ---
  {
    id: 'f_modest_1',
    name: 'Aisha (Rose Hijab)',
    gender: 'female',
    style: 'modest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#9d174d"/><path d="M18 96 C18 70 82 70 82 96" fill="#f43f5e"/><path d="M24 50 C24 22 76 22 76 50 C76 72 68 84 50 86 C32 84 24 72 24 50 Z" fill="#be123c"/><circle cx="50" cy="49" r="16" fill="#fbd38d"/><path d="M34 42 Q50 34 66 42" stroke="#fda4af" stroke-width="3" fill="none"/><circle cx="44" cy="48" r="2.2" fill="#1e293b"/><circle cx="56" cy="48" r="2.2" fill="#1e293b"/><path d="M45 56 Q50 60 55 56" stroke="#be123c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: 'f_modest_2',
    name: 'Fatima (Emerald Silk Hijab)',
    gender: 'female',
    style: 'modest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#065f46"/><path d="M18 96 C18 70 82 70 82 96" fill="#047857"/><path d="M24 50 C24 22 76 22 76 50 C76 73 67 85 50 87 C33 85 24 73 24 50 Z" fill="#10b981"/><circle cx="50" cy="49" r="16" fill="#f6ad55"/><path d="M34 41 Q50 33 66 41" stroke="#a7f3d0" stroke-width="3" fill="none"/><circle cx="44" cy="48" r="2.2" fill="#0f172a"/><circle cx="56" cy="48" r="2.2" fill="#0f172a"/><path d="M45 56 Q50 59 55 56" stroke="#991b1b" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="63" cy="64" r="2.5" fill="#fef08a"/></svg>`
  },
  {
    id: 'f_modest_3',
    name: 'Maryam (Lavender Hijab & Glasses)',
    gender: 'female',
    style: 'modest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#5b21b6"/><path d="M18 96 C18 70 82 70 82 96" fill="#6d28d9"/><path d="M24 50 C24 22 76 22 76 50 C76 73 67 85 50 87 C33 85 24 73 24 50 Z" fill="#8b5cf6"/><circle cx="50" cy="49" r="16" fill="#fbd38d"/><circle cx="43" cy="48" r="5.5" stroke="#d97706" stroke-width="1.8" fill="none"/><circle cx="57" cy="48" r="5.5" stroke="#d97706" stroke-width="1.8" fill="none"/><line x1="48.5" y1="48" x2="51.5" y2="48" stroke="#d97706" stroke-width="1.8"/><circle cx="43" cy="48" r="1.8" fill="#1e293b"/><circle cx="57" cy="48" r="1.8" fill="#1e293b"/><path d="M46 56 Q50 59 54 56" stroke="#9d174d" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: 'f_modest_4',
    name: 'Khadija (Modest Abaya & Niqab)',
    gender: 'female',
    style: 'modest',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#0f172a"/><path d="M18 96 C18 70 82 70 82 96" fill="#1e293b"/><path d="M23 50 C23 21 77 21 77 50 C77 74 68 86 50 88 C32 86 23 74 23 50 Z" fill="#334155"/><rect x="33" y="42" width="34" height="11" rx="5.5" fill="#fbd38d"/><path d="M33 51 C33 66 67 66 67 51 Z" fill="#1e293b"/><path d="M28 41 Q50 36 72 41" stroke="#fbbf24" stroke-width="1.8" fill="none"/><circle cx="43" cy="47.5" r="2.2" fill="#0f172a"/><circle cx="57" cy="47.5" r="2.2" fill="#0f172a"/></svg>`
  },

  // --- FEMALE CASUAL MODERN ---
  {
    id: 'f_casual_1',
    name: 'Sara (Modern Casual Bob)',
    gender: 'female',
    style: 'casual',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#db2777"/><path d="M20 96 C20 73 80 73 80 96" fill="#fce7f3"/><path d="M26 52 C24 23 76 23 74 52 C74 62 70 67 66 67 C66 55 34 55 34 67 C30 67 26 62 26 52 Z" fill="#1e293b"/><circle cx="50" cy="49" r="17" fill="#fbd38d"/><path d="M32 42 C36 28 64 28 68 42 C58 35 42 35 32 42 Z" fill="#1e293b"/><circle cx="44" cy="48" r="2.2" fill="#1e293b"/><circle cx="56" cy="48" r="2.2" fill="#1e293b"/><path d="M45 56 Q50 60 55 56" stroke="#e11d48" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: 'f_casual_2',
    name: 'Nadia (Pastel Sweater & Bun)',
    gender: 'female',
    style: 'casual',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#0284c7"/><circle cx="50" cy="22" r="10" fill="#27272a"/><path d="M20 96 C20 73 80 73 80 96" fill="#fef08a"/><circle cx="50" cy="50" r="17" fill="#f6ad55"/><path d="M32 45 C33 27 67 27 68 45 C60 36 40 36 32 45 Z" fill="#27272a"/><circle cx="44" cy="49" r="2.2" fill="#1e293b"/><circle cx="56" cy="49" r="2.2" fill="#1e293b"/><path d="M45 57 Q50 61 55 57" stroke="#be123c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`
  }
];

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_duochat_salt').digest('hex');
}

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        users: parsed.users || {},
        conversations: parsed.conversations || {}
      };
    }
  } catch (err) {
    console.error('Error loading DB, initializing fresh DB:', err);
  }
  return { users: {}, conversations: {} };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving DB:', err);
  }
}

const db = loadDB();

function getConversationKey(u1, u2) {
  return [u1.toLowerCase(), u2.toLowerCase()].sort().join('__');
}

function getPublicUser(user) {
  if (!user) return null;
  return {
    username: user.username,
    displayName: user.displayName,
    gender: user.gender,
    avatarId: user.avatarId,
    bio: user.bio || 'Assalamu Alaikum! Ready to chat & play.',
    friends: user.friends || [],
    incomingRequests: user.incomingRequests || [],
    outgoingRequests: user.outgoingRequests || [],
    createdAt: user.createdAt
  };
}

function registerUser({ username, displayName, password, gender, avatarId }) {
  const cleanUsername = (username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
    return { error: 'Username must be 3-20 characters (letters, numbers, underscores only).' };
  }
  if (!password || password.length < 4) {
    return { error: 'Password must be at least 4 characters long.' };
  }
  if (db.users[cleanUsername]) {
    return { error: 'Username is already taken. Please choose another.' };
  }

  const validAvatar = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
  const newUser = {
    username: cleanUsername,
    displayName: (displayName || cleanUsername).trim().slice(0, 28),
    passwordHash: hashPassword(password),
    gender: gender === 'female' ? 'female' : 'male',
    avatarId: validAvatar.id,
    bio: 'Assalamu Alaikum! Using DuoChat.',
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    createdAt: Date.now()
  };

  db.users[cleanUsername] = newUser;
  saveDB(db);
  return { user: getPublicUser(newUser) };
}

function loginUser({ username, password }) {
  const cleanUsername = (username || '').trim().toLowerCase();
  const user = db.users[cleanUsername];
  if (!user) {
    return { error: 'Account not found. Please register first.' };
  }
  if (user.passwordHash !== hashPassword(password || '')) {
    return { error: 'Incorrect password. Please try again.' };
  }
  return { user: getPublicUser(user) };
}

function updateProfile(username, { displayName, avatarId, bio }) {
  const user = db.users[(username || '').toLowerCase()];
  if (!user) return { error: 'User not found.' };
  if (displayName && displayName.trim()) {
    user.displayName = displayName.trim().slice(0, 28);
  }
  if (avatarId && AVATARS.some(a => a.id === avatarId)) {
    user.avatarId = avatarId;
  }
  if (typeof bio === 'string') {
    user.bio = bio.trim().slice(0, 80);
  }
  saveDB(db);
  return { user: getPublicUser(user) };
}

function searchUsers(query, currentUsername) {
  const q = (query || '').trim().toLowerCase();
  const me = db.users[(currentUsername || '').toLowerCase()];
  if (!q || !me) return [];

  return Object.values(db.users)
    .filter(u => u.username !== me.username && (u.username.includes(q) || u.displayName.toLowerCase().includes(q)))
    .slice(0, 12)
    .map(u => {
      let relation = 'none';
      if (me.friends.includes(u.username)) relation = 'friends';
      else if (me.outgoingRequests.includes(u.username)) relation = 'outgoing';
      else if (me.incomingRequests.includes(u.username)) relation = 'incoming';
      return {
        username: u.username,
        displayName: u.displayName,
        gender: u.gender,
        avatarId: u.avatarId,
        bio: u.bio,
        relation
      };
    });
}

function sendFriendRequest(fromUsername, toUsername) {
  const from = db.users[(fromUsername || '').toLowerCase()];
  const to = db.users[(toUsername || '').toLowerCase()];

  if (!from || !to) return { error: 'User not found.' };
  if (from.username === to.username) return { error: 'You cannot add yourself.' };
  if (from.friends.includes(to.username)) return { error: 'You are already friends!' };
  if (from.outgoingRequests.includes(to.username)) return { error: 'Friend request already sent.' };

  // If the other user already sent a request to us, auto-accept
  if (from.incomingRequests.includes(to.username)) {
    return respondToFriendRequest(from.username, to.username, 'accept');
  }

  from.outgoingRequests.push(to.username);
  if (!to.incomingRequests.includes(from.username)) {
    to.incomingRequests.push(from.username);
  }
  saveDB(db);
  return { status: 'sent', from: getPublicUser(from), to: getPublicUser(to) };
}

function respondToFriendRequest(username, requesterUsername, action) {
  const me = db.users[(username || '').toLowerCase()];
  const reqUser = db.users[(requesterUsername || '').toLowerCase()];

  if (!me || !reqUser) return { error: 'User not found.' };
  if (!me.incomingRequests.includes(reqUser.username)) {
    return { error: 'No pending request from this user.' };
  }

  me.incomingRequests = me.incomingRequests.filter(u => u !== reqUser.username);
  reqUser.outgoingRequests = reqUser.outgoingRequests.filter(u => u !== me.username);

  if (action === 'accept') {
    if (!me.friends.includes(reqUser.username)) me.friends.push(reqUser.username);
    if (!reqUser.friends.includes(me.username)) reqUser.friends.push(me.username);

    const convKey = getConversationKey(me.username, reqUser.username);
    if (!db.conversations[convKey]) {
      db.conversations[convKey] = [];
    }
  }

  saveDB(db);
  return {
    status: action === 'accept' ? 'accepted' : 'declined',
    me: getPublicUser(me),
    requester: getPublicUser(reqUser)
  };
}

function areFriends(u1, u2) {
  const user1 = db.users[(u1 || '').toLowerCase()];
  const user2 = db.users[(u2 || '').toLowerCase()];
  if (!user1 || !user2) return false;
  return user1.friends.includes(user2.username) && user2.friends.includes(user1.username);
}

function getConversationMessages(u1, u2) {
  const key = getConversationKey(u1, u2);
  return db.conversations[key] || [];
}

function addMessage(from, to, messageObj) {
  const key = getConversationKey(from, to);
  if (!db.conversations[key]) {
    db.conversations[key] = [];
  }
  db.conversations[key].push(messageObj);
  if (db.conversations[key].length > 250) {
    db.conversations[key] = db.conversations[key].slice(-250);
  }
  saveDB(db);
  return messageObj;
}

function markMessagesRead(readerUsername, partnerUsername) {
  const key = getConversationKey(readerUsername, partnerUsername);
  const msgs = db.conversations[key] || [];
  let updated = false;
  msgs.forEach(m => {
    if (m.to === readerUsername && !m.read) {
      m.read = true;
      updated = true;
    }
  });
  if (updated) saveDB(db);
  return updated;
}

function getUserDashboardData(username, onlineMap) {
  const me = db.users[(username || '').toLowerCase()];
  if (!me) return null;

  const friendsList = me.friends
    .map(fUsername => db.users[fUsername])
    .filter(Boolean)
    .map(f => {
      const msgs = getConversationMessages(me.username, f.username);
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const unreadCount = msgs.filter(m => m.to === me.username && !m.read).length;
      return {
        username: f.username,
        displayName: f.displayName,
        gender: f.gender,
        avatarId: f.avatarId,
        bio: f.bio,
        online: Boolean(onlineMap.get(f.username)),
        lastMessage: lastMsg,
        unreadCount
      };
    })
    .sort((a, b) => {
      const timeA = a.lastMessage ? a.lastMessage.timestamp : 0;
      const timeB = b.lastMessage ? b.lastMessage.timestamp : 0;
      return timeB - timeA;
    });

  const incomingList = me.incomingRequests
    .map(u => db.users[u])
    .filter(Boolean)
    .map(u => ({
      username: u.username,
      displayName: u.displayName,
      gender: u.gender,
      avatarId: u.avatarId,
      bio: u.bio
    }));

  const outgoingList = me.outgoingRequests
    .map(u => db.users[u])
    .filter(Boolean)
    .map(u => ({
      username: u.username,
      displayName: u.displayName,
      gender: u.gender,
      avatarId: u.avatarId,
      bio: u.bio
    }));

  return {
    me: getPublicUser(me),
    friends: friendsList,
    incomingRequests: incomingList,
    outgoingRequests: outgoingList
  };
}

module.exports = {
  AVATARS,
  registerUser,
  loginUser,
  updateProfile,
  searchUsers,
  sendFriendRequest,
  respondToFriendRequest,
  areFriends,
  getConversationKey,
  getConversationMessages,
  addMessage,
  markMessagesRead,
  getUserDashboardData
};