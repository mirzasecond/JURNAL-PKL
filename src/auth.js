const crypto = require('crypto');
const db = require('./db');

const SESSION_COOKIE = 'jp_session';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 14; // 14 hari

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, Date.now() + SESSION_TTL);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL,
    path: '/',
  });
}

function destroySession(req, res) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies[SESSION_COOKIE];
  if (token) {
    const row = db.prepare(`
      SELECT u.id, u.email, u.created_at FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?
    `).get(token, Date.now());
    if (row) {
      const profile = db.prepare('SELECT full_name, profile_photo_path FROM student_profiles WHERE user_id = ?').get(row.id);
      row.fullName = profile && profile.full_name ? profile.full_name : row.email;
      row.profilePhoto = !!(profile && profile.profile_photo_path);
      row.initials = row.fullName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      req.user = row;
    } else {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      res.clearCookie(SESSION_COOKIE, { path: '/' });
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    const target = req.method === 'GET' ? `?next=${encodeURIComponent(req.originalUrl)}` : '';
    return res.redirect('/login' + target);
  }
  next();
}

module.exports = { hashPassword, verifyPassword, createSession, destroySession, loadUser, requireAuth, SESSION_COOKIE };
