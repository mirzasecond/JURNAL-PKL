const sharp = require('sharp');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB per foto
const MAX_PHOTOS = 3;              // maksimal foto per jurnal
const MAX_REQUEST_SIZE = 25 * 1024 * 1024; // 25 MB per permintaan unggah (selaras nginx)
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_LABEL = 'JPG, PNG, atau WebP';
const MAX_SIZE_MB = Math.round(MAX_SIZE / 1024 / 1024);

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function saveImage(buffer, userId) {
  await ensureDir();
  const name = `u${userId}-${crypto.randomBytes(8).toString('hex')}.webp`;
  const dest = path.join(UPLOAD_DIR, name);
  const out = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await fs.writeFile(dest, out);
  return name;
}

async function saveThumb(buffer, userId) {
  await ensureDir();
  const name = `t-u${userId}-${crypto.randomBytes(8).toString('hex')}.webp`;
  const dest = path.join(UPLOAD_DIR, name);
  const out = await sharp(buffer)
    .rotate()
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  await fs.writeFile(dest, out);
  return name;
}

async function deleteImage(filename) {
  if (!filename) return;
  const safe = path.basename(filename);
  await fs.rm(path.join(UPLOAD_DIR, safe), { force: true });
}

module.exports = {
  UPLOAD_DIR, MAX_SIZE, MAX_PHOTOS, MAX_REQUEST_SIZE,
  ALLOWED_MIME, ALLOWED_LABEL, MAX_SIZE_MB,
  saveImage, saveThumb, deleteImage, ensureDir,
};
