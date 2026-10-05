export const languages = [
  { code: 'en', locale: 'en-US', native: 'English', name: 'English', countries: 'Singapore · Philippines' },
  { code: 'id', locale: 'id-ID', native: 'Bahasa Indonesia', name: 'Indonesian', countries: 'Indonesia' },
  { code: 'ms', locale: 'ms-MY', native: 'Bahasa Melayu', name: 'Malay', countries: 'Malaysia · Brunei · Singapore' },
  { code: 'th', locale: 'th-TH', native: 'ไทย', name: 'Thai', countries: 'Thailand' },
  { code: 'vi', locale: 'vi-VN', native: 'Tiếng Việt', name: 'Vietnamese', countries: 'Vietnam' },
  { code: 'my', locale: 'my-MM', native: 'မြန်မာ', name: 'Burmese', countries: 'Myanmar' },
  { code: 'km', locale: 'km-KH', native: 'ខ្មែរ', name: 'Khmer', countries: 'Cambodia' },
  { code: 'lo', locale: 'lo-LA', native: 'ລາວ', name: 'Lao', countries: 'Laos' },
  { code: 'fil', locale: 'fil-PH', native: 'Filipino', name: 'Filipino', countries: 'Philippines' },
  { code: 'zh', locale: 'zh-SG', native: '中文', name: 'Mandarin Chinese', countries: 'Singapore' },
  { code: 'ta', locale: 'ta-SG', native: 'தமிழ்', name: 'Tamil', countries: 'Singapore' },
  { code: 'tet', locale: 'en-TL', native: 'Tetun', name: 'Tetum', countries: 'Timor-Leste' },
  { code: 'pt', locale: 'pt-TL', native: 'Português', name: 'Portuguese', countries: 'Timor-Leste' },
];
const catalogs = {};
const aliases = {};
const listeners = new Set();
let language = 'en';
export const getLanguage = () => language;
export const getLocale = () => languages.find(item => item.code === language)?.locale || 'en-US';
export const subscribeLanguage = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export function registerCatalog(code, catalog) {
  catalogs[code] = catalog;
  if (code === 'en') for (const [key, value] of Object.entries(catalog)) aliases[value] ??= key;
}
export function activateLanguage(code) {
  if (!languages.some(item => item.code === code) || !catalogs[code]) return false;
  language = code;
  for (const listener of listeners) listener();
  return true;
}
export function t(value, parameters = {}) {
  if (value == null) return '';
  const text = String(value);
  const key = Object.hasOwn(catalogs.en || {}, text) ? text : aliases[text] || text;
  const translated = catalogs[language]?.[key] ?? catalogs.en?.[key] ?? text;
  return translated.replace(/\{(p\d+)\}/g, (token, name) => Object.hasOwn(parameters, name) ? typeof parameters[name] === 'string' ? t(parameters[name]) : String(parameters[name] ?? '') : token);
}
export function formatNumber(value, digits = 2, minimumDigits = digits) {
  return value == null ? '—' : new Intl.NumberFormat(getLocale(), { maximumFractionDigits: digits, minimumFractionDigits: minimumDigits }).format(value);
}
export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat(getLocale(), options).format(new Date(value));
}
