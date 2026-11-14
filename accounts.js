const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const directory = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const filename = path.join(directory, 'accounts.json');
let users = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
const sessions = new Map();
let saving = Promise.resolve();
function persist() {
  saving = saving.catch(() => {}).then(async () => {
    await fs.promises.writeFile(filename + '.tmp', JSON.stringify(users), { mode: 0o600 });
    await fs.promises.rename(filename + '.tmp', filename);
  });
  return saving;
}
const publicUser = u => ({ id: u.id, username: u.username, name: u.name, gender: u.gender, avatar: u.avatar });
function lookup(token) {
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) { sessions.delete(token); return null; }
  return Object.values(users).find(u => u.id === session.id) || null;
}
function install(socket) {
  let attempts = 0; let since = Date.now(); let busy = false;
  socket.on('account-auth', async (data = {}, cb = () => {}) => {
    if (Date.now() - since > 60000) { attempts = 0; since = Date.now(); }
    if (busy || ++attempts > 8) return cb({ error: 'Too many attempts. Try again in a minute.' });
    busy = true;
    try {
      const { mode, password, gender, avatar } = data || {};
      const username = String(data.username || '').trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(username) || typeof password !== 'string' || password.length < 8 || password.length > 128) throw Error('Use a 3–24 character username and an 8–128 character password.');
      let user = Object.hasOwn(users, username) ? users[username] : null;
      if (mode === 'register') {
        if (user) throw Error('This username is already taken.');
        if (!['male', 'female'].includes(gender)) throw Error('Choose an avatar.');
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = (await scrypt(password, salt, 64)).toString('hex');
        // Check again after the asynchronous hash to prevent concurrent registrations.
        if (Object.hasOwn(users, username)) throw Error('This username is already taken.');
        user = { id: crypto.randomUUID(), username, name: String(data.name || username).trim().slice(0,24) || username, gender, avatar: Math.max(0, Math.min(7, Number(avatar) || 0)), salt, hash };
        users[username] = user;
        try { await persist(); } catch (err) { delete users[username]; throw Error('Could not save account. Please try again.'); }
      } else if (mode === 'login') {
        const hash = await scrypt(password, user ? user.salt : 'invalid-account-salt', 64);
        if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'))) throw Error('Incorrect username or password.');
      } else throw Error('Invalid account action.');
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { id: user.id, expires: Date.now() + 7*86400000 });
      cb({ ok: true, token, user: publicUser(user) });
    } catch (error) { cb({ error: error.message || 'Account request failed.' }); }
    finally { busy = false; }
  });
  socket.on('account-resume', (token, cb = () => {}) => { const user = lookup(token); cb(user ? { user: publicUser(user) } : { error: 'Please sign in again.' }); });
  socket.on('account-logout', token => { sessions.delete(token); socket.disconnect(true); });
}
module.exports = { install, lookup };
