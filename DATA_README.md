# SakuArab — Panduan Data

## Berkas utama

- `words-expanded-legacy.json`: format kompatibilitas berisi enam kolom per kata, agar loader lama lebih mudah dipertahankan.
- `words-structured.json`: format utama berbentuk objek; root berisi `_meta`, `words`, dan `similar`.
- `config.json`: pengaturan aplikasi, jalur, warna aksen, font Arab, tema, dan toggle fitur.
- `data/rpl.json`, `data/akuntansi.json`, `data/tbkr.json`, `data/tsm.json`, `data/umum.json`: data per jalur.
- `data/similar.json`: 24 pasangan kata yang mirip.

## Skema kata terstruktur

Setiap kata memakai `id`, `ar`, `latin`, `id_text`, `track`, `category`, `example.ar`, `example.id`, dan `tags`. ID sudah diuji unik pada dataset saat ini. Contoh kalimat yang sebelumnya kosong pada entri umum telah diisi.

## Jumlah entri

| Jalur | Jumlah |
|---|---:|
| RPL | 600 |
| Akuntansi | 600 |
| TBKR | 600 |
| TSM | 600 |
| Umum | 102 |
| Pasangan mirip | 24 |

Penyamaan duplikat dilakukan secara hati-hati; kata homograf yang memiliki makna berbeda tetap dipertahankan. Karena ini kamus pembelajaran dan istilah vokasi dapat memiliki varian, mohon lakukan proofreading bersama guru Bahasa Arab atau guru produktif sebelum menjadikannya bahan ajar resmi.
