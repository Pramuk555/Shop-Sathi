/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext();

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('appLanguage') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('appLanguage', language);
    // Update the HTML lang attribute for accessibility/SEO
    document.documentElement.lang = language;
  }, [language]);

  // Translation helper function
  const t = (key) => {
    try {
      return translations[language][key] || key;
    } catch {
      console.warn(`Translation key "${key}" not found in language "${language}"`);
      return key;
    }
  };

  const value = {
    language,
    setLanguage,
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
