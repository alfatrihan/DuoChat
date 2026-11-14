const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const directory = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

const filename = path.join(directory, 'accounts.json');
let users = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};

// Normalize legacy users to ensure friends & requests arrays exist
for (const u of Object.values(users)) {
  if (!Array.isArray(u.friends)) u.friends = [];
  if (!Array.isArray(u.incomingRequests)) u.incomingRequests = [];
  if (!Array.isArray(u.outgoingRequests)) u.outgoingRequests = [];
}

const sessions = new Map();
let saving = Promise.resolve();

function persist() {
  saving = saving.catch(() => {}).then(async () => {
    await fs.promises.writeFile(filename + '.tmp', JSON.stringify(users, null, 2), { mode: 0o600 });
    await fs.promises.rename(filename + '.tmp', filename);
  });
  return saving;
}

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  gender: u.gender,
  avatar: u.avatar
});

function getById(id) {
  return Object.values(users).find((u) => u.id === id) || null;
}

function getByUsername(username) {
  const key = String(username || '').trim().toLowerCase();
  return Object.hasOwn(users, key) ? users[key] : null;
}

function lookup(token) {
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return getById(session.id);
}

function searchUsers(query, currentUserId) {
  const q = String(query || '').trim().toLowerCase().replace(/^@/, '');
  if (!q) return [];
  const me = getById(currentUserId);
  if (!me) return [];

  return Object.values(users)
    .filter((u) => u.id !== currentUserId && (u.username.includes(q) || u.name.toLowerCase().includes(q)))
    .slice(0, 15)
    .map((u) => {
      let relation = 'none';
      if (me.friends.includes(u.id)) relation = 'friend';
      else if (me.incomingRequests.includes(u.id)) relation = 'incoming';
      else if (me.outgoingRequests.includes(u.id)) relation = 'outgoing';
      return { ...publicUser(u), relation };
    });
}

async function sendFriendRequest(fromId, targetUsername) {
  const me = getById(fromId);
  const target = getByUsername(targetUsername);
  if (!me || !target) throw new Error('User not found.');
  if (me.id === target.id) throw new Error('You cannot add yourself.');
  if (me.friends.includes(target.id)) throw new Error('You are already friends.');
  if (me.outgoingRequests.includes(target.id)) throw new Error('Friend request already sent.');

  // Auto-accept if target already sent a request to me
  if (me.incomingRequests.includes(target.id)) {
    return acceptFriendRequest(fromId, target.id);
  }

  me.outgoingRequests.push(target.id);
  target.incomingRequests.push(me.id);
  await persist();
  return { status: 'sent', target: publicUser(target), from: publicUser(me) };
}

async function acceptFriendRequest(userId, requesterId) {
  const me = getById(userId);
  const requester = getById(requesterId);
  if (!me || !requester) throw new Error('User not found.');
  if (!me.incomingRequests.includes(requester.id)) throw new Error('No pending request from this user.');

  me.incomingRequests = me.incomingRequests.filter((id) => id !== requester.id);
  me.outgoingRequests = me.outgoingRequests.filter((id) => id !== requester.id);
  requester.outgoingRequests = requester.outgoingRequests.filter((id) => id !== me.id);
  requester.incomingRequests = requester.incomingRequests.filter((id) => id !== me.id);

  if (!me.friends.includes(requester.id)) me.friends.push(requester.id);
  if (!requester.friends.includes(me.id)) requester.friends.push(me.id);

  await persist();
  return { status: 'accepted', me: publicUser(me), friend: publicUser(requester) };
}

async function declineFriendRequest(userId, requesterId) {
  const me = getById(userId);
  const requester = getById(requesterId);
  if (!me) throw new Error('User not found.');

  me.incomingRequests = me.incomingRequests.filter((id) => id !== requesterId);
  if (requester) {
    requester.outgoingRequests = requester.outgoingRequests.filter((id) => id !== me.id);
  }
  await persist();
  return { status: 'declined', requesterId };
}

async function cancelFriendRequest(userId, targetId) {
  const me = getById(userId);
  const target = getById(targetId);
  if (!me) throw new Error('User not found.');

  me.outgoingRequests = me.outgoingRequests.filter((id) => id !== targetId);
  if (target) {
    target.incomingRequests = target.incomingRequests.filter((id) => id !== me.id);
  }
  await persist();
  return { status: 'cancelled', targetId };
}

function getSocialState(userId) {
  const me = getById(userId);
  if (!me) return { friends: [], incoming: [], outgoing: [] };
  return {
    friends: me.friends.map(getById).filter(Boolean).map(publicUser),
    incoming: me.incomingRequests.map(getById).filter(Boolean).map(publicUser),
    outgoing: me.outgoingRequests.map(getById).filter(Boolean).map(publicUser)
  };
}

function install(socket) {
  let attempts = 0;
  let since = Date.now();
  let busy = false;

  socket.on('account-auth', async (data = {}, cb = () => {}) => {
    if (Date.now() - since > 60000) {
      attempts = 0;
      since = Date.now();
    }
    if (busy || ++attempts > 10) return cb({ error: 'Too many attempts. Try again in a minute.' });
    busy = true;
    try {
      const { mode, password, gender, avatar } = data || {};
      const username = String(data.username || '').trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(username) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
        throw new Error('Use a 3–24 character username (letters, numbers, _) and an 8–128 character password.');
      }
      let user = getByUsername(username);
      if (mode === 'register') {
        if (user) throw new Error('This username is already taken.');
        if (!['male', 'female'].includes(gender)) throw new Error('Choose an avatar.');
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = (await scrypt(password, salt, 64)).toString('hex');
        if (getByUsername(username)) throw new Error('This username is already taken.');
        user = {
          id: crypto.randomUUID(),
          username,
          name: String(data.name || username).trim().slice(0, 24) || username,
          gender,
          avatar: Math.max(0, Math.min(7, Number(avatar) || 0)),
          salt,
          hash,
          friends: [],
          incomingRequests: [],
          outgoingRequests: []
        };
        users[username] = user;
        try {
          await persist();
        } catch (err) {
          delete users[username];
          throw new Error('Could not save account. Please try again.');
        }
      } else if (mode === 'login') {
        const hash = await scrypt(password, user ? user.salt : 'invalid-account-salt', 64);
        if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'))) {
          throw new Error('Incorrect username or password.');
        }
      } else {
        throw new Error('Invalid account action.');
      }
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { id: user.id, expires: Date.now() + 7 * 86400000 });
      cb({ ok: true, token, user: publicUser(user) });
    } catch (error) {
      cb({ error: error.message || 'Account request failed.' });
    } finally {
      busy = false;
    }
  });

  socket.on('account-resume', (token, cb = () => {}) => {
    const user = lookup(token);
    cb(user ? { user: publicUser(user) } : { error: 'Please sign in again.' });
  });

  socket.on('account-logout', (token) => {
    sessions.delete(token);
    socket.disconnect(true);
  });
}

module.exports = {
  install,
  lookup,
  getById,
  publicUser,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  getSocialState
};
