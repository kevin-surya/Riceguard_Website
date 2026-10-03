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
- **Forecasting:** forecast regional MLP/LSTM tersimpan 2025–2030; model produksi dan populasi dipilih terpisah. Tabel evaluasi test dan validasi notebook, ekspor semua model, regresi negara 2025–2035, skenario pertumbuhan infografis, resiliensi, dan tekanan panen.
- **Climate Monitor:** anomali iklim ilustratif yang diberi label demo, analisis/rekomendasi, serta prakiraan Open-Meteo tujuh hari pada titik representatif tiap negara.
- **Early Warning:** skor risiko eksploratif yang mengikuti skenario, filter tingkat risiko, daftar pantauan tersimpan pada browser.
- **Interactive Risk Map:** geometri negara asli Natural Earth, klik negara, zoom, layer risiko, suhu demo, dan produksi historis. Singapura ditampilkan sebagai titik.
- **Integrated Data:** atribusi, cakupan, dan status integrasi tiap sumber.
- **Spatio-temporal:** hasil GloRice BYM2–AR(1), peta luas panen per negara, skenario SSP2-4.5/SSP5-8.5, batas bawah/atas dan lebar interval, tabel dan ekspor CSV, empat gambar asli notebook (1961/2021 dan proyeksi 2030), evaluasi temporal holdout dan grafik Moran’s I residual.
- Pencarian negara, dialog metodologi, laporan yang dapat dicetak/disimpan sebagai PDF, dan ekspor CSV historis serta proyeksi.
- Layout responsif untuk desktop dan ponsel, navigasi keyboard, dialog dengan Escape dan fokus terjaga.

## Data dan asal-usul

`src/data.json` adalah snapshot data terbuka, bukan angka historis buatan:

- [Rice production — FAO via Our World in Data](https://ourworldindata.org/grapher/rice-production): 1961–2024. Produksi dalam **ton gabah/padi**, bukan beras giling.
- [Population with UN projections — UN via Our World in Data](https://ourworldindata.org/grapher/population-with-un-projections): 1961–2024, dengan 2024 dari kolom proyeksi UN pada dataset.
- [Natural Earth](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/): geometri 1:110m, disimpan di `public/sea.geojson`.
- [Open-Meteo](https://open-meteo.com/en/docs): cuaca terkini diambil saat tombol diminta. Prakiraan titik, bukan agregat nasional. Kegagalan jaringan ditampilkan sebagai pesan, tanpa mengganti dengan cuaca fiktif.

Agregat Asia Tenggara mencakup Indonesia, Vietnam, Thailand, Myanmar, Filipina, Kamboja, Laos, Malaysia, Singapura, Brunei, dan Timor-Leste. Data populasi mencakup 11 negara; produksi 2024 tersedia untuk 10 negara. Produksi Singapura **null**, bukan nol. Dalam mode notebook, nilai dasar regional 2024 memakai output notebook: 197.000.964 ton dan 695.149.428 jiwa. Riwayat lain memakai snapshot OWID. Nama agregat produksi asli “Total 10 Negara” tidak cukup untuk memverifikasi komposisi negara tanpa CSV asli. Forecast spasial memakai 10 negara notebook dan tidak mencakup Timor-Leste.

Refresh snapshot dengan Python 3 (hanya pustaka standar):

```powershell
npm run data:refresh
```

Script memvalidasi cakupan sebelum mengganti snapshot. Internet diperlukan untuk refresh, fonts eksternal, prakiraan cuaca, dan layanan AI. Grafik, filter, proyeksi, peta, dan analisis lokal tetap dapat dipakai tanpa jaringan ketika aplikasi disajikan dari server lokal. Font memiliki fallback sistem.

CHIRPS, CMIP6 (ACCESS-CM2), GADM, dan GloRice digunakan dalam notebook spasial. Hasil notebook tersimpan sudah terintegrasi; data mentah tidak disertakan. Ketentuan sumber asli berlaku pada penggunaan ulang. Data/pemrosesan OWID diatribusikan; Natural Earth adalah public domain. Perhatikan ketentuan Open-Meteo untuk penggunaan komersial.

## Model dan batasan

1. **Tren:** regresi linear sepuluh observasi terbaru digunakan untuk kemiringan tahunan, dengan proyeksi di-anchor pada nilai 2024. Nilai negatif dibatasi nol.
2. **Infografis:** pertumbuhan total enam tahun +1,56% (padi) dan +9,06% (populasi), diterapkan majemuk pada setiap negara. Adaptasi asumsi; bukan reproduksi MLP atau angka agregat penelitian.
3. **Resiliensi:** tren × `(1 + 0.012 × tahun_sejak_2024)` pada produksi.
4. **Tekanan panen:** pengurangan bertahap hingga persentase yang dipilih di tahun akhir.
5. **Padi per kapita:** `(juta ton / juta jiwa) × 1000` kg/jiwa/tahun.
6. **Skor pantauan:** `min(100, 4 × max(0, -perubahan_perkapita_persen) + 13 × max(0, anomali_suhu) + 0.55 × abs(perubahan_hujan_persen))`. Rendah <30, waspada 30–54, tinggi ≥55. Suhu/hujan adalah input demo tanpa baseline observasi. Model belum dikalibrasi atau dilatih; skor bukan probabilitas.

Data/tren dapat mengandung perubahan metode pengukuran. Belum memasukkan perdagangan, stok, kehilangan hasil, konsumsi, akses pangan, atau rasio penggilingan gabah. Penurunan padi per kapita tidak membuktikan defisit beras. MAPE 0,93% dan evaluasi BYM2–AR(1) merujuk ke output notebook asli, bukan validasi baru aplikasi atau formula risiko. Early Warning belum mengirim notifikasi operasional.

## AI opsional

`AI Climate Monitor` bekerja dengan rekomendasi lokal berbasis aturan. Untuk layanan AI sungguhan, salin `.env.example` menjadi `.env.local`, isi `AI_API_URL`, `AI_API_KEY`, dan `AI_MODEL` dengan provider yang mendukung format chat-completions, lalu restart Vite. URL harus merupakan endpoint API lengkap.

Kunci hanya dipakai di middleware server; jangan gunakan prefix `VITE_`. Endpoint `/api/analyze` mengirim konteks skenario, skor, dan input iklim demo ke provider yang Anda konfigurasi. Tidak ada file infografis atau kredensial yang dikirim. Tanpa konfigurasi atau saat provider gagal, UI secara eksplisit menyebut analisis lokal. Keluaran AI belum diuji dengan akun provider dan perlu validasi manusia.

## Verifikasi

```powershell
npm test
npm run build
```

Tes mencakup cakupan snapshot, agregasi, gejala data hilang, regresi pada seri yang diketahui, pertumbuhan infografis, tekanan hasil panen, dan batas/arah skor risiko.

## Implementasi notebook

Tiga notebook asli di folder induk dibaca tanpa mengeksekusi kode yang bergantung pada data mentah. `scripts/import_notebooks.py` mengekstrak output tabel Data Wrangler (angka presisi penuh), tabel forecast HTML (dibulatkan satu ton/jiwa), dan PNG asli. `src/research.json` menyimpan hasil serta hash SHA-256 setiap notebook. Berkas asli tidak diubah.

Untuk memperbarui setelah notebook dijalankan ulang dan disimpan:

```powershell
npm run research:import
npm test
npm run build
```

Ini implementasi penyajian hasil/inferensi tersimpan, bukan layanan retraining. Tidak ada interpolasi nilai piksel, forecast setelah 2030 dari MLP/LSTM, atau pembagian forecast agregat secara arbitrer menjadi model negara. Regresi tren digunakan saat wilayah negara dipilih; Risk Map dan Early Warning negara tetap memakai regresi negara dan input iklim demo. Nilai forecast asli dapat diunduh di `public/research/forecast-notebook-2025-2030.csv`.

- **Produksi:** train 1961–2018, validasi internal 2013–2018, test 2019–2024; MLP lag 5 / hidden 16 / alpha 0,01 / learning rate 0,001. Test MAPE 0,93005%. LSTM lag 3 / hidden 8 / learning rate 0,01 / weight decay 0,0001 / 250 epochs; test MAPE 2,25025%. Nilai 2030 MLP **196,367174 juta ton**; LSTM **199,329868 juta ton**. Angka 199,33 di infografis sesuai LSTM, bukan MLP. XGBoost memiliki validasi terendah (2,60786%); tidak ada forecast masa depannya yang disimpan di notebook.
- **Populasi:** train 1950–2018; validasi 2013–2018; test 2019–2024. MLP lag 3 / hidden 16 / alpha 0,01 / learning rate 0,001; test MAPE 3,62601%, forecast 2030 758,115227 juta jiwa. LSTM konfigurasi yang sama dengan LSTM produksi; test MAPE 2,71360%, forecast 2030 695,193894 juta jiwa. Notebook `forecastPopulasiSEA.ipynb` adalah versi dengan horizon lebih pendek; hasilnya diverifikasi sesuai pada tahun yang bertumpang tindih.
- **Spasial:** bagian akhir GloRice digunakan; APRA500 legacy diabaikan. Dynamic hurdle BYM2(group year) + AR(1), grid 2°, train 1981–2011, seluruh outcome test 2012–2021 dimask sebelum fit. n=4.940, R²=0,9791634, MAE=16.311,67 ha, RMSE=30.737,97 ha, bias aktual−prediksi=−15.549,36 ha. R² bukan persentase akurasi. Moran’s I residual ~0,60–0,68, p=0,005: struktur residual spasial masih tersisa.
- **Proyeksi spasial 2030:** model di-fit ulang pada 1981–2021; ACCESS-CM2 CMIP6, rerata iklim 2021–2040. Interval posterior aproksimatif luas panen bersyarat belum mencakup seluruh ketidakpastian iklim. Tabel negara memakai irisan batas GADM equal-area; geometri UI Natural Earth hanya untuk tampilan. Penjumlahan batas bawah/atas negara bukan interval posterior total. Total grid mencakup daratan luar ASEAN, sehingga berbeda dari jumlah 10 negara.
- **Raster 5 arcminute:** peta historis berasal dari GloRice; visual 2030 mengalokasikan hasil model 2° mengikuti dukungan pola area panen 2021. Ini disagregasi visual terbatasi, bukan inferensi baru per piksel atau prediksi lokasi sawah baru. Tidak tersedia data piksel mentah untuk tooltip per piksel; website menyediakan gambar asli dan interaksi pada ringkasan negara. Singapura/Brunei sangat sensitif terhadap resolusi grid.

Data mentah/bobot yang dirujuk notebook belum ada: `rice-production.csv`, `../populasiSEA.xlsx`, `data/processed/glorice/*.npz`, CSV grid/GeoTIFF proyeksi, GADM, CHIRPS, dan CMIP6. Retraining/peta raster interaktif memerlukan berkas tersebut dan pipeline pemodelan asli. Penambahan layanan model tidak diklaim selesai dengan output tersimpan ini.

Tes tambahan memastikan hash notebook, angka model dan satuan 2030, pemilihan model independen, batas horizon, interval setiap negara, cakupan ASEAN vs grid, dan validitas PNG asli. Preview hasil tersimpan di `artifacts`.
