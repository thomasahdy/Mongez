import { useTranslation } from "react-i18next";

export function useLocaleDirection() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "en";
  const isRTL = i18n.dir(language) === "rtl";

  return {
    isRTL,
    locale: isRTL ? "ar-EG" : "en-US",
    language,
  };
}
