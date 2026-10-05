# Rice Guard

A Southeast Asian food-monitoring dashboard based on the supplied infographic, with an English interface and a language selector covering the region.

## Run locally

Use Node.js 20.19+ or 22.12+:

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173. Production builds:

```powershell
npm test
npm run build
npm run preview
```

Preview uses http://127.0.0.1:4173. The `dist` folder can be hosted as a static site. Live AI requires a server route equivalent to `server/ai.mjs`; local recommendations also work on static deployments.

## Language support

English is the default. The top-right selector offers English, Indonesian, Malay, Thai, Vietnamese, Burmese, Khmer, Lao, Filipino, Mandarin Chinese, Tamil, Tetum, and Portuguese. The choice is saved in this browser. Labels, navigation, dialogs, descriptions, country names, tooltips, numbers, dates, local recommendations, and plot annotations respond to the selected language. Numeric forecast values and source datasets stay unchanged.

Catalogs are bundled locally in `src/locales`. Switching languages does not send text or data to a translation service. Other languages are machine-translation drafts; Indonesian forecast terminology has been reviewed. English remains the reference for technical interpretation. Tetum uses an English-compatible numeric/date format because Intl does not supply a Tetum locale here. Research PNGs use translated SVG annotations in the interface; the downloadable originals retain their original labels.

To collect newly added `t('...')` messages and draft translations:

```powershell
node scripts/collect_translations.mjs
python scripts/translate_catalogs.py
npm test
npm run build
```

The optional generation script sends **public UI phrases only** to Google's public Translate endpoint at development time. No research files, user datasets, or credentials are sent. Reviewed translations are stored in `scripts/locale-overrides.json`; English terminology corrections are in `src/locales/english-overrides.json`. Native-speaker review is recommended before publication.

## Forecasts for everyday readers

Forecasting shows expected paddy production, population, production per person, changes from 2024, and a short explanation. Separate charts use solid lines for past data and dashed lines for forecasts. A collapsed harvest-loss scenario is available for exploration. Model selectors, technical evaluation tables, training parameters, and source-code filenames are absent from the interface.

The regional forecast automatically selects the lowest historical **test MAPE among models with available future outputs**: MLP for paddy production (0.93005%) and LSTM for population (2.71360%). The selected 2030 result is **196.367174 million tonnes** and **695.193894 million people**. XGBoost performed better in the production validation split, but its future forecast is unavailable; the site does not invent one. Selection uses the provided historical evaluation, not a newly trained or independently validated model. These details are maintained for developers here rather than shown in the forecast page.

Regional outputs span 2025–2030. Country outlooks use the recent historical trend, because country-specific trained forecasts were not supplied. They are not arbitrary allocations of the regional result. Regional and country totals can differ due to coverage and methods. Changes in production per person within ±1% are described as broadly stable; this is a presentation convention, not a validated food-risk threshold.

Paddy means unmilled rice. Production per person is not consumption or proof of food sufficiency. Trade, reserves, losses, consumption, and access are not modeled. Missing Singapore production remains unavailable rather than zero. Harvest-loss scenarios reduce production progressively and leave population unchanged.

## Features and data

- Overview: production, population, climate illustrations, and country warnings.
- Forecasting: simplified regional and country outlooks, CSV export, and reports.
- Climate Monitor: clearly labeled demo anomalies, recommendations, and on-demand seven-day Open-Meteo forecasts at representative points.
- Risk Map and Early Warning: country-level exploratory scores, interactive layers, and a browser-saved watchlist. They do not send operational alerts.
- Spatio-temporal: GloRice harvested-area estimates for 2030, climate scenarios, country maps and tables, conditional ranges, and historical/projected figures.
- Integrated Data: source attribution and coverage without source-code provenance in the UI.

`src/data.json` contains real annual observations:

- [FAO paddy production via OWID](https://ourworldindata.org/grapher/rice-production), 1961–2024.
- [UN population via OWID](https://ourworldindata.org/grapher/population-with-un-projections), including UN's 2024 projection column.
- [Natural Earth country boundaries](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/), cached as `public/sea.geojson`.
- [Open-Meteo forecasts](https://open-meteo.com/en/docs), fetched only on request.

The historical snapshot covers 11 countries for population and 10 for available 2024 production. Regional model baseline values are 197,000,964 tonnes and 695,149,428 people; earlier chart history uses OWID. The supplied regional production aggregate is labeled “Total 10 Negara”; membership cannot be independently verified without its original CSV. Spatial estimates cover 10 countries and exclude Timor-Leste. Source terms apply to reuse.

Refresh the public snapshot with `npm run data:refresh`. Charts, translations, maps, and local calculations work without external APIs when served locally. Fonts, weather requests, optional AI, and data refresh need internet.

## Research implementation and limitations

The supplied files are imported by `scripts/import_notebooks.py` without rerunning training. `src/research.json` preserves forecasts, metrics, and SHA-256 provenance; scientific PNGs and CSVs are in `public/research`. Developer provenance remains available in source files and this document, but is absent from the public-facing dashboard.

```powershell
npm run research:import
npm test
npm run build
```

The spatial module uses the final GloRice dynamic hurdle BYM2–AR(1) results, a 2° model grid, training 1981–2011, and forward holdout 2012–2021. R² is 0.9791634, MAE 16,311.67 ha, RMSE 30,737.97 ha; residual spatial clustering remains (Moran's I about 0.60–0.68). R² is not percentage accuracy. Future projections use ACCESS-CM2 and average 2021–2040 climate. Conditional ranges do not include all climate uncertainty. Summing country bounds does not create a regional posterior interval.

The 5-arcminute future maps allocate coarse-grid estimates according to the 2021 harvested-area pattern. They are not new pixel-level inference or forecasts of new rice fields. Raw grid/GeoTIFF data, training weights, and some climate inputs are not available, so no retraining or invented pixel tooltips are provided. Country interactions use the supplied tables.

Country risk scores use the projected decline in paddy per person, illustrative temperature anomalies, and rainfall changes. The formula is `min(100, 4 × max(0, -per-capita change %) + 13 × max(0, temperature anomaly) + 0.55 × abs(rainfall change %))`, with low <30, watch 30–54, high ≥55. This is an uncalibrated monitoring signal, not a food-shortage probability.

## Optional AI

Copy `.env.example` to `.env.local`, configure `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL` for a chat-completions provider, and restart Vite. The API URL must be the complete endpoint. Secrets stay on the server; never add a `VITE_` prefix. Requests use the selected display language. Without a configured provider, the UI identifies the translated local-rule fallback. Live AI has not been verified with a provider account.

## Verification

`npm test` checks source coverage, missing data, projections, units, model selection, original research outputs, every locale catalog, preserved placeholders, and locale formatting. Desktop/mobile screenshots and interaction checks are saved in `artifacts`.
