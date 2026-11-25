// Uji unggah foto dengan berkas nyata JPG, PNG, WebP + batas ukuran + otorisasi.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:3000';
let cookies = {};
function ck() { return Object.entries(cookies).map(([k, v]) => k + '=' + v).join('; '); }
function sc(res) {
  const l = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of l) {
    const [p] = c.split(';'); const i = p.indexOf('=');
    const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
    if (v === '') delete cookies[k]; else cookies[k] = v;
  }
}
async function req(p, o = {}) {
  const h = { ...(o.headers || {}) };
  if (Object.keys(cookies).length) h.cookie = ck();
  let b = o.body;
  if (b && typeof b === 'object' && !(b instanceof FormData)) { h['content-type'] = 'application/x-www-form-urlencoded'; b = new URLSearchParams(b).toString(); }
  const r = await fetch(BASE + p, { ...o, headers: h, body: b, redirect: 'manual' });
  sc(r);
  return r;
}
let pass = 0, fail = 0;
function check(name, cond, extra = '') { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); cond ? pass++ : fail++; }

async function upload(journalId, buffer, mime, filename, csrf) {
  const fd = new FormData();
  fd.append('photos', new Blob([buffer], { type: mime }), filename);
  fd.append('_csrf', csrf);
  const r = await req(`/journals/${journalId}/photos`, { method: 'POST', body: fd });
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch (e) {}
  return { status: r.status, data, text };
}

(async () => {
  await req('/');
  const email = `foto${Date.now()}@t.id`;
  await req('/register', { method: 'POST', body: { _csrf: cookies._csrf, email, password: 'sandirahasia1', password_confirm: 'sandirahasia1' } });
  await req('/setup', { method: 'POST', body: { _csrf: cookies._csrf, full_name: 'Penguji Foto', company_name: 'PT Foto', start_date: '2026-11-01', end_date: '2027-03-01' } });
  await req('/journals', { method: 'POST', body: { _csrf: cookies._csrf, activity_date: '2026-11-15', title: 'Uji Foto', description: 'Deskripsi uji' } });

  const list = await req('/journals');
  const listText = await list.text();
  const journalId = (listText.match(/\/journals\/(\d+)/) || [])[1];
  check('jurnal dibuat & id ditemukan', !!journalId, 'id=' + journalId);

  // Gambar "foto" realistis dengan gradien + noise agar ukuran mirip foto
  async function makeImage(fmt) {
    const w = 1200, h = 900;
    const base = sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 80, b: 70 } } })
      .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b4d3e"/><stop offset="1" stop-color="#4fd1c5"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="600" cy="400" r="220" fill="#ffd166" opacity="0.6"/><text x="600" y="820" font-size="60" fill="#ffffff" text-anchor="middle">Dokumentasi PKL</text></svg>`), top: 0, left: 0 }]);
    if (fmt === 'jpeg') return base.jpeg({ quality: 92 }).toBuffer();
    if (fmt === 'png') return base.png().toBuffer();
    return base.webp({ quality: 88 }).toBuffer();
  }

  const jpg = await makeImage('jpeg');
  const png = await makeImage('png');
  const webp = await makeImage('webp');
  console.log('ukuran berkas: jpg=' + (jpg.length / 1024 | 0) + 'KB png=' + (png.length / 1024 | 0) + 'KB webp=' + (webp.length / 1024 | 0) + 'KB');

  let r = await upload(journalId, jpg, 'image/jpeg', 'foto.jpg', cookies._csrf);
  check('unggah JPG', r.status === 200 && r.data && r.data.ok, JSON.stringify(r.data).slice(0, 60));
  r = await upload(journalId, png, 'image/png', 'foto.png', cookies._csrf);
  check('unggah PNG', r.status === 200 && r.data && r.data.ok, JSON.stringify(r.data).slice(0, 60));
  r = await upload(journalId, webp, 'image/webp', 'foto.webp', cookies._csrf);
  check('unggah WebP', r.status === 200 && r.data && r.data.ok, JSON.stringify(r.data).slice(0, 60));

  // CSRF salah
  r = await upload(journalId, jpg, 'image/jpeg', 'x.jpg', 'salah');
  check('CSRF salah ditolak', r.status === 403 && r.data && !r.data.ok, 'status=' + r.status);

  // Format tidak didukung
  r = await upload(journalId, Buffer.from('bukan gambar'), 'text/plain', 'x.txt', cookies._csrf);
  check('format tidak didukung ditolak', r.status === 400 && r.data && !r.data.ok, 'status=' + r.status + ' ' + (r.data && r.data.error));

  // Terlalu besar (>5MB): PNG lossless ber-noise (kompresi buruk) agar ukuran nyata > 5 MB
  const noise = Buffer.alloc(2200 * 2200 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() * 256) | 0;
  let bigFinal = await sharp(noise, { raw: { width: 2200, height: 2200, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  if (bigFinal.length <= 5 * 1024 * 1024) {
    bigFinal = Buffer.concat([bigFinal, Buffer.alloc(6 * 1024 * 1024 - bigFinal.length, 1)]);
  }
  console.log('berkas besar: ' + (bigFinal.length / 1024 / 1024).toFixed(1) + ' MB');
  r = await upload(journalId, bigFinal, 'image/png', 'besar.png', cookies._csrf);
  check('berkas >5MB ditolak', r.status === 400 && r.data && !r.data.ok, 'status=' + r.status + ' ' + (r.data && r.data.error));

  // Batas final: 3 foto per jurnal. Sudah terunggah 3 (JPG, PNG, WebP).
  r = await upload(journalId, jpg, 'image/jpeg', 'keempat.jpg', cookies._csrf);
  check('foto ke-4 ditolak dengan pesan jelas', r.status === 400 && r.data && !r.data.ok, (r.data && r.data.error));
  check('pesan menyebut batas 3 foto', r.data && /3 foto/.test(r.data.error || ''), (r.data && r.data.error));

  // Unggah 3 foto sekaligus pada jurnal baru → harus sukses semua
  await req('/journals', { method: 'POST', body: { _csrf: cookies._csrf, activity_date: '2026-11-18', title: 'Uji batch 3 foto', description: 'Deskripsi batch' } });
  const list2 = await (await req('/journals')).text();
  const journalId2 = (list2.match(/\/journals\/(\d+)/) || [])[1];
  const batchFd = new FormData();
  for (let i = 0; i < 3; i++) batchFd.append('photos', new Blob([jpg], { type: 'image/jpeg' }), `batch${i}.jpg`);
  batchFd.append('_csrf', cookies._csrf);
  const batchRes = await req(`/journals/${journalId2}/photos`, { method: 'POST', body: batchFd });
  const batchJson = JSON.parse(await batchRes.text());
  check('tiga foto sekaligus berhasil', batchRes.status === 200 && batchJson.ok && batchJson.count === 3, JSON.stringify(batchJson));
  // Tambah 1 foto ke jurnal yang sudah penuh → ditolak
  const extra = await upload(journalId2, jpg, 'image/jpeg', 'extra.jpg', cookies._csrf);
  check('tambahan ke jurnal penuh ditolak', extra.status === 400 && extra.data && !extra.data.ok, (extra.data && extra.data.error));

  // Tampil di detail
  let detail = await req('/journals/' + journalId);
  const detailText = await detail.text();
  const photoIds = [...detailText.matchAll(/src="\/photos\/(\d+)"/g)].map(m => m[1]);
  check('foto tampil di detail', photoIds.length === 3, photoIds.length + ' foto');

  // Foto bisa dibuka pemilik + valid webp
  const pr = await req('/photos/' + photoIds[0]);
  const pbuf = Buffer.from(await pr.arrayBuffer());
  let isWebp = false;
  try { const meta = await sharp(pbuf).metadata(); isWebp = meta.format === 'webp'; } catch (e) {}
  check('pemilik dapat membuka foto & hasil WebP', pr.status === 200 && isWebp, pbuf.length + 'b');

  // Hapus foto
  const delFd = new FormData(); delFd.append('_csrf', cookies._csrf);
  const dr = await req('/photos/' + photoIds[0] + '/delete', { method: 'POST', body: delFd });
  const dj = JSON.parse(await dr.text());
  check('hapus foto', dr.status === 200 && dj.ok);
  check('foto terhapus tidak bisa dibuka', (await req('/photos/' + photoIds[0])).status === 404);

  // Pengguna lain
  const otherCookie = cookies;
  cookies = {};
  await req('/');
  const email2 = `lain${Date.now()}@t.id`;
  await req('/register', { method: 'POST', body: { _csrf: cookies._csrf, email: email2, password: 'sandirahasia1', password_confirm: 'sandirahasia1' } });
  await req('/setup', { method: 'POST', body: { _csrf: cookies._csrf, full_name: 'Lain', company_name: 'PT Lain', start_date: '2026-11-01', end_date: '2027-03-01' } });
  check('akun lain tidak bisa buka foto', (await req('/photos/' + photoIds[1])).status === 404);
  const ofd = new FormData(); ofd.append('photos', new Blob([jpg], { type: 'image/jpeg' }), 'x.jpg'); ofd.append('_csrf', cookies._csrf);
  const orr = await req('/journals/' + journalId + '/photos', { method: 'POST', body: ofd });
  check('akun lain tidak bisa unggah ke jurnal orang', orr.status === 404);
  cookies = otherCookie;

  console.log(`\nRingkasan foto: ${pass} lulus, ${fail} gagal`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('ERROR', e); process.exit(1); });
