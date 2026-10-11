# SakuArab — Kamus Arab Vokasi

PWA kamus Arab–Indonesia untuk siswa SMK. Mobile-first, siap offline setelah aplikasi dan data dimuat, tanpa login atau backend.

## Fitur yang sudah disiapkan

- Pencarian Bahasa Arab, transliterasi Latin, Indonesia, dan kategori; normalisasi harakat, tatweel, variasi alif, alif maqsurah, hamzah di atas/bawah, serta ta marbuta untuk pencarian.
- Pilih jalur RPL, Akuntansi, TBKR, TSM, atau Umum. Setiap jalur menggunakan warna aksen dari `src/data/config.json`.
- Kartu kata, harakat on/off, transliterasi, contoh Arab–Indonesia, tag bunyi ع / غ / ق, bookmark, riwayat, dan bagikan kartu sebagai PNG.
- Kata hari ini, streak harian, progress, flashcard “Tebak Arti”, kuis lima soal, “Susun Huruf”, dan “Mirip tapi Beda”.
- Dark/light/auto, ukuran teks Arab, ekspor/impor progres JSON, dan penyimpanan lokal dengan IndexedDB (Dexie).
- PWA lewat `vite-plugin-pwa`; track JSON dimuat secara lazy. Tata letak: bottom nav untuk layar kecil dan sidebar + panel daftar/detail untuk desktop.
- GitHub Actions untuk build dan deploy ke GitHub Pages.

## Menjalankan di lokal

Persyaratan: Node.js 20 atau lebih baru.

```bash
npm install
npm run dev
```

Untuk mengecek build produksi:

```bash
npm run build
npm run preview
```

## Deploy ke GitHub Pages

1. Buat repository GitHub dan unggah seluruh isi folder ini ke branch `main`.
2. Buka **Settings → Pages**, lalu pilih sumber deploy **GitHub Actions**.
3. Workflow `.github/workflows/deploy.yml` otomatis mengatur `VITE_BASE_PATH` berdasarkan nama repository dan menjalankan deploy saat ada push ke `main`.

Karena navigasi aplikasi memakai state, URL tidak memerlukan SPA route fallback. `vite.config.js` mengatur `base`, `scope`, dan `start_url` berdasarkan variabel build.

## Mengubah kosakata dan konfigurasi

### Konfigurasi tampilan dan jalur

Edit `src/data/config.json` untuk mengubah:

- nama aplikasi, tagline, locale, jalur default, dan lebar maksimum;
- mode tema default, radius, warna aksen, pengaturan Arab;
- toggle fitur;
- nama, deskripsi, warna, ikon, dan file data tiap jurusan;
- metadata dan scope PWA.

Warna aktif disediakan lewat CSS variable `--accent`, sehingga komponen dapat ikut berubah tanpa mengganti stylesheet.

### File kosakata

Data aplikasi berbentuk array objek dalam `src/data/`:

```json
{
  "id": "rpl-contoh-1234567",
  "ar": "حَاسُوب",
  "latin": "ḥāsūb",
  "id_text": "komputer",
  "track": "RPL",
  "category": "Komputer dan perangkat",
  "example": {
    "ar": "أَسْتَخْدِمُ الْحَاسُوبَ كُلَّ يَوْمٍ",
    "id": "Saya memakai komputer setiap hari"
  },
  "tags": ["Komputer dan perangkat", "RPL", "bunyi-qaf"]
}
```

`id` sebaiknya unik dan stabil agar bookmark/progres tidak terputus saat daftar diurutkan ulang. File `rpl.json`, `akuntansi.json`, `tbkr.json`, `tsm.json`, dan `umum.json` diimpor secara dinamis. `similar.json` berisi pasangan kata yang mirip.

### Format data kompatibilitas

- `words-expanded-legacy.json`: mempertahankan format lama enam kolom per kata.
- `words-structured.json`: semua kata dalam format objek untuk integrasi baru.
- `config.json`: konfigurasi di root dan salinannya di `src/data/config.json` untuk aplikasi.

## Catatan data

Empat jalur vokasi disediakan masing-masing 600 entri unik setelah pembersihan duplikasi yang jelas. 102 entri umum dan 24 pasangan “Mirip tapi Beda” ikut dipertahankan. Contoh yang sebelumnya kosong pada kosakata umum sudah dilengkapi. Karena kosakata teknis dan transliterasi Arab bisa memiliki varian, lakukan proofreading akhir bersama guru Bahasa Arab atau guru produktif sebelum dipakai sebagai bahan ajar resmi.

## Privasi dan batasan

Tidak ada akun, backend, chat, leaderboard, atau AI tutor. Bookmark, progres, streak, dan riwayat berada di IndexedDB pada perangkat. Ekspor/impor file JSON adalah cara memindahkan progres antarperangkat. Pencarian dan pengalaman offline bergantung pada data aplikasi yang sudah di-cache oleh service worker.
