const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const crypto = require('crypto');
const layouts = require('express-ejs-layouts');
require('dotenv').config();

const db = require('./db');
const { loadUser, requireAuth, hashPassword, verifyPassword, createSession, destroySession } = require('./auth');
const uploadCfg = require('./upload');
const { streamPdf, MONTHS_ID } = require('./pdf');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(layouts);
app.set('layout', 'layouts/public');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0 }));

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(loadUser);

// CSRF token
app.use((req, res, next) => {
  if (!req.cookies._csrf) {
    res.cookie('_csrf', crypto.randomBytes(24).toString('hex'), { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  }
  res.locals.csrf = req.cookies._csrf || '';
  res.locals.user = req.user;
  res.locals.me = req.user;
  res.locals.currentPath = req.path;
  res.locals.flash = null;
  next();
});

// Pilih layout: halaman publik memakai layouts/public, sisanya layouts/app
app.use((req, res, next) => {
  const publicPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
  res.locals.layout = publicPaths.includes(req.path) ? 'layouts/public' : 'layouts/app';
  next();
});

// Verifikasi CSRF untuk semua POST.
// Body multipart (unggah foto / profil) baru terbaca setelah multer, sehingga
// rute-rute itu memvalidasi token di dalam handler-nya masing-masing.
function csrfTokenFromReq(req) {
  const bodyToken = req.body && req.body._csrf;
  const headerToken = req.get('x-csrf-token');
  const expected = req.cookies._csrf;
  if (!expected) return false;
  return (bodyToken && bodyToken === expected) || (headerToken && headerToken === expected);
}
function csrfValid(req) { return csrfTokenFromReq(req); }
const MULTIPART_HANDLED_PATHS = [/^\/journals\/\d+\/photos$/, /^\/photos\/\d+\/delete$/, /^\/profile$/];
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const isMultipart = (req.headers['content-type'] || '').includes('multipart/form-data');
  if (isMultipart && MULTIPART_HANDLED_PATHS.some(re => re.test(req.path))) return next();
  if (!csrfTokenFromReq(req)) {
    const wantsJson = /\/photos$|\/delete$/.test(req.path) || (req.get('accept') || '').includes('application/json');
    if (wantsJson) return res.status(403).json({ ok: false, error: 'Sesi tidak valid. Muat ulang halaman lalu coba lagi.' });
    return res.status(403).render('error', { title: 'Akses ditolak', message: 'Sesi tidak valid. Muat ulang halaman lalu coba lagi.' });
  }
  next();
});

// Flash lewat cookie
function setFlash(res, type, message) {
  res.cookie('_flash', JSON.stringify({ type, message }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60000 });
}
app.use((req, res, next) => {
  let f = null;
  try { f = req.cookies._flash ? JSON.parse(req.cookies._flash) : null; } catch { f = null; }
  if (f) res.clearCookie('_flash', { path: '/' });
  res.locals.flash = f;
  next();
});

// Helper
const getProfile = (uid) => db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(uid);
const getInternship = (uid) => db.prepare('SELECT * FROM internships WHERE user_id = ?').get(uid);
const isId = (s) => /^\d+$/.test(s || '');

// ================= PUBLIK =================
app.get('/', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('home', { title: 'Jurnal PKL — Catat · Pantau · Capai' });
});

app.get('/register', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('register', { title: 'Daftar Akun', errors: {}, values: {} });
});

app.post('/register', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const confirm = req.body.password_confirm || '';
  const errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Format email tidak valid.';
  if (password.length < 8) errors.password = 'Kata sandi minimal 8 karakter.';
  if (password !== confirm) errors.password_confirm = 'Konfirmasi kata sandi tidak sama.';
  if (!errors.email && db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    errors.email = 'Email tidak dapat digunakan untuk mendaftar.';
  }
  if (Object.keys(errors).length) return res.status(400).render('register', { title: 'Daftar Akun', errors, values: { email } });
  const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hashPassword(password));
  createSession(res, info.lastInsertRowid);
  setFlash(res, 'success', 'Akun berhasil dibuat. Lengkapi profil PKL Anda.');
  res.redirect('/setup');
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  const next = typeof req.query.next === 'string' && req.query.next.startsWith('/') && !req.query.next.startsWith('//') ? req.query.next : '';
  res.render('login', { title: 'Masuk', errors: {}, values: {}, next });
});

app.post('/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).render('login', { title: 'Masuk', errors: { form: 'Email atau kata sandi salah.' }, values: { email }, next: req.body.next || '' });
  }
  createSession(res, user.id);
  const target = typeof req.body.next === 'string' && req.body.next.startsWith('/') && !req.body.next.startsWith('//') ? req.body.next : '/dashboard';
  res.redirect(target);
});

app.post('/logout', (req, res) => {
  destroySession(req, res);
  res.redirect('/');
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { title: 'Pemulihan Akses', sent: false, errors: {}, values: {}, token: null });
});

app.post('/forgot-password', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  let token = null;
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (user) {
    token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, user.id, Date.now() + 1000 * 60 * 60);
    if (process.env.NODE_ENV !== 'production') console.log(`[reset] /reset-password?t=${token}`);
  }
  // Pesan identik agar tidak membocorkan status email
  res.render('forgot-password', { title: 'Pemulihan Akses', sent: true, token, errors: {}, values: { email } });
});

app.get('/reset-password', (req, res) => {
  const t = req.query.t || '';
  const row = db.prepare('SELECT 1 FROM password_resets WHERE token = ? AND expires_at > ?').get(t, Date.now());
  if (!row) return res.status(400).render('error', { title: 'Tautan tidak valid', message: 'Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman pemulihan.' });
  res.render('reset-password', { title: 'Atur Ulang Kata Sandi', token: t, errors: {} });
});

app.post('/reset-password', (req, res) => {
  const t = req.body.token || '';
  const password = req.body.password || '';
  const confirm = req.body.password_confirm || '';
  const row = db.prepare('SELECT user_id FROM password_resets WHERE token = ? AND expires_at > ?').get(t, Date.now());
  if (!row) return res.status(400).render('error', { title: 'Tautan tidak valid', message: 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.' });
  if (password.length < 8 || password !== confirm) {
    return res.status(400).render('reset-password', { title: 'Atur Ulang Kata Sandi', token: t, errors: { form: 'Kata sandi minimal 8 karakter dan konfirmasi harus sama.' } });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id);
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
  setFlash(res, 'success', 'Kata sandi berhasil diubah. Silakan masuk.');
  res.redirect('/login');
});

// ================= AREA PRIVAT =================
app.use(requireAuth);

app.get('/setup', (req, res) => {
  res.render('setup', {
    title: 'Setup Profil & PKL',
    profile: getProfile(req.user.id),
    internship: getInternship(req.user.id),
    errors: {},
  });
});

function validateSetup(b) {
  const errors = {};
  if (!(b.full_name || '').trim()) errors.full_name = 'Nama lengkap wajib diisi.';
  if (!(b.company_name || '').trim()) errors.company_name = 'Nama perusahaan/instansi wajib diisi.';
  if (!b.start_date) errors.start_date = 'Tanggal mulai PKL wajib diisi.';
  if (!b.end_date) errors.end_date = 'Tanggal selesai PKL wajib diisi.';
  if (b.start_date && b.end_date && b.end_date < b.start_date) errors.end_date = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  return errors;
}

function saveSetup(uid, b) {
  const profile = getProfile(uid);
  if (profile) {
    db.prepare(`UPDATE student_profiles SET full_name=?, student_number=?, class_name=?, school_name=?, program=?, updated_at=datetime('now') WHERE user_id=?`)
      .run(b.full_name.trim(), b.student_number?.trim() || null, b.class_name?.trim() || null, b.school_name?.trim() || null, b.program?.trim() || null, uid);
  } else {
    db.prepare(`INSERT INTO student_profiles (user_id, full_name, student_number, class_name, school_name, program) VALUES (?,?,?,?,?,?)`)
      .run(uid, b.full_name.trim(), b.student_number?.trim() || null, b.class_name?.trim() || null, b.school_name?.trim() || null, b.program?.trim() || null);
  }
  const internship = getInternship(uid);
  if (internship) {
    db.prepare(`UPDATE internships SET company_name=?, company_address=?, supervisor_name=?, position=?, start_date=?, end_date=?, description=?, updated_at=datetime('now') WHERE user_id=?`)
      .run(b.company_name.trim(), b.company_address?.trim() || null, b.supervisor_name?.trim() || null, b.position?.trim() || null, b.start_date, b.end_date, b.description?.trim() || null, uid);
  } else {
    const info = db.prepare(`INSERT INTO internships (user_id, company_name, company_address, supervisor_name, position, start_date, end_date, description) VALUES (?,?,?,?,?,?,?,?)`)
      .run(uid, b.company_name.trim(), b.company_address?.trim() || null, b.supervisor_name?.trim() || null, b.position?.trim() || null, b.start_date, b.end_date, b.description?.trim() || null);
    db.prepare('UPDATE journals SET internship_id = ? WHERE user_id = ? AND internship_id IS NULL').run(info.lastInsertRowid, uid);
  }
}

app.post('/setup', (req, res) => {
  const errors = validateSetup(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).render('setup', { title: 'Setup Profil & PKL', profile: req.body, internship: req.body, errors });
  }
  saveSetup(req.user.id, req.body);
  setFlash(res, 'success', 'Profil dan informasi PKL berhasil disimpan.');
  res.redirect('/dashboard');
});

// Setup wajib sebelum halaman lain (logout & pengaturan tetap dapat diakses)
app.use((req, res, next) => {
  if (req.path === '/logout' || req.path.startsWith('/settings')) return next();
  if (!getProfile(req.user.id) || !getInternship(req.user.id)) {
    setFlash(res, 'info', 'Lengkapi profil dan informasi PKL terlebih dahulu.');
    return res.redirect('/setup');
  }
  next();
});

app.get('/dashboard', (req, res) => {
  const uid = req.user.id;
  const total = db.prepare('SELECT COUNT(*) c FROM journals WHERE user_id = ?').get(uid).c;
  const days = db.prepare('SELECT COUNT(DISTINCT activity_date) c FROM journals WHERE user_id = ?').get(uid).c;
  const recent = db.prepare(`SELECT j.*, (SELECT COUNT(*) FROM journal_documentation d WHERE d.journal_id = j.id) photo_count
    FROM journals j WHERE user_id = ? ORDER BY activity_date DESC, id DESC LIMIT 5`).all(uid);
  res.render('dashboard', { title: 'Dashboard', profile: getProfile(uid), internship: getInternship(uid), total, days, recent });
});

// ================= JURNAL =================
function validateJournal(b, uid) {
  const errors = {};
  if (!b.activity_date) errors.activity_date = 'Tanggal kegiatan wajib diisi.';
  if (!(b.title || '').trim()) errors.title = 'Judul kegiatan wajib diisi.';
  if (!(b.description || '').trim()) errors.description = 'Deskripsi kegiatan wajib diisi.';
  if (b.start_time && b.end_time && b.end_time <= b.start_time) errors.end_time = 'Jam selesai harus setelah jam mulai.';
  if (b.activity_date) {
    const internship = getInternship(uid);
    if (internship) {
      if (b.activity_date < internship.start_date) errors.activity_date = 'Tanggal kegiatan sebelum periode PKL dimulai.';
      else if (b.activity_date > internship.end_date) errors.activity_date = 'Tanggal kegiatan setelah periode PKL berakhir.';
    }
  }
  return errors;
}

app.get('/journals', (req, res) => {
  const uid = req.user.id;
  const q = (req.query.q || '').trim();
  const from = req.query.from || '';
  const to = req.query.to || '';
  const sort = req.query.sort === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const per = 10;

  let where = 'j.user_id = ?'; const params = [uid];
  if (q) { where += ' AND (j.title LIKE ? OR j.description LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (from) { where += ' AND j.activity_date >= ?'; params.push(from); }
  if (to) { where += ' AND j.activity_date <= ?'; params.push(to); }

  const total = db.prepare(`SELECT COUNT(*) c FROM journals j WHERE ${where}`).get(...params).c;
  const pages = Math.max(1, Math.ceil(total / per));
  const safePage = Math.min(page, pages);
  const journals = db.prepare(`SELECT j.*, (SELECT COUNT(*) FROM journal_documentation d WHERE d.journal_id = j.id) photo_count
    FROM journals j WHERE ${where} ORDER BY j.activity_date ${sort}, j.id ${sort} LIMIT ? OFFSET ?`)
    .all(...params, per, (safePage - 1) * per);

  res.render('journals/index', { title: 'Riwayat Jurnal', journals, q, from, to, sort, page: safePage, pages, total });
});

app.get('/journals/new', (req, res) => {
  res.render('journals/form', { title: 'Tambah Jurnal', journal: null, photos: [], errors: {}, maxPhotos: uploadCfg.MAX_PHOTOS, maxSizeMb: uploadCfg.MAX_SIZE_MB });
});

app.post('/journals', (req, res) => {
  const errors = validateJournal(req.body, req.user.id);
  if (Object.keys(errors).length) {
    return res.status(400).render('journals/form', { title: 'Tambah Jurnal', journal: req.body, photos: [], errors, maxPhotos: uploadCfg.MAX_PHOTOS, maxSizeMb: uploadCfg.MAX_SIZE_MB });
  }
  const internship = getInternship(req.user.id);
  const info = db.prepare(`INSERT INTO journals (user_id, internship_id, activity_date, start_time, end_time, title, description, result, obstacles, solutions)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, internship ? internship.id : null, req.body.activity_date, req.body.start_time || null, req.body.end_time || null,
      req.body.title.trim(), req.body.description.trim(), req.body.result?.trim() || null, req.body.obstacles?.trim() || null, req.body.solutions?.trim() || null);
  setFlash(res, 'success', 'Jurnal berhasil disimpan. Anda dapat menambahkan foto dokumentasi.');
  res.redirect(`/journals/${info.lastInsertRowid}`);
});

function ownJournal(req, res) {
  const j = db.prepare('SELECT * FROM journals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!j) { res.status(404).render('error', { title: 'Tidak ditemukan', message: 'Jurnal tidak ditemukan atau bukan milik Anda.' }); return null; }
  return j;
}

app.get('/journals/:id', (req, res) => {
  if (!isId(req.params.id)) return next('route');
  const j = ownJournal(req, res); if (!j) return;
  const photos = db.prepare('SELECT * FROM journal_documentation WHERE journal_id = ? AND user_id = ? ORDER BY id').all(j.id, req.user.id);
  res.render('journals/show', { title: 'Detail Jurnal', journal: j, photos, maxPhotos: uploadCfg.MAX_PHOTOS, maxSizeMb: uploadCfg.MAX_SIZE_MB });
});

app.get('/journals/:id/edit', (req, res) => {
  if (!isId(req.params.id)) return next('route');
  const j = ownJournal(req, res); if (!j) return;
  const photos = db.prepare('SELECT * FROM journal_documentation WHERE journal_id = ? AND user_id = ? ORDER BY id').all(j.id, req.user.id);
  res.render('journals/form', { title: 'Edit Jurnal', journal: j, photos, errors: {}, maxPhotos: uploadCfg.MAX_PHOTOS, maxSizeMb: uploadCfg.MAX_SIZE_MB });
});

app.post('/journals/:id', (req, res) => {
  if (!isId(req.params.id)) return next('route');
  const j = ownJournal(req, res); if (!j) return;
  const errors = validateJournal(req.body, req.user.id);
  if (Object.keys(errors).length) {
    const photos = db.prepare('SELECT * FROM journal_documentation WHERE journal_id = ? AND user_id = ?').all(j.id, req.user.id);
    return res.status(400).render('journals/form', { title: 'Edit Jurnal', journal: { ...j, ...req.body }, photos, errors, maxPhotos: uploadCfg.MAX_PHOTOS, maxSizeMb: uploadCfg.MAX_SIZE_MB });
  }
  db.prepare(`UPDATE journals SET activity_date=?, start_time=?, end_time=?, title=?, description=?, result=?, obstacles=?, solutions=?, updated_at=datetime('now') WHERE id=? AND user_id=?`)
    .run(req.body.activity_date, req.body.start_time || null, req.body.end_time || null, req.body.title.trim(), req.body.description.trim(),
      req.body.result?.trim() || null, req.body.obstacles?.trim() || null, req.body.solutions?.trim() || null, j.id, req.user.id);
  setFlash(res, 'success', 'Perubahan jurnal berhasil disimpan.');
  res.redirect(`/journals/${j.id}`);
});

app.post('/journals/:id/delete', (req, res) => {
  if (!isId(req.params.id)) return next('route');
  const j = ownJournal(req, res); if (!j) return;
  const photos = db.prepare('SELECT image_path FROM journal_documentation WHERE journal_id = ? AND user_id = ?').all(j.id, req.user.id);
  db.prepare('DELETE FROM journals WHERE id = ? AND user_id = ?').run(j.id, req.user.id);
  photos.forEach(p => uploadCfg.deleteImage(p.image_path));
  setFlash(res, 'success', 'Jurnal berhasil dihapus.');
  res.redirect('/journals');
});

// ================= FOTO =================
const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadCfg.MAX_SIZE, files: uploadCfg.MAX_PHOTOS, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (!uploadCfg.ALLOWED_MIME.includes(file.mimetype)) return cb(new Error('FORMAT'));
    cb(null, true);
  },
});

app.post('/journals/:id/photos', (req, res, next) => { if (!isId(req.params.id)) return next('route'); next(); }, uploadPhoto.array('photos', uploadCfg.MAX_PHOTOS), async (req, res, next) => {
  try {
    if (!csrfValid(req)) return res.status(403).json({ ok: false, error: 'Sesi tidak valid. Muat ulang halaman lalu coba lagi.' });
    const j = ownJournalJson(req, res); if (!j) return;
    const count = db.prepare('SELECT COUNT(*) c FROM journal_documentation WHERE journal_id = ? AND user_id = ?').get(j.id, req.user.id).c;
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ ok: false, error: 'Pilih minimal satu foto.' });
    if (files.length > uploadCfg.MAX_PHOTOS) {
      return res.status(400).json({ ok: false, error: `Maksimal ${uploadCfg.MAX_PHOTOS} foto dapat diunggah sekaligus.` });
    }
    if (count + files.length > uploadCfg.MAX_PHOTOS) {
      const sisa = Math.max(0, uploadCfg.MAX_PHOTOS - count);
      return res.status(400).json({
        ok: false,
        error: `Maksimal ${uploadCfg.MAX_PHOTOS} foto per jurnal. Saat ini ${count} foto tersimpan, sisa ${sisa} slot. Hapus foto lama bila ingin menambah.`,
      });
    }
    for (const f of files) {
      const name = await uploadCfg.saveImage(f.buffer, req.user.id);
      db.prepare('INSERT INTO journal_documentation (journal_id, user_id, image_path, caption) VALUES (?,?,?,?)')
        .run(j.id, req.user.id, name, (req.body.caption || '').trim() || null);
    }
    const total = count + files.length;
    res.json({ ok: true, count: total, max: uploadCfg.MAX_PHOTOS });
  } catch (e) { next(e); }
});

function ownJournalJson(req, res) {
  const j = db.prepare('SELECT * FROM journals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!j) { res.status(404).json({ ok: false, error: 'Jurnal tidak ditemukan.' }); return null; }
  return j;
}

app.post('/photos/:id/delete', (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ ok: false, error: 'Foto tidak ditemukan.' });
  const p = db.prepare('SELECT * FROM journal_documentation WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ ok: false, error: 'Foto tidak ditemukan.' });
  db.prepare('DELETE FROM journal_documentation WHERE id = ? AND user_id = ?').run(p.id, req.user.id);
  uploadCfg.deleteImage(p.image_path);
  res.json({ ok: true });
});

app.get('/photos/:id', (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Not found');
  const p = db.prepare('SELECT image_path FROM journal_documentation WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!p) return res.status(404).send('Not found');
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.join(uploadCfg.UPLOAD_DIR, path.basename(p.image_path)));
});

app.get('/profile-photo', (req, res) => {
  const p = getProfile(req.user.id);
  if (!p || !p.profile_photo_path) return res.status(404).send('Not found');
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.join(uploadCfg.UPLOAD_DIR, path.basename(p.profile_photo_path)));
});

// ================= PROGRES =================
app.get('/progress', (req, res) => {
  const uid = req.user.id;
  const total = db.prepare('SELECT COUNT(*) c FROM journals WHERE user_id = ?').get(uid).c;
  const days = db.prepare('SELECT COUNT(DISTINCT activity_date) c FROM journals WHERE user_id = ?').get(uid).c;
  const byMonth = db.prepare(`SELECT substr(activity_date,1,7) ym, COUNT(*) c, COUNT(DISTINCT activity_date) d
    FROM journals WHERE user_id = ? GROUP BY ym ORDER BY ym DESC LIMIT 12`).all(uid)
    .map(r => ({ ...r, label: `${MONTHS_ID[parseInt(r.ym.slice(5, 7)) - 1]} ${r.ym.slice(0, 4)}` }));
  const byWeek = db.prepare(`SELECT strftime('%Y-%W', activity_date) wk, COUNT(*) c
    FROM journals WHERE user_id = ? GROUP BY wk ORDER BY wk DESC LIMIT 8`).all(uid).reverse();
  res.render('progress', { title: 'Progres', total, days, byMonth, byWeek, internship: getInternship(uid) });
});

// ================= EKSPOR PDF =================
app.get('/export', (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year) || now.getFullYear();
  const month = parseInt(req.query.month) || now.getMonth() + 1;
  res.render('export', { title: 'Ekspor Laporan PDF', year, month: Math.min(12, Math.max(1, month)), MONTHS_ID });
});

app.get('/export/preview', (req, res) => {
  const uid = req.user.id;
  const year = parseInt(req.query.year);
  const month = parseInt(req.query.month);
  if (!year || !month || month < 1 || month > 12) return res.status(400).json({ ok: false, error: 'Bulan/tahun tidak valid.' });
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const journals = db.prepare(`SELECT activity_date, title, start_time, end_time FROM journals
    WHERE user_id = ? AND activity_date LIKE ? ORDER BY activity_date ASC, id ASC`).all(uid, `${ym}%`);
  res.json({ ok: true, count: journals.length, days: new Set(journals.map(j => j.activity_date)).size, journals });
});

app.get('/export/download', async (req, res, next) => {
  const year = parseInt(req.query.year);
  const month = parseInt(req.query.month);
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).render('error', { title: 'Periode tidak valid', message: 'Pilih bulan dan tahun yang valid.' });
  }
  try {
    await streamPdf(res, req.user, { year, month });
  } catch (e) {
    if (res.headersSent) {
      // Header PDF sudah terkirim; tidak bisa mengganti dengan halaman HTML.
      try { res.end(); } catch (_) {}
      console.error('Gagal menyelesaikan PDF:', e.message);
      return;
    }
    next(e);
  }
});

// ================= PROFIL =================
app.get('/profile', (req, res) => {
  res.render('profile', { title: 'Profil & PKL', profile: getProfile(req.user.id), internship: getInternship(req.user.id), errors: {} });
});

app.post('/profile', uploadPhoto.single('photo'), async (req, res, next) => {
  try {
    if (!csrfValid(req)) return res.status(403).render('error', { title: 'Akses ditolak', message: 'Sesi tidak valid. Muat ulang halaman lalu coba lagi.' });
    const b = req.body;
    const errors = validateSetup(b);
    if (req.file && !uploadCfg.ALLOWED_MIME.includes(req.file.mimetype)) errors.photo = 'Format foto harus JPG, PNG, atau WebP.';
    if (Object.keys(errors).length) {
      return res.status(400).render('profile', {
        title: 'Profil & PKL', profile: { ...getProfile(req.user.id), ...b }, internship: b, errors,
      });
    }
    if (req.file) {
      const old = getProfile(req.user.id);
      const name = await uploadCfg.saveImage(req.file.buffer, req.user.id);
      if (old.profile_photo_path) await uploadCfg.deleteImage(old.profile_photo_path);
      db.prepare('UPDATE student_profiles SET profile_photo_path=? WHERE user_id=?').run(name, req.user.id);
    }
    saveSetup(req.user.id, b);
    setFlash(res, 'success', 'Profil dan informasi PKL berhasil diperbarui.');
    res.redirect('/profile');
  } catch (e) { next(e); }
});

// ================= PENGATURAN =================
app.get('/settings', (req, res) => {
  res.render('settings', { title: 'Pengaturan', email: req.user.email });
});

app.post('/settings/change-password', (req, res) => {
  const current = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(req.body.current_password || '', current.password_hash)) {
    setFlash(res, 'error', 'Kata sandi saat ini salah.');
    return res.redirect('/settings');
  }
  if ((req.body.new_password || '').length < 8 || req.body.new_password !== req.body.password_confirm) {
    setFlash(res, 'error', 'Kata sandi baru minimal 8 karakter dan konfirmasi harus sama.');
    return res.redirect('/settings');
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(req.body.new_password), req.user.id);
  setFlash(res, 'success', 'Kata sandi berhasil diubah.');
  res.redirect('/settings');
});

app.post('/settings/delete-account', (req, res) => {
  if ((req.body.confirm_text || '').trim() !== 'HAPUS') {
    setFlash(res, 'error', 'Ketik HAPUS (huruf kapital) untuk mengonfirmasi penghapusan akun.');
    return res.redirect('/settings');
  }
  const photos = db.prepare('SELECT image_path FROM journal_documentation WHERE user_id = ?').all(req.user.id);
  const profile = getProfile(req.user.id);
  if (profile && profile.profile_photo_path) photos.push({ image_path: profile.profile_photo_path });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  photos.forEach(p => uploadCfg.deleteImage(p.image_path));
  destroySession(req, res);
  res.redirect('/');
});

// ================= ERROR =================
app.use((req, res) => {
  res.status(404).render('error', { title: 'Halaman tidak ditemukan', message: 'Halaman yang Anda cari tidak tersedia.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  let message = 'Terjadi kesalahan pada server. Silakan coba lagi.';
  let status = 500;
  if (err.message === 'FORMAT') { message = `Format berkas tidak didukung. Gunakan ${uploadCfg.ALLOWED_LABEL}.`; status = 400; }
  if (err.code === 'LIMIT_FILE_SIZE') { message = `Ukuran foto melebihi batas ${uploadCfg.MAX_SIZE_MB} MB per foto.`; status = 400; }
  if (err.code === 'LIMIT_FILE_COUNT') { message = `Jumlah foto melebihi batas ${uploadCfg.MAX_PHOTOS} foto per jurnal.`; status = 400; }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') { message = `Maksimal ${uploadCfg.MAX_PHOTOS} foto dapat diunggah sekaligus.`; status = 400; }
  if (err instanceof multer.MulterError) status = 400;
  const wantsJson = req.xhr || /\/photos$|\/delete$/.test(req.path) || (req.get('accept') || '').includes('application/json');
  if (wantsJson) return res.status(status).json({ ok: false, error: message });
  res.status(status).render('error', { title: status === 400 ? 'Permintaan tidak valid' : 'Terjadi kesalahan', message });
});

const PORT = process.env.PORT || 3000;

// Bersihkan sesi kedaluwarsa & token reset kedaluwarsa secara berkala
function cleanup() {
  try {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(Date.now());
  } catch (e) { /* abaikan */ }
}
cleanup();
setInterval(cleanup, 1000 * 60 * 60).unref();

uploadCfg.ensureDir().then(() => {
  app.listen(PORT, () => console.log(`Jurnal PKL berjalan di http://localhost:${PORT}`));
});
