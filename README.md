# Jurnal PKL — Website

Website pencatatan aktivitas Praktik Kerja Lapangan (PKL) untuk siswa SMK.
**Catat · Pantau · Capai**

## Fitur

- Akun: daftar, masuk, keluar, pemulihan kata sandi, hapus akun
- Profil siswa & informasi PKL (periode, perusahaan, pembimbing)
- Jurnal harian: tambah, lihat, edit, hapus (dengan konfirmasi)
- Foto dokumentasi per jurnal (maks **3 foto**, JPG/PNG/WebP, maks **5 MB** per foto)
- Riwayat: pencarian, filter tanggal, urutan terbaru/terlama, pagination
- Dashboard & progres: total jurnal, hari tercatat, rekap bulanan + grafik
- Ekspor laporan PDF bulanan dengan pratinjau, **termasuk foto dokumentasi** tiap jurnal

## Teknologi

Node.js >= 22 (LTS; diuji di Node 24) · Express 5 · SQLite (better-sqlite3) · EJS · sharp · PDFKit.
Tanpa dependensi layanan eksternal — database dan file tersimpan di server.

## Menjalankan lokal

```bash
npm install
cp .env.example .env   # opsional; nilai default cukup untuk pengembangan
npm run dev            # atau: npm start
```

Buka http://localhost:3000

## Uji

```bash
npm start &             # jalankan server
npm run smoke           # uji end-to-end (33 pemeriksaan)
npm run test:photo      # unggah foto: JPG/PNG/WebP, 3-foto/batas ukuran, CSRF, otorisasi (17)
npm run test:pdf        # ekspor PDF + foto: tanpa foto/1 foto/3 foto/multi-halaman (18)
npm run test:ui         # UI browser: unggah 3 foto via chooser, hapus, pratinjau ekspor (16)
node scripts/legacy-check.js  # data lama >3 foto: tetap tampil & masuk PDF, unggahan baru dicegah (4)
```

Alat uji browser/PDF (`playwright`, `pdf-to-png-converter`) ada di
`devDependencies` dan tidak terpasang dengan `npm ci --omit=dev`.

`visual-check.js` memotret semua halaman pada lebar 360/390/471 px dan desktop
serta mendeteksi overflow (jalankan `npx playwright install chromium` sekali).

Ekspor PDF memuat foto dokumentasi setiap jurnal langsung dari `UPLOAD_DIR`
(folder privat) — tidak lewat URL publik. Foto diperkecil & diubah ke JPEG
untuk menjaga ukuran berkas, rasio dipertahankan, dan tetap menempel pada
jurnalnya; jurnal tanpa foto tampil normal. Jurnal lama yang sudah berisi lebih dari
3 foto tetap ditampilkan penuh dan ikut masuk PDF; hanya unggahan tambahan yang
dicegah.

## Deploy ke VPS

Lihat [deploy/DEPLOY.md](deploy/DEPLOY.md).

## Struktur

```
src/
  index.js     aplikasi Express (semua rute)
  auth.js      sesi, hash kata sandi (scrypt), cookie aman
  db.js        skema & koneksi SQLite
  upload.js    pemrosesan foto (sharp → WebP, resize)
  pdf.js       generator laporan PDF bulanan
  views/       template EJS (layouts, halaman, partials)
public/        CSS, JS klien, ikon
deploy/        unit systemd, konfigurasi nginx, panduan deploy
data/          database SQLite & unggahan foto (jangan di-commit)
```

## Keamanan

- Kata sandi di-hash dengan scrypt + salt acak
- Sesi berbasis cookie httpOnly/SameSite; `secure` saat produksi
- Token CSRF pada semua form POST
- Otorisasi per baris: setiap query jurnal/foto menyaring `user_id`
- Foto disajikan lewat rute terautentikasi, bukan folder statis
- Pesan login/pemulihan tidak membocorkan keberadaan email terdaftar
