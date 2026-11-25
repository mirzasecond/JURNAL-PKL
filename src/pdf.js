const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs/promises');
const db = require('./db');
const { UPLOAD_DIR } = require('./upload');

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

const GREEN = '#1b4d3e';
const TEAL = '#0f766e';
const MUTED = '#5b7269';
const LINE = '#dfe6e3';

// Batas ukuran gambar di dalam PDF (px) agar berkas tetap ringan
const PDF_IMAGE_MAX = 1100;
const PDF_IMAGE_QUALITY = 82;

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

// Muat & siapkan foto dari penyimpanan privat. Tidak lewat HTTP / folder publik.
async function loadPhotosForJournals(userId, journals) {
  const byJournal = new Map();
  if (!journals.length) return byJournal;

  const ids = journals.map(j => j.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT id, journal_id, image_path, caption FROM journal_documentation
    WHERE user_id = ? AND journal_id IN (${placeholders})
    ORDER BY journal_id ASC, id ASC
  `).all(userId, ...ids);

  for (const row of rows) {
    let buffer = null;
    try {
      const safe = path.basename(row.image_path || '');
      if (!safe) continue;
      const abs = path.join(UPLOAD_DIR, safe);
      const raw = await fs.readFile(abs);
      const out = await sharp(raw)
        .rotate()
        .resize({ width: PDF_IMAGE_MAX, height: PDF_IMAGE_MAX, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: PDF_IMAGE_QUALITY, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      buffer = out.data;
      const list = byJournal.get(row.journal_id) || [];
      list.push({ buffer, width: out.info.width, height: out.info.height, caption: row.caption || null });
      byJournal.set(row.journal_id, list);
    } catch (e) {
      // Foto hilang/rusak: lewati tanpa menggagalkan laporan
      console.warn('PDF: foto dilewati', row.id, e.message);
    }
  }
  return byJournal;
}

async function streamPdf(res, user, { year, month }) {
  const profile = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(user.id) || {};
  const internship = db.prepare('SELECT * FROM internships WHERE user_id = ?').get(user.id) || {};
  const journals = db.prepare(`
    SELECT * FROM journals WHERE user_id = ? AND activity_date LIKE ?
    ORDER BY activity_date ASC, id ASC
  `).all(user.id, `${year}-${String(month).padStart(2, '0')}%`);
  const uniqueDays = new Set(journals.map(j => j.activity_date)).size;
  const periodLabel = `${MONTHS_ID[month - 1]} ${year}`;

  // Siapkan foto sebelum membuat dokumen (operasi async tidak di tengah alur PDF)
  const photosByJournal = await loadPhotosForJournals(user.id, journals);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 56, left: 50, right: 50 },
    bufferPages: true,
    autoFirstPage: true,
    info: { Title: `Laporan PKL ${periodLabel}` },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Laporan-PKL-${year}-${String(month).padStart(2, '0')}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  doc.pipe(res);

  const LEFT = doc.page.margins.left;
  const W = doc.page.width - LEFT - doc.page.margins.right;
  const BOTTOM_LIMIT = () => doc.page.height - doc.page.margins.bottom;

  // Header ringkas pada halaman lanjutan
  doc.on('pageAdded', () => {
    doc.save();
    doc.rect(0, 0, doc.page.width, 42).fill('#f1f7f5');
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8.5)
      .text('Laporan Bulanan Praktik Kerja Lapangan', LEFT, 16, { width: W, lineBreak: false });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text(periodLabel, LEFT, 16, { width: W, align: 'right', lineBreak: false });
    doc.restore();
    doc.fillColor('#000000');
    doc.x = LEFT;
    doc.y = 58;
  });

  // ------- Banner halaman pertama -------
  doc.rect(0, 0, doc.page.width, 96).fill(GREEN);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
    .text('Laporan Bulanan Praktik Kerja Lapangan', LEFT, 24, { width: W, lineBreak: false });
  doc.font('Helvetica').fontSize(10)
    .text(periodLabel, LEFT, 50, { width: W, lineBreak: false });
  doc.fontSize(8).fillColor('#cfe8e1')
    .text('Jurnal PKL — Catat · Pantau · Capai', LEFT, 68, { width: W, lineBreak: false });
  doc.fillColor('#000000');
  doc.y = 116;

  // ------- Helper alur -------
  function ensureSpace(h) {
    if (doc.y + h > BOTTOM_LIMIT()) {
      doc.addPage();
      doc.y = 58;
    }
  }

  function sectionTitle(text) {
    ensureSpace(30);
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(10.5)
      .text(text.toUpperCase(), LEFT, doc.y, { width: W, characterSpacing: 0.4 });
    doc.moveDown(0.25);
    const y = doc.y;
    doc.moveTo(LEFT, y).lineTo(LEFT + W, y).strokeColor(LINE).lineWidth(1).stroke();
    doc.moveDown(0.55);
    doc.fillColor('#000000');
  }

  function kv(label, value) {
    const text = value && String(value).trim() ? String(value) : '-';
    const labelW = 140;
    const valueW = W - labelW - 8;
    doc.font('Helvetica-Bold').fontSize(9.5);
    const lh = doc.heightOfString(label, { width: labelW });
    doc.font('Helvetica').fontSize(9.5);
    const vh = doc.heightOfString(text, { width: valueW });
    const h = Math.max(lh, vh);
    ensureSpace(h + 4);
    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(MUTED)
      .text(label, LEFT, top, { width: labelW, lineBreak: false });
    doc.font('Helvetica').fontSize(9.5).fillColor('#000000')
      .text(text, LEFT + labelW + 8, top, { width: valueW });
    doc.y = top + h + 5;
  }

  function flowField(label, value) {
    if (!value || !String(value).trim()) return;
    ensureSpace(26);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED)
      .text(label.toUpperCase(), LEFT, doc.y, { width: W, characterSpacing: 0.3 });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9.5).fillColor('#000000')
      .text(String(value), LEFT, doc.y, { width: W, align: 'left' });
    doc.moveDown(0.5);
  }

  // ------- Galeri foto per jurnal -------
  const COLS = 2;
  const GAP = 10;
  const CELL_W = (W - GAP * (COLS - 1)) / COLS;
  const IMG_H = 132;           // tinggi area gambar ideal (pt)
  const CAP_H = 14;            // ruang keterangan
  const CELL_H = IMG_H + CAP_H;
  const ROW_GAP = 8;
  const LABEL_H = 16;
  const MIN_IMG_H = 76;        // batas minimum agar gambar tetap layak dilihat

  function photoLabel(journal, index, continued) {
    const base = `FOTO DOKUMENTASI — ${index + 1}. ${journal.title}`;
    return continued ? `${base} (lanjutan)` : base;
  }

  function drawPhotoLabel(journal, index, continued) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED)
      .text(photoLabel(journal, index, continued), LEFT, doc.y, {
        width: W, characterSpacing: 0.3, lineBreak: false, ellipsis: true,
      });
    doc.moveDown(0.35);
    doc.fillColor('#000000');
  }

  function drawPhotos(journal, photos, index) {
    if (!photos || !photos.length) return;

    // Pastikan label + minimal satu baris gambar muat
    ensureSpace(LABEL_H + MIN_IMG_H + CAP_H);
    drawPhotoLabel(journal, index, false);

    for (let rowStart = 0; rowStart < photos.length; rowStart += COLS) {
      const rowPhotos = photos.slice(rowStart, rowStart + COLS);

      // Tinggi baris adaptif: pakai sisa ruang halaman bila cukup, sehingga tidak
      // menyisakan celah besar; jika kurang dari minimum, pindah halaman penuh.
      let imgH = IMG_H;
      const avail = BOTTOM_LIMIT() - doc.y;
      if (avail < CELL_H) {
        const fitImgH = avail - CAP_H - ROW_GAP;
        if (fitImgH >= MIN_IMG_H) {
          imgH = Math.min(IMG_H, fitImgH);
        } else {
          doc.addPage();
          doc.y = 58;
          drawPhotoLabel(journal, index, true);
        }
      }
      const rowH = imgH + CAP_H;

      const rowY = doc.y;
      rowPhotos.forEach((p, col) => {
        const cellX = LEFT + col * (CELL_W + GAP);

        doc.save();
        doc.roundedRect(cellX, rowY, CELL_W, rowH, 4).fill('#f4f8f6');
        doc.restore();

        // Pertahankan rasio gambar: skala agar muat di dalam area, lalu pusatkan
        const scale = Math.min((CELL_W - 8) / p.width, (imgH - 6) / p.height);
        const dw = Math.max(1, p.width * scale);
        const dh = Math.max(1, p.height * scale);
        const dx = cellX + (CELL_W - dw) / 2;
        const dy = rowY + 3 + (imgH - 6 - dh) / 2;
        try {
          doc.image(p.buffer, dx, dy, { width: dw, height: dh });
        } catch (e) {
          doc.font('Helvetica-Oblique').fontSize(7).fillColor(MUTED)
            .text('Foto tidak dapat dimuat', cellX + 6, rowY + imgH / 2, { width: CELL_W - 12, align: 'center' });
        }

        if (p.caption) {
          doc.font('Helvetica').fontSize(6.8).fillColor(MUTED)
            .text(p.caption, cellX + 6, rowY + imgH + 1, {
              width: CELL_W - 12, height: CAP_H - 2, align: 'center', ellipsis: true,
            });
        }
      });

      doc.y = rowY + rowH + ROW_GAP;
      doc.x = LEFT;
      doc.fillColor('#000000');
    }

    // Ruang napas kecil setelah galeri
    doc.y += 2;
  }

  // ------- Identitas -------
  sectionTitle('Identitas Siswa');
  kv('Nama Lengkap', profile.full_name || user.email);
  kv('NIS/NISN', profile.student_number);
  kv('Kelas', profile.class_name);
  kv('Program Keahlian', profile.program);
  kv('Sekolah', profile.school_name);
  doc.moveDown(0.4);

  // ------- Informasi PKL -------
  sectionTitle('Informasi PKL');
  kv('Perusahaan/Instansi', internship.company_name);
  kv('Alamat', internship.company_address);
  kv('Pembimbing Industri', internship.supervisor_name);
  kv('Posisi/Divisi', internship.position);
  kv('Periode PKL', internship.start_date ? `${fmtDate(internship.start_date)} s.d. ${fmtDate(internship.end_date)}` : '-');
  doc.moveDown(0.4);

  // ------- Ringkasan -------
  const totalPhotos = [...photosByJournal.values()].reduce((n, l) => n + l.length, 0);
  sectionTitle('Ringkasan');
  kv('Jumlah Jurnal', String(journals.length));
  kv('Hari Tercatat', String(uniqueDays));
  kv('Foto Dokumentasi', String(totalPhotos));
  doc.moveDown(0.4);

  // ------- Daftar jurnal -------
  sectionTitle('Daftar Jurnal');

  if (journals.length === 0) {
    ensureSpace(70);
    doc.fillColor('#000000');
    doc.font('Helvetica-Bold').fontSize(10)
      .text(`Tidak ada jurnal pada ${periodLabel}`, LEFT, doc.y, { width: W });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text('Belum ada catatan kegiatan PKL yang tersimpan untuk bulan ini. Anda tetap dapat menambahkan jurnal melalui website dan mengunduh laporan ini kembali setelahnya.', LEFT, doc.y, { width: W });
    doc.fillColor('#000000');
    doc.moveDown(0.5);
  }

  journals.forEach((j, i) => {
    ensureSpace(52);
    const headH = 20;
    const top = doc.y;
    doc.save();
    doc.rect(LEFT, top, W, headH).fill('#eef6f4');
    doc.restore();
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(9)
      .text(`${i + 1}. ${fmtDate(j.activity_date)}`, LEFT + 8, top + 6.5, { width: W - 120, lineBreak: false, ellipsis: true });
    if (j.start_time) {
      const t = j.end_time ? `${j.start_time}–${j.end_time}` : j.start_time;
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
        .text(t, LEFT + W - 108, top + 7, { width: 100, align: 'right', lineBreak: false });
    }
    doc.y = top + headH + 7;
    doc.fillColor('#000000');

    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#14231d')
      .text(j.title, LEFT, doc.y, { width: W });
    doc.moveDown(0.3);

    flowField('Kegiatan', j.description);
    flowField('Hasil', j.result);
    flowField('Kendala', j.obstacles);
    flowField('Solusi', j.solutions);

    drawPhotos(j, photosByJournal.get(j.id), i);

    ensureSpace(14);
    const ly = doc.y;
    doc.moveTo(LEFT, ly).lineTo(LEFT + W, ly).strokeColor(LINE).lineWidth(0.7).stroke();
    doc.y = ly + 14;
  });

  // ------- Footer & nomor halaman -------
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 38;
    doc.moveTo(LEFT, fy - 10).lineTo(LEFT + W, fy - 10).strokeColor(LINE).lineWidth(0.7).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(`Jurnal PKL · Laporan ${periodLabel}`, LEFT, fy, { width: W / 2, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(`Halaman ${i - range.start + 1} dari ${total}`, LEFT, fy, { width: W, align: 'right', lineBreak: false });
    doc.page.margins.bottom = oldBottom;
  }

  doc.end();
}

module.exports = { streamPdf, MONTHS_ID };
