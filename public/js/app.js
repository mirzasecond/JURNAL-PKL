(function () {
  'use strict';

  // ---- Tombol dengan status sibuk (cegah klik ganda) ----
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function () {
      var btn = form.querySelector('[data-busy]');
      if (btn && !btn.disabled) {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        var w = btn.querySelector('.spinner');
        if (!w) {
          w = document.createElement('span');
          w.className = 'spinner';
          btn.prepend(w);
        }
      }
    });
  });

  // ---- Modal konfirmasi ----
  var modal = document.getElementById('confirmModal');
  var pendingForm = null;
  function openModal(title, message, onConfirm) {
    if (!modal) { onConfirm(); return; }
    modal.querySelector('#confirmTitle').textContent = title || 'Konfirmasi';
    modal.querySelector('#confirmMessage').textContent = message || 'Apakah Anda yakin?';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    pendingForm = onConfirm;
    modal.querySelector('[data-modal-confirm]').focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    pendingForm = null;
  }
  if (modal) {
    modal.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
    modal.querySelector('[data-modal-confirm]').addEventListener('click', function () {
      var cb = pendingForm; closeModal();
      if (cb) cb();
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }
  document.querySelectorAll('form[data-confirm], [data-confirm]').forEach(function (el) {
    var isForm = el.tagName === 'FORM';
    var btn = isForm ? el.querySelector('button[type="submit"]') : el;
    if (!btn) return;
    var handler = function (e) {
      e.preventDefault();
      e.stopPropagation();
      openModal(el.getAttribute('data-confirm-title'), el.getAttribute('data-confirm-message'), function () {
        if (isForm) {
          el.removeEventListener('submit', handler);
          el.submit();
        } else {
          btn.removeEventListener('click', handler);
          btn.click();
        }
      });
    };
    if (isForm) el.addEventListener('submit', handler);
    else btn.addEventListener('click', handler);
  });

  // ---- Manajemen foto dokumentasi ----
  var manager = document.getElementById('photoManager');
  if (manager) {
    var journalId = manager.getAttribute('data-journal-id');
    var csrf = manager.getAttribute('data-csrf');
    var max = parseInt(manager.getAttribute('data-max'), 10) || 3;
    var maxSizeMb = parseInt(manager.getAttribute('data-max-size-mb'), 10) || 5;
    var input = document.getElementById('photoInput');
    var dropzone = manager.querySelector('.dropzone');
    var pick = document.getElementById('pickPhoto');
    var status = document.getElementById('uploadStatus');
    var grid = manager.parentElement.querySelector('#photoGrid') || document.getElementById('photoGrid');
    var currentCount = manager.getAttribute('data-count') ? parseInt(manager.getAttribute('data-count'), 10) : -1;

    function setStatus(msg, cls) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'upload-status' + (cls ? ' ' + cls : '');
    }

    function resetInput() { try { if (input) input.value = ''; } catch (e) {} }

    if (pick && input) pick.addEventListener('click', function () { input.click(); });
    if (dropzone && input) {
      dropzone.addEventListener('click', function (e) {
        if (e.target === dropzone || e.target.closest('.dz-text')) input.click();
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('drag'); });
      });
      dropzone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files.length) {
          input.files = e.dataTransfer.files;
          upload();
        }
      });
    }
    if (input) input.addEventListener('change', function () { if (input.files && input.files.length) upload(); });

    function validateFiles(files) {
      var allowed = ['image/jpeg', 'image/png', 'image/webp'];
      var maxBytes = maxSizeMb * 1024 * 1024;
      if (currentCount >= max) {
        return 'Batas ' + max + ' foto untuk jurnal ini sudah tercapai. Hapus salah satu foto bila ingin menggantinya.';
      }
      if (currentCount >= 0 && currentCount + files.length > max) {
        var sisa = Math.max(0, max - currentCount);
        return 'Maksimal ' + max + ' foto per jurnal. Saat ini ' + currentCount + ' foto tersimpan, sisa ' + sisa + ' slot.';
      }
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (allowed.indexOf(f.type) === -1) return 'Berkas "' + f.name + '" bukan gambar JPG, PNG, atau WebP.';
        if (f.size > maxBytes) return 'Berkas "' + f.name + '" melebihi batas ' + maxSizeMb + ' MB (' + (f.size / 1024 / 1024).toFixed(1) + ' MB).';
      }
      return null;
    }

    function upload() {
      if (!input) return;
      var files = Array.from(input.files || []);
      if (!files.length) return;
      var invalid = validateFiles(files);
      if (invalid) { setStatus(invalid, 'err'); resetInput(); return; }

      var fd = new FormData();
      files.forEach(function (f) { fd.append('photos', f); });
      fd.append('_csrf', csrf);
      setStatus('Mengunggah ' + files.length + ' foto…');
      if (pick) pick.disabled = true;

      fetch('/journals/' + journalId + '/photos', { method: 'POST', body: fd, credentials: 'same-origin' })
        .then(function (r) {
          return r.text().then(function (body) {
            var data = null;
            try { data = JSON.parse(body); } catch (e) {}
            return { ok: r.ok, status: r.status, data: data, body: body };
          });
        })
        .then(function (res) {
          if (res.ok && res.data && res.data.ok) {
            setStatus('Foto berhasil diunggah. Memuat ulang…', 'ok');
            window.location.reload();
            return;
          }
          var msg = (res.data && res.data.error);
          if (!msg) {
            if (res.status === 403) msg = 'Sesi tidak valid atau kedaluwarsa. Muat ulang halaman lalu coba lagi.';
            else if (res.status === 413) msg = 'Ukuran unggahan terlalu besar. Maksimal ' + maxSizeMb + ' MB per foto.';
            else if (res.status === 401 || res.status === 302) msg = 'Sesi berakhir. Silakan masuk kembali.';
            else msg = 'Gagal mengunggah foto (kode ' + res.status + '). Coba lagi.';
          }
          setStatus(msg + ' Klik "Pilih Foto" untuk mencoba lagi.', 'err');
          resetInput();
        })
        .catch(function () {
          setStatus('Gagal mengunggah. Periksa koneksi internet lalu coba lagi.', 'err');
          resetInput();
        })
        .finally(function () { if (pick) pick.disabled = false; });
    }

    if (grid) {
      grid.addEventListener('click', function (e) {
        var del = e.target.closest('[data-delete-photo]');
        if (!del) return;
        var id = del.getAttribute('data-delete-photo');
        openModal('Hapus foto ini?', 'Foto akan dihapus secara permanen dari jurnal ini.', function () {
          var fd = new FormData();
          fd.append('_csrf', csrf);
          fetch('/photos/' + id + '/delete', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'x-csrf-token': csrf } })
            .then(function (r) { return r.json(); })
            .then(function (j) {
              if (j.ok) {
                setStatus('Foto dihapus. Memuat ulang…', 'ok');
                // Muat ulang agar penghitung, sisa slot, dan ketersediaan kontrol
                // unggah konsisten (mis. saat kuota tadinya sudah penuh).
                window.location.reload();
              } else {
                setStatus(j.error || 'Gagal menghapus foto.', 'err');
              }
            })
            .catch(function () { setStatus('Gagal menghapus foto. Coba lagi.', 'err'); });
        });
      });
    }
  }

  // ---- Pratinjau ekspor PDF ----
  var exportForm = document.getElementById('exportForm');
  if (exportForm) {
    var monthSel = document.getElementById('month');
    var yearSel = document.getElementById('year');
    var previewBtn = document.getElementById('previewBtn');
    var downloadBtn = document.getElementById('downloadBtn');
    var previewArea = document.getElementById('previewArea');
    var previewBadge = document.getElementById('previewBadge');
    var MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    function sel() {
      return { year: yearSel.value, month: monthSel.value };
    }
    function updateDownload() {
      var s = sel();
      downloadBtn.href = '/export/download?year=' + s.year + '&month=' + s.month;
    }
    monthSel.addEventListener('change', updateDownload);
    yearSel.addEventListener('change', updateDownload);

    previewBtn.addEventListener('click', function () {
      var s = sel();
      previewBtn.disabled = true;
      previewBadge.textContent = 'Memuat…';
      previewArea.innerHTML = '<div class="skeleton" style="height:64px;"></div><div class="skeleton mt-1" style="height:28px;"></div><div class="skeleton mt-1" style="height:28px;"></div><div class="skeleton mt-1" style="height:28px;"></div>';
      fetch('/export/preview?year=' + s.year + '&month=' + s.month, { credentials: 'same-origin' })
        .then(function (r) {
          return r.text().then(function (body) {
            var data = null;
            try { data = JSON.parse(body); } catch (e) {}
            return { ok: r.ok, status: r.status, data: data };
          });
        })
        .then(function (res) {
          if (!res.ok || !res.data || !res.data.ok) {
            previewBadge.textContent = 'Gagal';
            var msg = (res.data && res.data.error) || 'Gagal memuat pratinjau (kode ' + res.status + ').';
            previewArea.innerHTML = '<div class="preview-empty">' +
              '<div class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg></div>' +
              '<h3>Pratinjau gagal dimuat</h3><p class="mb-2">' + escapeHtml(msg) + '</p>' +
              '<button type="button" class="btn btn-outline btn-sm" id="retryPreview">Coba Lagi</button></div>';
            var retry = document.getElementById('retryPreview');
            if (retry) retry.addEventListener('click', function () { previewBtn.disabled = false; previewBtn.click(); });
            return;
          }
          var j = res.data;
          if (j.count === 0) {
            previewBadge.textContent = '0 jurnal';
            previewArea.innerHTML = '<div class="preview-empty">' +
              '<div class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg></div>' +
              '<h3>Tidak ada jurnal pada bulan ini</h3>' +
              '<p class="mb-2">' + escapeHtml(MONTHS[s.month - 1]) + ' ' + escapeHtml(s.year) + ' belum memiliki catatan jurnal.</p>' +
              '<p class="tiny muted mb-0">PDF tetap dapat diunduh dan akan memuat keterangan bahwa bulan tersebut kosong.</p></div>';
            return;
          }
          previewBadge.textContent = j.count + ' jurnal · ' + j.days + ' hari';
          var rows = j.journals.slice(0, 20).map(function (x) {
            var d = new Date(x.activity_date + 'T00:00:00');
            var t = x.start_time ? (x.end_time ? x.start_time + '–' + x.end_time : x.start_time) : '';
            return '<div class="list-item" style="padding:.55rem 0;"><div class="grow"><h3>' + escapeHtml(x.title) +
              '</h3><div class="meta"><span>' + d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
              '</span>' + (t ? '<span>' + escapeHtml(t) + '</span>' : '') + '</div></div></div>';
          }).join('');
          var more = j.journals.length > 20 ? '<p class="tiny muted center" style="margin:.6rem 0 0;">dan ' + (j.journals.length - 20) + ' jurnal lainnya…</p>' : '';
          previewArea.innerHTML = '<div class="alert alert-info" style="margin-bottom:.75rem;"><span><strong>' + j.count +
            ' jurnal</strong> · ' + j.days + ' hari tercatat pada ' + escapeHtml(MONTHS[s.month - 1]) + ' ' + escapeHtml(s.year) + '.</span></div>' +
            '<div class="preview-list list">' + rows + '</div>' + more;
        })
        .catch(function () {
          previewBadge.textContent = 'Gagal';
          previewArea.innerHTML = '<div class="preview-empty">' +
            '<div class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></div>' +
            '<h3>Koneksi bermasalah</h3><p class="mb-2">Pratinjau tidak dapat dimuat. Periksa koneksi internet Anda.</p>' +
            '<button type="button" class="btn btn-outline btn-sm" id="retryPreview">Coba Lagi</button></div>';
          var retry2 = document.getElementById('retryPreview');
          if (retry2) retry2.addEventListener('click', function () { previewBtn.disabled = false; previewBtn.click(); });
        })
        .finally(function () { previewBtn.disabled = false; });
    });
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
})();
