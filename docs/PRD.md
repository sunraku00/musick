# PRD: Aplikasi Musik Desktop Gratis, Tanpa Iklan

| | |
|---|---|
| **Status** | Versi 1.1 (Diperbarui pasca-Milestone M0) |
| **Tanggal** | 20 November 2026 |
| **Pemilik produk** | Pembuat aplikasi (dibantu agen AI) |
| **Platform awal** | Windows 10/11 64-bit, dibagikan sebagai installer |
| **Catatan** | Dokumen ini bukan nasihat hukum. Bagian risiko hukum perlu dikonsultasikan ke ahli hukum bila aplikasi akan disebarkan lebih luas. |

---

## 1. Ringkasan

Aplikasi pemutar musik desktop bergaya Spotify yang **gratis penuh, tanpa iklan, dan tanpa langganan**. Dibuat nirlaba untuk dibagikan, tahap awal ke lingkaran teman. Semua data pengguna tersimpan lokal di komputer masing-masing. Tidak ada akun dan tidak ada server milik pembuat.

Aplikasi tidak menyertakan pustaka analitik, pelacakan, atau pelaporan crash otomatis pihak ketiga. Namun, saat mencari dan memutar lagu, lalu lintas jaringan langsung menuju ke server layanan sumber musik, sehingga layanan tersebut dapat melihat alamat IP dan permintaan pengguna.

**Prinsip inti (tidak boleh dilanggar tanpa keputusan eksplisit):**

1. Tanpa iklan, tanpa langganan, tanpa paywall.
2. Tanpa akun dan tanpa server milik pembuat.
3. Tanpa pustaka telemetri, analitik, atau pelaporan crash otomatis pihak ketiga.
4. Ringan: nyaman di laptop spek rendah (target divalidasi bertahap).
5. Sumber musik terisolasi dari aplikasi lewat antarmuka `MusicSource`, supaya bisa diganti tanpa menulis ulang UI atau database.

## 2. Tujuan dan Bukan Tujuan

**Tujuan**
- Teman-teman pembuat bisa mencari dan memutar musik tanpa iklan, dan senang memakainya.
- Fitur inti (cari, putar, antrean, favorit, playlist) berjalan stabil.
- Berjalan lancar di laptop RAM 4 GB (wajib divalidasi di M3).

**Bukan tujuan (saat ini)**
- Menghasilkan uang dalam bentuk apa pun.
- Akun, sinkronisasi antarkomputer, fitur sosial real-time.
- Versi macOS, Linux, atau seluler.
- Publikasi luas atau masuk toko aplikasi.
- Unduh offline (ditunda, lihat bagian 14).

## 3. Pengguna

**Dimas, pendengar harian.** Usia 20-an, laptop Windows spek rendah (RAM 4 GB), mendengar musik berjam-jam saat belajar atau bekerja, kesal dengan iklan mendadak dan aplikasi berat. Bisa jadi kuota internetnya terbatas. Puas bila aplikasi dipakai tiap hari tanpa crash.

**Pembuat sekaligus admin.** Membangun dengan agen AI, tanpa tenggat, tanpa server. "Admin" berarti pengelola aplikasi: membagikan installer, merilis pembaruan, menjaga aplikasi tetap hidup saat sumber musik berubah. Puas bila teman senang dan tidak ada bug yang mengganggu fitur inti.

## 4. User Story

| # | Versi | Story |
|---|---|---|
| 1 | V1 | Sebagai pendengar, saya ingin mencari lagu, artis, dan album, supaya saya bisa cepat menemukan musik yang ingin saya dengar. |
| 2 | V1 | Sebagai pendengar, saya ingin memutar, menjeda, melanjutkan, menggeser posisi lagu, dan mengatur volume, supaya saya bisa mengendalikan musik sesuai suasana. |
| 3 | V1 | Sebagai pendengar, saya ingin mengatur antrean, mengacak, dan mengulang lagu, supaya musik terus mengalir tanpa saya memilih satu per satu. |
| 4 | V1 | Sebagai pendengar, saya ingin menyimpan lagu favorit dan membuat playlist sendiri, supaya lagu yang saya sukai mudah ditemukan lagi kapan saja. |
| 5 | V1 | Sebagai pendengar, saya ingin aplikasi yang ringan, tanpa iklan, dan menjaga privasi lokal, supaya saya mendengarkan dengan nyaman. |
| 6 | V2 | Sebagai pendengar, saya ingin mengekspor dan membagikan playlist lewat file atau kode, supaya teman saya bisa mengimpornya. |
| 7 | V1 | Sebagai admin, saya ingin membagikan installer dan merilis versi baru dengan mudah, supaya teman-teman memakai versi yang sudah diperbaiki. |
| 8 | V1 | Sebagai admin, saya ingin sumber musik dipisah dari pemutar lewat satu lapisan penghubung, supaya bila akses diblokir saya cukup mengganti satu bagian. |

## 5. Lingkup Fitur MVP

### Wajib (V1)

| # | Fitur | Alasan |
|---|---|---|
| 1 | Pencarian lagu, artis, album | Pintu masuk ke semua fitur lain. |
| 2 | Kontrol pemutar (putar, jeda, lanjut, geser, volume) | Inti aplikasi musik. |
| 3 | Antrean, acak, ulang | Musik mengalir tanpa dipilih satu per satu. |
| 4 | Liked Songs dan playlist sendiri | Alasan pengguna kembali. Data lokal. |
| 5 | Lapisan sumber musik yang bisa diganti | Pelindung proyek karena sumber musik rapuh. |

Ringan, tanpa iklan, dan privasi lokal adalah **syarat kualitas** untuk semua fitur, bukan fitur tersendiri.

### Bagus kalau ada (V2)
- Beranda dan rekomendasi sederhana (berdasarkan lagu yang sering diputar)
- Lirik
- Berbagi playlist lewat file atau kode
- Pembaruan aplikasi mandiri berbasis komponen bertanda tangan

### Nanti dulu
- Unduh offline (V3, risiko hukum tertinggi, diputuskan ulang)
- Fitur sosial real-time
- macOS dan Linux
- Sinkronisasi antarkomputer

## 6. Alur Pengguna

**Alur utama (V1)**

1. Pengguna membuka aplikasi dari ikon desktop.
2. Aplikasi terbuka ke **Beranda**. Tidak ada login, popup, atau iklan.
3. Pengguna mengetik judul atau artis di **Cari**.
4. Hasil tampil dikelompokkan: Lagu, Artis, Album. Bila gagal, muncul pesan jelas dengan tombol "Coba lagi".
5. Pengguna menekan lagu, lalu lagu diputar dan pemutar bawah aktif.
6. Pengguna mengatur jeda, geser, volume, acak, ulang, dan menambah lagu ke **Antrean**.
7. Pengguna menekan ikon hati untuk menyimpan ke **Liked Songs**.
8. Pengguna membuat **playlist** dan menambahkan lagu.
9. Pengguna menutup aplikasi. Antrean dan posisi lagu terakhir tersimpan.
10. Esok hari aplikasi memulihkan antrean terakhir. Playlist dan favorit masih ada. **Tujuan tercapai.**

**Alur berbagi playlist (V2)**
1. Pengguna membuka playlist lalu menekan **Bagikan**.
2. Memilih ekspor file atau salin kode, lalu mengirimnya lewat WhatsApp/Telegram.
3. Teman membuka **Perpustakaan > Impor**, memilih file atau menempel kode.
4. Aplikasi memvalidasi isinya, menampilkan pratinjau ("Playlist X, 25 lagu"), dan menunggu konfirmasi sebelum menyimpan.

**Alur gagal (wajib ditangani tanpa crash)**
- Sumber musik tidak bisa diakses → pesan "Sumber musik sedang bermasalah", pemutaran lagu yang sudah berjalan tidak terputus bila memungkinkan, tombol "Coba lagi".
- Akses dibatasi (bot check) → pesan ramah `BLOCKED`: "Akses dibatasi oleh sumber musik (deteksi bot/jaringan). Silakan coba beberapa saat lagi."
- Lagu tidak tersedia → lompat ke lagu berikutnya dengan pemberitahuan kecil.
- Internet putus → pesan jelas, data lokal (playlist, favorit) tetap bisa dilihat.

## 7. Daftar Halaman

| Halaman | Isi | Versi |
|---|---|---|
| Pemutar (bar bawah, selalu tampil) | Sampul, judul, artis, putar/jeda/lanjut/sebelumnya, slider posisi, volume, acak, ulang, hati, tombol Antrean | V1 |
| Sidebar kiri | Beranda, Cari, Perpustakaan, daftar playlist, "Buat playlist" | V1 |
| Beranda | "Terakhir diputar" (keadaan kosong rapi di awal), pintasan Liked Songs. V2: rekomendasi | V1/V2 |
| Cari | Kolom cari, riwayat cari, hasil Lagu/Artis/Album | V1 |
| Halaman Artis | Nama, foto, lagu populer, album | V1 |
| Halaman Album | Sampul, judul, artis, tahun, daftar lagu, putar semua | V1 |
| Halaman Playlist | Nama, deskripsi, daftar lagu (urut, hapus, putar semua). V2: Bagikan | V1/V2 |
| Liked Songs | Daftar lagu disukai, putar semua | V1 |
| Perpustakaan | Semua playlist dan Liked Songs. V2: Impor | V1/V2 |
| Antrean | Lagu sedang diputar, daftar berikutnya, hapus, ubah urutan | V1 |
| Lirik (panel) | Lirik lagu yang diputar | V2 |
| Pengaturan | Kualitas audio, tema, hapus riwayat, cadangkan/pulihkan data, tentang (versi, pernyataan privasi) | V1 |

## 8. Persyaratan Fungsional dan Kriteria Penerimaan

### F1. Pencarian
- Mengetik lalu berhenti 400 ms memicu pencarian (debounce). Kata kosong atau spasi saja tidak memicu pencarian.
- Hasil dikelompokkan Lagu, Artis, Album. Tampil dalam 3 detik pada koneksi normal; bila lebih lama, tampil indikator memuat.
- Hasil kosong menampilkan "Tidak ada hasil untuk '...'". Kegagalan sumber menampilkan pesan error berbeda dari hasil kosong.
- Hasil pencarian yang sama dalam sesi yang sama dipakai ulang (cache) agar tidak membebani sumber.
- Teks dari sumber ditampilkan sebagai teks biasa (tidak pernah sebagai HTML).

### F2. Kontrol pemutar
- Putar, jeda, lanjut, sebelumnya/berikutnya, geser posisi, volume dan bisukan berfungsi. Volume dan posisi terakhir tersimpan.
- Menggeser ke posisi melebihi durasi diperlakukan sebagai akhir lagu.
- Pemutaran berlanjut normal setelah komputer tidur lalu bangun, dan setelah perangkat audio berganti (misalnya headphone dicabut → jeda otomatis).
- Tombol media keyboard (play/pause/next/prev) berfungsi.
- Bila alamat stream kedaluwarsa di tengah lagu, aplikasi mengambil ulang alamat dan melanjutkan dari posisi terakhir tanpa tindakan pengguna. Bila gagal 2 kali berturut-turut, tampilkan pesan dan lompat ke lagu berikutnya; berhenti setelah 5 lompatan berturut-turut.

### F3. Antrean, acak, ulang
- Mode ulang: mati, ulang semua, ulang satu lagu.
- Acak tidak menghilangkan urutan asli: mematikan acak mengembalikan urutan semula dengan lagu yang sedang diputar tetap berlanjut.
- Menghapus lagu yang sedang diputar dari antrean langsung memutar lagu berikutnya. Antrean kosong menghentikan pemutaran dan menampilkan keadaan kosong.
- Bila beberapa lagu berturut-turut tidak tersedia, aplikasi berhenti setelah 5 lompatan berturut-turut dan menampilkan pesan (mencegah putaran tak berujung).
- Antrean dan posisi terakhir dipulihkan saat aplikasi dibuka kembali, termasuk setelah aplikasi ditutup paksa.

### F4. Liked Songs dan playlist
- Satu lagu hanya satu kali di Liked Songs. Menekan hati dua kali membatalkan.
- Playlist boleh berisi lagu yang sama lebih dari sekali; saat menambah duplikat, aplikasi bertanya "Sudah ada, tambahkan lagi?".
- Nama playlist wajib, maksimal 100 karakter, boleh sama dengan playlist lain. Deskripsi opsional, maksimal 300 karakter.
- Menghapus playlist meminta konfirmasi dan tidak menghapus lagu dari Liked Songs.
- Lagu yang ditandai tidak tersedia tetap tampil di playlist (abu-abu) dan tidak dihapus otomatis.
- Daftar panjang (1.000+ lagu) tetap mulus digulir (virtualized list).

### F5. Lapisan sumber musik
- Aplikasi (UI, pemutar, antrean, database) hanya berbicara dengan satu antarmuka `MusicSource`: `search`, `getArtist`, `getAlbum`, `getTrack`, `resolveStream`, `getLyrics` (V2).
- Mengganti sumber hanya mengubah satu modul adaptor, tanpa mengubah UI atau skema database.
- Semua kegagalan sumber diterjemahkan menjadi kelas error yang seragam (`NETWORK`, `UNAVAILABLE`, `RATE_LIMITED`, `SOURCE_CHANGED`, `BLOCKED`) sehingga UI menampilkan pesan yang tepat.
- Pengujian kontrak (contract test) otomatis terpisah (`npm run test:contract` offline, `npm run test:live` daring).
- Ada satu adaptor tiruan (mock) untuk pengembangan dan pengujian tanpa internet.

### F6. Berbagi playlist (V2)
- Format ekspor: JSON berversi (`format_version`) berisi nama, deskripsi, dan daftar `source` + `source_id` + judul + artis. **Tidak berisi data pribadi apa pun.**
- Impor memvalidasi skema, membatasi ukuran file (maks 1 MB) dan jumlah lagu (maks 2.000), membuang karakter kontrol, menampilkan pratinjau, dan baru menyimpan setelah konfirmasi.
- Lagu dari sumber yang tidak dikenali aplikasi ditampilkan sebagai tidak tersedia, dan pengguna diberi tahu jumlahnya.
- File atau kode rusak menghasilkan pesan "File tidak valid", tidak pernah crash.

### F7. Distribusi dan pembaruan
- Installer Windows (.exe) NSIS dibagikan bersama **checksum SHA-256** lewat saluran terpisah.
- Aplikasi menampilkan nomor versi di Pengaturan > Tentang.
- V1: pembaruan manual (data pengguna tetap aman di `%APPDATA%\Musick`, bukan di folder instalasi).
- V2: pembaruan komponen terpisah (arsip bridge terkompresi dengan tanda tangan digital Ed25519) langsung dari host rilis resmi tanpa mengunduh ulang installer Electron.

## 9. Persyaratan Nonfungsional

Angka target di bawah menggunakan metrik **Private Working Set (PWS)** sebagai ukuran utama alokasi RAM fisik eksklusif.

| Aspek | Target PRD v1.1 | Angka Nyata Terukur (Mesin Pengembang) | Status / Catatan |
|---|---|---|---|
| Sistem operasi | Windows 10 dan 11, 64-bit | Windows 11 Build 26340 x64 | Terverifikasi |
| Memori (Diam) | ≤ 150 MB Private WS | **117,44 MB** (tanpa bridge)<br>**147,10 MB** (bridge aktif) | Indikatif (diukur pada rilis) |
| Memori (Memutar) | ≤ 250 MB Private WS | **152,95 MB** rata-rata (puncak 190,24 MB) | Indikatif (pemutaran 5 menit) |
| Waktu buka (Cold start) | ≤ 3 detik | **1,09 detik** rata-rata (3 sampel) | Indikatif (diukur pada rilis) |
| CPU (Memutar) | ≤ 5% rata-rata | **0,11%** rata-rata (puncak 3,81%) | Indikatif (diukur pada rilis) |
| Ukuran installer | ≤ 150 MB | **135,51 MB** (142.090.317 byte) | Terverifikasi (NSIS terbundel) |
| Ukuran di disk | Sekitar 420 MB | **427,3 MB** (2.760 berkas) | Terverifikasi (folder hasil pasang) |
| Validasi RAM 4 GB | Nyaman di laptop RAM 4 GB | *Menunggu pengujian langsung di M3* | **Belum divalidasi** (Gerbang M3) |
| Data internet | Kualitas audio bisa diatur; default hemat | Formats: WebM Opus ~128 kbps / M4A ~128 kbps | Menunggu implementasi M1 |
| Stabilitas | Nol crash dalam 8 jam terus-menerus | Uji 5 menit: 0 error, orphan cleanup 100% | Diuji bertahap |
| Bahasa | Antarmuka bahasa Indonesia, struktur i18n | Siap diimplementasikan di M1 | Target M1 |
| Aksesibilitas | Navigasi keyboard penuh, kontras tinggi | Navigasi Tab, fokus ring jelas | Target M1 |

## 10. Arsitektur dan Keputusan Teknis

```
┌──────────────────────── Aplikasi desktop (Windows) ───────────────────────┐
│  UI React (Renderer Process)                                               │
│    │  (IPC Terisolasi & Bertipe di Preload, ContextIsolation=true)        │
│  Main Process (Electron v45): Pemutar, Antrean, SQLite                     │
│    │                         │                                             │
│  Database SQLite lokal    Antarmuka MusicSource                            │
│                              │                                             │
│                       Adaptor ytmusic (Bridge stdio JSON-RPC)              │
│                              │  stdin / stdout                             │
│                       Python 3.12.8 Embeddable (ytmusicapi + yt-dlp)       │
└────────────────────────────────────────────────────────────────────────────┘
                               │  HTTPS
                       YouTube Music & GoogleVideo CDN
```

### Keputusan Arsitektur

| # | Keputusan | Status | Pilihan & Penjelasan |
|---|---|---|---|
| **K1** | **Cara menjalankan ytmusicapi** | **TERPUTUSKAN** | **Python 3.12.8 embeddable bundel** dengan mekanisme *lazy spawning* stdio JSON-RPC. Tanpa socket HTTP, tanpa port terbuka, mati otomatis saat 5 menit idle, mati seketika saat main process ditutup via EOF stdin. |
| **K2** | **Cara mendapatkan audio** | **DIJELASKAN** | **Bridge yt-dlp** di balik antarmuka `MusicSource.resolveStream`. Mengambil URL stream HTTPS langsung dari CDN googlevideo (`itag=251` Opus) dengan opsi `skip_download=True` tanpa login/cookie akun. URL dialirkan langsung ke pemutar HTML5 di renderer. |
| **K3** | **Pembungkus desktop** | **TERPUTUSKAN** | **Electron untuk V1.** Estimasi angka Tauri (30–40 MB) dicabut karena tidak terverifikasi pada Windows (WebView2 multi-proses membutuhkan 100–120 MB RAM). Electron terbukti stabil, lulus audit keamanan sandboxing/CSP, dan menghasilkan Private Working Set 152,95 MB saat pemutaran aktif. |
| **K4** | **Pustaka database** | **DALAM EVALUASI** | SQLite lokal. Sedang dievaluasi antara modul bawaan `node:sqlite` (Node 22+) vs `better-sqlite3`. Keputusan final ditentukan pada awal M1 berdasarkan stabilitas build Electron 45 di Windows. |
| **K5** | **Lisensi aplikasi** | **TERBUKA** | Menunggu keputusan pemilik produk (open source vs tertutup). |
| **K6** | **Sumber lirik** | **TERBUKA** | Ditunda ke V2. |

### Pedoman Keamanan Penerapan
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Fuse hardening Electron aktif: `RunAsNode=Disabled`, `OnlyLoadAppFromAsar=Enabled`, `EnableEmbeddedAsarIntegrityValidation=Enabled`, `EnableCookieEncryption=Enabled`.
- Build rilis tidak membuka remote debugging (`--remote-debugging-port` dilarang di rilis).
- Content Security Policy ketat. **Dilarang** `dangerouslySetInnerHTML` dan `eval`. Semua teks dari sumber dirender sebagai teks biasa.
- Navigasi eksternal dan jendela baru diblokir.
- Seluruh permintaan jaringan (kecuali pengaliran audio langsung dari googlevideo CDN dan thumbnail album) berasal dari backend main process / bridge Python.

## 11. Rancangan Database (SQLite lokal)

Lokasi: `%APPDATA%\Musick\musick.db`. Tidak dihapus saat aplikasi dicopot (preservasi data pengguna).

### Relasi
```
artists ──< track_artists >── tracks >── albums
                                │
    ┌───────────────────────────┼───────────────────────┐
playlist_tracks >── playlists  liked_tracks  queue_items  play_history
```

### Tabel Inti M1 & M2
- **`schema_meta`**: versi migrasi skema database.
- **`settings`**: pengaturan lokal (volume, mute, kualitas audio, repeat, shuffle).
- *(Tabel `tracks`, `artists`, `albums`, `playlists`, `liked_tracks`, `queue_items`, `play_history` diimplementasikan pada M2)*.

## 12. Privasi dan Keamanan

### Pernyataan Privasi yang Jujur
Aplikasi ini tidak memiliki akun pengguna, tidak memasang iklan, dan tidak menyertakan library analitik atau telemetri pelaporan crash pihak ketiga. Tidak ada server perantara milik pembuat aplikasi.

Namun, pengguna harus memahami batasan teknis privasi berikut:
1. **Layanan Sumber Musik:** Saat mencari dan memutar lagu, aplikasi menghubungi server YouTube Music dan CDN Google (`*.googlevideo.com`). Layanan tersebut dapat melihat alamat IP pengguna, User-Agent, dan data lagu yang diminta.
2. **Pemeriksaan Pembaruan (V2):** Jika fitur pembaruan diaktifkan kelak, aplikasi hanya akan menghubungi host repositori rilis resmi pembuat untuk mencocokkan hash versi terbaru.

### Ancaman dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Installer tidak bertanda tangan memicu SmartScreen Windows | Sedang | Distribusi checksum SHA-256 lewat saluran pesan terpisah; sediakan panduan visual untuk teman |
| Pembaruan otomatis dibajak | Tinggi | Pembaruan komponen menggunakan verifikasi kriptografi tanda tangan Ed25519 |
| Injeksi skrip XSS di renderer UI | Tinggi | Isolasi konteks, CSP ketat, Larangan `dangerouslySetInnerHTML`, pembatasan skrip inline |
| Injeksi SQL | Sedang | Query berparameter wajib, tanpa penggabungan string query mentah |
| Pustaka dependensi rentan | Sedang | Penguncian versi di `package.json` dan `bridge/requirements.txt`, audit berkala |

## 13. Daftar Edge Case yang Wajib Diuji

**Pemutaran**
- Alamat stream kedaluwarsa di tengah lagu (ambil ulang otomatis dan lanjutkan dari detik terakhir).
- Internet putus saat memutar, lalu tersambung lagi.
- Komputer tidur dan bangun; perangkat audio dicabut/diganti (jeda otomatis saat headphone dicabut).
- Deteksi anti-bot YouTube tanpa cookie (`BLOCKED`).
- Lima lagu berturut-turut tidak tersedia (berhenti otomatis agar tidak loop tak berujung).
- Aksi beruntun pengguna (mengklik tombol berikutnya 10 kali secara cepat) tidak merusak state audio.

**Pencarian dan Antarmuka**
- Input kosong, spasi berulang, atau karakter non-Latin/emoji.
- Latensi jaringan tinggi (tampilkan skeleton loading).
- Cache per sesi untuk query yang berulang.

## 14. Risiko Proyek

| # | Risiko | Tingkat | Tanggapan |
|---|---|---|---|
| R1 | Sumber musik (YouTube Music) mengubah API internal atau memblokir akses | Tinggi | Isolasi modul lewat `MusicSource`; pembaruan bridge mandiri via arsip komponen |
| R2 | Deteksi bot YouTube tanpa cookie memunculkan error `BLOCKED` | Sedang | Tangani dengan error code `BLOCKED` dan tampilkan pesan ramah ke pengguna |
| R3 | Keusangan dependensi ekstraksi `yt-dlp` | Sedang | Mekanisme pembaruan bridge independen tanpa instal ulang aplikasi penuh |
| R4 | Ketergantungan pada endpoint alternatif klien yt-dlp (bila ditutup) | Sedang | Rencana cadangan: bundel runtime JS ringan (QuickJS ~1,5 MB) bila challenge solver diwajibkan |
| R5 | Kinerja di laptop RAM 4 GB belum divalidasi | Sedang | **Gerbang Pengujian M3:** wajib diuji pada laptop RAM ≤ 4 GB sebelum installer dibagikan |
| R6 | Installer tak bertanda tangan diblokir Windows SmartScreen | Rendah | Sediakan checksum SHA-256 dan panduan klik "More info -> Run anyway" |
| R7 | Pemeriksaan pembaruan komponen membutuhkan host rilis publik | Rendah | Transparan di dokumen privasi; hanya menghubungi release host publik tanpa identitas pengguna |

## 15. Rencana Rilis dan Milestone

| Milestone | Status | Lingkup Utama | Kriteria Selesai |
|---|---|---|---|
| **M0. Spike Kelayakan** | **SELESAI** | Putuskan K1 (Python embed) & K3 (Electron); buktikan search -> resolve -> play; tangkap net-log & koneksi Python; ukur memori Private WS; hardening Electron fuses. | Draf laporan M0 selesai, installer rilis 135,5 MB terverifikasi. |
| **M1. Pemutar Inti** | *Berikutnya* | UI Spotify dark theme, navigasi Beranda/Cari/Artis/Album, pemutar audio HTML5 tangguh, penanganan kedaluwarsa stream, SQLite settings & schema_meta. | Bisa mencari, membuka album/artis, memutar musik dengan kontrol penuh dan bebas crash. |
| **M2. Pustaka & Playlist** | Terencana | Liked Songs, playlist lokal, antrean, acak, ulang, pemulihan antrean, skema database lengkap. | Pembuat dapat memakai aplikasi setiap hari untuk mendengar musik lokal. |
| **M3. Pengerasan & Rilis Teman** | Terencana | Penanganan seluruh edge case, **Gerbang Pengujian Laptop RAM 4 GB**, installer final + SHA-256. | Lolos uji RAM 4 GB, installer siap dibagikan ke lingkaran teman terdekat. |
| **M4. Fitur V2** | Terencana | Beranda rekomendasi lokal, lirik (bila ada sumber), berbagi playlist JSON, pembaruan komponen bertanda tangan Ed25519. | Pembaruan aplikasi mandiri dan fitur berbagi playlist aktif. |
