# Panduan Deploy VPS — Jurnal PKL

Panduan ini **Anda jalankan sendiri** di VPS. Tidak ada kredensial yang perlu
dikirim ke siapa pun, dan tidak ada langkah yang perlu mengakses VPS dari luar.

Aplikasi: Node.js (Express 5) + SQLite (better-sqlite3) + EJS + sharp + PDFKit.
Foto disimpan di folder privat `data/uploads/` dan hanya disajikan lewat rute
terautentikasi (`/photos/:id`), bukan folder statis publik.

**Batas unggah foto:** maksimal **3 foto per jurnal**, **5 MB per foto**, dan
**25 MB per permintaan** (batas nginx). Nilai ini harus selaras antara aplikasi
dan nginx.

> **VPS bersama (sudah menjalankan Elmira VC).**
> Panduan ini **hanya menambah** service dan server block baru untuk Jurnal PKL.
> Jangan menghapus, menimpa, atau menonaktifkan konfigurasi nginx/systemd milik
> Elmira VC. Periksa dulu, baru ubah.

Notasi:
- `DOMAIN` — domain Jurnal PKL, mis. `jurnal.contoh.com`
- `APP_DIR` — `/opt/jurnalpkl`
- Port aplikasi — `3000` (ganti bila bentrok)

---

## 0. Periksa kondisi VPS (tanpa mengubah apa pun)

```bash
systemctl list-units --type=service --state=running --no-pager
sudo ss -tlnp | grep -E ':80|:443|:3000'
sudo nginx -T | grep -nE "server_name|listen"
node -v 2>/dev/null || echo "node belum ada"
nginx -v 2>&1
df -h /
```

Jika port `3000` sudah dipakai, pilih mis. `3100` dan sesuaikan `PORT` di
`.env` serta `proxy_pass` di nginx.

---

## 1. Node.js LTS (yang benar-benar didukung dependensi)

**Jangan pakai Node 20.** `better-sqlite3@13` mensyaratkan **Node >= 22**.
Panduan ini memakai **Node 24 LTS** (Active LTS; sudah diverifikasi dengan
proyek ini: `sharp` dan `better-sqlite3` berjalan normal di Node v24.19.0).
Node 22 juga boleh (Maintenance LTS).

```bash
node -v
# Jika belum ada atau < 22, pasang Node 24 LTS:
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
node -v   # pastikan >= 22
```

`build-essential` dibutuhkan bila `better-sqlite3`/`sharp` harus dikompilasi
untuk arsitektur VPS Anda.

---

## 2. Ambil kode & pasang dependensi

Pilih **salah satu**. Jangan arahkan ke folder Elmira VC.

**A. rsync dari komputer Anda**

Simpan cadangan di **luar** `APP_DIR` (default `rsync` dengan `--delete` bisa
menghapus `backup/` bila berada di dalamnya). Contoh cadangan di `/var/backups/jurnalpkl`:

```bash
rsync -av --delete \
  --exclude node_modules --exclude data --exclude .env \
  --exclude backup --exclude 'data/shots' --exclude 'data/pdfshots' \
  ./ user@DOMAIN:/opt/jurnalpkl/
```

`data/`, `.env`, dan `backup/` dikecualikan → data pengguna tidak terhapus.

**B. git di VPS**

```bash
sudo mkdir -p /opt/jurnalpkl
sudo chown "$USER":"$USER" /opt/jurnalpkl
git clone <URL_REPO_ANDA> /opt/jurnalpkl
```

Pasang dependensi produksi saja (Playwright/pdf-to-png tidak ikut):

```bash
cd /opt/jurnalpkl
npm ci --omit=dev      # atau: npm install --omit=dev
```

---

## 3. Konfigurasi lingkungan & folder data

```bash
cd /opt/jurnalpkl
cp .env.example .env
nano .env
```

```ini
NODE_ENV=production
PORT=3000
DATA_DIR=/opt/jurnalpkl/data
UPLOAD_DIR=/opt/jurnalpkl/data/uploads
```

```bash
sudo mkdir -p /opt/jurnalpkl/data/uploads
sudo chown -R www-data:www-data /opt/jurnalpkl/data
sudo chmod 750 /opt/jurnalpkl/data /opt/jurnalpkl/data/uploads

sudo chown www-data:www-data /opt/jurnalpkl/.env
sudo chmod 640 /opt/jurnalpkl/.env
```

---

## 4. Cadangan data (sebelum pembaruan apa pun)

Jika ini instalasi baru, lewati. Untuk pembaruan, **selalu** cadangkan dulu.
Simpan cadangan **di luar** `APP_DIR` agar aman dari `rsync --delete`:

```bash
BACKUP=/var/backups/jurnalpkl
sudo mkdir -p "$BACKUP"
STAMP=$(date +%F-%H%M)
cd /opt/jurnalpkl

# 1) Database SQLite (konsisten walau aplikasi berjalan)
sqlite3 data/jurnalpkl.db ".backup '$BACKUP/db-$STAMP.db'"

# 2) Foto
sudo tar -czf "$BACKUP/uploads-$STAMP.tar.gz" -C data uploads

# 3) Konfigurasi
sudo cp .env "$BACKUP/env-$STAMP.bak"
sudo cp /etc/nginx/sites-available/jurnalpkl "$BACKUP/nginx-$STAMP.conf" 2>/dev/null || true

ls -lh "$BACKUP"
```

### Jika `sqlite3` belum terpasang

```bash
command -v sqlite3 || echo "sqlite3 tidak ada"
```

Pilih salah satu:

**A. Pasang sqlite3 (disarankan)**

```bash
sudo apt-get update && sudo apt-get install -y sqlite3
```

**B. Tanpa sqlite3 — salin berkas langsung (hentikan layanan sebentar)**

```bash
sudo systemctl stop jurnalpkl
sudo cp data/jurnalpkl.db      "$BACKUP/db-$STAMP.db"
sudo cp data/jurnalpkl.db-wal  "$BACKUP/wal-$STAMP.db-wal" 2>/dev/null || true
sudo cp data/jurnalpkl.db-shm  "$BACKUP/shm-$STAMP.db-shm" 2>/dev/null || true
sudo systemctl start jurnalpkl
```

**C. Tanpa sqlite3, tanpa henti layanan — backup berbasis VACUUM INTO via Node**

```bash
cd /opt/jurnalpkl
sudo -u www-data node -e "
  const D=require('better-sqlite3');
  const db=new D(process.env.DATA_DIR+'/jurnalpkl.db');
  db.exec(\"VACUUM INTO '$BACKUP/db-$STAMP.db'\");
  db.close();
  console.log('backup selesai');
"
```

Salin `$BACKUP` ke luar VPS bila memungkinkan (mis. `scp`), karena cadangan di
VPS yang sama tidak melindungi dari kerusakan disk.

---

## 5. Layanan systemd (service baru, tidak mengganggu layanan lain)

```bash
sudo cp deploy/jurnalpkl.service /etc/systemd/system/jurnalpkl.service
sudo nano /etc/systemd/system/jurnalpkl.service   # sesuaikan bila perlu
sudo systemctl daemon-reload
sudo systemctl enable --now jurnalpkl
systemctl status jurnalpkl --no-pager
```

Uji langsung:

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3000/
```

Harus `HTTP 200`. Jika gagal: `journalctl -u jurnalpkl -n 50 --no-pager`.

---

## 6. nginx (server block baru saja)

**Jangan menimpa** konfigurasi yang sudah ada. Buat berkas baru:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/jurnalpkl
sudo nano /etc/nginx/sites-available/jurnalpkl   # ganti DOMAIN_ANDA
```

`deploy/nginx.conf` sudah memakai `client_max_body_size 25m` (selaras batas
unggah 3 × 5 MB). Inti konfigurasi:

```nginx
server {
    listen 80;
    server_name DOMAIN_ANDA;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Aktifkan **hanya berkas baru ini**, uji dulu, baru reload:

```bash
sudo ln -s /etc/nginx/sites-available/jurnalpkl /etc/nginx/sites-enabled/jurnalpkl
sudo nginx -t                # WAJIB sukses
sudo systemctl reload nginx
```

Pastikan DNS mengarah ke VPS:

```bash
dig +short DOMAIN_ANDA
```

Buka `http://DOMAIN_ANDA` → beranda Jurnal PKL harus tampil.

> Jika Elmira VC memakai server block `default_server` dengan `server_name _`,
> domain ini tetap dilayani server block baru karena `server_name` lebih
> spesifik. Jangan mengubah blok `default_server` miliknya.

---

## 7. HTTPS (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d DOMAIN_ANDA
sudo certbot renew --dry-run
curl -sSI https://DOMAIN_ANDA | head -n 1
```

Certbot hanya mengubah blok yang cocok dengan `-d DOMAIN_ANDA`. Cookie sesi
menjadi `Secure` otomatis karena `NODE_ENV=production`.

---

## 8. Verifikasi hasil deploy

```bash
systemctl is-active jurnalpkl
curl -sS -o /dev/null -w "internal  %{http_code}\n" http://127.0.0.1:3000/
curl -sS -o /dev/null -w "publik    %{http_code}\n" https://DOMAIN_ANDA/
curl -sS -o /dev/null -w "dashboard %{http_code} → %{redirect_url}\n" https://DOMAIN_ANDA/dashboard
curl -sS -o /dev/null -w "uploads   %{http_code}\n" https://DOMAIN_ANDA/uploads/berkas.webp
```

Ekspektasi: `active`, `200`, `200`, `302` ke `/login`, dan `uploads` **bukan**
`200` (harus `302`/`404`).

Uji manual di browser:
1. Daftar → isi profil & PKL → tambah jurnal.
2. Detail jurnal → unggah **3 foto** sekaligus → tampil semua.
3. Coba unggah foto ke-4 → ditolak dengan pesan jelas.
4. Ekspor → pilih bulan → Pratinjau → Unduh PDF → foto muncul di bawah jurnal
   yang benar, nomor halaman benar, tidak ada halaman kosong.
5. Buka jurnal akun lain → harus 404.

---

## 9. Pembaruan aplikasi

```bash
BACKUP=/var/backups/jurnalpkl
STAMP=$(date +%F-%H%M)
sudo mkdir -p "$BACKUP"
cd /opt/jurnalpkl

# 1) Cadangan (lihat langkah 4)
sqlite3 data/jurnalpkl.db ".backup '$BACKUP/db-$STAMP.db'"
sudo tar -czf "$BACKUP/uploads-$STAMP.tar.gz" -C data uploads

# 2) Kode baru
git pull                 # atau rsync ulang (kecualikan data/, .env, backup/)
npm ci --omit=dev

# 3) Restart & verifikasi
sudo systemctl restart jurnalpkl
sleep 1
systemctl is-active jurnalpkl
journalctl -u jurnalpkl -n 30 --no-pager
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://DOMAIN_ANDA/
```

---

## 10. Rollback

```bash
cd /opt/jurnalpkl
git log --oneline -5
git checkout <commit-sebelumnya>
npm ci --omit=dev
sudo systemctl restart jurnalpkl

# Bila perlu pulihkan data (STOP dulu agar konsisten):
sudo systemctl stop jurnalpkl
cp /var/backups/jurnalpkl/db-<STAMP>.db      data/jurnalpkl.db
rm -f data/jurnalpkl.db-wal data/jurnalpkl.db-shm
sudo tar -xzf /var/backups/jurnalpkl/uploads-<STAMP>.tar.gz -C data
sudo chown -R www-data:www-data data
sudo systemctl start jurnalpkl
```

---

## 11. Pemecahan masalah

| Gejala | Periksa |
|---|---|
| 502 Bad Gateway | `systemctl status jurnalpkl`; `PORT` di `.env` vs `proxy_pass` |
| Unggah foto 413 | `client_max_body_size` nginx harus `25m`; restart nginx |
| Foto ke-4 ditolak (400) | normal — batas 3 foto per jurnal |
| Foto tidak tampil | hak akses `data/uploads` harus milik `www-data` |
| Login gagal terus | `NODE_ENV=production` + HTTPS aktif (cookie `Secure`) |
| PDF tanpa foto | `UPLOAD_DIR` benar & berkas ada di `data/uploads` |
| `node` error saat install | Node < 22; pasang Node 24 LTS (langkah 1) |

```bash
journalctl -u jurnalpkl -f
sudo tail -f /var/log/nginx/error.log
sudo nginx -t
```

---

## 12. Yang TIDAK boleh dilakukan

- Jangan menonaktifkan/menghapus service atau server block Elmira VC.
- Jangan menjalankan `rsync --delete` tanpa mengecualikan `data/`, `.env`, `backup/`.
- Jangan menyimpan `.env`, cadangan database, atau isi `data/` ke repositori.
- Jangan mengekspos `data/uploads` lewat `location` statis di nginx.
- Jangan mengubah `default_server` milik layanan lain.
