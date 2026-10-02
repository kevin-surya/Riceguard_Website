/** Baseline models. These are exploratory indicators, not food-security classifications. */
export const countries = [
  { code: 'IDN', name: 'Indonesia', flag: '🇮🇩', location: 'Karawang, Jawa Barat', lat: -6.30, lon: 107.30, label: [118, -4], temperature: 1.4, rain: -18 },
  { code: 'VNM', name: 'Vietnam', flag: '🇻🇳', location: 'Can Tho, Delta Mekong', lat: 10.04, lon: 105.79, label: [109.5, 16], temperature: 1.2, rain: -12 },
  { code: 'THA', name: 'Thailand', flag: '🇹🇭', location: 'Suphan Buri', lat: 14.47, lon: 100.12, label: [100, 17], temperature: 1.8, rain: -28 },
  { code: 'MMR', name: 'Myanmar', flag: '🇲🇲', location: 'Pathein, Ayeyarwady', lat: 16.78, lon: 94.73, label: [95, 22], temperature: 1.6, rain: -22 },
  { code: 'PHL', name: 'Filipina', flag: '🇵🇭', location: 'Muñoz, Nueva Ecija', lat: 15.72, lon: 120.90, label: [125, 14], temperature: 1.5, rain: 24 },
  { code: 'KHM', name: 'Kamboja', flag: '🇰🇭', location: 'Battambang', lat: 13.10, lon: 103.20, label: [104.5, 11], temperature: 1.3, rain: -15 },
  { code: 'LAO', name: 'Laos', flag: '🇱🇦', location: 'Savannakhet', lat: 16.57, lon: 104.75, label: [103.5, 20], temperature: 1.0, rain: -8 },
  { code: 'MYS', name: 'Malaysia', flag: '🇲🇾', location: 'Alor Setar, Kedah', lat: 6.12, lon: 100.37, label: [109, 4], temperature: 0.9, rain: 5 },
  { code: 'SGP', name: 'Singapura', flag: '🇸🇬', location: 'Singapura', lat: 1.35, lon: 103.82, label: [104, 0], temperature: 1.1, rain: 8 },
  { code: 'BRN', name: 'Brunei', flag: '🇧🇳', location: 'Bandar Seri Begawan', lat: 4.90, lon: 114.94, label: [115, 6], temperature: 0.8, rain: 3 },
  { code: 'TLS', name: 'Timor-Leste', flag: '🇹🇱', location: 'Baucau', lat: -8.47, lon: 126.45, label: [127, -10], temperature: 1.2, rain: -16 },
];

export function seriesFor(snapshot, code) {
  if (code !== 'SEA') return snapshot.countries[code] || [];
  const years = snapshot.countries.IDN.map(point => point.year);
  return years.map(year => {
    const rows = countries.map(country => snapshot.countries[country.code].find(point => point.year === year));
    const riceRows = rows.filter(point => point?.rice != null);
    return {
      year,
      rice: riceRows.reduce((sum, point) => sum + point.rice, 0),
      population: rows.reduce((sum, point) => sum + (point?.population || 0), 0),
      riceCoverage: riceRows.length,
      populationProjected: rows.some(point => point?.populationProjected),
    };
  });
}

export function slope(points, key) {
  const rows = points.filter(point => Number.isFinite(point[key])).slice(-10);
  if (rows.length < 2) return 0;
  const xMean = rows.reduce((sum, point) => sum + point.year, 0) / rows.length;
  const yMean = rows.reduce((sum, point) => sum + point[key], 0) / rows.length;
  return rows.reduce((sum, point) => sum + (point.year - xMean) * (point[key] - yMean), 0)
    / rows.reduce((sum, point) => sum + (point.year - xMean) ** 2, 0);
}

export function forecast(points, endYear = 2030, scenario = 'trend', stress = 0) {
  if (!points.length) return [];
  const base = points.at(-1);
  const riceSlope = slope(points, 'rice');
  const popSlope = slope(points, 'population');
  return Array.from({ length: Math.max(0, endYear - base.year) }, (_, index) => {
    const step = index + 1;
    const rice = base.rice == null ? null : scenario === 'infographic'
      ? base.rice * Math.pow(1.0156, step / 6)
      : Math.max(0, base.rice + riceSlope * step);
    const population = scenario === 'infographic' ? base.population * Math.pow(1.0906, step / 6)
      : Math.max(0, base.population + popSlope * step);
    const factor = scenario === 'resilient' ? 1 + 0.012 * step : 1;
    return { year: base.year + step, rice: rice == null ? null : Math.max(0, rice * factor * (1 - stress / 100 * step / (endYear - base.year))), population };
  });
}

export function indicator(points, projection, climate) {
  const base = points.at(-1);
  const end = projection.at(-1) || base;
  if (base?.rice == null || !base.population || !end.population) return { score: null, level: 'unknown', change: null, supply: null };
  const supply = end.rice / end.population * 1000;
  const change = (supply / (base.rice / base.population * 1000) - 1) * 100;
  // Transparent heuristic: per-capita production decline plus illustrative climate stress.
  const score = Math.round(Math.min(100, Math.max(0, -change * 4) + Math.max(0, climate.temperature) * 13 + Math.abs(climate.rain) * 0.55));
  return { score, level: score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low', change, supply };
}

export function climateFor(code) {
  const rows = code === 'SEA' ? countries : countries.filter(country => country.code === code);
  return {
    temperature: rows.reduce((sum, country) => sum + country.temperature, 0) / rows.length,
    rain: rows.reduce((sum, country) => sum + country.rain, 0) / rows.length,
  };
}

export function changePercent(current, previous) {
  return previous > 0 && current != null ? (current / previous - 1) * 100 : null;
}

export function insights(country, risk, climate, year) {
  const actions = [];
  if (climate.temperature >= 1.3) actions.push('Evaluasi kalender tanam dan varietas toleran panas bersama penyuluh setempat.');
  if (climate.rain < -15) actions.push('Prioritaskan audit ketersediaan air, efisiensi irigasi, dan cadangan air di sentra produksi.');
  if (climate.rain > 15) actions.push('Periksa drainase dan kesiapan penanganan genangan di lahan yang rentan banjir.');
  if (risk.change != null && risk.change < 0) actions.push('Tinjau cadangan serta distribusi pangan; proyeksi produksi padi per kapita menurun.');
  if (!actions.length) actions.push('Lanjutkan pemantauan hasil panen, kondisi air, dan distribusi pangan secara berkala.');
  return {
    summary: risk.score == null ? `Data produksi padi ${country} belum tersedia. Analisis kecukupan produksi belum dapat dihitung.`
      : `Pada skenario ${year}, ${country} memiliki skor pantauan ${risk.score}/100. Produksi padi per kapita diproyeksikan ${risk.change < 0 ? 'turun' : 'naik'} ${Math.abs(risk.change).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% dari 2024.`,
    actions,
  };
}
