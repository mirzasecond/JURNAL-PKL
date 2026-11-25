// Simulasi data lama: jurnal dengan 5 foto (melebihi batas baru).
// Ekspektasi: 5 foto tetap tampil & bisa diunduh, UI menampilkan keadaan "penuh",
// unggahan baru ditolak, dan PDF memuat kelimanya.
const { chromium } = require("playwright");
const sharp = require("sharp");
const Database = require("better-sqlite3");
(async () => {
  let pass = 0, fail = 0;
  const check = (n, c, e = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${e ? "  " + e : ""}`); c ? pass++ : fail++; };
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const BASE = "http://localhost:3000";
  await p.goto(BASE + "/");
  const csrf = (await ctx.cookies()).find(c => c.name === "_csrf").value;
  const email = `legacy${Date.now()}@t.id`;
  await p.request.post(BASE + "/register", { form: { _csrf: csrf, email, password: "sandirahasia1", password_confirm: "sandirahasia1" } });
  await p.request.post(BASE + "/setup", { form: { _csrf: csrf, full_name: "Pengguna Lama", company_name: "PT Lama", start_date: "2026-01-01", end_date: "2026-12-31" } });
  await p.request.post(BASE + "/journals", { form: { _csrf: csrf, activity_date: "2026-06-10", title: "Jurnal lama 5 foto", description: "Data sebelum batas baru" } });
  const list = await (await p.request.get(BASE + "/journals")).text();
  const jid = (list.match(/\/journals\/(\d+)/) || [])[1];

  // Sisipkan 5 foto langsung ke DB + berkas (mensimulasikan data lama)
  const db = new Database("data/jurnalpkl.db");
  const uid = db.prepare("SELECT id FROM users WHERE email = ?").get(email).id;
  const fs = require("fs"); const path = require("path");
  const dir = "data/uploads";
  for (let i = 1; i <= 5; i++) {
    const buf = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 30 + i * 20, g: 90, b: 80 } } }).webp().toBuffer();
    const name = `legacy-${Date.now()}-${i}.webp`;
    fs.writeFileSync(path.join(dir, name), buf);
    db.prepare("INSERT INTO journal_documentation (journal_id, user_id, image_path, caption) VALUES (?,?,?,?)").run(jid, uid, name, "Foto lama " + i);
  }
  db.close();

  const detail = await p.goto(BASE + "/journals/" + jid);
  const html = await detail.text();
  const shown = (html.match(/src="\/photos\/(\d+)"/g) || []).length;
  check("5 foto lama tetap tampil", shown === 5, shown + " foto");
  check("UI menampilkan keadaan penuh", html.includes("sudah tercapai"));
  const hasDropzone = await p.locator("#dropzone").count();
  check("kontrol unggah disembunyikan saat penuh", hasDropzone === 0);

  // PDF harus memuat 5 foto tersebut
  const pdfRes = await ctx.request.get(BASE + "/export/download?year=2026&month=6");
  const pdfBuf = Buffer.from(await pdfRes.body());
  const imgs = (pdfBuf.toString("latin1").match(/\/Subtype\s*\/Image/g) || []).length;
  check("PDF memuat 5 foto lama", imgs === 5, imgs + " gambar");

  await b.close();
  console.log(`\nRingkasan data lama: ${pass} lulus, ${fail} gagal`);
  process.exitCode = fail ? 1 : 0;
})();
