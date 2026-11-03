// ============================================================
// Fitting Baju Siswa Baru — Google Apps Script (versi GAS)
// Koperasi Konsumen Al Hidayah Jakarta Maju Bersama
//
// File ini DITEMPEL di proyek Apps Script yang sama dengan Index.html.
// JANGAN dibagikan sembarangan: file ini berisi ID Sheet produksi.
// Pengunjung web app TIDAK bisa melihat file ini — mereka hanya menerima
// Index.html. Password tidak pernah ditulis polos di mana pun: di tab Akun
// hanya hash SHA-256, dan akun bawaan di bawah ini disisipkan langsung
// sebagai hash (bukan password polos).
//
// Sheet produksi: DATABASE FITTING BAJU
//   Tab Data_Utama — 26 kolom, satu baris = satu siswa:
//     Timestamp | Nomor Pendaftaran | Nama Peserta Didik | Unit Sekolah |
//     Jenis Kelamin | lalu 7 seragam x (Ukuran | Jumlah | Keterangan)
//   Seragam (posisi tetap, kolom ke-2 adalah celana formal):
//     Baju Putih | Celana Biru* | Baju Pramuka | Celana Pramuka |
//     Baju Koko | Kaos Olahraga | Celana Olahraga
//     * Header kolom memakai nama "Celana Biru", tapi isinya celana formal
//       sesuai unit: SMP = Celana Biru, SMA/SMK = Celana Abu-abu (OSIS).
//   Tab Akun — Dibuat | Nama | Username | Peran | PasswordHash |
//     Terakhir Direset | Status
//
// Keamanan: login mengembalikan token sesi (disimpan di CacheService,
// berlaku 6 jam). Setiap panggilan sesudahnya wajib menyertakan token;
// server memeriksa peran dari token, BUKAN dari klaim peran di klien.
// Petugas tidak bisa (di server, bukan hanya di tampilan): melihat daftar
// akun, membuat/mereset/menghapus akun, atau mengedit/menghapus data.
// ============================================================

var SHEET_ID = '1KeD1kh0lLPgJJHTY_wKWINK60kGfmtBZHNjnGBdwGrI';
var TAB_DATA = 'Data_Utama';
var TAB_AKUN = 'Akun';
var SERAGAM = ['Baju Putih', 'Celana Biru', 'Baju Pramuka', 'Celana Pramuka',
               'Baju Koko', 'Kaos Olahraga', 'Celana Olahraga'];

// Hash SHA-256 dari password akun bawaan (dihitung sekali, lalu ditempel
// sebagai hash — password polosnya tidak ada di file ini). Password awal
// kedua akun ini tercantum di PANDUAN-DEPLOY.md supaya pemilik bisa masuk
// pertama kali, dan WAJIB diganti lewat Kelola User setelah login pertama.
var SEED_ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
var SEED_PETUGAS_HASH = '2dad904f71aa0dcf6ea1addaa084a5865ffe448e4d3f900668e1cc7e7b6153d7';

// ---------- util ----------

function hashPw(pw) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function getSpreadsheet() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function headerData() {
  var h = ['Timestamp', 'Nomor Pendaftaran', 'Nama Peserta Didik', 'Unit Sekolah', 'Jenis Kelamin'];
  SERAGAM.forEach(function(n) { h.push(n + ' - Ukuran', n + ' - Jumlah', n + ' - Keterangan'); });
  return h; // 5 + 7 x 3 = 26 kolom
}

function headerAkun() {
  return ['Dibuat', 'Nama', 'Username', 'Peran', 'PasswordHash', 'Terakhir Direset', 'Status'];
}

function styleHeader(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  var r = sheet.getRange(1, 1, 1, lastCol);
  r.setFontWeight('bold');
  r.setBackground('#eef2ff');
  sheet.setFrozenRows(1);
}

function getDataSheet() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(TAB_DATA);
  if (!sh) {
    sh = ss.insertSheet(TAB_DATA);
    sh.appendRow(headerData());
    styleHeader(sh);
    return sh;
  }
  if (sh.getLastRow() === 0) { // tab ada tapi kosong: pasang header saja
    sh.appendRow(headerData());
    styleHeader(sh);
  }
  return sh;
}

function getAkunSheet() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(TAB_AKUN);
  if (!sh) {
    sh = ss.insertSheet(TAB_AKUN);
    sh.appendRow(headerAkun());
    styleHeader(sh);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(headerAkun());
    styleHeader(sh);
  }
  // Seed HANYA bila tab Akun belum punya baris data sama sekali.
  // Bila sudah ada akun (mis. dibuat lewat Kelola User), jangan timpa.
  if (sh.getLastRow() <= 1) {
    var now = new Date();
    sh.appendRow([now, 'Admin', 'admin', 'Admin', SEED_ADMIN_HASH, '', 'Aktif']);
    sh.appendRow([now, 'Petugas Demo', 'petugas', 'Petugas Fitting', SEED_PETUGAS_HASH, '', 'Aktif']);
  }
  return sh;
}

// ---------- sesi (token) ----------

function buatToken(akun) {
  var token = Utilities.getUuid();
  var cache = CacheService.getScriptCache();
  cache.put('sess_' + token, JSON.stringify(akun), 21600); // 6 jam
  return token;
}

function sesiDariToken(token) {
  if (!token) return null;
  try {
    var raw = CacheService.getScriptCache().get('sess_' + token);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// Mengembalikan {ok, sesi} atau {ok:false, msg}. adminOnly=true = hanya Admin.
function perluSesi(payload, adminOnly) {
  var sesi = sesiDariToken(payload && payload.token);
  if (!sesi) return { ok: false, msg: 'Sesi habis atau tidak sah. Silakan login ulang.' };
  if (adminOnly && sesi.peran !== 'Admin') {
    return { ok: false, msg: 'Aksi ini hanya untuk Admin.' };
  }
  return { ok: true, sesi: sesi };
}

// ---------- akun ----------

function cariAkunRow(sh, username) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === String(username).toLowerCase()) {
      return { row: i + 1, values: data[i] };
    }
  }
  return null;
}

function apiLogin(p) {
  var sh = getAkunSheet();
  var found = cariAkunRow(sh, p.username);
  // Pesan sengaja generik: jangan bocorkan username atau password yang salah.
  if (!found || found.values[6] !== 'Aktif') return { ok: false, msg: 'Username atau password salah.' };
  if (found.values[4] !== hashPw(p.password || '')) return { ok: false, msg: 'Username atau password salah.' };
  var akun = { nama: found.values[1], username: found.values[2], peran: found.values[3] };
  return { ok: true, nama: akun.nama, username: akun.username, peran: akun.peran,
           token: buatToken(akun) };
}

function apiListAkun(p) {
  var cek = perluSesi(p, true);
  if (!cek.ok) return cek;
  var data = getAkunSheet().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][2]) continue;
    out.push({ dibuat: data[i][0], nama: data[i][1], username: data[i][2],
               peran: data[i][3], terakhirDireset: data[i][5], status: data[i][6] });
  }
  return { ok: true, akun: out }; // TANPA hash — hash tidak pernah dikirim ke klien
}

function apiBuatAkun(p) {
  var cek = perluSesi(p, true);
  if (!cek.ok) return cek;
  if (!p.nama) return { ok: false, msg: 'Nama belum diisi.' };
  if (!p.username || p.username.length < 3 || !/^[a-z0-9._]+$/.test(p.username)) {
    return { ok: false, msg: 'Username minimal 3 karakter, hanya huruf kecil, angka, titik, atau garis bawah.' };
  }
  if (!p.password || p.password.length < 6) return { ok: false, msg: 'Password minimal 6 karakter.' };
  if (p.peran !== 'Admin' && p.peran !== 'Petugas Fitting') return { ok: false, msg: 'Peran tidak dikenal.' };
  var sh = getAkunSheet();
  if (cariAkunRow(sh, p.username)) return { ok: false, msg: 'Username sudah dipakai akun lain.' };
  sh.appendRow([new Date(), p.nama, p.username, p.peran, hashPw(p.password), '', 'Aktif']);
  return { ok: true };
}

function apiResetAkun(p) {
  var cek = perluSesi(p, true);
  if (!cek.ok) return cek;
  if (!p.passwordBaru || p.passwordBaru.length < 6) return { ok: false, msg: 'Password baru minimal 6 karakter.' };
  var sh = getAkunSheet();
  var found = cariAkunRow(sh, p.username);
  if (!found) return { ok: false, msg: 'Akun tidak ditemukan.' };
  sh.getRange(found.row, 5).setValue(hashPw(p.passwordBaru));
  sh.getRange(found.row, 6).setValue(new Date());
  return { ok: true };
}

function apiHapusAkun(p) {
  var cek = perluSesi(p, true);
  if (!cek.ok) return cek;
  var sh = getAkunSheet();
  var found = cariAkunRow(sh, p.username);
  if (!found) return { ok: false, msg: 'Akun tidak ditemukan.' };
  if (String(found.values[2]).toLowerCase() === String(cek.sesi.username).toLowerCase()) {
    return { ok: false, msg: 'Akun yang sedang kamu pakai tidak bisa dihapus.' };
  }
  if (found.values[3] === 'Admin') {
    var data = sh.getDataRange().getValues();
    var nAdmin = 0;
    for (var i = 1; i < data.length; i++) {
      if (data[i][3] === 'Admin' && data[i][6] === 'Aktif') nAdmin++;
    }
    if (nAdmin <= 1) return { ok: false, msg: 'Akun Admin terakhir tidak bisa dihapus.' };
  }
  sh.deleteRow(found.row);
  return { ok: true };
}

// ---------- data fitting ----------

function namaCelana(unit) {
  return unit && unit.indexOf('SMP') === 0 ? 'Celana Biru' : 'Celana Abu-abu';
}

function barisKeKlien(values) {
  var unit = String(values[3] || '');
  var items = [];
  for (var k = 0; k < 7; k++) {
    var base = 5 + k * 3;
    var nama = SERAGAM[k];
    if (k === 1) nama = namaCelana(unit); // celana formal mengikuti unit
    items.push({ seragam: nama,
                 ukuran: String(values[base] || ''),
                 jumlah: String(values[base + 1] || ''),
                 keterangan: String(values[base + 2] || '') });
  }
  return { waktu: values[0] ? new Date(values[0]).toISOString() : '',
           noDaftar: String(values[1] || ''), nama: String(values[2] || ''),
           unit: unit, jk: String(values[4] || ''), items: items };
}

function cariFittingRow(sh, noDaftar) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(noDaftar).trim()) return { row: i + 1, values: data[i] };
  }
  return null;
}

function itemsKeBaris(items) {
  var out = [];
  for (var k = 0; k < 7; k++) {
    var it = (items && items[k]) || {};
    out.push(it.ukuran || '', it.jumlah || '', it.keterangan || '');
  }
  return out; // 21 nilai
}

function validasiFitting(p) {
  if (!p.noDaftar) return 'Nomor Pendaftaran belum diisi.';
  if (!p.nama) return 'Nama Peserta Didik belum diisi.';
  if (!p.unit) return 'Unit Sekolah belum diisi.';
  if (!p.jk) return 'Jenis Kelamin belum diisi.';
  var ada = (p.items || []).some(function(it) { return !!it.ukuran; });
  if (!ada) return 'Isi minimal satu Ukuran seragam.';
  return '';
}

function apiListFitting(p) {
  var cek = perluSesi(p, false);
  if (!cek.ok) return cek;
  var data = getDataSheet().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1] && !data[i][2]) continue; // lewati baris kosong
    out.push(barisKeKlien(data[i]));
  }
  return { ok: true, rows: out };
}

function apiSimpanFitting(p) {
  var cek = perluSesi(p, false); // Admin dan Petugas boleh input baru
  if (!cek.ok) return cek;
  var salah = validasiFitting(p);
  if (salah) return { ok: false, msg: salah };
  var sh = getDataSheet();
  if (cariFittingRow(sh, p.noDaftar)) {
    return { ok: false, msg: 'Gagal! Nomor Pendaftaran ' + p.noDaftar + ' sudah melakukan fitting pakaian.' };
  }
  sh.appendRow([new Date(), String(p.noDaftar).trim(), p.nama, p.unit, p.jk].concat(itemsKeBaris(p.items)));
  return { ok: true };
}

function apiEditFitting(p) {
  var cek = perluSesi(p, true); // edit hanya Admin
  if (!cek.ok) return cek;
  var salah = validasiFitting(p);
  if (salah) return { ok: false, msg: salah };
  var sh = getDataSheet();
  var found = cariFittingRow(sh, p.noDaftarLama || p.noDaftar);
  if (!found) return { ok: false, msg: 'Data lama tidak ditemukan.' };
  if (String(p.noDaftar).trim() !== String(p.noDaftarLama).trim() && cariFittingRow(sh, p.noDaftar)) {
    return { ok: false, msg: 'Gagal! Nomor Pendaftaran ' + p.noDaftar + ' sudah dipakai siswa lain.' };
  }
  // Kolom B..Z (25 kolom): Nomor, Nama, Unit, JK, lalu 7 x 3 kolom seragam.
  // Kolom A (Timestamp) dipertahankan seperti semula.
  var vals = [[String(p.noDaftar).trim(), p.nama, p.unit, p.jk].concat(itemsKeBaris(p.items))];
  sh.getRange(found.row, 2, 1, vals[0].length).setValues(vals);
  return { ok: true };
}

function apiHapusFitting(p) {
  var cek = perluSesi(p, true);
  if (!cek.ok) return cek;
  var sh = getDataSheet();
  var found = cariFittingRow(sh, p.noDaftar);
  if (!found) return { ok: false, msg: 'Data tidak ditemukan.' };
  sh.deleteRow(found.row);
  return { ok: true };
}

function apiHapusSemuaFitting(p) {
  var cek = perluSesi(p, true);
  if (!cek.ok) return cek;
  var sh = getDataSheet();
  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1); // header (baris 1) dipertahankan
  return { ok: true };
}

// ---------- pintu masuk ----------

// Dipanggil dari Index.html lewat google.script.run.gasApi(...)
function gasApi(payload) {
  payload = payload || {};
  switch (payload.aksi) {
    case 'login': return apiLogin(payload);
    case 'listAkun': return apiListAkun(payload);
    case 'buatAkun': return apiBuatAkun(payload);
    case 'resetAkun': return apiResetAkun(payload);
    case 'hapusAkun': return apiHapusAkun(payload);
    case 'listFitting': return apiListFitting(payload);
    case 'simpanFitting': return apiSimpanFitting(payload);
    case 'editFitting': return apiEditFitting(payload);
    case 'hapusFitting': return apiHapusFitting(payload);
    case 'hapusSemuaFitting': return apiHapusSemuaFitting(payload);
    default: return { ok: false, msg: 'Aksi tidak dikenal: ' + payload.aksi };
  }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Fitting Baju Siswa Baru');
}

// Endpoint JSON (bila ada yang memanggil URL web app dengan POST).
// SATU doPost saja dalam satu proyek — jangan buat doPost kedua.
function doPost(e) {
  var out = { ok: false, msg: 'Permintaan tidak dikenali.' };
  try {
    var payload = JSON.parse(e.postData.contents);
    out = gasApi(payload);
  } catch (err) {
    out = { ok: false, msg: 'JSON tidak valid: ' + err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
