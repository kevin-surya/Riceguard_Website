import { useEffect, useRef, useState } from 'react';
import { Languages, LoaderCircle } from 'lucide-react';
import { changeLanguage, languages, t, useLanguage } from './i18n';

export default function LanguageSelect() {
  const language = useLanguage();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);
  const select = async (code: string) => {
    const request = ++requestId.current;
    setLoading(true); setFailed(false);
    try { await changeLanguage(code); } catch { if (request === requestId.current) setFailed(true); }
    finally { if (request === requestId.current) setLoading(false); }
  };
  useEffect(() => {
    try { const saved = localStorage.getItem('riceguard-language'); if (saved && saved !== 'en' && languages.some(item => item.code === saved)) void select(saved); } catch { /* Default language is English. */ }
  }, []);
  return <div className="language-control" title={t('English is the source language. Other languages are machine translations; check the English version for technical interpretation.')}>
    {loading ? <LoaderCircle size={16} className="spin" /> : <Languages size={16} />}
    <label className="sr-only" htmlFor="language-selector">{t('Choose language')}</label>
    <select id="language-selector" data-testid="language-select" aria-label={t('Choose language')} value={language} onChange={event => void select(event.target.value)} aria-busy={loading}>
      {languages.map(item => <option key={item.code} value={item.code} lang={item.code}>{item.native} · {item.name}</option>)}
    </select>
    {failed && <span role="status" className="language-error">English</span>}
  </div>;
}
