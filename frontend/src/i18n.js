import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/translation.json";
import ar from "./locales/ar/translation.json";
import appPagesEn from "./locales/en/appPages";
import appPagesAr from "./locales/ar/appPages";

const storedLanguage =
  typeof window !== "undefined" ? window.localStorage.getItem("mongez.language") : null;
const preferredLanguage =
  storedLanguage ||
  (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en");

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        ...en,
        ...appPagesEn,
      },
    },
    ar: {
      translation: {
        ...ar,
        ...appPagesAr,
      },
    },
  },
  lng: preferredLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
