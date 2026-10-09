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

Preview uses http://127.0.0.1:4173. The `dist` folder can be hosted as a static site. Live AI runs through the included Vercel Functions or the local Vite middleware; local rule-based Climate Monitor recommendations also work on static deployments.

## Deploy on Vercel

1. Commit and push these changes, including the `api/` folder and `vercel.json`, to the connected GitHub repository.
2. Set **Root Directory** to the folder containing this `package.json` and `vercel.json`. For a repository rooted in `riceguard_web`, use the repository root (`.`). If your repository contains a parent folder, select `riceguard_web` instead.
3. Choose **Vite** as the framework. `vercel.json` sets **Build Command** to `npm run build` and **Output Directory** to `dist`; remove any conflicting dashboard overrides.
4. In **Settings → Environment Variables**, add `OPENAI_API_KEY` as a Secret and `OPENAI_MODEL=gpt-6-luna` for Production and, if needed, Preview. Do not add a `VITE_` prefix. The functions read `process.env` at runtime; the local `.env` is not deployed.
5. Trigger a new deployment or redeploy the updated commit. Environment variable changes apply to new deployments.
6. Open `https://YOUR-DOMAIN/api/chat/status`: a configured deployment returns `{"configured":true}`. This checks configuration, not API quota. Then send a question through **Panel RiceGuard AI** to verify provider access.

The frontend calls relative same-origin URLs, so no API base URL or CORS configuration is needed:

| Endpoint | Function | Method |
| --- | --- | --- |
| `/api/chat` | `api/chat.js` | POST |
| `/api/chat/status` | `api/chat/status.js` | GET |
| `/api/analyze` | `api/analyze.js` | POST |

The functions share the local middleware. `server/http.mjs` accepts both request streams and the already-parsed JSON body supplied by Vercel. Input-size limits also apply to parsed bodies. Each AI function has a 60-second deployment timeout, longer than the provider timeout; the status function is lightweight and does not load research datasets. The deployment file tracer uses literal dataset paths, with explicit `includeFiles` for the three JSON datasets used by chat. `.vercelignore` excludes local secrets, training caches, and development artifacts from CLI uploads. There is no catch-all rewrite that could send API requests to `index.html`.

This follows Vercel's [Node.js Functions guide](https://vercel.com/docs/functions/runtimes/node-js) and [runtime file packaging guide](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions). Run `npm test` and `npm run build` before pushing. Tests exercise the actual API entry modules with Vercel-style consumed/parsed requests and verify imports/data in an isolated deployment directory; provider responses in tests are mocked. A real hosted deployment still needs checking on your Vercel domain.

## RiceGuard AI farmer chat

Open **Panel RiceGuard AI** from the floating button at the bottom right of any page. It supports follow-up questions, a new-chat button, quick questions about drought/heavy rain, and the selected interface language. The panel follows the current dashboard country/year/outlook and the spatio-temporal country/year/scenario/layer. Closing it preserves the conversation until the page reloads; conversations are kept in browser memory, not localStorage.

The ignored `.env` file is ready for your own key:

```dotenv
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-6-luna
```

After saving your key, restart `npm run dev` (or `npm run preview`). Do not put the key in React code, chat messages, or a variable beginning with `VITE_`. If `.env` is missing, copy `.env.example` to `.env`. Existing `.env.local` settings override `.env`; operating-system environment variables override both. The existing Climate Monitor AI analysis also accepts these OpenAI settings, while its optional `AI_*` settings remain available.

The chat uses the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) with `store: false`; it sends a bounded recent conversation and fresh dashboard context through server-side API routes. The selected default is [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), using `reasoning.effort: none` for concise chat replies within the output budget. The model can be changed in `.env` to one available to your API account that supports Responses. API access/billing is separate from using the ChatGPT website. No API call is made just by opening the panel; the connection indicator checks local configuration, not key validity or quota. Missing keys, authentication failures, quota limits, timeouts, and incomplete replies have separate messages; the chat does not present canned text as an AI answer.

`server/chat-context.mjs` recomputes forecast/risk/map figures from saved data instead of accepting arbitrary client totals. On-demand Open-Meteo weather is included only if already loaded, with its point location and dates. `server/riceguard-prompt.mjs` defines the farmer context: practical prevention, low-cost steps, crop stage and irrigation questions, and clear distinctions between illustrative climate inputs, forecasts, historical maps, hectares, and paddy production. It avoids invented live alerts and unsupported product/dose/planting prescriptions.

Local development, preview, and Vercel Functions serve `/api/chat`, `/api/chat/status`, and `/api/analyze`. Static hosting alone does not run those routes. The chat limits concurrent provider requests to two per running instance; this is not a global spending limit. Authentication and per-user request/spend limits can be added for public access. Chat replies use React text rendering rather than injecting HTML. Network/backend tests use mocked provider responses and never spend API credits; actual model-generated recommendation quality needs checking after a valid key is supplied.

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
- Risk Map and Early Warning: country-level production-pressure categories, actual percentage declines from 2024, interactive layers, and a browser-saved watchlist. They do not send operational alerts.
- Spatio-temporal: an annual slider from 1961 to 2030, play/pause, raster maps, country selection, trend chart, two climate scenarios, conditional ranges, and selected-year/all-year CSV exports.
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

Archived single-year outputs remain in `src/research.json` and the original PNG/CSV files. The annual website module now uses the newly computed timeline described below. The archived evaluation and new evaluation belong to different implementations and should not be compared as identical reruns.

Both the archived and annual future maps allocate coarse-grid estimates according to the 2021 harvested-area pattern. They are not new pixel-level inference or forecasts of new rice fields. Raw source archives, regional data, and newly fitted annual parameters are cached locally in `data/`; public website assets contain the exported annual results. The unavailable original training implementation is not claimed to have been reproduced exactly.

Early warning compares projected paddy production per person with the fixed 2024 baseline: `change = (forecast_per_person / baseline_per_person - 1) × 100`; `decline = max(0, -change)`. Low pressure means an increase, no change, or a decline below 5%; Watch means a decline of at least 5% but below 10%; High pressure means a decline of 10% or more. Missing, zero, or unusable baseline data and missing forecasts are Not assessed. Categories use unrounded values, with a 1e-10 percentage-point tolerance only for floating-point arithmetic at exact boundaries. Watch and High countries appear in the warning list, ordered by the actual decline. Reasons, map colors, reports, notifications, and AI context use the same rule. There is no composite 0–100 score, and illustrative climate inputs do not contribute to this category. The 5% and 10% cut-offs are explicit prototype planning tolerances chosen for understandable monitoring, not journal-derived or scientifically validated food-shortage thresholds. Imports, exports, stocks, consumption, access, and rice milling remain outside this indicator. Country projections follow recent trends; the regional recommended forecast remains separate.

## Optional alternative Climate Monitor provider

For a different chat-completions provider for the Climate Monitor analysis button, configure `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL` in `.env` and restart Vite. The API URL must be the complete endpoint. When these are blank, the button uses the OpenAI settings described above. Secrets stay on the server; never add a `VITE_` prefix. Requests use the selected display language. Without a configured provider, this analysis button identifies its translated local-rule fallback. The floating chat always uses `OPENAI_API_KEY` with the OpenAI Responses API. A local GPT-6 Luna chat request was verified with the configured account; the Vercel deployment must be checked separately.

## Verification

`npm test` checks source coverage, missing data, projections, units, model selection, original research outputs, every locale catalog, preserved placeholders, and locale formatting. Desktop/mobile screenshots and interaction checks are saved in `artifacts`.


## Annual spatio-temporal model and slider

The original spatial notebook reads precomputed tables and rasters; it does not contain the original model-fitting implementation. A new, documented MAP pipeline was therefore reconstructed using a regularized, scaled spatial CAR + independent-component mixture (BYM2-style) and AR(1) temporal dependence. It is an approximation with different domain/prior settings, not an exact reproduction of the original fitted model. Original notebooks and their saved outputs remain unchanged.

The sources supplied for this rerun were downloaded:

- [GloRice intensive harvested area, 1961–2021](https://figshare.com/articles/dataset/GloRice_I_Gridded_paddy_rice_distribution_for_the_years_1961_to_2021/25752207), with the archive MD5 verified against Figshare metadata.
- [CHIRPS v3](https://chc.ucsb.edu/data/chirps3): actual annual rainfall subsets for 1981–2021, aggregated to the model grid. Negative NoData values are masked before aggregation.
- [WorldClim CMIP6, 10 arcminutes](https://worldclim.org/data/cmip6/cmip6_clim10m.html): ACCESS-CM2 precipitation under SSP2-4.5 and SSP5-8.5, 2021–2040, plus the WorldClim historical precipitation baseline.
- [GADM 4.1](https://gadm.org/data.html): country boundaries projected to EPSG:6933 for grid-intersection area fractions.

The timeline includes 61 historical years and nine projected years under each scenario: **79 frames, 133 raster/layer images, and 790 country records**. Moving the slider updates the map, totals, uncertainty, country details, table, graph marker, and selected-year export. Historical years have no artificial model intervals. Scenario controls and uncertainty layers are enabled for projected years. Play/pause advances by one year. The original country-production forecasting page is unchanged.

Model resolution is 2°, covering 255 country-intersecting cells. Mixing is fixed at 0.5; proper-CAR ridge regularization is 0.05 before marginal-variance scaling. Rho and precision are selected using 2007–2011 validation after fitting 1981–2006. The selected rho is 0.99 and precision 0.1. Refitting through 2011 precedes the independent 2012–2021 holdout. New test results: **R² 0.970226, MAE 20,333.91 ha, RMSE 60,918.43 ha, n = 2,550**. Test covariates use observed CHIRPS rainfall, so this evaluates conditional harvested-area forecasts rather than a joint weather/harvest forecasting service. The full model is subsequently refitted through 2021. Forty-one missing rainfall values in one boundary cell are imputed from training-period rainfall statistics.

Every 2022–2030 harvested-area value is calculated from the fitted spatial/temporal model; outputs are not interpolated between two endpoint maps. Rainfall covariates follow an assumed gradual path from the 2012–2021 CHIRPS mean to the WorldClim future/historical precipitation ratio. WorldClim supplies 20-year climate averages, not actual weather for each projected year. Temporal dynamics propagate using AR(1), alongside fixed rainfall and year covariates.

Approximate conditional log-area ranges hold the presence probability fixed. They exclude uncertainty in the presence model, hyperparameter selection, climate ensemble, and annual climate-path assumption. Summed cell/country lower and upper bounds are not regional posterior confidence intervals. Small countries are especially sensitive to the coarse grid. Country totals in **both historical and projected periods** use the same equal-area grid fractions; they are grid-allocated estimates, not official national statistics or exact sums of fine pixels clipped to each country. Fine projected patterns follow 2021 rice pixels; cells without 2021 support are not assigned new rice-field locations. Timor-Leste is outside the ten-country spatial domain.

### Recompute locally

Python 3.11 is used for this pipeline. The website itself only needs Node; it does not require scientific Python at runtime.

```powershell
python -m venv .venv-spatio
.\.venv-spatio\Scripts\python.exe -m pip install -r requirements-spatio.txt
npm run spatio:download
npm run spatio:prepare
npm run spatio:train
npm test
npm run build
```

Downloads are cached; the GloRice archive supports resumable range downloads. `spatio:prepare` saves cropped GloRice arrays, climate grids, equal-area country fractions, and display boundaries. `spatio:train` performs selection, holdout evaluation, full refitting, and all yearly exports. `npm run spatio:render` recolors cached model results with a fixed map scale without refitting. Raw and processed caches plus the virtual environment are excluded from Git.

The website loads `public/research/spatio-timeline.json`, `gadm-spatio.geojson`, and the images in `public/research/timeline/`. Complete numeric outputs are in `spatio-annual-countries.csv`. The model-selection/evaluation report is in `artifacts/spatio-rerun-report.json`; fitted coefficients and grid outputs are in `data/processed/glorice/`. Source file hashes are preserved in the download metadata/report. `npm run research:import` refreshes only the archived notebook outputs and does not replace the new annual timeline.


### Executed notebook visualization cells

`npm run spatio:notebook` executes the supplied notebook’s GloRice visualization cells 32, 37, 39, and 41 against the newly fitted 2030 outputs. It saves `artifacts/spatio-glorice-executed.ipynb`, containing the unchanged selected source cells and their freshly executed figures/tables. The setup uses downloaded GADM boundaries and new grid/country CSVs and projected GeoTIFFs. The unrelated FAO ADM1 and APRA500 legacy sections are excluded. Kernel configuration is temporary; no persistent user kernel registration is created. This reruns the original visualization code, while model fitting remains the documented reconstructed pipeline described above.
