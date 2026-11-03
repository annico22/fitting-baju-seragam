# Deploy Fitting Baju lewat Google Script

Paket ini berisi 2 file: `Code.gs` (server: login, akun, dan Sheet) dan
`Index.html` (tampilan aplikasi, sama seperti preview terakhir — Halaman
Sambutan, login, Dashboard Admin, Form, Rekap, Kelola User, dan blanko
kertas Koperasi Konsumen Al Hidayah Jakarta Maju Bersama).

Datanya tersimpan di Sheet **DATABASE FITTING BAJU** (tab `Data_Utama`
untuk data siswa, tab `Akun` untuk akun — tab Akun dibuat otomatis saat
login pertama). Berbeda dengan preview, di versi ini data **dibagi untuk
semua perangkat**: yang diinput Petugas langsung terlihat di Rekap Admin,
dan sebaliknya.

## Langkah deploy (sekali saja)

1. Buka https://script.google.com , lalu buat proyek baru
   (atau buka proyek Apps Script yang sudah ada untuk aplikasi ini).
2. Di editor, buka file `Code.gs`, hapus seluruh isinya, lalu tempel
   seluruh isi file `Code.gs` dari paket ini. Simpan (Ctrl+S / ikon disket).
3. Tambah file HTML: klik **+** di samping "Files" > **HTML**, beri nama
   `Index`, hapus seluruh isinya, lalu tempel seluruh isi file
   `Index.html` dari paket ini. Simpan lagi.
4. Klik **Deploy > New deployment**.
5. Klik ikon roda gigi di samping "Select type", pilih **Web app**.
6. Isi seperti ini:
   - **Execute as:** Me (alamat email kamu)
   - **Who has access:** Anyone
7. Klik **Deploy**, izinkan akses saat diminta (pilih akun Google kamu,
   lalu "Advanced" > "Go to ... (unsafe)" bila muncul — itu normal untuk
   script buatan sendiri).
8. Salin URL web app yang muncul (bentuknya
   `https://script.google.com/macros/s/.../exec`).

## Setelah deploy — penting

- **Kirim URL itu kembali** supaya bisa dites login dan simpan datanya.
  Versi ini **belum bisa dipakai** sebelum URL-nya dites: login, buat
  Petugas, simpan satu data, lalu muat ulang halaman dan pastikan datanya
  masih ada.
- **Jangan bagikan URL ke publik.** Siapa pun yang memegang URL bisa
  memanggil endpoint login — walau tetap butuh username dan password yang
  benar untuk bisa masuk.
- **Login pertama:** pakai akun bawaan yang sama seperti preview:
  Admin — username `admin`, password `admin123`; Petugas Demo — username
  `petugas`, password `petugas123`. Begitu berhasil masuk sebagai Admin,
  **langsung ganti kedua password itu lewat Kelola User > Reset Password**.
  Setelah diganti, password lama langsung tidak berlaku.
- **Setiap ada revisi file** (Code.gs atau Index.html diubah), ulangi
  langkah 4–8 dan buat **New deployment** baru — sekadar menekan Simpan
  saja tidak mengubah web app yang sudah tayang. Bila URL berubah, kirim
  URL yang baru.

## Yang berubah dari preview (supaya tidak kaget)

- Rekap produksi mulai **kosong** bila Sheet masih kosong. Itu normal:
  Sheet memang belum punya baris siswa. Data contoh generik ("Siswa
  Contoh Satu" dst.) hanya muncul bila Admin menekan **Muat Ulang Data
  Contoh**, hanya tampil di layar, dan **tidak pernah ditulis ke Sheet**.
- Sesi login berlaku 6 jam. Bila sudah lewat, aplikasi meminta login ulang.
- Sheet hanya punya 7 kolom seragam. Bila di formulir baris seragam
  tambahan (baris 8–10) ikut diisi, baris itu **tidak tersimpan di
  Sheet** dan aplikasi akan memberi peringatan saat menyimpan.
- Peran tetap sama: Admin akses penuh (Dashboard, Edit, Hapus, CSV,
  Kelola User); Petugas Fitting hanya Form Input, lihat Rekap, dan cetak.
  Pembatasan ini juga diperiksa di server, bukan hanya di tampilan.

## Kalau ada masalah

- **"Page Not Found" saat login:** biasanya deployment belum dibuat
  (baru disimpan) atau URL-nya dari deployment lama. Buat New deployment
  lagi dan pakai URL yang baru.
- **"Script function not found: gasApi":** file `Code.gs` belum tersimpan
  dengan benar, atau ada dua file `.gs` yang saling tumpang tindih.
  Pastikan hanya ada satu `Code.gs` berisi file dari paket ini.
- **Login selalu "Username atau password salah":** periksa username
  (huruf kecil semua) dan pastikan tab `Akun` sudah terbuat di Sheet.
  Bila tab `Akun` belum ada, login sekali lagi — tab itu dibuat otomatis
  saat login pertama.
- **Data hilang setelah reload:** pastikan yang dibuka adalah URL web app
  hasil deploy (bukan file HTML mentah), dan data yang diinput memang
  sudah tersimpan (muncul pesan sukses) sebelum reload.
