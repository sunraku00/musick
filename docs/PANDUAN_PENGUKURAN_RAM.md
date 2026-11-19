# Panduan Satu Halaman: Pengukuran Kinerja Musick di Laptop RAM 4 GB

Panduan ini ditujukan bagi penguji/pengguna untuk menjalankan audit memori independen pada laptop Windows (RAM 4 GB) tanpa perlu memasang Node.js, npm, Git, atau dependensi pengembang apa pun. Skrip `scripts\measure.ps1` murni menggunakan PowerShell bawaan Windows (WMI/CIM).

---

## 1. Persiapan

1. Pastikan aplikasi **Musick** telah terpasang di komputer (dari installer `Musick Setup 0.1.0.exe` atau folder instalasi).
2. Simpan skrip `measure.ps1` (ada di folder proyek `scripts\measure.ps1`) ke komputer target (misalnya di `C:\Musick\measure.ps1` atau di mana saja).

---

## 2. Cara Menjalankan Pengukuran

### Skenario A: Kondisi Diam Tanpa Bridge (Aplikasi Baru Dibuka)
1. Buka aplikasi **Musick** dari Start Menu atau Desktop. (Jangan lakukan pencarian lagu terlebih dahulu).
2. Buka **Windows PowerShell** (tekan `Win + X`, lalu pilih **Windows PowerShell**).
3. Jalankan perintah:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\measure.ps1 -DurationSeconds 15
   ```
4. Skrip akan menampilkan spesifikasi komputer, daftar seluruh proses `Musick.exe` (Main, Renderer, GPU, Utility), dan mencatat rata-rata **Private Working Set**.

### Skenario B: Kondisi Bridge Diam (Setelah Melakukan Pencarian)
1. Pada aplikasi Musick, ketik judul lagu (misal: `Sheila on 7`) di bilah pencarian lalu tekan Enter.
2. Tunggu hasil pencarian muncul. Bridge Python sekarang telah aktif.
3. Jalankan kembali skrip pengukuran di PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\measure.ps1 -DurationSeconds 15
   ```
4. Skrip otomatis mendeteksi proses `Musick.exe` ditambah proses `python.exe` (bridge).

### Skenario C: Kondisi Pemutaran Musik (Sedang Memutar Lagu)
1. Klik salah satu lagu dari hasil pencarian agar audio mulai berputar.
2. Jalankan skrip pengukuran dengan durasi lebih panjang (misal 5 menit = 300 detik atau 30 detik):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\measure.ps1 -DurationSeconds 60
   ```
3. Skrip akan melakukan sampling setiap 2 detik dan menampilkan agregat Private Working Set serta penggunaan CPU selama streaming audio berlangsung.

---

## 3. Cara Membaca Hasil

- **Private Working Set (Angka Utama):** Jumlah memori fisik yang dialokasikan khusus dan eksklusif untuk proses aplikasi Musick dan Python Bridge. Angka ini mencerminkan beban nyata aplikasi terhadap RAM sistem.
  - *Target PRD (Idle):* $\le 150\text{ MB}$
  - *Target PRD (Playback):* $\le 250\text{ MB}$
- **Total Working Set (Pembanding):** Meliputi memori bersama (*shared memory*, DLL sistem Windows, runtime GPU shared). Digunakan oleh Windows Task Manager sebagai kolom "Memory".
- **CPU Usage:** Rata-rata beban CPU dari seluruh pohon proses dinormalisasi terhadap jumlah core CPU.
  - *Target PRD:* $\le 10\%$ saat pemutaran musik normal.

---

## 4. Pelaporan
Salin baris `PRIVATE WORKING SET (ANGKA UTAMA)` dan `TOTAL WORKING SET (PEMBANDING)` dari ringkasan hijau di akhir keluaran skrip dan laporkan angka tersebut untuk evaluasi Milestone M0.
