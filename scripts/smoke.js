const BASE = 'http://localhost:3000';
let cookies = {};

function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}
function storeCookies(res) {
  const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (v === '' || /Expires=Thu, 01 Jan 1970/i.test(c)) delete cookies[k];
    else cookies[k] = v;
  }
}
async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (Object.keys(cookies).length) headers.cookie = cookieHeader();
  let body = opts.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(body).toString();
  }
  const res = await fetch(BASE + path, { ...opts, headers, body, redirect: 'manual' });
  storeCookies(res);
  return res.text().then(text => ({ status: res.status, location: res.headers.get('location'), text, res }));
}
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  let r = await req('/');
  check('GET / 200', r.status === 200);
  const csrf = cookies._csrf;
  check('csrf cookie set', !!csrf);

  r = await req('/register', { method: 'POST', body: { _csrf: csrf, email: `uji${Date.now()}@test.id`, password: 'sandirahasia1', password_confirm: 'sandirahasia1' } });
  check('POST /register redirect', r.status === 302, r.location || '');
  check('session cookie set', !!cookies.jp_session);

  const c2 = cookies._csrf;
  r = await req('/setup', { method: 'POST', body: { _csrf: c2, full_name: 'Siswa Uji', student_number: '12345', class_name: 'XII SIJA 1', program: 'SIJA', school_name: 'SMK Negeri 1', company_name: 'PT Uji Coba', company_address: 'Jl. Test 1', supervisor_name: 'Budi', position: 'IT Support', start_date: '2026-11-02', end_date: '2027-02-28', description: 'Membantu tim IT' } });
  check('POST /setup redirect', r.status === 302, r.location || '');

  r = await req('/dashboard');
  check('dashboard 200 & greets', r.status === 200 && r.text.includes('Halo'));

  r = await req('/journals', { method: 'POST', body: { _csrf: c2, activity_date: '2026-11-20', start_time: '08:00', end_time: '15:00', title: 'Instalasi Jaringan', description: 'Mengkonfigurasi router dan switch di gedung A', result: 'Jaringan berjalan', obstacles: 'Kabel kurang', solutions: 'Membeli tambahan' } });
  check('create journal redirect', r.status === 302, r.location || '');
  const journalUrl = r.location;

  r = await req('/journals');
  check('journals list has item', r.status === 200 && r.text.includes('Instalasi Jaringan'));

  r = await req('/journals?q=Jaringan');
  check('search finds item', r.text.includes('Instalasi Jaringan'));
  r = await req('/journals?q=zzzznotfound');
  check('search empty state', r.text.includes('Tidak ada hasil'));

  r = await req('/journals?from=2026-12-01&to=2026-12-31');
  check('date filter excludes', !r.text.includes('Instalasi Jaringan'));

  r = await req('/progress');
  check('progress 200', r.status === 200 && r.text.includes('Progres PKL'));

  r = await req('/export/preview?year=2026&month=11');
  let j = JSON.parse(r.text);
  check('preview count=1', j.ok && j.count === 1, JSON.stringify(j));

  r = await req('/export/preview?year=2026&month=1');
  j = JSON.parse(r.text);
  check('preview empty month', j.ok && j.count === 0);

  r = await req('/export/download?year=2026&month=11');
  const buf = Buffer.from(r.text, 'binary');
  check('pdf generated', r.status === 200 && buf.slice(0, 4).toString() === '%PDF', `${buf.length} bytes`);

  // validation: end < start
  r = await req('/journals', { method: 'POST', body: { _csrf: c2, activity_date: '2026-11-21', start_time: '15:00', end_time: '08:00', title: 'Uji', description: 'Uji' } });
  check('time validation 400', r.status === 400 && r.text.includes('Jam selesai harus setelah jam mulai'));

  // detail page
  r = await req(journalUrl);
  check('journal detail 200', r.status === 200 && r.text.includes('Instalasi Jaringan'));

  // edit
  r = await req(journalUrl + '/edit');
  check('edit form 200', r.status === 200);
  r = await req(journalUrl, { method: 'POST', body: { _csrf: c2, activity_date: '2026-11-20', start_time: '08:00', end_time: '16:00', title: 'Instalasi Jaringan (revisi)', description: 'Update deskripsi' } });
  check('edit redirect', r.status === 302);

  // CSRF rejection
  r = await req('/journals', { method: 'POST', body: { _csrf: 'wrong', activity_date: '2026-11-22', title: 'x', description: 'y' } });
  check('csrf blocks', r.status === 403);

  // Upload foto
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 20, g: 120, b: 100 } } }).png().toBuffer();
  const fd = new FormData();
  fd.append('photos', new Blob([png], { type: 'image/png' }), 'foto.png');
  fd.append('_csrf', c2);
  r = await req(journalUrl + '/photos', { method: 'POST', body: fd });
  let up = JSON.parse(r.text);
  check('photo upload', r.status === 200 && up.ok, r.text.slice(0, 80));
  r = await req(journalUrl);
  check('detail shows photo', r.text.includes('/photos/'));
  const photoId = (r.text.match(/\/photos\/(\d+)/) || [])[1];
  r = await req('/photos/' + photoId);
  check('photo served to owner', r.status === 200 && r.text.length > 50);
  // invalid mime
  const fd2 = new FormData();
  fd2.append('photos', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'x.txt');
  fd2.append('_csrf', c2);
  r = await req(journalUrl + '/photos', { method: 'POST', body: fd2 });
  check('invalid mime rejected', r.status >= 400 && r.status < 500, String(r.status));

  // cross-user isolation
  const otherCookies = Object.assign({}, cookies);
  cookies = {};
  r = await req('/');
  r = await req('/register', { method: 'POST', body: { _csrf: cookies._csrf, email: `lain${Date.now()}@test.id`, password: 'sandirahasia1', password_confirm: 'sandirahasia1' } });
  r = await req('/setup', { method: 'POST', body: { _csrf: cookies._csrf, full_name: 'Siswa Lain', company_name: 'PT Lain', start_date: '2026-11-02', end_date: '2027-02-28' } });
  r = await req(journalUrl);
  check('other user blocked 404', r.status === 404);
  check('other user photo blocked', (await req('/photos/' + photoId)).status === 404);
  r = await req('/journals');
  check('other user empty list', !r.text.includes('Instalasi Jaringan'));

  // unauth
  cookies = {};
  r = await req('/dashboard');
  check('unauth dashboard redirect', r.status === 302 && r.location.startsWith('/login'));
  r = await req('/journals');
  check('unauth journals redirect', r.status === 302);

  // wrong password
  r = await req('/login', { method: 'POST', body: { _csrf: cookies._csrf, email: 'nobody@test.id', password: 'x' } });
  check('bad login 401', r.status === 401);

  // logout
  cookies = otherCookies;
  r = await req('/settings');
  check('settings 200', r.status === 200);
  r = await req('/logout', { method: 'POST', body: { _csrf: cookies._csrf } });
  check('logout redirect', r.status === 302 && r.location === '/');
  r = await req('/dashboard');
  check('after logout redirect', r.status === 302);

  console.log('\nSelesai.');
})().catch(e => { console.error('TEST ERROR', e); process.exit(1); });
