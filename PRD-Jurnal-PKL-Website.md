# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Jurnal PKL — Website

**Versi:** 1.0  
**Status:** Draft untuk acuan MVP  
**Tipe produk:** Website responsif  
**Pemilik produk:** Mirza Razaq — XII SIJA 1  
**Tagline:** Catat · Pantau · Capai

---

## 1. Ringkasan Produk

Jurnal PKL adalah website yang membantu siswa SMK mencatat dan mengelola aktivitas Praktik Kerja Lapangan (PKL). Siswa dapat mengisi jurnal harian, menambahkan foto, melihat riwayat dan progres, serta mengelola informasi diri dan tempat PKL.

Website dirancang untuk digunakan melalui browser di ponsel maupun komputer. Data jurnal disimpan pada akun siswa sehingga dapat dibuka kembali dari perangkat lain setelah masuk.

### Masalah yang ingin diselesaikan

- Catatan kegiatan manual mudah hilang atau tercecer.
- Dokumentasi kegiatan tersimpan terpisah dari catatan.
- Siswa sulit mencari catatan lama dan membuat rekap.
- Siswa tidak memiliki gambaran yang jelas tentang konsistensi pencatatan.

### Visi

Menyediakan cara yang praktis dan teratur bagi siswa SMK untuk mencatat, meninjau, dan merangkum kegiatan PKL melalui website.

---

## 2. Tujuan dan Ukuran Keberhasilan

### Tujuan produk

1. Membuat siswa dapat mencatat kegiatan PKL dengan cepat.
2. Menjaga jurnal dan dokumentasi tetap terhubung serta dapat ditemukan kembali.
3. Menampilkan riwayat dan ringkasan progres berdasarkan data sebenarnya.
4. Membantu siswa menyiapkan rekap kegiatan PKL.
5. Menyediakan pengalaman yang nyaman di layar ponsel dan komputer.

### Metrik keberhasilan MVP

- Pengguna dapat menyelesaikan pembuatan jurnal valid dan melihatnya di riwayat.
- Jurnal yang tersimpan tetap tersedia setelah pengguna keluar dan masuk kembali.
- Pengguna dapat menemukan jurnal lewat pencarian atau filter tanggal.
- Ringkasan jumlah jurnal sama dengan jumlah data jurnal yang tercatat.
- Alur utama dapat digunakan pada ukuran layar ponsel dan desktop tanpa konten terpotong.
- Kegagalan simpan atau unggah menampilkan pesan dan langkah pemulihan yang jelas.

---

## 3. Pengguna dan Peran

### MVP: Siswa

Siswa SMK yang sedang mengikuti PKL. Siswa dapat mengelola data PKL miliknya sendiri, membuat dan mengelola jurnal, serta melihat rekap pribadi.

### Di luar MVP

- Guru pembimbing sekolah untuk memantau dan memberi umpan balik.
- Pembimbing industri untuk mengonfirmasi atau mengevaluasi kegiatan.
- Admin sekolah untuk mengelola banyak siswa dan periode PKL.

Setiap perluasan peran memerlukan aturan akses dan alur persetujuan tersendiri.

---

## 4. Asumsi dan Batasan MVP

- Produk adalah website responsif yang dibuka melalui browser; aplikasi native Android bukan target MVP.
- MVP menggunakan akun siswa dan penyimpanan berbasis cloud agar data dapat diakses kembali lintas perangkat.
- Setiap akun hanya dapat melihat dan mengubah data miliknya sendiri.
- Satu akun dapat memiliki satu periode PKL aktif pada MVP. Riwayat periode PKL sebelumnya belum menjadi kebutuhan wajib.
- Jurnal dibuat dan disunting secara manual oleh siswa. Tidak ada approval pembimbing pada MVP.
- Foto dokumentasi bersifat opsional dan terhubung dengan satu jurnal.
- Bahasa antarmuka MVP adalah Bahasa Indonesia.
- Detail vendor autentikasi, database, dan penyimpanan file diputuskan pada tahap teknis, dengan tetap memenuhi persyaratan keamanan pada dokumen ini.

---

## 5. Ruang Lingkup Produk

### Termasuk MVP

- Halaman pengenalan produk sederhana.
- Daftar akun, masuk, keluar, dan pemulihan akses akun.
- Setup dan edit profil siswa.
- Setup dan edit informasi PKL.
- Dashboard dengan ringkasan dan aktivitas terbaru.
- Buat, lihat, edit, dan hapus jurnal.
- Unggah, lihat, dan hapus foto dokumentasi jurnal.
- Riwayat jurnal dengan pencarian, filter tanggal, dan urutan terbaru/terlama.
- Detail jurnal.
- Statistik dasar dan rekap kegiatan di dalam website.
- Status loading, kosong, sukses, dan gagal pada alur utama.
- Tata letak responsif untuk ponsel, tablet, dan desktop.

### Tidak termasuk MVP

- Akun atau dashboard guru dan pembimbing industri.
- Persetujuan, tanda tangan digital, komentar, atau penilaian jurnal.
- Ekspor PDF/Excel dan cetak laporan terformat.
- Pengingat terjadwal dan notifikasi push.
- Kalender kegiatan tingkat lanjut.
- Sinkronisasi offline penuh.
- Multi-periode PKL dengan pergantian periode.
- Integrasi dengan sistem sekolah.

---

## 6. Navigasi dan Halaman

### Navigasi utama setelah masuk

- **Dashboard** — ringkasan PKL dan aktivitas terbaru.
- **Jurnal** — riwayat jurnal dan tombol tambah jurnal.
- **Progres** — statistik dan rekap kegiatan.
- **Profil & PKL** — informasi siswa dan tempat PKL.
- **Pengaturan** — akun, privasi, dan informasi produk.

Di desktop, navigasi dapat berupa sidebar atau menu atas. Di ponsel, gunakan navigasi ringkas yang mudah dijangkau dan tetap menyediakan label yang jelas.

### Halaman publik

- **Beranda/pengenalan:** fungsi produk dan tombol daftar/masuk.
- **Masuk dan daftar akun.**
- **Lupa kata sandi/pemulihan akses.**

### Halaman pengguna

- Dashboard.
- Form setup profil dan PKL.
- Riwayat jurnal.
- Form tambah/edit jurnal.
- Detail jurnal.
- Progres dan rekap.
- Profil & PKL.
- Pengaturan.

---

## 7. Kebutuhan Fungsional

### 7.1 Akun dan akses

- Pengguna dapat membuat akun, masuk, dan keluar.
- Pengguna dapat memulihkan akses akun melalui mekanisme yang disediakan layanan autentikasi.
- Halaman pribadi hanya dapat diakses setelah masuk.
- Sistem menolak akses ke jurnal, profil, dan foto milik akun lain.
- Pesan validasi tidak membocorkan apakah alamat email tertentu telah terdaftar.

### 7.2 Profil siswa

Data yang dapat dikelola:

- Nama lengkap (wajib).
- NIS/NISN (opsional).
- Kelas (opsional).
- Program keahlian (opsional).
- Nama sekolah (opsional).
- Foto profil (opsional).

Pengguna dapat membuat dan memperbarui profil. Nama siswa digunakan pada dashboard dan rekap.

### 7.3 Informasi PKL

Data yang dapat dikelola:

- Nama perusahaan/instansi (wajib untuk menyelesaikan setup).
- Alamat (opsional).
- Nama pembimbing industri (opsional).
- Posisi/divisi (opsional).
- Tanggal mulai dan selesai PKL (wajib; tanggal selesai tidak boleh sebelum tanggal mulai).
- Deskripsi kegiatan PKL (opsional).

Perubahan informasi PKL tidak mengubah isi jurnal yang telah dibuat.

### 7.4 Dashboard

Dashboard menampilkan:

- Sapaan dan nama siswa.
- Nama tempat PKL dan periode aktif.
- Total jurnal.
- Jumlah hari yang memiliki jurnal.
- Aktivitas terbaru.
- Tombol utama untuk menambah jurnal.
- Tautan ke riwayat dan progres.

Semua angka berasal dari jurnal yang tersimpan. Jika profil atau data PKL belum lengkap, tampilkan ajakan untuk menyelesaikan setup.

### 7.5 Jurnal harian

Data jurnal:

- Tanggal kegiatan (wajib).
- Jam mulai dan selesai (opsional; jika keduanya diisi, jam selesai harus setelah jam mulai).
- Judul kegiatan (wajib).
- Deskripsi kegiatan (wajib).
- Hasil kegiatan (opsional).
- Kendala (opsional).
- Solusi (opsional).
- Foto dokumentasi (opsional, dapat lebih dari satu dengan batas produk yang ditentukan pada implementasi).

Fungsi:

- Membuat jurnal dan menyimpan ke akun pengguna.
- Menampilkan konfirmasi atau status sukses setelah tersimpan.
- Mempertahankan isian saat validasi gagal.
- Mengedit jurnal milik pengguna.
- Menghapus jurnal setelah konfirmasi.
- Menampilkan waktu pembuatan dan pembaruan pada detail bila relevan.
- Mencegah pengiriman ganda akibat klik berulang saat proses simpan berlangsung.

Validasi wajib menandai kolom yang perlu diperbaiki dan menjelaskan alasannya dengan Bahasa Indonesia yang mudah dipahami.

### 7.6 Riwayat dan pencarian

- Menampilkan daftar jurnal dengan tanggal, judul, ringkasan, dan indikator foto bila tersedia.
- Mendukung pencarian pada judul dan deskripsi.
- Mendukung filter rentang tanggal atau bulan.
- Mendukung urutan terbaru dan terlama.
- Filter dan pencarian tidak mengubah atau menghapus data.
- Menyediakan keadaan kosong untuk akun tanpa jurnal dan untuk pencarian tanpa hasil.
- Daftar tetap nyaman digunakan saat jumlah jurnal bertambah; implementasi dapat memakai pagination atau pemuatan bertahap.

### 7.7 Detail jurnal

Menampilkan semua kolom jurnal dan dokumentasinya. Pengguna dapat kembali ke riwayat, mengedit, atau menghapus jurnal tersebut.

### 7.8 Dokumentasi foto

- Pengguna dapat memilih foto dari perangkat melalui browser.
- Sistem memvalidasi tipe dan ukuran berkas serta menjelaskan batas unggahan kepada pengguna.
- Foto hanya dapat dibaca oleh pemilik data yang berwenang.
- Kegagalan unggah menampilkan pesan yang jelas dan menyediakan opsi mencoba kembali.
- Kegagalan unggah foto tidak boleh menyebabkan jurnal teks yang sudah tersimpan hilang.
- Penghapusan foto meminta konfirmasi bila foto sudah terhubung ke jurnal tersimpan.

Batas ukuran, jumlah foto, dan format yang diterima ditetapkan sebelum implementasi berdasarkan kapasitas layanan penyimpanan.

### 7.9 Progres dan rekap

MVP menampilkan:

- Total jurnal.
- Jumlah hari unik yang tercatat.
- Jumlah jurnal dalam periode yang dipilih.
- Daftar/ringkasan jurnal berdasarkan tanggal.
- Grafik sederhana per minggu atau bulan jika data cukup.

Definisi perhitungan:

- **Total jurnal:** jumlah catatan jurnal yang tidak dihapus.
- **Hari tercatat:** jumlah tanggal kegiatan unik yang memiliki minimal satu jurnal.
- **Periode:** menggunakan tanggal kegiatan, bukan tanggal jurnal dibuat.
- Grafik tidak menampilkan nilai buatan. Jika data belum cukup, tampilkan ringkasan tanpa grafik.

Rekap MVP tersedia di halaman web. Unduh PDF merupakan pengembangan berikutnya.

### 7.10 Pengaturan

- Menampilkan informasi akun dan tindakan keluar.
- Menyediakan informasi produk, versi, dan kebijakan privasi.
- Preferensi tema hanya disertakan jika dapat diselesaikan tanpa menghambat fitur inti.
- Hapus akun, bila disediakan, harus menjelaskan konsekuensi penghapusan data dan meminta konfirmasi eksplisit.

---

## 8. Alur Pengguna Utama

### Pengguna baru

Beranda → Daftar → Verifikasi/pemulihan akses sesuai layanan → Masuk → Isi profil dan informasi PKL → Dashboard.

### Membuat jurnal

Dashboard atau Jurnal → Tambah jurnal → Isi data → Pilih foto (opsional) → Simpan → Lihat status berhasil → Detail jurnal atau kembali ke riwayat.

### Mengelola jurnal

Riwayat → Buka detail → Edit dan simpan perubahan, atau pilih hapus → Konfirmasi → Riwayat diperbarui.

### Melihat progres

Dashboard → Progres → Pilih periode → Tinjau statistik dan daftar rekap.

---

## 9. Persyaratan UI/UX

### Arah visual

Modern, bersih, profesional, ramah siswa, dan mudah dibaca. Gunakan identitas warna hijau hutan gelap, teal, dan aksen mint/turquoise dengan latar off-white. Pastikan kontras teks memadai.

### Prinsip pengalaman

- Utamakan pencatatan jurnal sebagai tindakan utama.
- Gunakan formulir yang terkelompok dan tidak terasa panjang.
- Tampilkan label tetap pada input, bukan hanya placeholder.
- Berikan umpan balik saat menyimpan, mengunggah, menghapus, dan saat terjadi kesalahan.
- Sediakan keadaan loading, kosong, berhasil, dan gagal pada halaman yang mengambil atau mengubah data.
- Gunakan dialog konfirmasi untuk tindakan hapus.
- Pertahankan konsistensi navigasi dan istilah di seluruh halaman.
- Tampilkan tanggal dan waktu dengan format lokal Indonesia yang konsisten.
- Pastikan fungsi utama dapat digunakan dengan keyboard dan pembaca layar dasar.

### Responsif

- Mendukung lebar ponsel mulai sekitar 360 px, tablet, dan desktop.
- Form tidak melebar berlebihan di layar desktop.
- Tabel atau daftar menyesuaikan ke kartu/list pada layar sempit.
- Tidak ada elemen penting yang keluar dari area layar atau tertutup navigasi.

---

## 10. Model Data Konseptual

### User

- id
- email
- created_at

### StudentProfile

- id
- user_id
- full_name
- student_number
- class_name
- school_name
- program
- profile_photo_path
- created_at
- updated_at

### Internship

- id
- user_id
- company_name
- company_address
- supervisor_name
- position
- start_date
- end_date
- description
- created_at
- updated_at

### Journal

- id
- user_id
- internship_id
- activity_date
- start_time
- end_time
- title
- description
- result
- obstacles
- solutions
- created_at
- updated_at

### JournalDocumentation

- id
- journal_id
- user_id
- image_path
- caption
- created_at

Semua entitas pengguna harus memiliki relasi dan aturan akses yang memastikan hanya pemiliknya yang dapat membaca atau mengubah data.

---

## 11. Persyaratan Non-Fungsional

### Keamanan dan privasi

- Semua koneksi menggunakan HTTPS pada lingkungan produksi.
- Otorisasi diterapkan pada server/data, bukan hanya dengan menyembunyikan tombol di antarmuka.
- Foto dan data pribadi tidak boleh tersedia secara publik tanpa otorisasi.
- Rahasia layanan tidak disimpan di kode sisi klien atau repositori publik.
- Kumpulkan data pribadi seminimal mungkin dan jelaskan tujuan penggunaannya dalam kebijakan privasi.
- Sediakan mekanisme penghapusan akun/data sesuai kebijakan produk.

### Keandalan

- Kegagalan penyimpanan harus terlihat dan tidak dilaporkan sebagai sukses.
- Pengguna mendapat kesempatan mencoba kembali tanpa mengisi ulang seluruh formulir jika memungkinkan.
- Perubahan data tersimpan konsisten dan tidak membuat jurnal milik pengguna lain berubah.

### Kinerja

- Halaman inti menampilkan konten utama dengan cepat pada koneksi seluler normal.
- Foto dioptimalkan untuk tampilan web dan tidak memblokir penggunaan form.
- Riwayat menggunakan pemuatan bertahap/pagination saat data bertambah.

### Kompatibilitas

- Mendukung versi terbaru browser utama berbasis Chromium, Firefox, dan Safari.
- Layout dan alur utama tetap dapat dipakai di ponsel, tablet, serta desktop.

### Aksesibilitas dasar

- Kontras warna cukup.
- Kontrol memiliki label yang jelas.
- Fokus keyboard terlihat.
- Informasi penting tidak disampaikan hanya melalui warna.
- Gambar dekoratif dan gambar dokumentasi memiliki teks alternatif yang sesuai bila diperlukan.

---

## 12. Kriteria Penerimaan MVP

- [ ] Pengguna dapat mendaftar, masuk, dan keluar.
- [ ] Halaman pribadi tidak dapat dibuka tanpa autentikasi.
- [ ] Siswa dapat menyimpan dan memperbarui profil serta informasi PKL.
- [ ] Siswa dapat membuat, melihat, mengedit, dan menghapus jurnal miliknya.
- [ ] Sistem memvalidasi tanggal, judul, deskripsi, dan jam kegiatan.
- [ ] Jurnal tersimpan tetap tersedia setelah pengguna masuk kembali.
- [ ] Riwayat mendukung pencarian, filter tanggal, dan pengurutan.
- [ ] Detail jurnal menampilkan informasi dan foto terkait.
- [ ] Foto yang gagal diunggah tidak menghilangkan teks jurnal yang tersimpan.
- [ ] Dashboard dan progres menggunakan data aktual.
- [ ] Definisi total jurnal dan hari tercatat konsisten di seluruh halaman.
- [ ] Keadaan kosong, loading, sukses, dan gagal tersedia pada alur utama.
- [ ] Penghapusan jurnal dan foto memerlukan konfirmasi.
- [ ] Data dan foto satu siswa tidak dapat diakses oleh akun siswa lain.
- [ ] Halaman dan formulir dapat digunakan di ponsel dan desktop.
- [ ] Teks antarmuka menggunakan Bahasa Indonesia yang jelas.

---

## 13. Risiko dan Keputusan Terbuka

Sebelum implementasi, pemilik produk perlu menentukan:

1. Apakah pendaftaran terbuka untuk siapa saja atau memakai undangan/kode sekolah?
2. Apakah email harus diverifikasi sebelum siswa dapat menggunakan fitur jurnal?
3. Berapa batas ukuran, format, dan jumlah foto per jurnal?
4. Apakah jurnal boleh dibuat untuk tanggal lampau atau tanggal yang sama lebih dari sekali?
5. Apakah siswa perlu menghapus akun sendiri pada MVP?
6. Apakah rekap perlu mencakup hari tanpa jurnal atau target jumlah hari PKL?

Asumsi sementara PRD: pendaftaran email terbuka, verifikasi mengikuti layanan autentikasi, tanggal lampau diperbolehkan, dan siswa dapat membuat lebih dari satu jurnal pada tanggal yang sama. Batas unggahan foto diputuskan saat pemilihan layanan penyimpanan.

---

## 14. Tahapan Pengembangan

### Tahap 1 — Fondasi

- Finalisasi alur dan identitas visual.
- Siapkan autentikasi dan struktur data.
- Bangun halaman publik, masuk, daftar, serta setup profil/PKL.

### Tahap 2 — Jurnal inti

- Dashboard.
- Form tambah/edit jurnal.
- Riwayat, detail, pencarian, dan filter.
- Penghapusan dengan konfirmasi.

### Tahap 3 — Foto dan progres

- Unggah dan tampilkan dokumentasi.
- Statistik serta rekap berdasarkan data aktual.
- Tangani kegagalan unggah dan penyimpanan.

### Tahap 4 — Penyelesaian MVP

- Perapian responsif dan aksesibilitas dasar.
- Tinjau kontrol akses dan privasi.
- Perbaiki alur error, loading, serta keadaan kosong.
- Pastikan seluruh kriteria penerimaan terpenuhi.

### Tahap berikutnya

- Ekspor PDF/Excel.
- Kalender dan pengingat.
- Akun guru/pembimbing, komentar, evaluasi, dan persetujuan.
- Banyak periode PKL dan administrasi sekolah.

---

## 15. Ringkasan

Jurnal PKL versi website berfokus pada kebutuhan siswa untuk mengelola profil PKL, mencatat kegiatan harian, menyimpan foto, mencari riwayat, dan melihat progres. MVP berupa website responsif dengan akun dan penyimpanan cloud, tanpa fitur pemantauan atau persetujuan pembimbing. Prioritas produk adalah data yang aman, alur jurnal yang ringkas, dan rekap yang dihitung dari catatan nyata.

**Tagline:** Catat · Pantau · Capai  
**Pemilik produk:** Mirza Razaq — XII SIJA 1
