import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppLanguage,
  getHtmlLang,
  getLocaleTag,
  getStoredLanguage,
  setStoredLanguage,
  tr,
} from '../shared/i18n';

interface I18nContextValue {
  lang: AppLanguage;
  setLanguage: (next: AppLanguage) => void;
  localeTag: string;
  t: <T = string>(zhTw: T, zhCn: T, en: T) => T;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'zh-TW',
  setLanguage: () => {},
  localeTag: 'zh-TW',
  t: (zhTw) => zhTw,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(() => getStoredLanguage());

  const setLanguage = useCallback((next: AppLanguage) => {
    setLangState(next);
    setStoredLanguage(next);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = getHtmlLang(lang);
    document.documentElement.setAttribute('data-lang', lang);

    const title = tr(
      lang,
      'Waynote — 簡約旅程規劃',
      'Waynote — 简约旅程规划',
      'Waynote — Effortless Travel Planner'
    );
    const description = tr(
      lang,
      '簡約現代的跨裝置旅程規劃工具，整合行程時間軸、AI 路線規劃、即時天氣、開支預算與百寶箱。',
      '简约现代的跨设备旅程规划工具，整合行程时间轴、AI 路线规划、实时天气、开支预算与百宝箱。',
      'A sleek cross-device travel planner with timelines, AI route planning, live weather, expense splitting, and travel essentials.'
    );
    document.title = title;
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
  }, [lang]);

  const localeTag = useMemo(() => getLocaleTag(lang), [lang]);

  const t = useCallback(
    <T = string,>(zhTw: T, zhCn: T, en: T): T => tr(lang, zhTw, zhCn, en),
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLanguage,
      localeTag,
      t,
    }),
    [lang, setLanguage, localeTag, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
