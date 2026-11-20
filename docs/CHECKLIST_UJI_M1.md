# Checklist Uji Manual Milestone M1 (Pemutar Inti)

Dokumen ini berisi panduan dan daftar periksa pengujian manual (*manual acceptance test checklist*) untuk memverifikasi fungsionalitas F1 (Pencarian), F2 (Kontrol Pemutar), dan penanganan kasus batas (*edge cases*) pada aplikasi terpasang `Musick.exe`.

---

## 1. Lingkup Pengujian F1 (Pencarian, Pengelompokan Kategori & Cache Sesi)

| # | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|:---:|
| 1.0 | **Sumber Bawaan Rilis** | Buka Pengaturan > Tentang pada build hasil instalasi tanpa env var. | Sumber aktif terverifikasi `YouTube Music (ytmusic)`. MockSource dinonaktifkan permanen dan dilarang fallback diam-diam. | [x] Terverifikasi Otomatis |
| 1.1 | **Debounce 400 ms** | Ketik kata kunci (misal: `"Dewa 19"`) secara bertahap tanpa jeda. | Permintaan ke sumber musik baru dikirim 400 ms setelah ketikan terakhir berhenti; tidak ada request per huruf. | [x] Terverifikasi Otomatis |
| 1.2 | **Kueri Kosong / Spasi** | Ketik spasi kosong berulang kali lalu hapus. | Kotak pencarian tidak memicu pemanggilan IPC/bridge dan menampilkan keadaan awal "Cari Musik Favoritmu". | [x] Terverifikasi Otomatis |
| 1.3 | **Pengelompokan Lagu, Artis, Album** | Cari `"Sheila on 7"` atau `"Tulus"`. | Tampil tab kategori (Semua, Lagu, Artis, Album). Bagian Lagu menampilkan daftar trek, Artis menampilkan kartu profil bulat, Album menampilkan kartu persegi. | [x] Terverifikasi Otomatis |
| 1.4 | **Pencarian Relevansi Indonesia (location=ID)** | Cari kueri lokal seperti `"hiduplah tanahku"` dan `"lagu daerah"`. | Menghasilkan katalog spesifik Indonesia yang diprioritaskan oleh YouTube Music Innertube API. | [x] Terverifikasi Otomatis |
| 1.5 | **Pembedaan Hasil Kosong vs Galat** | Cari kueri tanda hubung panjang `"-------------------"`. | Muncul state kosong "Tidak Ada Hasil" tanpa banner error merah. Sebaliknya, saat offline/error muncul banner merah peringatan dengan tombol "Coba Lagi". | [x] Terverifikasi Otomatis |
| 1.6 | **Latest-Wins (Kueri Cepat)** | Ketik kata `"Sheila"`, lalu langsung ubah cepat menjadi `"Sheila on 7"`. | Hasil yang tampil di layar wajib milik `"Sheila on 7"`. Respons lama dari `"Sheila"` tidak boleh menimpa hasil terbaru. | [x] Terverifikasi Otomatis |
| 1.7 | **Cache Sesi In-Memory** | Cari `"Padi"`, lalu cari `"Kotak"`, lalu ketik kembali `"Padi"`. | Hasil `"Padi"` kedua langsung tampil instan (0 ms) dari cache tanpa indikator loading atau request jaringan baru. | [x] Terverifikasi Otomatis |
| 1.8 | **Penanganan Error & "Coba Lagi"** | Putuskan koneksi WiFi/LAN, lalu ketik kueri pencarian. | Banner error merah muncul dengan pesan ramah berbahasa Indonesia dan tombol "Coba Lagi". Teks kueri pencarian tetap utuh tidak terhapus. | [x] Terverifikasi Otomatis |
| 1.9 | **Pemulihan Setelah Error** | Sambungkan kembali WiFi/LAN, lalu tekan tombol "Coba Lagi". | Pencarian berhasil dieksekusi ulang dan daftar lagu ditampilkan normal. | [x] Terverifikasi Otomatis |

---

## 2. Lingkup Pengujian F2 (Kontrol Pemutar Audio & Media Session)

| # | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|:---:|
| 2.1 | **Mulai Pemutaran dari Hasil Cari** | Klik salah satu baris trek hasil pencarian. | Bar pemutar bawah memuat info lagu (judul, artis, sampul), tombol berubah menjadi Jeda (⏸), dan audio mulai terdengar. | [ ] |
| 2.2 | **Jeda dan Lanjut (Play/Pause)** | Klik tombol Play/Pause di bar pemutar atau gunakan spasi. | Audio berhenti seketika saat jeda, dan berlanjut normal tanpa distorsi saat diputar kembali. | [ ] |
| 2.3 | **Slider Posisi (Seeking)** | Geser bulatan slider ke tengah durasi lagu (misal detik ke-60). | Posisi lagu melompat mulus ke detik ke-60 dan pemutaran berlanjut dari posisi baru tersebut. | [ ] |
| 2.4 | **Seek Melebihi Durasi Lagu** | Geser slider posisi hingga mentok ke ujung kanan (melebihi durasi). | Diperlakukan sebagai akhir lagu; pemutar otomatis menyelesaikan lagu dan memutar trek berikutnya dalam antrean. | [ ] |
| 2.5 | **Logika Tombol "Sebelumnya" (> 3 detik)** | Biarkan lagu berputar selama 10 detik, lalu klik tombol "Sebelumnya" (⏮). | Lagu saat ini di-restart dari detik ke-0 (posisi reset, tidak berganti trek). | [ ] |
| 2.6 | **Logika Tombol "Sebelumnya" (≤ 3 detik)** | Di detik ke-1 pemutaran, klik tombol "Sebelumnya" (⏮). | Pemutar berpindah ke lagu sebelumnya dalam antrean minimal. | [ ] |
| 2.7 | **Tombol "Berikutnya" (⏭)** | Klik tombol Berikutnya saat lagu sedang diputar. | Pemutar segera menghentikan lagu saat ini dan beralih memutar trek berikutnya. | [ ] |
| 2.8 | **Volume & Bisukan (Mute)** | Klik ikon speaker di kanan bawah, lalu klik lagi. | Audio langsung bisu (mute) tanpa mengubah posisi slider, dan kembali ke volume semula saat di-unmute. | [ ] |
| 2.9 | **Windows Media Session API** | Tekan tombol Play/Pause/Next pada keyboard multimedia, atau cek menu media flyout Windows (Win+G / volume bar). | Metadata lagu (judul, artis, cover) muncul di Windows Media Overlay dan tombol keyboard fisik merespons pemutar. | [ ] |

---

## 3. Lingkup Ketahanan Stream & Kasus Batas (Stream Resilience)

| # | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|:---:|
| 3.1 | **Kedaluwarsa Stream Otomatis** | Simulasi URL stream kedaluwarsa atau terputus di tengah pemutaran. | Engine secara otomatis memanggil `resolveStream` ulang di latar belakang dan melanjutkan dari detik terakhir tanpa interupsi pengguna. | [ ] |
| 3.2 | **Lompat Setelah 2x Gagal** | Lagu yang diblokir wilayah atau stream rusak dicoba diputar. | Engine mencoba hingga 2 kali. Jika tetap gagal, toast notifikasi muncul dan pemutar melompat ke lagu berikutnya. | [ ] |
| 3.3 | **Infinite Loop Guard (5x Skip)** | Simulasi 5 trek berturut-turut tidak tersedia. | Setelah 5 kali lompatan berturut-turut, pemutar berhenti total dengan pesan error jelas agar tidak terjadi loop pemutaran tanpa henti. | [ ] |
| 3.4 | **Reset Counter Setelah 5 Detik** | Setelah 1x terjadi skip, biarkan lagu berikutnya berputar lebih dari 5 detik. | Penghitung `consecutiveSkips` otomatis di-reset menjadi 0. | [ ] |

---

## 4. Lingkup Tampilan & Pengaturan

| # | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|:---:|
| 4.1 | **Navigasi Sidebar** | Klik menu "Beranda", "Cari", dan "Pengaturan" di sidebar kiri. | Halaman berganti seketika dengan transisi mulus; status pemutaran audio di bar bawah TIDAK terputus. | [ ] |
| 4.2 | **Halaman Pengaturan** | Buka menu Pengaturan. | Tampil opsi kualitas audio "Hemat (WebM Opus ~128 kbps)" dengan keterangan perkiraan data ~55 MB/jam dan pernyataan privasi lokal. | [ ] |
| 4.3 | **Keamanan Teks (No XSS)** | Cari lagu dengan karakter khusus (misal: `<script>alert(1)</script>`). | Teks dirender sebagai teks biasa murni; tidak ada eksekusi HTML/JavaScript. | [ ] |

---

## 5. Pemetaan Uji: Otomasi vs Verifikasi Manual Fisik

### A. Bagian yang Berhasil Diotomatiskan Penuh (CDP - `scripts/automate_ui_flow.py`):
1. Mengetik pada kolom Cari dengan debounce 400 ms.
2. Memilih dan mengklik baris trek pertama dari hasil pencarian di UI.
3. Memverifikasi audio HTML5 memutar (`audio.paused === false`) dan `currentTime` bertambah.
4. Menekan tombol "Berikutnya" (⏭) dan memverifikasi pergantian judul lagu di PlayerBar.
5. Melakukan seek posisi lagu ke tengah durasi dan memverifikasi `audio.currentTime`.
6. Mengubah slider volume dan memverifikasi nilai `audio.volume`.

### B. Bagian yang TIDAK Dapat Diotomatiskan via CDP (Wajib Checklist Manual Fisik):
1. **Tombol Fisik Multimedia Keyboard Windows:** Menekan tombol Fn/Media Play/Pause/Next pada keyboard laptop/eksternal fisik untuk menguji respons Media Session API.
2. **Pencabutan Fisik Perangkat Audio:** Mencabut jack audio 3.5mm atau memutuskan sambungan headset Bluetooth fisik untuk menguji penanganan event `devicechange` (jeda otomatis).
3. **Siklus Tidur/Bangun Laptop (Sleep/Wake):** Menutup layar laptop (lid close) lalu membuka kembali untuk memverifikasi pemulihan status pemutar tanpa crash.
4. **Dialog Peringatan Windows SmartScreen:** Memverifikasi tampilan prompt biru *"Windows protected your PC"* pada laptop Windows pengguna lain yang belum pernah memasang aplikasi.
