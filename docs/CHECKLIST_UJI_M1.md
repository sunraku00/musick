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
| 4.1 | **Navigasi Sidebar** | Klik menu "Beranda", "Cari", dan "Pengaturan" di sidebar kiri. | Halaman berganti seketika dengan transisi mulus; status pemutaran audio di bar bawah TIDAK terputus. | [x] Terverifikasi Otomatis |
| 4.2 | **Halaman Pengaturan** | Buka menu Pengaturan. | Tampil info versi aplikasi (v0.1.3), commit hash pendek, sumber musik aktif (YouTube Music), opsi kualitas audio, dan tombol hapus riwayat. | [x] Terverifikasi Otomatis |
| 4.3 | **Keamanan Teks (No XSS)** | Cari lagu dengan karakter khusus (misal: `<script>alert(1)</script>`). | Teks dirender sebagai teks biasa murni; tidak ada eksekusi HTML/JavaScript. | [x] Terverifikasi Otomatis |

---

## 5. Lingkup Fitur Slice 2 (Artis, Album, Putar Semua, Database SQLite, Keyboard, Power & Device Change)

| # | Skenario Uji | Langkah Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|:---:|
| 5.1 | **Navigasi Halaman Artis** | Klik kartu artis pada hasil pencarian (mis. "Dewa 19"). | Halaman Artis terbuka menampilkan nama artis, foto, tombol "Putar Semua", daftar trek terpopuler, dan deretan album. | [x] Terverifikasi Otomatis |
| 5.2 | **Navigasi Halaman Album** | Klik kartu album pada halaman artis atau hasil pencarian. | Halaman Album terbuka menampilkan cover album, nama album, tahun/durasi, tombol "Putar Semua", dan nomor trek lengkap. | [x] Terverifikasi Otomatis |
| 5.3 | **Tombol "Putar Semua"** | Klik tombol "Putar Semua" pada halaman Artis atau Album. | Seluruh lagu dalam daftar dimasukkan ke antrean pemutar dan lagu pertama langsung diputar otomatis (`paused === false`). | [x] Terverifikasi Otomatis |
| 5.4 | **Virtualisasi Daftar (VirtualizedTrackList)** | Buka daftar lagu panjang (> 50 trek) lalu gulir cepat (scroll). | Hanya item yang masuk viewport yang dirender di DOM (DOM recycling); pemakaian memori tetap rendah dan bebas lag. | [x] Terverifikasi Otomatis |
| 5.5 | **Pintasan Keyboard Bebas Konflik Fokus** | Uji Space dan Panah saat fokus di input teks, tombol, slider, dan area umum. | Tidak ada aksi ganda; Space pada input mengetik spasi, pada tombol memicu klik native, pada slider mengatur nilai, pada body memicu play/pause. | [x] Terverifikasi Otomatis |
| 5.6 | **Persistensi Database SQLite (node:sqlite)** | Putar lagu, ubah antrean, lalu muat ulang atau buka kembali aplikasi. | Pengaturan, antrean lagu, riwayat putar, dan posisi lagu terakhir tersimpan di database lokal SQLite (`musick.db`). | [x] Terverifikasi Otomatis |
| 5.7 | **Siklus Tidur / Bangun (Sleep/Wake Simulation)** | Simulasi sinyal suspend saat pemutaran aktif, lalu resume, lalu putar lanjut. | Audio jeda saat suspend, tetap jeda saat resume, dan saat ditekan play pemutaran berlanjut dari posisi detik terakhir (bukan 0) tanpa error. | [x] Terverifikasi Otomatis |
| 5.8 | **Perubahan Perangkat Audio (Device Change)** | Earphone dicabut saat pemutaran aktif (hanya jeda bila output aktif hilang). | Logika deteksi hilangnya output audio aktif memicu jeda pemutaran agar tidak bocor ke speaker. | [ ] Belum diverifikasi di perangkat nyata |
| 5.9 | **Smoke Test Binary Rilis Mandiri** | Jalankan `scripts/smoke_test_release.py` pada build hasil instalasi tanpa CDP / env var uji. | Membaca `%APPDATA%\Musick\runtime-status.json` dan membuktikan `isPackaged === true`, sumber aktif `ytmusic`, dan mock source tidak ada. | [x] Terverifikasi Otomatis |
| 5.10 | **Pengerasan DB & Hapus Riwayat Permanen** | Tekan tombol "Hapus Riwayat Putar & Cari" di Pengaturan. | Seluruh baris riwayat putar dan riwayat pencarian dihapus permanen dari berkas `musick.db` (baris = 0). | [x] Terverifikasi Otomatis |
| 5.11 | **Pencarian 1 Request Unfiltered (Tab Semua)** | Ketik kata kunci pada kolom Cari. | Mengirimkan tepat 1 permintaan tanpa filter (hasil campuran), menghemat 66,7% beban HTTP dan mematuhi throttle 250ms. | [x] Terverifikasi Otomatis |
| 5.12 | **Pemutaran Saat Layar Mati (Display Off Timeout)** | Biarkan laptop hingga batas waktu layar mati tercapai tanpa menutup lid. | Audio tetap mengalir lancar, `prevent-app-suspension` aktif, panel layar mati normal. | [ ] Belum diverifikasi di perangkat nyata |
| 5.13 | **Kunci Layar (Lock Screen Win+L)** | Kunci layar Windows (Win+L) saat pemutaran sedang berlangsung. | Audio terus berlanjut tanpa tercekik (timer renderer aktif berkat `backgroundThrottling: false`). | [x] Diverifikasi manual oleh pemilik produk, 20 Nov 2026 |
| 5.14 | **Tidur Idle Sistem (Idle System Sleep)** | Biarkan komputer menyala tanpa aktivitas hingga batas waktu tidur sistem saat memutar musik. | Pemutaran musik mencegah tidur sistem karena idle via `prevent-app-suspension`. Saat pemutar jeda, komputer tidur normal. | [ ] Belum diverifikasi di perangkat nyata |
| 5.15 | **Tutup Layar Manual (Lid Close) & Sleep Manual** | Tutup penutup laptop atau pilih Start > Sleep (catatan: di luar kendali aplikasi, mengikuti setelan Windows). | Jika setelan "Sleep" atau Sleep manual, event `suspend` tertangkap, audio terjeda dan posisi tersimpan; saat bangun tetap jeda dan bisa dilanjutkan dengan 1x klik Play dari posisi terakhir. Jika setelan lid "Do nothing", musik terus berlanjut. | [ ] Belum diverifikasi di perangkat nyata |
| 5.16 | **Opsi 'Tetap putar saat layar mati'** | Matikan toggle "Tetap putar saat layar mati" di Pengaturan, lalu putar musik. | Blocker daya tidak diaktifkan (`active: false, settingEnabled: false`), menghormati preferensi hemat baterai. | [x] Terverifikasi Otomatis |

---

## 6. Pemetaan Uji: Otomasi vs Verifikasi Manual Fisik

### A. Bagian yang Berhasil Diotomatiskan Penuh (CDP & Smoke Test):
1. Mengetik pada kolom Cari dengan debounce 400 ms.
2. Memilih dan mengklik baris trek pertama dari hasil pencarian di UI.
3. Memverifikasi audio HTML5 memutar (`audio.paused === false`) dan `currentTime` bertambah.
4. Menekan tombol "Berikutnya" (⏭) dan memverifikasi pergantian judul lagu di PlayerBar.
5. Melakukan seek posisi lagu ke tengah durasi dan memverifikasi `audio.currentTime`.
6. Mengubah slider volume dan memverifikasi nilai `audio.volume`.
7. Navigasi ke halaman Artis dan Album, serta tombol "Putar Semua".
8. Pintasan keyboard Space, ArrowLeft, ArrowRight, ArrowDown, ArrowUp, dan M.
9. Persistensi SQLite untuk riwayat, antrean, dan playback state.
10. Smoke test binary rilis mandiri tanpa harness CDP.
11. Siklus hidup `powerSaveBlocker` ('prevent-app-suspension') aktif saat playing, berhenti saat pause.
12. Transisi lagu otomatis di latar belakang saat jendela tidak terlihat.
13. Sakelar pengaturan "Tetap putar saat layar mati" mengontrol status blocker secara dinamis.

### B. Bagian Checklist Manual Fisik (Lingkungan Nyata):
1. **Kunci Layar Fisik (Win+L):** [x] Diverifikasi manual oleh pemilik produk, 20 Nov 2026 (LULUS, pemutaran musik tetap berjalan lancar pada build 0.1.3).
2. **Layar Mati Fisik (Display Timeout):** [ ] Belum diverifikasi di perangkat nyata (dilewati oleh pemilik produk).
3. **Tidur Idle Sistem Fisik:** [ ] Belum diverifikasi di perangkat nyata (dilewati oleh pemilik produk).
4. **Tutup Layar Fisik (Lid Close) & Sleep Manual:** [ ] Belum diverifikasi di perangkat nyata (dilewati oleh pemilik produk; mengikuti setelan Windows).
5. **Pencabutan Fisik Perangkat Audio (Headphone):** [ ] Belum diverifikasi di perangkat nyata (dilewati oleh pemilik produk).
6. **Tombol Fisik Multimedia Keyboard Windows:** [ ] Belum diverifikasi di perangkat nyata.
7. **Dialog Peringatan Windows SmartScreen:** [ ] Belum diverifikasi di perangkat nyata.
