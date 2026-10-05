import { useSyncExternalStore } from 'react';
import english from './locales/en.json';
import { activateLanguage, getLanguage, getLocale, registerCatalog, subscribeLanguage, t, languages } from './i18n-core.mjs';
export { t, getLocale, languages, formatNumber, formatDate } from './i18n-core.mjs';
registerCatalog('en', english);
const loaders = import.meta.glob<{ default: Record<string, string> }>(['./locales/*.json', '!./locales/en.json', '!./locales/source.json', '!./locales/english-overrides.json']);
const pending = new Map<string, Promise<void>>();
let requested = 0;
export async function changeLanguage(code: string) {
  if (!languages.some(item => item.code === code)) return false;
  const request = ++requested;
  if (code !== 'en') {
    if (!pending.has(code)) pending.set(code, loaders[`./locales/${code}.json`]().then(module => { registerCatalog(code, module.default); }).catch(error => { pending.delete(code); throw error; }));
    await pending.get(code);
  }
  if (request !== requested) return false;
  activateLanguage(code);
  try { localStorage.setItem('riceguard-language', code); } catch { /* Locale remains available in memory. */ }
  document.documentElement.lang = code;
  document.documentElement.dir = 'ltr';
  document.title = t('Rice Guard · Food security in view');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('Rice Guard — paddy production, population, and food-risk monitoring in Southeast Asia.'));
  return true;
}
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en');
}
