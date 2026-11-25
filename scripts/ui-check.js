// Uji UI nyata: unggah foto lewat file chooser di halaman detail, hapus foto,
// dan keadaan pratinjau ekspor (initial, loading, isi, kosong, gagal).
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const BASE = 'http://localhost:3000';

(async () => {
  let pass = 0, fail = 0;
  const check = (n, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  ' + e : ''}`); c ? pass++ : fail++; };

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR ' + e.message));

  await page.goto(BASE + '/');
  const csrf = (await ctx.cookies()).find(c => c.name === '_csrf').value;
  const email = `ui${Date.now()}@t.id`;
  await page.request.post(BASE + '/register', { form: { _csrf: csrf, email, password: 'sandirahasia1', password_confirm: 'sandirahasia1' } });
  await page.request.post(BASE + '/setup', { form: { _csrf: csrf, full_name: 'Penguji UI', company_name: 'PT UI', start_date: '2026-11-01', end_date: '2027-03-01' } });
  await page.request.post(BASE + '/journals', { form: { _csrf: csrf, activity_date: '2026-11-19', title: 'Uji Unggah UI', description: 'Deskripsi' } });

  await page.goto(BASE + '/journals');
  await page.click('text=Uji Unggah UI');
  await page.waitForSelector('#photoManager');
  check('tombol Pilih Foto terlihat', await page.isVisible('#pickPhoto'));

  // Klik tombol → file chooser → unggah gambar nyata
  const jpgBuf = await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 20, g: 110, b: 90 } } })
    .composite([{ input: Buffer.from('<svg width="900" height="700"><rect width="100%" height="100%" fill="#14948a"/><circle cx="450" cy="300" r="160" fill="#ffd166"/><text x="450" y="620" font-size="54" fill="#fff" text-anchor="middle">Foto PKL</text></svg>'), top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
  fs.writeFileSync('data/uji-unggah.jpg', jpgBuf);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#pickPhoto'),
  ]);
  await chooser.setFiles('data/uji-unggah.jpg');

  // Tunggu reload setelah sukses
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  const gridCount = await page.locator('#photoGrid figure').count();
  check('foto muncul di detail setelah unggah UI', gridCount >= 1, gridCount + ' foto');
  check('tidak ada error console saat unggah', consoleErrors.length === 0, consoleErrors.join('; '));

  // Siapkan 2 berkas gambar untuk melengkapi 3 foto sekaligus
  const fsx = require('fs');
  fsx.writeFileSync('data/uji-2.jpg', await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 90, g: 40, b: 120 } } }).jpeg().toBuffer());
  fsx.writeFileSync('data/uji-3.jpg', await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 140, g: 90, b: 30 } } }).jpeg().toBuffer());

  // Unggah 2 lagi (total 3) lewat UI
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#pickPhoto')]);
  await chooser2.setFiles(['data/uji-2.jpg', 'data/uji-3.jpg']);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  const total3 = await page.locator('#photoGrid figure').count();
  check('tiga foto tampil di detail', total3 === 3, total3 + ' foto');
  check('kontrol unggah hilang saat 3 foto penuh', (await page.locator('#dropzone').count()) === 0);
  check('pesan batas tercapai tampil', (await page.textContent('body')).includes('sudah tercapai'));

  // Foto dapat dibuka (pemilik)
  const img = page.locator('#photoGrid img').first();
  const src = await img.getAttribute('src');
  const resp = await page.request.get(BASE + src);
  check('gambar dapat dimuat', resp.status() === 200);

  // Hapus satu foto lewat UI (modal konfirmasi) → slot kembali tersedia
  await page.click('[data-delete-photo]');
  await page.waitForSelector('#confirmModal.open');
  check('modal konfirmasi hapus muncul', await page.isVisible('#confirmModal.open'));
  await page.click('[data-modal-confirm]');
  await page.waitForTimeout(800);
  const afterDel = await page.locator('#photoGrid figure').count();
  check('foto terhapus dari UI', afterDel === 2, afterDel + ' foto tersisa');
  check('kontrol unggah kembali muncul setelah hapus', (await page.locator('#dropzone').count()) === 1);

  // ---- Ekspor: keadaan ----
  await page.goto(BASE + '/export');
  check('pratinjau awal menampilkan empty state', await page.isVisible('.preview-empty'));
  check('badge awal "Belum dimuat"', (await page.textContent('#previewBadge')).trim() === 'Belum dimuat');

  // Pratinjau bulan berisi
  await page.selectOption('#month', '11');
  await page.selectOption('#year', '2026');
  await page.click('#previewBtn');
  await page.waitForSelector('#previewArea .alert-info', { timeout: 8000 });
  check('pratinjau isi muncul', (await page.textContent('#previewArea')).includes('1 jurnal'));
  check('badge menampilkan jumlah', (await page.textContent('#previewBadge')).includes('1 jurnal'));

  // Pratinjau bulan kosong
  await page.selectOption('#month', '1');
  await page.click('#previewBtn');
  await page.waitForTimeout(1200);
  const emptyTxt = await page.textContent('#previewArea');
  check('pratinjau bulan kosong jelas', emptyTxt.includes('Tidak ada jurnal pada bulan ini'), emptyTxt.slice(0, 60));
  check('download tetap tersedia untuk bulan kosong', (await page.getAttribute('#downloadBtn', 'href')).includes('month=1'));

  console.log(`\nRingkasan UI: ${pass} lulus, ${fail} gagal`);
  await browser.close();
  process.exitCode = fail ? 1 : 0;
})();
