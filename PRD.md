# PRD: Aplikasi Musik Desktop Gratis, Tanpa Iklan

| | |
|---|---|
| **Status** | Draf 1.0 (sudah melalui review kritis) |
| **Tanggal** | 19 November 2026 |
| **Pemilik produk** | Pembuat aplikasi (dibantu agen AI) |
| **Platform awal** | Windows 10/11 64-bit, dibagikan sebagai installer |
| **Catatan** | Dokumen ini bukan nasihat hukum. Bagian risiko hukum perlu dikonsultasikan ke ahli hukum bila aplikasi akan disebarkan lebih luas. |

---

## 1. Ringkasan

Aplikasi pemutar musik desktop bergaya Spotify yang **gratis penuh, tanpa iklan, tanpa langganan, dan tanpa telemetri**. Dibuat nirlaba untuk dibagikan, tahap awal ke lingkaran teman. Semua data pengguna tersimpan lokal di komputer masing-masing. Tidak ada akun dan tidak ada server milik pembuat.

**Prinsip inti (tidak boleh dilanggar tanpa keputusan eksplisit):**

1. Tanpa iklan, tanpa langganan, tanpa paywall.
2. Tanpa akun dan tanpa server milik pembuat.
3. Tanpa telemetri, analitik, atau pelaporan crash otomatis.
4. Ringan: nyaman di laptop spek rendah.
5. Sumber musik terisolasi dari aplikasi, supaya bisa diganti tanpa menulis ulang.

## 2. Tujuan dan Bukan Tujuan

**Tujuan**
- Teman-teman pembuat bisa mencari dan memutar musik tanpa iklan, dan senang memakainya.
- Fitur inti (cari, putar, antrean, favorit, playlist) berjalan stabil.
- Berjalan lancar di laptop RAM 4 GB.

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
| 5 | V1 | Sebagai pendengar, saya ingin aplikasi yang ringan, tanpa iklan, dan tanpa pelacakan, supaya saya mendengarkan dengan nyaman dan privasi saya terjaga. |
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

Ringan, tanpa iklan, dan tanpa pelacakan adalah **syarat kualitas** untuk semua fitur, bukan fitur tersendiri.

### Bagus kalau ada (V2)
- Beranda dan rekomendasi sederhana (berdasarkan lagu yang sering diputar)
- Lirik
- Berbagi playlist lewat file atau kode
- Pembaruan aplikasi yang lebih mudah

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
- Lagu tidak tersedia → lompat ke lagu berikutnya dengan pemberitahuan kecil.
- Internet putus → pesan jelas, data lokal (playlist, favorit) tetap bisa dilihat.

## 7. Daftar Halaman

| Halaman | Isi | Versi |
|---|---|---|
| Pemutar (bar bawah, selalu tampil) | Sampul, judul, artis, putar/jeda/lanjut/sebelumnya, slider posisi, volume, acak, ulang, hati, tombol Antrean | V1 |
| Sidebar kiri | Beranda, Cari, Perpustakaan, daftar playlist, "Buat playlist" | V1 |
| Beranda | "Terakhir diputar", pintasan Liked Songs. V2: rekomendasi sederhana | V1/V2 |
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
- Bila alamat stream kedaluwarsa di tengah lagu, aplikasi mengambil ulang alamat dan melanjutkan dari posisi terakhir tanpa tindakan pengguna. Bila gagal 2 kali berturut-turut, tampilkan pesan dan lompat ke lagu berikutnya.

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
- Ada pengujian kontrak (contract test) otomatis yang bisa dijalankan pembuat untuk mengecek apakah sumber masih bekerja setelah ada perubahan.
- Ada satu adaptor tiruan (mock) untuk pengembangan dan pengujian tanpa internet.

### F6. Berbagi playlist (V2)
- Format ekspor: JSON berversi (`format_version`) berisi nama, deskripsi, dan daftar `source` + `source_id` + judul + artis. **Tidak berisi data pribadi apa pun.**
- Impor memvalidasi skema, membatasi ukuran file (maks 1 MB) dan jumlah lagu (maks 2.000), membuang karakter kontrol, menampilkan pratinjau, dan baru menyimpan setelah konfirmasi.
- Lagu dari sumber yang tidak dikenali aplikasi ditampilkan sebagai tidak tersedia, dan pengguna diberi tahu jumlahnya.
- File atau kode rusak menghasilkan pesan "File tidak valid", tidak pernah crash.

### F7. Distribusi dan pembaruan
- Installer Windows (.exe/.msi) dibagikan bersama **checksum SHA-256** yang dicantumkan pembuat lewat saluran terpisah dari berkas (misalnya di pesan, bukan di dalam zip).
- Aplikasi menampilkan nomor versi di Pengaturan > Tentang.
- V1: pembaruan manual (pembuat mengirim installer baru; data pengguna tetap ada karena disimpan di folder data pengguna, bukan folder instalasi).
- V2: pemeriksaan pembaruan **opsional dan terlihat** (pengguna bisa mematikan), hanya mengunduh dari satu alamat tetap lewat HTTPS dan memverifikasi tanda tangan/checksum sebelum memasang.

## 9. Persyaratan Nonfungsional

Angka di bawah adalah **target awal** yang harus divalidasi pada satu laptop uji RAM 4 GB, bukan janji.

| Aspek | Target |
|---|---|
| Sistem operasi | Windows 10 dan 11, 64-bit (versi lebih lama tidak didukung) |
| Memori | ≤ 250 MB saat memutar musik, ≤ 150 MB saat diam (tidak memutar) |
| Waktu buka | ≤ 5 detik sampai bisa dipakai (cold start) |
| CPU | ≤ 10% rata-rata saat memutar di laptop uji |
| Ukuran installer | ≤ 100 MB (sasaran, bergantung pilihan pembungkus) |
| Data internet | Kualitas audio bisa diatur; default hemat. Tampilkan perkiraan pemakaian data per jam di Pengaturan, karena kuota pengguna bisa terbatas |
| Stabilitas | Nol crash dalam 8 jam pemutaran terus-menerus pada uji pra-rilis |
| Bahasa | Antarmuka berbahasa Indonesia, struktur teks siap diterjemahkan |
| Aksesibilitas | Dapat dioperasikan penuh dengan keyboard, kontras teks memadai |
| Teks | Mendukung Unicode penuh (judul berbahasa Jepang/Korea/Arab, emoji, judul sangat panjang dipotong dengan elipsis) |

## 10. Arsitektur dan Keputusan Teknis

```
┌──────────────────────── Aplikasi desktop (Windows) ───────────────────────┐
│  UI React                                                                  │
│    │  (IPC terbatas: hanya perintah yang diizinkan)                        │
│  Lapisan inti: pemutar, antrean, pustaka                                   │
│    │                         │                                             │
│  Database SQLite lokal    Antarmuka MusicSource                            │
│                              │                                             │
│                       Adaptor sumber (ytmusicapi / pengganti kelak)        │
└────────────────────────────────────────────────────────────────────────────┘
                               │  HTTPS
                          Sumber musik
```

### Keputusan yang masih terbuka (harus diputuskan sebelum menulis kode)

| # | Keputusan | Pilihan | Catatan |
|---|---|---|---|
| K1 | **Cara menjalankan ytmusicapi** | (a) Python di proses terpisah yang dibundel; (b) pustaka JavaScript sejenis; (c) layanan lokal kecil | **Temuan review:** ytmusicapi adalah pustaka **Python**, sedangkan UI memakai React. Membundel Python menambah ukuran dan memori, dan bisa bertentangan dengan target "ringan". Perlu spike 1–2 hari untuk membandingkan. |
| K2 | **Cara mendapatkan audio** | Harus ada komponen pengurai alamat stream terpisah | **Temuan review:** ytmusicapi hanya memberi metadata, bukan audio. Komponen ini yang paling rapuh dan paling berisiko hukum, dan alamat stream bisa kedaluwarsa. Wajib berada di balik `MusicSource.resolveStream`. |
| K3 | **Pembungkus desktop** | Electron vs Tauri | Tauri umumnya lebih hemat memori dan ukuran, tapi bergantung WebView2 dan ekosistem Rust. Electron lebih mudah bagi agen AI. Putuskan setelah mengukur di laptop uji. |
| K4 | **Pustaka database** | SQLite (better-sqlite3 atau setara) | Gunakan query berparameter, `PRAGMA foreign_keys = ON`, mode WAL. |
| K5 | **Lisensi aplikasi** | Open source (MIT/GPL) atau tertutup | Berpengaruh pada kepercayaan pengguna soal "tanpa pelacakan": kode terbuka membuat janji itu bisa diperiksa. |
| K6 | **Sumber lirik** | Belum ditentukan | Lirik juga berhak cipta. Perlu sumber berlisensi atau ditunda. |

### Pedoman keamanan penerapan
- Proses UI **tidak boleh** punya akses langsung ke sistem file atau Node (Electron: `contextIsolation: true`, `nodeIntegration: false`, sandbox aktif; Tauri: izin minimal).
- Content Security Policy ketat. **Dilarang** `dangerouslySetInnerHTML` dan `eval`. Semua teks dari sumber dan dari file impor dirender sebagai teks.
- Tidak memuat skrip dari internet saat berjalan. Semua kode dikemas di dalam aplikasi.
- Navigasi eksternal dan jendela baru diblokir kecuali tautan yang disetujui, dibuka di peramban bawaan sistem.
- Seluruh permintaan jaringan berasal dari modul sumber musik di sisi inti, bukan dari UI.
- Dependensi dikunci (lockfile), diaudit berkala (`npm audit`), dan diperbarui secara sengaja.
- Log disimpan lokal, tidak berisi kata pencarian atau nama lagu secara default, dan bisa dihapus.

## 11. Rancangan Database (SQLite lokal)

Lokasi: folder data pengguna (`%APPDATA%\<NamaAplikasi>\`), bukan folder instalasi, agar pembaruan tidak menghapus data.

### Relasi

```
artists ──< track_artists >── tracks >── albums
                               │
   ┌───────────────────────────┼───────────────────────┐
playlist_tracks >── playlists  liked_tracks  queue_items  play_history
```

### Tabel

**`schema_meta`** (baru, hasil review)

| Kolom | Tipe | Keterangan |
|---|---|---|
| key | TEXT PK | Mis. `schema_version` |
| value | TEXT | |

Dipakai untuk migrasi terurut saat aplikasi diperbarui. Sebelum migrasi, database dicadangkan otomatis.

**`tracks`**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | |
| source | TEXT NOT NULL | Mis. `ytmusic` |
| source_id | TEXT NOT NULL | `UNIQUE(source, source_id)` |
| title | TEXT NOT NULL | |
| album_id | INTEGER FK → albums | Boleh kosong, `ON DELETE SET NULL` |
| duration_sec | INTEGER | |
| cover_url | TEXT | |
| is_available | INTEGER (0/1) | **Baru.** Default 1; diset 0 bila sumber melaporkan tidak tersedia |
| last_checked_at | DATETIME | **Baru.** Kapan terakhir dicek ketersediaannya |
| created_at | DATETIME | |

**`artists`**: `id` PK; `source`, `source_id` (`UNIQUE` bersama); `name` NOT NULL; `image_url`.

**`albums`**: `id` PK; `source`, `source_id` (`UNIQUE` bersama); `title` NOT NULL; `artist_id` FK → artists; `year`; `cover_url`.

**`track_artists`**: `track_id` FK, `artist_id` FK, `position`. PK gabungan `(track_id, artist_id)`. `ON DELETE CASCADE`.

**`playlists`**: `id` PK; `name` NOT NULL (maks 100); `description` (maks 300); `created_at`; `updated_at`.

**`playlist_tracks`** (diperbaiki)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | **Baru.** Pengganti PK gabungan agar lagu yang sama boleh muncul dua kali |
| playlist_id | INTEGER FK → playlists | `ON DELETE CASCADE` |
| track_id | INTEGER FK → tracks | `ON DELETE RESTRICT` (lagu di playlist tidak ikut terhapus saat bersih-bersih cache) |
| position | INTEGER NOT NULL | Urutan |
| added_at | DATETIME | |

Indeks: `(playlist_id, position)`.

**`liked_tracks`**: `track_id` PK FK → tracks; `liked_at`. Indeks pada `liked_at`.

**`queue_items`**: `id` PK; `track_id` FK; `position`; `original_position`. Antrean hanya satu (aplikasi menyimpan satu antrean aktif). Indeks `position`.

**`play_history`**: `id` PK; `track_id` FK; `played_at`. Dibatasi otomatis (misalnya 500 entri terakhir) agar tidak membengkak dan untuk meminimalkan data yang tersimpan.

**`search_history`**: `id` PK; `query`; `searched_at`. Dibatasi 50 entri terakhir.

**`settings`**: `key` PK; `value`. Contoh kunci: `volume`, `shuffle`, `repeat_mode`, `theme`, `audio_quality`, `queue_current_id`, `last_position_sec`, `update_check_enabled`.

### Aturan data (hasil review)
- Hanya **metadata** yang disimpan. Tidak ada file audio.
- Tombol "Hapus riwayat" menghapus `play_history` dan `search_history` secara permanen.
- "Cadangkan data" mengekspor playlist dan favorit ke satu file; "Pulihkan" mengimpornya dengan validasi yang sama seperti impor playlist.
- Penulisan ke database memakai transaksi (reorder playlist atau antrean tidak boleh setengah jadi).
- Saat dibuka, aplikasi menjalankan `PRAGMA integrity_check`. Bila rusak, tawarkan memulihkan dari cadangan otomatis terakhir.
- Aplikasi hanya boleh berjalan **satu instans** (single-instance lock) agar dua proses tidak menulis ke database yang sama.
- Disk penuh atau gagal menulis: tampilkan pesan, jangan crash, jangan kehilangan data yang sudah ada.

## 12. Privasi dan Keamanan

### Pernyataan privasi yang jujur (diperbaiki)

Janji awal "tidak ada pelacakan sama sekali" terlalu luas. Aplikasi ini memang tidak mengirim data apa pun ke pembuat, tetapi **permintaan ke sumber musik tetap terlihat oleh sumber itu** (alamat IP, jenis aplikasi, lagu yang diminta). Karena itu pernyataan resmi di Pengaturan > Tentang berbunyi:

> Aplikasi ini tidak punya iklan, akun, analitik, atau pelaporan crash. Tidak ada data yang dikirim ke pembuat. Playlist, favorit, dan riwayat hanya tersimpan di komputer kamu. Perlu diketahui: saat mencari dan memutar lagu, aplikasi menghubungi layanan sumber musik, sehingga layanan itu dapat melihat alamat IP dan permintaanmu.

### Ancaman dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Installer palsu atau terselip malware (tidak ditandatangani, dibagikan lewat chat) | Tinggi | Checksum SHA-256 lewat saluran terpisah; pertimbangkan tanda tangan kode kelak; jelaskan ke teman soal peringatan SmartScreen dan cara memverifikasi |
| Pembaruan otomatis dibajak | Tinggi | V1 tanpa pembaruan otomatis; V2 hanya HTTPS dari satu alamat, verifikasi tanda tangan, bisa dimatikan |
| Impor file/kode playlist berbahaya (XSS, file raksasa, JSON aneh) | Sedang | Validasi skema, batas ukuran dan jumlah, teks dirender sebagai teks, pratinjau + konfirmasi |
| Injeksi SQL | Sedang | Query berparameter, tanpa penggabungan string |
| Eksekusi kode lewat UI (XSS di Electron) | Tinggi | Isolasi konteks, CSP, tanpa `dangerouslySetInnerHTML`, tanpa akses Node di UI |
| Data riwayat terbaca orang lain di komputer yang sama | Rendah–sedang | Batas jumlah riwayat, tombol hapus; database tidak dienkripsi (diterima, dicatat) |
| Gambar sampul dari server pihak ketiga membocorkan IP | Rendah | Diakui di pernyataan privasi; opsi menyimpan sampul di cache lokal |
| Berkas log berisi data pribadi | Rendah | Log lokal, tanpa kata pencarian default, bisa dihapus |
| Pustaka dependensi rentan | Sedang | Lockfile, audit berkala, dependensi seminimal mungkin |

## 13. Daftar Edge Case yang Wajib Diuji

**Pemutaran**
- Alamat stream kedaluwarsa di tengah lagu
- Internet putus saat memutar, lalu tersambung lagi
- Komputer tidur dan bangun; perangkat audio dicabut/diganti
- Lagu diblokir wilayah, dihapus dari sumber, atau durasi nol/tidak diketahui
- Lima lagu berturut-turut tidak tersedia
- Dua tindakan cepat berurutan (klik "berikutnya" 10 kali dengan cepat) tidak merusak status pemutar

**Antrean**
- Menghapus lagu yang sedang diputar; menghapus semua; antrean satu lagu dengan ulang semua
- Menyalakan lalu mematikan acak berulang kali
- Aplikasi ditutup paksa saat memutar, lalu dibuka lagi

**Playlist dan data**
- Playlist 1.000+ lagu; duplikat lagu; nama playlist kosong, panjang, atau berisi emoji
- Menghapus playlist yang berisi lagu yang juga difavoritkan
- Database rusak; disk penuh; dua instans aplikasi dibuka bersamaan
- Impor file kosong, rusak, terlalu besar, berisi skrip, atau dari versi format yang lebih baru

**Pencarian dan tampilan**
- Kata pencarian kosong, sangat panjang, karakter khusus, dan non-Latin
- Sumber mengubah format respons (`SOURCE_CHANGED`) → pesan jelas, aplikasi tidak crash
- Layar kecil (1366×768) dan skala tampilan Windows 125%/150%

## 14. Risiko Proyek

| # | Risiko | Tingkat | Tanggapan |
|---|---|---|---|
| R1 | **Sumber musik (ytmusicapi/YouTube) melanggar ketentuan layanan YouTube, rapuh, dan bisa berhenti bekerja kapan saja; ada kemungkinan somasi dari pemegang hak cipta** | **Sangat tinggi** | Keputusan sadar pemilik produk. Mitigasi: lapisan `MusicSource`, distribusi terbatas ke lingkaran teman, tidak dipublikasikan luas, rencana pindah ke sumber legal (Jamendo, Internet Archive, artis independen) |
| R2 | Unduh offline memperbesar risiko hukum karena menyalin audio | Tinggi | Ditunda; hanya dipertimbangkan bila sumbernya berlisensi bebas |
| R3 | Target "ringan" tidak tercapai karena pembungkus dan runtime tambahan | Sedang | Spike K1/K3, ukur di laptop RAM 4 GB sebelum membangun fitur |
| R4 | Proyek tanpa tenggat macet di tengah jalan | Sedang | Milestone kecil (bagian 15) dengan hasil yang bisa dicoba |
| R5 | Installer tidak ditandatangani memicu peringatan dan kecurigaan | Sedang | Checksum, panduan singkat untuk teman, tanda tangan kode bila proyek membesar |
| R6 | Pemblokiran massal oleh sumber bila banyak pengguna | Sedang | Cache hasil, batasi permintaan, distribusi tetap kecil |
| R7 | Beban pemeliharaan menanggung perubahan sumber seorang diri | Sedang | Contract test otomatis, adaptor terisolasi |

## 15. Rencana Rilis dan Milestone

| Milestone | Isi | Hasil yang bisa dicoba |
|---|---|---|
| **M0. Spike kelayakan** (1–2 minggu) | Putuskan K1–K3; buktikan search → resolve → putar satu lagu lewat `MusicSource`; ukur RAM/ukuran di laptop uji | Prototipe yang memutar satu lagu, dan angka ukur nyata |
| **M1. Pemutar inti** | Cari, putar, jeda, geser, volume, kerangka UI, adaptor tiruan | Bisa mencari dan memutar lagu |
| **M2. Pustaka** | Antrean, acak, ulang, Liked Songs, playlist, database + migrasi, pemulihan antrean | Bisa dipakai sehari-hari oleh pembuat |
| **M3. Pengerasan dan rilis teman** | Penanganan error, edge case bagian 13, Pengaturan, hapus riwayat, cadangan, installer + checksum | **Rilis V1 ke teman terdekat** |
| **M4. V2** | Beranda dan rekomendasi sederhana, lirik (bila sumber jelas), berbagi/impor playlist, pembaruan opsional | Rilis V2 |
| **Evaluasi V3** | Putuskan ulang soal unduh offline dan sumber musik jangka panjang | Keputusan tertulis |

## 16. Ukuran Keberhasilan

- **Utama:** teman-teman menyatakan senang memakai aplikasi (ditanyakan langsung, tanpa pelacakan apa pun).
- **Kualitas:** tidak ada bug yang mengganggu fitur inti. Definisi: aplikasi tidak crash, lagu yang tersedia selalu bisa dicari dan diputar, playlist dan favorit tidak hilang. Bug kecil pada tampilan boleh ada dan diperbaiki bertahap.
- **Kinerja:** memenuhi target bagian 9 di laptop uji RAM 4 GB.
- **Privasi:** pemeriksaan pra-rilis membuktikan tidak ada koneksi jaringan selain ke sumber musik (dan alamat pembaruan bila diaktifkan).

## 17. Hasil Review Kritis (ringkasan perbaikan dari draf sebelumnya)

| # | Temuan | Perbaikan di dokumen ini |
|---|---|---|
| 1 | ytmusicapi berbasis Python dan hanya memberi metadata, bukan audio; ini mengancam target "ringan" dan menambah komponen rapuh | Dicatat sebagai keputusan terbuka K1 dan K2, dengan spike M0 sebelum membangun |
| 2 | Janji "tanpa pelacakan sama sekali" tidak akurat karena sumber musik tetap melihat IP | Pernyataan privasi diganti dengan versi yang jujur (bagian 12) |
| 3 | Installer dibagikan lewat chat tanpa tanda tangan: risiko malware dan peringatan Windows | Checksum SHA-256, panduan verifikasi, pembaruan otomatis ditunda |
| 4 | Impor playlist adalah input tak tepercaya | Validasi skema, batas ukuran, render teks, pratinjau (F6) |
| 5 | PK gabungan `playlist_tracks` melarang lagu duplikat | Ditambah kolom `id` PK |
| 6 | Tidak ada penanganan lagu yang hilang dari sumber | Kolom `is_available` dan `last_checked_at`, perilaku lompat dengan batas 5 |
| 7 | Tidak ada rencana migrasi, korupsi data, atau instans ganda | `schema_meta`, cadangan otomatis, `integrity_check`, single-instance lock |
| 8 | "Ringan" tidak terukur | Target angka awal (bagian 9) yang harus divalidasi |
| 9 | Alamat stream kedaluwarsa tidak dibahas | Persyaratan ambil ulang otomatis (F2) |
| 10 | Pengguna dengan kuota terbatas tidak dipertimbangkan | Kualitas audio dapat diatur, default hemat, perkiraan data |
| 11 | Dukungan Windows lama ambigu | Ditetapkan Windows 10/11 64-bit |
| 12 | Riwayat putar/cari bisa membengkak dan menyimpan data berlebihan | Batas entri dan tombol hapus |
| 13 | "Selengkap Spotify" terlalu luas | Dipecah ke V1/V2/V3 dan daftar "Bukan tujuan" |
| 14 | Lirik berhak cipta, sumber belum jelas | Keputusan K6, fitur ditunda sampai sumber jelas |
| 15 | Beranda tidak konsisten (V1 vs V2) | V1: "Terakhir diputar" + pintasan; V2: rekomendasi |

## 18. Pertanyaan yang Masih Perlu Dijawab Pemilik Produk

1. Mana yang dipilih untuk K1 (cara menjalankan ytmusicapi) dan K3 (Electron atau Tauri) setelah spike M0?
2. Apakah kode aplikasi akan dibuka (open source)?
3. Berapa batas wajar jumlah teman pada tahap awal, agar risiko R1 dan R6 tetap kecil?
4. Siapa yang akan menguji di laptop RAM 4 GB, dan apakah ada laptop uji yang bisa dipakai?
5. Sumber lirik apa yang akan dipakai, atau fitur lirik ditunda?
