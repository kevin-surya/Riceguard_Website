/** Monthly point anomalies. Both periods use the same ERA5 dataset and calendar month. */
export function monthlyAnomaly(current, normal) {
  const valid = value => typeof value === 'number' && Number.isFinite(value);
  const temperature = valid(current?.temperatureMeanC) && valid(normal?.temperatureMeanC)
    ? current.temperatureMeanC - normal.temperatureMeanC : null;
  const rain = valid(current?.precipitationMm) && current.precipitationMm >= 0 && valid(normal?.precipitationMm) && normal.precipitationMm > 0
    ? (current.precipitationMm - normal.precipitationMm) / normal.precipitationMm * 100 : null;
  return { temperature, rain };
}

export function climateFor(data, code, period = data.latestPeriod) {
  const point = data.points[code];
  const current = point?.months[period];
  const normal = point?.normals[period?.slice(5, 7)];
  const complete = data.periods.includes(period) && current && normal?.completeYears === 30;
  return {
    ...(complete ? monthlyAnomaly(current, normal) : { temperature: null, rain: null }),
    available: Boolean(complete), countryCode: code, period, baseline: data.baseline,
    source: data.source.name, sourceUrl: data.source.url, kind: data.source.kind,
    location: point?.location ?? null, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null,
    current: complete ? current : null, normal: complete ? normal : null, retrievedAt: data.retrievedAt,
    scope: 'one monitoring point; not a national average or field observation',
  };
}
