# Rice Guard

Dashboard ketahanan pangan Asia Tenggara, dibuat berdasarkan `infog fix.png`.
React + TypeScript + Vite, Recharts, Lucide, dan peta SVG dengan D3 Geo.

## Menjalankan

Node.js 20.19+ atau 22.12+ diperlukan. Jalankan di folder ini:

```powershell
npm install
npm run dev
```

Buka http://127.0.0.1:5173. Untuk build:

```powershell
npm run build
npm run preview
```

Preview berjalan pada http://127.0.0.1:4173. `dist` dapat dihosting sebagai situs statis. Koneksi AI server memerlukan middleware sendiri pada deployment statis; gunakan `server/ai.mjs` sebagai acuan. Mode lokal tetap berjalan jika endpoint AI tidak tersedia.

## Fitur

- **Overview:** ringkasan produksi padi, populasi, produksi per kapita, grafik, peta, iklim, dan peringatan.
- **Forecasting:** historis 1961–2024, proyeksi 2025–2035, regresi tren sepuluh tahun, skenario pertumbuhan dari infografis, resiliensi, dan slider tekanan hasil panen.
- **Climate Monitor:** anomali iklim ilustratif yang diberi label demo, analisis/rekomendasi, serta prakiraan Open-Meteo tujuh hari pada titik representatif tiap negara.
- **Early Warning:** skor risiko eksploratif yang mengikuti skenario, filter tingkat risiko, daftar pantauan tersimpan pada browser.
- **Interactive Risk Map:** geometri negara asli Natural Earth, klik negara, zoom, layer risiko, suhu demo, dan produksi historis. Singapura ditampilkan sebagai titik.
- **Integrated Data:** atribusi, cakupan, dan status integrasi tiap sumber.
- **Spatio-temporal:** tempat khusus untuk pengembangan berikutnya; analisis spasial belum diimplementasikan.
- Pencarian negara, dialog metodologi, laporan yang dapat dicetak/disimpan sebagai PDF, dan ekspor CSV historis serta proyeksi.
- Layout responsif untuk desktop dan ponsel, navigasi keyboard, dialog dengan Escape dan fokus terjaga.

## Data dan asal-usul

`src/data.json` adalah snapshot data terbuka, bukan angka historis buatan:

- [Rice production — FAO via Our World in Data](https://ourworldindata.org/grapher/rice-production): 1961–2024. Produksi dalam **ton gabah/padi**, bukan beras giling.
- [Population with UN projections — UN via Our World in Data](https://ourworldindata.org/grapher/population-with-un-projections): 1961–2024, dengan 2024 dari kolom proyeksi UN pada dataset.
- [Natural Earth](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/): geometri 1:110m, disimpan di `public/sea.geojson`.
- [Open-Meteo](https://open-meteo.com/en/docs): cuaca terkini diambil saat tombol diminta. Prakiraan titik, bukan agregat nasional. Kegagalan jaringan ditampilkan sebagai pesan, tanpa mengganti dengan cuaca fiktif.

Agregat Asia Tenggara mencakup Indonesia, Vietnam, Thailand, Myanmar, Filipina, Kamboja, Laos, Malaysia, Singapura, Brunei, dan Timor-Leste. Data populasi mencakup 11 negara; produksi 2024 tersedia untuk 10 negara. Produksi Singapura **null**, bukan nol. Snapshot OWID yang lebih baru membuat agregat produksi sedikit berbeda dari infografis; sumber dan satuan tetap dapat ditelusuri.

Refresh snapshot dengan Python 3 (hanya pustaka standar):

```powershell
npm run data:refresh
```

Script memvalidasi cakupan sebelum mengganti snapshot. Internet diperlukan untuk refresh, fonts eksternal, prakiraan cuaca, dan layanan AI. Grafik, filter, proyeksi, peta, dan analisis lokal tetap dapat dipakai tanpa jaringan ketika aplikasi disajikan dari server lokal. Font memiliki fallback sistem.

CHIRPS, CMIP6, GADM, dan GloRice ditampilkan sebagai sumber yang **belum diintegrasikan**, sesuai tahap pengembangan. Ketentuan sumber asli berlaku pada penggunaan ulang. Data/pemrosesan OWID diatribusikan; Natural Earth adalah public domain. Perhatikan ketentuan Open-Meteo untuk penggunaan komersial.

## Model dan batasan

1. **Tren:** regresi linear sepuluh observasi terbaru digunakan untuk kemiringan tahunan, dengan proyeksi di-anchor pada nilai 2024. Nilai negatif dibatasi nol.
2. **Infografis:** pertumbuhan total enam tahun +1,56% (padi) dan +9,06% (populasi), diterapkan majemuk pada setiap negara. Adaptasi asumsi; bukan reproduksi MLP atau angka agregat penelitian.
3. **Resiliensi:** tren × `(1 + 0.012 × tahun_sejak_2024)` pada produksi.
4. **Tekanan panen:** pengurangan bertahap hingga persentase yang dipilih di tahun akhir.
5. **Padi per kapita:** `(juta ton / juta jiwa) × 1000` kg/jiwa/tahun.
6. **Skor pantauan:** `min(100, 4 × max(0, -perubahan_perkapita_persen) + 13 × max(0, anomali_suhu) + 0.55 × abs(perubahan_hujan_persen))`. Rendah <30, waspada 30–54, tinggi ≥55. Suhu/hujan adalah input demo tanpa baseline observasi. Model belum dikalibrasi atau dilatih; skor bukan probabilitas.

Data/tren dapat mengandung perubahan metode pengukuran. Belum memasukkan perdagangan, stok, kehilangan hasil, konsumsi, akses pangan, atau rasio penggilingan gabah. Penurunan padi per kapita tidak membuktikan defisit beras. MAPE 0,93% dan hasil BYM2–AR(1) dari infografis **tidak** diklaim sebagai validasi aplikasi. Early Warning belum mengirim notifikasi operasional.

## AI opsional

`AI Climate Monitor` bekerja dengan rekomendasi lokal berbasis aturan. Untuk layanan AI sungguhan, salin `.env.example` menjadi `.env.local`, isi `AI_API_URL`, `AI_API_KEY`, dan `AI_MODEL` dengan provider yang mendukung format chat-completions, lalu restart Vite. URL harus merupakan endpoint API lengkap.

Kunci hanya dipakai di middleware server; jangan gunakan prefix `VITE_`. Endpoint `/api/analyze` mengirim konteks skenario, skor, dan input iklim demo ke provider yang Anda konfigurasi. Tidak ada file infografis atau kredensial yang dikirim. Tanpa konfigurasi atau saat provider gagal, UI secara eksplisit menyebut analisis lokal. Keluaran AI belum diuji dengan akun provider dan perlu validasi manusia.

## Verifikasi

```powershell
npm test
npm run build
```

Tes mencakup cakupan snapshot, agregasi, gejala data hilang, regresi pada seri yang diketahui, pertumbuhan infografis, tekanan hasil panen, dan batas/arah skor risiko.
