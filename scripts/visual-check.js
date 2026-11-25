// Screenshot semua halaman pada beberapa viewport + deteksi overflow horizontal
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const OUT = 'data/shots';
fs.mkdirSync(OUT, { recursive: true });

const widths = [
  { name: '360', width: 360, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '471', width: 471, height: 860 },
  { name: 'desktop', width: 1280, height: 900 },
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // Siapkan akun + data via API HTTP di konteks browser (cookie sama)
  const email = `vis${Date.now()}@t.id`;
  await page.goto(BASE + '/');
  const csrf = (await ctx.cookies()).find(c => c.name === '_csrf').value;
  await page.request.post(BASE + '/register', { form: { _csrf: csrf, email, password: 'sandirahasia1', password_confirm: 'sandirahasia1' } });
  await page.request.post(BASE + '/setup', { form: { _csrf: csrf, full_name: 'Mirza Razaq', student_number: '2410001', class_name: 'XII SIJA 1', school_name: 'SMK Negeri 1', program: 'SIJA', company_name: 'PT Teknologi Nusantara', company_address: 'Jl. Sudirman 52', supervisor_name: 'Pak Andi', position: 'IT Support', start_date: '2026-11-02', end_date: '2027-02-28', description: 'Magang di divisi IT' } });
  for (const d of [3, 5, 7, 10, 12]) {
    await page.request.post(BASE + '/journals', { form: { _csrf: csrf, activity_date: `2026-11-${String(d).padStart(2, '0')}`, start_time: '08:00', end_time: '16:00', title: `Pemeriksaan jaringan hari ke-${d}`, description: 'Melakukan pengecekan perangkat jaringan dan mencatat temuan pada log harian tim.', result: 'Semua perangkat normal', obstacles: 'Kabel longgar', solutions: 'Dirapikan ulang' } });
  }

  const pages = [
    { path: '/', name: 'beranda', public: true },
    { path: '/login', name: 'masuk', public: true },
  ];
  const authPages = [
    { path: '/dashboard', name: 'dashboard' },
    { path: '/journals', name: 'jurnal' },
    { path: '/journals?q=zzz', name: 'jurnal-kosong' },
    { path: '/journals/new', name: 'jurnal-baru' },
    { path: '/progress', name: 'progres' },
    { path: '/export', name: 'ekspor' },
    { path: '/profile', name: 'profil' },
    { path: '/settings', name: 'pengaturan' },
  ];

  async function audit(label, path) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const info = await page.evaluate(() => {
      const de = document.documentElement;
      const overflowX = de.scrollWidth > de.clientWidth + 1;
      // Cari elemen yang melewati tepi kanan
      const offenders = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > de.clientWidth + 2) {
          offenders.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 40), right: Math.round(r.right) });
        }
      });
      return { overflowX, clientWidth: de.clientWidth, scrollWidth: de.scrollWidth, offenders: offenders.slice(0, 5) };
    });
    return info;
  }

  let problems = [];
  for (const vp of widths) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    if (vp.width !== 1280) {
      // logout agar halaman publik dapat diakses
      // (beranda & login redirect kalau sudah login) → jalankan publik dulu sebelum login
    }
    // Publik: keluar dulu bila perlu
  }

  // ---- Publik di semua viewport (sebelum login aktif) ----
  await page.context().clearCookies();
  for (const vp of widths) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const pg of pages) {
      const info = await audit(pg.name, pg.path);
      await page.screenshot({ path: `${OUT}/public-${pg.name}-${vp.name}.png`, fullPage: true });
      if (info.overflowX) problems.push(`PUBLIC ${pg.name} @${vp.name}: overflow ${info.scrollWidth}>${info.clientWidth} ${JSON.stringify(info.offenders)}`);
    }
  }

  // ---- Login untuk halaman privat ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/login');
  await page.fill('#email', email);
  await page.fill('#password', 'sandirahasia1');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');

  for (const vp of widths) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const pg of authPages) {
      const info = await audit(pg.name, pg.path);
      await page.screenshot({ path: `${OUT}/app-${pg.name}-${vp.name}.png`, fullPage: true });
      if (info.overflowX) problems.push(`APP ${pg.name} @${vp.name}: overflow ${info.scrollWidth}>${info.clientWidth} ${JSON.stringify(info.offenders)}`);
    }
  }

  console.log('Overflow problems:', problems.length ? '\n' + problems.join('\n') : 'tidak ada');
  console.log('Console/page errors:', errors.length ? '\n' + errors.join('\n') : 'tidak ada');
  await browser.close();
})();
