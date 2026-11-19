/**
 * Kamus Teks Antarmuka Bahasa Indonesia Terpusat (i18n)
 * Menjamin konsistensi teks, pencegahan typo, dan kesiapan multi-bahasa kelak.
 */
export const ID_STRINGS = {
  app: {
    title: 'Musick',
    tagline: 'Pemutar Musik Desktop Ringan & Mandiri',
  },
  nav: {
    home: 'Beranda',
    search: 'Cari',
    artist: 'Artis',
    album: 'Album',
    settings: 'Pengaturan',
  },
  home: {
    welcome: 'Selamat Datang di Musick',
    subtitle: 'Temukan dan dengarkan jutaan musik tanpa iklan dan tanpa gangguan.',
    emptyRecentTitle: 'Belum Ada Lagu yang Diputar',
    emptyRecentDesc: 'Ketik artis atau judul lagu favoritmu di menu Cari untuk mulai mendengarkan.',
    startSearchBtn: 'Mulai Mencari',
  },
  search: {
    placeholder: 'Cari lagu, artis, atau album...',
    loading: 'Sedang mencari di sumber musik...',
    emptyQueryTitle: 'Cari Musik Favoritmu',
    emptyQueryDesc: 'Ketik nama artis, judul lagu, atau album pada kotak di atas.',
    noResultsTitle: 'Tidak Ada Hasil',
    noResultsDesc: (query: string) => `Tidak menemukan hasil apa pun untuk "${query}". Coba periksa ejaan atau gunakan kata kunci lain.`,
    tabAll: 'Semua',
    tabTracks: 'Lagu',
    tabArtists: 'Artis',
    tabAlbums: 'Album',
    retryBtn: 'Coba Lagi',
  },
  player: {
    unknownTitle: 'Tidak Ada Lagu',
    unknownArtist: 'Pilih lagu untuk memutar',
    play: 'Putar',
    pause: 'Jeda',
    previous: 'Sebelumnya',
    next: 'Berikutnya',
    mute: 'Bisukan',
    unmute: 'Bunyikan',
    volume: 'Volume',
    trackPosition: 'Posisi lagu',
    audioDeviceDisconnected: 'Perangkat audio terputus. Pemutaran dijeda.',
  },
  errors: {
    network: 'Gagal terhubung ke jaringan. Periksa koneksi internet Anda.',
    rateLimited: 'Terlalu banyak permintaan ke sumber musik. Harap tunggu beberapa saat.',
    blocked: 'Akses dibatasi oleh sumber musik (deteksi bot/jaringan). Silakan coba beberapa saat lagi.',
    sourceChanged: 'Format respons sumber musik berubah. Memerlukan pembaruan modul bridge.',
    unavailable: 'Lagu ini sedang tidak tersedia di sumber musik.',
    stalled: 'Aliran audio terhenti cukup lama. Menyegarkan kembali sambungan...',
    loopGuard: 'Pemutaran dihentikan: 5 trek berturut-turut gagal dimuat.',
    generic: 'Terjadi kesalahan sistem yang tidak terduga.',
  },
  settings: {
    title: 'Pengaturan',
    audioQuality: 'Kualitas Audio',
    qualityEconomy: 'Hemat (WebM Opus ~128 kbps)',
    qualityEconomyDesc: 'Paling hemat kuota data (~55 MB/jam). Rekomendasi standar.',
    qualityHigh: 'Tinggi (AAC / WebM ~256 kbps bila tersedia)',
    qualityHighDesc: 'Kualitas audio maksimal (~110 MB/jam). Membutuhkan kuota lebih besar.',
    privacyTitle: 'Pernyataan Privasi',
    privacyText:
      'Aplikasi ini tidak punya iklan, akun, analitik, atau pelaporan crash otomatis pihak ketiga. Data tersimpan lokal di komputer Anda. Permintaan audio langsung menghubungi CDN layanan musik.',
  },
};
