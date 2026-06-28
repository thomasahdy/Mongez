import { useTranslation } from "react-i18next";

export function useLocaleDirection() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "en";
  const isRTL = i18n.dir(language) === "rtl";
  const dir = isRTL ? "rtl" : "ltr";

  return {
    isRTL,
    isRtl: isRTL,
    dir,
    locale: isRTL ? "ar-EG" : "en-US",
    language,
  };
}

export default useLocaleDirection;
