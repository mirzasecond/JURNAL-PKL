// Uji ekspor PDF termasuk foto dokumentasi.
// Skenario: tanpa foto, satu foto, beberapa foto, laporan panjang multi-halaman.
const sharp = require('sharp');
const fs = require('fs');
const zlib = require('zlib');
const { pdfToPng } = require('pdf-to-png-converter');
const BASE = 'http://localhost:3000';
const OUT = 'data/pdfshots';
fs.mkdirSync(OUT, { recursive: true });

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

function pdfPageCount(buf) {
  const raw = buf.toString('latin1');
  return (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
}
function pdfText(buf) {
  const raw = buf.toString('latin1');
  let out = '';
  for (const m of raw.matchAll(/stream\r?\n?([\s\S]*?)endstream/g)) {
    try { out += zlib.inflateSync(Buffer.from(m[1], 'binary')).toString('latin1'); } catch (e) {}
  }
  const hex = [...out.matchAll(/<([0-9A-Fa-f]+)>/g)].map(m => Buffer.from(m[1], 'hex').toString('latin1'));
  return hex.join('');
}
function countImages(buf) {
  // Hitung objek XObject Image di dalam PDF
  const raw = buf.toString('latin1');
  return (raw.match(/\/Subtype\s*\/Image/g) || []).length;
}

let pass = 0, fail = 0;
const check = (n, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  ' + e : ''}`); c ? pass++ : fail++; };

async function makePhoto(rgb, label) {
  const w = 1000, h = 700;
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
    .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${rgb.join(',')})"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="500" cy="300" r="170" fill="#ffd166" opacity="0.85"/><text x="500" y="620" font-size="56" fill="#ffffff" text-anchor="middle">${label}</text></svg>`), top: 0, left: 0 }])
    .jpeg({ quality: 88 }).toBuffer();
}

async function addPhoto(journalId, csrf, buffer, name) {
  const fd = new FormData();
  fd.append('photos', new Blob([buffer], { type: 'image/jpeg' }), name);
  fd.append('_csrf', csrf);
  return req(`/journals/${journalId}/photos`, { method: 'POST', body: fd });
}

(async () => {
  await req('/');
  const csrf = cookies._csrf;
  const email = `pdfx${Date.now()}@t.id`;
  await req('/register', { method: 'POST', body: { _csrf: csrf, email, password: 'sandirahasia1', password_confirm: 'sandirahasia1' } });
  await req('/setup', { method: 'POST', body: { _csrf: csrf, full_name: 'Mirza Razaq', student_number: '2410001', class_name: 'XII SIJA 1', school_name: 'SMK Negeri 1', program: 'SIJA', company_name: 'PT Teknologi Nusantara', company_address: 'Jl. Sudirman 52, Jakarta', supervisor_name: 'Pak Andi', position: 'IT Support', start_date: '2026-01-01', end_date: '2026-12-31' } });

  async function createJournal(dateStr, title, desc) {
    const r = await req('/journals', { method: 'POST', body: { _csrf: csrf, activity_date: dateStr, start_time: '08:00', end_time: '16:00', title, description: desc || 'Deskripsi kegiatan.' } });
    const loc = r.headers.get('location');
    return parseInt(loc.split('/').pop());
  }

  // ===== Skenario A: bulan tanpa foto (Januari) =====
  await createJournal('2026-01-10', 'Rapat koordinasi awal', 'Berkoordinasi dengan tim mengenai rencana kerja mingguan.');
  await createJournal('2026-01-12', 'Penyusunan laporan internal', 'Menyusun laporan progres pekerjaan divisi.');

  // ===== Skenario B: satu jurnal tanpa foto (Februari) =====
  await createJournal('2026-02-05', 'Instalasi printer jaringan', 'Memasang printer jaringan di ruang administrasi dan mengatur alamat IP statis.');

  // ===== Skenario C: satu jurnal dengan 1 foto (Maret) =====
  const jc1 = await createJournal('2026-03-10', 'Pengecekan server ruang IT', 'Memeriksa kondisi server, suhu ruangan, dan log sistem.');
  await addPhoto(jc1, csrf, await makePhoto([30, 100, 80], 'Server Room'), 'satu.jpg');

  // ===== Skenario D: satu jurnal dengan tiga foto (April) =====
  const jd1 = await createJournal('2026-04-08', 'Pemasangan kabel UTP gedung B', 'Menarik kabel UTP dari ruang server ke titik akses lantai dua gedung B.');
  await addPhoto(jd1, csrf, await makePhoto([120, 40, 60], 'Kabel 1'), 'a.jpg');
  await addPhoto(jd1, csrf, await makePhoto([40, 70, 120], 'Kabel 2'), 'b.jpg');
  await addPhoto(jd1, csrf, await makePhoto([70, 110, 50], 'Kabel 3'), 'c.jpg');
  // Jurnal kedua di bulan yang sama, tanpa foto — memastikan jurnal tanpa foto tetap normal
  await createJournal('2026-04-12', 'Konfigurasi access point', 'Mengatur SSID dan keamanan access point di area kerja.');

  // ===== Skenario E: laporan panjang dengan foto, beberapa halaman (Mei) =====
  for (let d = 2; d <= 26; d += 2) {
    const jid = await createJournal(`2026-05-${String(d).padStart(2, '0')}`, `Pemeliharaan perangkat hari ke-${d}`, 'Melakukan pemeliharaan rutin perangkat jaringan dan komputer kerja, termasuk pembersihan, pengecekan koneksi, serta pencatatan kondisi perangkat pada log pemeliharaan tim agar riwayat perawatan tetap terdokumentasi dengan baik.');
    if (d % 4 === 2) {
      await addPhoto(jid, csrf, await makePhoto([40 + d, 80, 90], `Hari ${d} A`), `h${d}a.jpg`);
      await addPhoto(jid, csrf, await makePhoto([90, 40 + d, 70], `Hari ${d} B`), `h${d}b.jpg`);
    }
  }

  async function download(month, name) {
    const r = await req(`/export/download?year=2026&month=${month}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(`${OUT}/${name}.pdf`, buf);
    return buf;
  }

  const results = [];
  const scenarios = [
    { month: 1, name: 'A-tanpa-foto', expectPhotos: 0 },
    { month: 2, name: 'B-satu-jurnal-tanpa-foto', expectPhotos: 0 },
    { month: 3, name: 'C-satu-foto', expectPhotos: 1 },
    { month: 4, name: 'D-tiga-foto', expectPhotos: 3 },
    { month: 5, name: 'E-laporan-panjang', expectPhotos: 14 },
  ];

  for (const s of scenarios) {
    const buf = await download(s.month, s.name);
    const pages = pdfPageCount(buf);
    const imgs = countImages(buf);
    const text = pdfText(buf);
    const footerOk = /Halaman 1 dari \d+/.test(text);
    results.push({ ...s, pages, imgs, footerOk });
    console.log(`${s.name}: ${buf.length}b, ${pages} halaman, ${imgs} gambar, footer=${footerOk}`);
    check(`${s.name}: jumlah gambar sesuai (${s.expectPhotos})`, imgs === s.expectPhotos, `ditemukan ${imgs}`);
    check(`${s.name}: footer halaman ada`, footerOk);
    check(`${s.name}: tanpa halaman kosong (>=1)`, pages >= 1, pages + ' halaman');
  }

  // Validasi khusus
  const long = results.find(r => r.name === 'E-laporan-panjang');
  check('laporan panjang melewati beberapa halaman', long.pages >= 2, long.pages + ' halaman');
  const footerText = pdfText(fs.readFileSync(`${OUT}/E-laporan-panjang.pdf`));
  const footers = new Set(footerText.match(/Halaman \d+ dari \d+/g) || []);
  check('footer unik per halaman & berurutan', footers.size === long.pages, [...footers].join(', '));

  const onePage = results.find(r => r.name === 'C-satu-foto');
  check('satu foto tetap 1 halaman', onePage.pages === 1, onePage.pages + ' halaman');

  // Render ke PNG untuk pemeriksaan visual
  for (const s of scenarios) {
    const pages = await pdfToPng(`${OUT}/${s.name}.pdf`, { viewportScale: 1.1 });
    let i = 1;
    for (const p of pages) fs.writeFileSync(`${OUT}/${s.name}-h${i++}.png`, p.content);
  }
  console.log('render PNG selesai');

  console.log(`\nRingkasan PDF: ${pass} lulus, ${fail} gagal`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('ERROR', e); process.exit(1); });
