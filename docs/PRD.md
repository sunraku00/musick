# PRD: Aplikasi Musik Desktop Gratis, Tanpa Iklan

| | |
|---|---|
| **Status** | Versi 1.2 (Diperbarui dengan Pemutaran Saat Layar Mati & Pengelolaan Daya) |
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
4. Ringan: nyaman di laptop spek rendah (target divalidasi bertahap, gerbang M3).
5. Sumber musik terisolasi dari aplikasi lewat satu antarmuka `MusicSource`, supaya bisa diganti tanpa menulis ulang UI atau database.

## 2. Tujuan dan Bukan Tujuan

**Tujuan**
- Teman-teman pembuat bisa mencari dan memutar musik tanpa iklan, dan senang memakainya.
- Fitur inti (cari, putar, antrean, favorit, playlist) berjalan stabil.
- Berjalan lancar di laptop RAM 4 GB (wajib divalidasi pada gerbang M3).

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
- Pembaruan komponen mandiri berbasis verifikasi tanda tangan digital

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
- Akses dibatasi (bot check) → pesan ramah kelas `BLOCKED`: "Akses dibatasi oleh sumber musik (deteksi bot/jaringan). Silakan coba beberapa saat lagi."
- Lagu tidak tersedia → lompat ke lagu berikutnya dengan pemberitahuan kecil.
- Internet putus → pesan jelas, data lokal (playlist, favorit) tetap bisa dilihat.

## 7. Daftar Halaman

| Halaman | Isi | Versi |
|---|---|---|
| Pemutar (bar bawah, selalu tampil) | Sampul, judul, artis, putar/jeda/lanjut/sebelumnya, slider posisi, volume, acak, ulang, hati, tombol Antrean | V1 |
| Sidebar kiri | Beranda, Cari, Perpustakaan, daftar playlist, "Buat playlist" | V1 |
| Beranda | "Terakhir diputar" (keadaan kosong rapi di awal), pintasan Liked Songs. V2: rekomendasi sederhana | V1/V2 |
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
- Hasil dikelompokkan Lagu, Artis, Album. Tampil dalam 3 detik pada koneksi normal; bila lebih lama, tampil indikator memuat (skeleton loader).
- Hasil kosong menampilkan "Tidak ada hasil untuk '...'". Kegagalan sumber menampilkan pesan error berbeda dari hasil kosong.
- Hasil pencarian yang sama dalam sesi yang sama dipakai ulang (cache) agar tidak membebani sumber, dengan batas LRU 50 kueri dan TTL.
- Latest-wins: respons pencarian yang datang terlambat tidak boleh menimpa kueri terbaru.
- Tombol "Coba lagi" pada pesan error tidak menghapus teks kueri pencarian.
- Teks dari sumber ditampilkan sebagai teks biasa murni (tidak pernah sebagai HTML / tanpa `dangerouslySetInnerHTML`).

### F2. Kontrol pemutar
- Putar, jeda, lanjut, sebelumnya/berikutnya, geser posisi, volume dan bisukan berfungsi. Volume dan posisi terakhir tersimpan.
- Tombol sebelumnya me-restart lagu jika sudah diputar lebih dari 3 detik; jika $\le 3$ detik, pindah ke lagu sebelumnya di antrean.
- Menggeser ke posisi melebihi durasi diperlakukan sebagai akhir lagu.
- Pemutaran berlanjut normal setelah komputer tidur lalu bangun (status dipulihkan, stream diambil ulang, tetap dalam keadaan jeda sampai ditekan putar) [simulasi].
- Penanganan perangkat audio berganti (misalnya headphone dicabut → jeda otomatis sebagai upaya terbaik) [belum diverifikasi di perangkat nyata].
- Kontrol media terintegrasi melalui Media Session API (`navigator.mediaSession`), bukan globalShortcut [lulus uji unit].
- Bila alamat stream kedaluwarsa di tengah lagu, aplikasi mengambil ulang alamat dan melanjutkan dari posisi terakhir tanpa tindakan pengguna. Bila gagal 2 kali berturut-turut, tampilkan pesan dan lompat ke lagu berikutnya; berhenti setelah 5 lompatan berturut-turut (*infinite loop guard*). Reset penghitung lompatan setelah 5 detik pemutaran sukses [lulus uji unit].
- **Pemutaran saat Layar Mati & Penanganan Daya (v1.2):**
  - Saat status pemutar aktif (`playing`), aplikasi memanggil `powerSaveBlocker.start('prevent-app-suspension')` agar Windows tidak menidurkan proses aplikasi saat batas waktu layar mati tercapai (*display timeout*) [belum diverifikasi di perangkat nyata] atau saat layar dikunci (*lock screen* Win+L) [diverifikasi manual oleh pemilik produk, 20 Nov 2026], sehingga aliran musik terus berlanjut.
  - Aplikasi secara sengaja TIDAK menggunakan jenis `prevent-display-sleep`, sehingga panel layar tetap diizinkan mati secara alami guna menghemat daya layar dan baterai [lulus uji unit].
  - Renderer dikonfigurasi dengan `backgroundThrottling: false` untuk memastikan timer internal (deteksi koneksi terhenti/stalled, transisi lagu otomatis, buffer audio) tidak tercekik saat jendela terminimalkan atau layar mati [diukur].
  - Saat jeda (*paused*), lagu selesai, error terminal, atau aplikasi ditutup, blocker dilepas secara bersih guna mencegah kebocoran daya (*resource leak*) [diukur].
  - Opsi pengaturan "Tetap putar saat layar mati" disediakan di Pengaturan (bawaan: AKTIF). Bila dinonaktifkan oleh pengguna, blocker tidak akan pernah dijalankan saat memutar lagu [diukur].
  - **Penanganan Tidur Sistem Sungguhan (Sleep / Suspend):** Event `suspend` sistem (seperti laptop ditutup saat disetel "Sleep", atau perintah Sleep eksplisit) tetap dihormati; pemutar langsung menjeda audio, menyimpan posisi, dan melepas blocker. Saat komputer terbangun (`resume`), pemutar tetap dalam keadaan jeda sampai pengguna menekan tombol putar (mencegah semburan audio mendadak di tempat umum) [simulasi].
  - **Batasan Sistem Operasi (Di Luar Kendali Aplikasi):**
    - *Sleep Manual (Start > Sleep):* Perintah tidur manual yang dipicu langsung oleh pengguna melalui Windows (Start > Power > Sleep) adalah instruksi tingkat kernel/ACPI sistem operasi. Tidak ada aplikasi di Windows yang dapat atau diizinkan mencegah tidur manual yang disengaja. Berhentinya audio saat tidur manual adalah perilaku sah sistem operasi, bukan bug [belum diverifikasi di perangkat nyata].
    - *Tutup Penutup Laptop (Lid Close):* Sepenuhnya mengikuti setelan Windows (*"Saat menutup penutup"* / *"When I close the lid"*). Bila Windows disetel ke "Sleep", sistem akan tidur dan audio terjeda; bila disetel ke "Do nothing", musik tetap mengalir dengan layar mati [belum diverifikasi di perangkat nyata].
    - *Tidur Idle Sistem (Idle Sleep):* Mencegah tidur karena idle saat musik memutar [belum diverifikasi di perangkat nyata].
    - *Pemulihan Pasca-Tidur:* Setelah tidur sistem yang disengaja, posisi trek dan antrean tetap aman di SQLite, dan musik dapat dilanjutkan seketika dengan 1 tekanan tombol putar dari detik terakhir [simulasi].
  - **Risiko yang Diketahui & Mitigasi Pengguna:**
    - *Risiko Laptop di Dalam Tas:* Jika pengguna menyetel aksi penutup laptop Windows ke "Do nothing" atau membiarkan laptop hidup memutar musik lalu memasukkannya ke dalam tas tertutup, pemutaran audio dan koneksi Wi-Fi akan terus berjalan. Hal ini berisiko menyebabkan penumpukan panas di dalam tas dan menguras baterai. *Rekomendasi:* Pengguna disarankan memastikan setelan Windows "Saat menutup penutup" adalah "Sleep", atau menekan jeda sebelum menyimpan laptop ke dalam tas.
    - *Konsumsi Baterai:* Pemutaran audio di latar belakang dengan layar mati mengonsumsi daya CPU rendah (~1-3% CPU) dan modul Wi-Fi untuk streaming buffer audio CDN.

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
- Installer Windows (.exe) NSIS dibagikan bersama **checksum SHA-256** lewat saluran terpisah dari berkas.
- Aplikasi menampilkan nomor versi di Pengaturan > Tentang.
- V1: pembaruan manual (data pengguna tetap aman di `%APPDATA%\Musick`, bukan di folder instalasi).
- V2: pemeriksaan pembaruan opsional dan terlihat; pembaruan komponen bridge mandiri (arsip zip bertanda tangan Ed25519) langsung dari host rilis resmi tanpa mengunduh ulang installer Electron utuh.

## 9. Persyaratan Nonfungsional

Angka target di bawah menggunakan metrik **Private Working Set (PWS)** sebagai ukuran utama alokasi RAM fisik eksklusif.

### Ambang Batas Memori Tiga Tingkat (Target RAM 4 GB):
1. **Tingkat 1 (Ideal / Nyaman):** $\le 150\text{ MB}$ Private WS saat aplikasi terbuka diam (kondisi cold start tanpa bridge Python).
2. **Tingkat 2 (Batas Wajar):** $\le 200\text{ MB}$ Private WS saat bridge Python aktif diam atau saat pemutaran musik normal berlangsung.
3. **Tingkat 3 (Batas Keras / Ambang Peringatan):** $\le 250\text{ MB}$ Private WS sebagai batas atas mutlak agar terhindar dari swap/paging pada laptop RAM 4 GB.

| Aspek | Target PRD v1.2 | Angka Nyata Terukur Hasil Pasang (v0.1.3) | Angka Pembanding M0 (Terkoreksi) | Status / Catatan |
|---|---|---|---|---|
| Sistem operasi | Windows 10 dan 11, 64-bit | Windows 11 Build 26340 x64 | Windows 11 Build 26340 x64 | Terverifikasi |
| Memori Kondisi A (Tanpa Bridge) | Tingkat 1: $\le 150\text{ MB}$ | **147,39 MB** Private WS | **147,39 MB** Private WS | Diukur [diukur] |
| Memori Kondisi B (Bridge Diam) | Tingkat 2: $\le 200\text{ MB}$ | **176,33 MB** Private WS | **176,33 MB** Private WS | Diukur [diukur] |
| Memori Kondisi C (Memutar Aktif) | Tingkat 2: $\le 200\text{ MB}$ | **200,11 MB** Private WS (puncak awal) | **200,11 MB** Private WS | Diukur [diukur] |
| Waktu buka (Cold start) | $\le 3$ detik | **59,9 ms** (jendela tampil) / **630,9 ms** (siap dipakai) | 1,09 detik | Diukur [diukur] |
| CPU (Memutar Normal) | $\le 5\%$ rata-rata | **0,11%** rata-rata | 0,11% rata-rata | Diukur [diukur] |
| CPU (Layar Mati / Tersembunyi) | $\le 2\%$ rata-rata | **0,00%** rata-rata (dampak backgroundThrottling 0,00%) | N/A | Diukur [diukur] |
| Ukuran installer | $\le 150\text{ MB}$ | **135,52 MB** (142.108.541 byte) | 135,51 MB | Terverifikasi [diukur] |
| Ukuran di disk | Sekitar 420 MB | **427,3 MB** (2.760 berkas) | 427,3 MB | Terverifikasi [diukur] |
| Validasi RAM 4 GB | Nyaman di laptop RAM 4 GB | Menunggu pengujian langsung di M3 | Menunggu pengujian di M3 | **Belum divalidasi** (Gerbang M3) |
| Stabilitas | Nol crash dalam 8 jam | Uji 10 menit background: 0 error, orphan cleanup 100% | Uji 5 menit: 0 error | Diuji bertahap [diukur] |
| Bahasa | Bahasa Indonesia | Terpusat di `src/shared/i18n/id.ts` | Terpusat di `src/shared/i18n/id.ts` | Terverifikasi |

## 10. Arsitektur dan Keputusan Teknis

```
┌──────────────────────── Aplikasi desktop (Windows) ───────────────────────┐
│  UI React (Renderer Process, skema app://musick/)                          │
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
| **K4** | **Pustaka database** | **DALAM EVALUASI** | SQLite lokal via modul bawaan **`node:sqlite`** (dibungkus antarmuka repositori tipis, mode WAL, PRAGMA foreign_keys=ON, query berparameter, integrity check). |
| **K5** | **Lisensi aplikasi** | **TERBUKA** | Menunggu keputusan pemilik produk (open source vs tertutup). |
| **K6** | **Sumber lirik** | **TERBUKA** | Ditunda ke V2. |

### Pedoman Keamanan Penerapan
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Fuse hardening Electron aktif: `RunAsNode=Disabled`, `OnlyLoadAppFromAsar=Enabled`, `EnableEmbeddedAsarIntegrityValidation=Enabled`, `EnableCookieEncryption=Enabled`, `GrantFileProtocolExtraPrivileges=Disabled`.
- Pemuatan aset renderer menggunakan protokol kustom `app://musick/` dengan penjaga keamanan anti path traversal.
- Build rilis dipastikan menolak remote debugging (`--remote-debugging-port`).
- Content Security Policy ketat. **Dilarang** `dangerouslySetInnerHTML` dan `eval`. Semua teks dari sumber dirender sebagai teks biasa murni.
- Navigasi eksternal dan jendela baru diblokir total.
- Seluruh permintaan jaringan (kecuali pengaliran audio langsung dari googlevideo CDN dan thumbnail album) berasal dari backend main process / bridge Python.

## 11. Rancangan Database (SQLite lokal)

Lokasi: folder data pengguna (`%APPDATA%\Musick\musick.db`), bukan folder instalasi, agar pembaruan tidak menghapus data.

### Relasi

```
artists ──< track_artists >── tracks >── albums
                               │
   ┌───────────────────────────┼───────────────────────┐
playlist_tracks >── playlists  liked_tracks  queue_items  play_history
```

### Tabel

**`schema_meta`** (untuk pelacakan migrasi)

| Kolom | Tipe | Keterangan |
|---|---|---|
| key | TEXT PK | Mis. `schema_version` |
| value | TEXT | Nilai konfigurasi / versi skema |

Dipakai untuk migrasi terurut saat aplikasi diperbarui. Sebelum migrasi, database dicadangkan otomatis.

**`tracks`**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | Primary Key internal |
| source | TEXT NOT NULL | Mis. `ytmusic` |
| source_id | TEXT NOT NULL | `UNIQUE(source, source_id)` |
| title | TEXT NOT NULL | Judul trek |
| album_id | INTEGER FK → albums | Boleh kosong, `ON DELETE SET NULL` |
| duration_sec | INTEGER | Durasi dalam detik |
| cover_url | TEXT | URL gambar sampul |
| is_available | INTEGER (0/1) | Default 1; diset 0 bila sumber melaporkan tidak tersedia |
| last_checked_at | DATETIME | Kapan terakhir dicek ketersediaannya |
| created_at | DATETIME | Waktu simpan |

**`artists`**: `id` PK; `source`, `source_id` (`UNIQUE` bersama); `name` NOT NULL; `image_url`.

**`albums`**: `id` PK; `source`, `source_id` (`UNIQUE` bersama); `title` NOT NULL; `artist_id` FK → artists; `year`; `cover_url`.

**`track_artists`**: `track_id` FK, `artist_id` FK, `position`. PK gabungan `(track_id, artist_id)`. `ON DELETE CASCADE`.

**`playlists`**: `id` PK; `name` NOT NULL (maks 100); `description` (maks 300); `created_at`; `updated_at`.

**`playlist_tracks`**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | Pengganti PK gabungan agar lagu yang sama boleh muncul dua kali |
| playlist_id | INTEGER FK → playlists | `ON DELETE CASCADE` |
| track_id | INTEGER FK → tracks | `ON DELETE RESTRICT` (lagu di playlist tidak ikut terhapus saat bersih-bersih cache) |
| position | INTEGER NOT NULL | Urutan urutan di playlist |
| added_at | DATETIME | Waktu ditambahkan |

Indeks: `(playlist_id, position)`.

**`liked_tracks`**: `track_id` PK FK → tracks; `liked_at`. Indeks pada `liked_at`.

**`queue_items`**: `id` PK; `track_id` FK; `position`; `original_position`. Antrean hanya satu (aplikasi menyimpan satu antrean aktif). Indeks `position`.

**`play_history`**: `id` PK; `track_id` FK; `played_at`. Dibatasi otomatis (misalnya 500 entri terakhir) agar tidak membengkak dan untuk meminimalkan data yang tersimpan.

**`search_history`**: `id` PK; `query`; `searched_at`. Dibatasi 50 entri terakhir.

**`settings`**: `key` PK; `value`. Contoh kunci: `volume`, `shuffle`, `repeat_mode`, `theme`, `audio_quality`, `queue_current_id`, `last_position_sec`, `update_check_enabled`.

### Aturan Data
- Hanya **metadata** yang disimpan. Tidak ada file audio yang disimpan ke disk.
- Tombol "Hapus riwayat" menghapus `play_history` dan `search_history` secara permanen.
- "Cadangkan data" mengekspor playlist dan favorit ke satu file; "Pulihkan" mengimpornya dengan validasi yang sama seperti impor playlist.
- Penulisan ke database memakai transaksi (reorder playlist atau antrean tidak boleh setengah jadi).
- Saat dibuka, aplikasi menjalankan `PRAGMA integrity_check`. Bila rusak, tawarkan memulihkan dari cadangan otomatis terakhir.
- Aplikasi hanya boleh berjalan **satu instans** (single-instance lock) agar dua proses tidak menulis ke database yang sama secara konkuren.
- Disk penuh atau gagal menulis: tampilkan pesan ramah, jangan crash, dan jangan merusak data yang sudah ada.

## 12. Privasi dan Keamanan

### Pernyataan Privasi yang Jujur
Aplikasi ini tidak memiliki akun pengguna, tidak memasang iklan, dan tidak menyertakan library analitik atau telemetri pelaporan crash pihak ketiga. Tidak ada server perantara milik pembuat aplikasi.

Namun, pengguna harus memahami batasan teknis privasi berikut:
1. **Layanan Sumber Musik:** Saat mencari dan memutar lagu, aplikasi menghubungi server YouTube Music dan CDN Google (`*.googlevideo.com`). Layanan tersebut dapat melihat alamat IP pengguna, User-Agent, dan data lagu yang diminta.
2. **Pemeriksaan Pembaruan (V2):** Jika fitur pembaruan diaktifkan kelak, aplikasi hanya akan menghubungi host repositori rilis resmi pembuat untuk mencocokkan hash versi terbaru.

### Ancaman dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Installer palsu atau terselip malware (tidak ditandatangani, dibagikan lewat chat) | Tinggi | Checksum SHA-256 lewat saluran terpisah; pertimbangkan tanda tangan kode kelak; jelaskan ke teman soal peringatan SmartScreen dan cara memverifikasi |
| Pembaruan otomatis dibajak | Tinggi | V1 tanpa pembaruan otomatis; V2 hanya HTTPS dari satu alamat, verifikasi tanda tangan digital Ed25519, bisa dimatikan |
| Impor file/kode playlist berbahaya (XSS, file raksasa, JSON aneh) | Sedang | Validasi skema, batas ukuran dan jumlah, teks dirender sebagai teks, pratinjau + konfirmasi |
| Injeksi SQL | Sedang | Query berparameter wajib, tanpa penggabungan string query mentah |
| Eksekusi kode lewat UI (XSS di Electron) | Tinggi | Isolasi konteks, CSP ketat, tanpa `dangerouslySetInnerHTML`, tanpa akses Node di UI, skema `app://` terproteksi |
| Data riwayat terbaca orang lain di komputer yang sama | Rendah–sedang | Batas jumlah riwayat, tombol hapus; database tidak dienkripsi (diterima, dicatat) |
| Gambar sampul dari server pihak ketiga membocorkan IP | Rendah | Diakui di pernyataan privasi; opsi menyimpan sampul di cache lokal |
| Berkas log berisi data pribadi | Rendah | Log lokal, tanpa kata pencarian default, tanpa judul lagu default, bisa dihapus |
| Pustaka dependensi rentan | Sedang | Penguncian versi di `package.json` dan `bridge/requirements.txt`, audit berkala |

## 13. Daftar Edge Case yang Wajib Diuji

**Pemutaran**
- Alamat stream kedaluwarsa di tengah lagu (ambil ulang otomatis dan lanjutkan dari posisi detik terakhir).
- Internet putus saat memutar, lalu tersambung lagi.
- Komputer tidur dan bangun; perangkat audio dicabut/diganti (jeda otomatis saat headphone dicabut, tetap jeda saat bangun tidur).
- Lagu diblokir wilayah, dihapus dari sumber, atau durasi nol/tidak diketahui.
- Lima lagu berturut-turut tidak tersedia (berhenti otomatis dengan pesan loop guard).
- Dua tindakan cepat berurutan (klik "berikutnya" 10 kali dengan cepat) tidak merusak status pemutar.

**Antrean**
- Menghapus lagu yang sedang diputar; menghapus semua; antrean satu lagu dengan ulang semua.
- Menyalakan lalu mematikan acak berulang kali.
- Aplikasi ditutup paksa saat memutar, lalu dibuka lagi.

**Playlist dan Data**
- Playlist 1.000+ lagu; duplikat lagu; nama playlist kosong, panjang, atau berisi emoji.
- Menghapus playlist yang berisi lagu yang juga difavoritkan.
- Database rusak; disk penuh; dua instans aplikasi dibuka bersamaan.
- Impor file kosong, rusak, terlalu besar, berisi skrip, atau dari versi format yang lebih baru.

**Pencarian dan Tampilan**
- Kata pencarian kosong, sangat panjang, karakter khusus, dan non-Latin/emoji.
- Sumber mengubah format respons (`SOURCE_CHANGED`) → pesan jelas, aplikasi tidak crash.
- Layar kecil (1366×768) dan skala tampilan Windows 125%/150%.
- Kueri lambat tiba setelah kueri cepat (latest-wins).

## 14. Risiko Proyek

| # | Risiko | Tingkat | Tanggapan |
|---|---|---|---|
| R1 | **Sumber musik (ytmusicapi/YouTube) melanggar ketentuan layanan YouTube, rapuh, dan bisa berhenti bekerja kapan saja; ada kemungkinan somasi dari pemegang hak cipta** | **Sangat tinggi** | Keputusan sadar pemilik produk. Mitigasi: lapisan `MusicSource`, distribusi terbatas ke lingkaran teman, tidak dipublikasikan luas, rencana pindah ke sumber legal kelak |
| R2 | Unduh offline memperbesar risiko hukum karena menyalin audio | Tinggi | Ditunda; hanya dipertimbangkan bila sumbernya berlisensi bebas |
| R3 | Target "ringan" tidak tercapai karena pembungkus dan runtime tambahan | Sedang | Spike K1/K3 selesai; divalidasi bertahap pada gerbang M3 |
| R4 | Proyek tanpa tenggat macet di tengah jalan | Sedang | Milestone kecil (bagian 15) dengan hasil yang bisa dicoba |
| R5 | Installer tidak ditandatangani memicu peringatan SmartScreen | Sedang | Checksum SHA-256, panduan singkat untuk teman, tanda tangan kode bila proyek membesar |
| R6 | Pemblokiran massal oleh sumber bila banyak pengguna | Sedang | Cache hasil, batasi permintaan, distribusi tetap kecil |
| R7 | Beban pemeliharaan menanggung perubahan sumber seorang diri | Sedang | Contract test otomatis, adaptor terisolasi |
| R8 | Deteksi bot YouTube tanpa cookie memunculkan error `BLOCKED` | Sedang | Tangani dengan error code `BLOCKED` dan tampilkan pesan ramah ke pengguna |
| R9 | Keusangan dependensi ekstraksi `yt-dlp` | Sedang | Desain pembaruan bridge mandiri via rilis GitHub tanpa unduh ulang Electron |
| R10 | Ketergantungan pada endpoint alternatif klien yt-dlp (bila ditutup) | Sedang | Rencana cadangan: bundel runtime JS ringan (QuickJS ~1,5 MB) bila challenge solver diwajibkan |
| R11 | Kinerja di laptop RAM 4 GB belum divalidasi | Sedang | **Gerbang Pengujian M3:** wajib diuji pada laptop RAM ≤ 4 GB sebelum installer dibagikan |
| R12 | Pemeriksaan pembaruan komponen membutuhkan host rilis publik | Rendah | Transparan di dokumen privasi; hanya menghubungi release host publik tanpa identitas pengguna |

## 15. Rencana Rilis dan Milestone

| Milestone | Status | Lingkup Utama | Hasil yang Bisa Dicoba |
|---|---|---|---|
| **M0. Spike Kelayakan** | **SELESAI** | Putuskan K1 (Python embed) & K3 (Electron); buktikan search → resolve → play; tangkap net-log & koneksi Python; ukur memori Private WS; hardening Electron fuses. | Prototipe mandiri memutar satu lagu, angka ukur nyata, installer 135,5 MB. |
| **M1. Pemutar Inti** | *Sedang Berjalan* | UI Spotify dark theme, navigasi Beranda/Cari/Artis/Album, pemutar audio HTML5 tangguh, penanganan kedaluwarsa stream, SQLite settings & schema_meta. | Bisa mencari, membuka album/artis, memutar musik dengan kontrol penuh dan bebas crash. |
| **M2. Pustaka & Playlist** | Terencana | Liked Songs, playlist lokal, antrean, acak, ulang, pemulihan antrean, skema database lengkap. | Pembuat dapat memakai aplikasi setiap hari untuk mendengar musik lokal. |
| **M3. Pengerasan & Rilis Teman** | Terencana | Penanganan seluruh edge case, **Gerbang Pengujian Laptop RAM 4 GB**, installer final + SHA-256. | Lolos uji RAM 4 GB, installer siap dibagikan ke lingkaran teman terdekat. |
| **M4. Fitur V2** | Terencana | Beranda rekomendasi lokal, lirik (bila ada sumber), berbagi playlist JSON, pembaruan komponen bertanda tangan Ed25519. | Pembaruan aplikasi mandiri dan fitur berbagi playlist aktif. |
| **Evaluasi V3** | Terencana | Putuskan ulang soal unduh offline dan sumber musik jangka panjang. | Keputusan tertulis. |

## 16. Ukuran Keberhasilan

- **Utama:** teman-teman menyatakan senang memakai aplikasi (ditanyakan langsung, tanpa pelacakan apa pun).
- **Kualitas:** tidak ada bug yang mengganggu fitur inti. Definisi: aplikasi tidak crash, lagu yang tersedia selalu bisa dicari dan diputar, playlist dan favorit tidak hilang. Bug kecil pada tampilan boleh ada dan diperbaiki bertahap.
- **Kinerja:** memenuhi target bagian 9 di laptop uji RAM 4 GB (divalidasi di M3).
- **Privasi:** pemeriksaan pra-rilis membuktikan tidak ada koneksi jaringan selain ke sumber musik (dan alamat pembaruan bila diaktifkan).

## 17. Hasil Review Kritis (ringkasan perbaikan dari draf sebelumnya)

| # | Temuan | Perbaikan di dokumen ini |
|---|---|---|
| 1 | ytmusicapi berbasis Python dan hanya memberi metadata, bukan audio; ini mengancam target "ringan" dan menambah komponen rapuh | Dicatat sebagai keputusan terbuka K1 dan K2, dengan spike M0 sebelum membangun (K1 diputuskan: Python 3.12.8 embed stdio JSON-RPC) |
| 2 | Janji "tanpa pelacakan sama sekali" tidak akurat karena sumber musik tetap melihat IP | Pernyataan privasi diganti dengan versi yang jujur (bagian 12) |
| 3 | Installer dibagikan lewat chat tanpa tanda tangan: risiko malware dan peringatan Windows | Checksum SHA-256, panduan verifikasi, pembaruan otomatis ditunda |
| 4 | Impor playlist adalah input tak tepercaya | Validasi skema, batas ukuran, render teks, pratinjau (F6) |
| 5 | PK gabungan `playlist_tracks` melarang lagu duplikat | Ditambah kolom `id` PK |
| 6 | Tidak ada penanganan lagu yang hilang dari sumber | Kolom `is_available` dan `last_checked_at`, perilaku lompat dengan batas 5 |
| 7 | Tidak ada rencana migrasi, korupsi data, atau instans ganda | `schema_meta`, cadangan otomatis, `integrity_check`, single-instance lock |
| 8 | "Ringan" tidak terukur | Target angka awal (bagian 9) yang divalidasi bertahap menggunakan Private Working Set |
| 9 | Alamat stream kedaluwarsa tidak dibahas | Persyaratan ambil ulang otomatis dan lanjutkan dari posisi terakhir (F2) |
| 10 | Pengguna dengan kuota terbatas tidak dipertimbangkan | Kualitas audio dapat diatur, default hemat, perkiraan data dihitung dari bitrate |
| 11 | Dukungan Windows lama ambigu | Ditetapkan Windows 10/11 64-bit |
| 12 | Riwayat putar/cari bisa membengkak dan menyimpan data berlebihan | Batas entri dan tombol hapus |
| 13 | "Selengkap Spotify" terlalu luas | Dipecah ke V1/V2/V3 dan daftar "Bukan tujuan" |
| 14 | Lirik berhak cipta, sumber belum jelas | Keputusan K6, fitur ditunda sampai sumber jelas |
| 15 | Beranda tidak konsisten (V1 vs V2) | V1: "Terakhir diputar" + pintasan; V2: rekomendasi |

## 18. Pertanyaan yang Masih Perlu Dijawab Pemilik Produk

1. Mana yang dipilih untuk K1 (cara menjalankan ytmusicapi) dan K3 (Electron atau Tauri) setelah spike M0? $\rightarrow$ **Terjawab di M0:** K1 = Python embeddable stdio JSON-RPC, K3 = Electron untuk V1.
2. Apakah kode aplikasi akan dibuka (open source)?
3. Berapa batas wajar jumlah teman pada tahap awal, agar risiko R1 dan R6 tetap kecil?
4. Siapa yang akan menguji di laptop RAM 4 GB, dan apakah ada laptop uji yang bisa dipakai? $\rightarrow$ **Terjawab di M0:** Pemilik produk menguji di laptop RAM 4 GB miliknya pada Gerbang M3.
5. Sumber lirik apa yang akan dipakai, atau fitur lirik ditunda?
