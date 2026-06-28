import React from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const ToggleLanguage = ({ setLanguage, language }) => {
  const { isRTL } = useLocaleDirection();
  const { i18n } = useTranslation();
  const currentLanguage = language || (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);

  const toggleLanguage = () => {
    const nextLanguage = currentLanguage === "en" ? "ar" : "en";

    if (setLanguage) {
      setLanguage(nextLanguage);
      return;
    }

    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = nextLanguage;
    window.localStorage.setItem("mongez.language", nextLanguage);
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <Button onClick={toggleLanguage} size="sm" className={`border-none ${isRTL ? "flex-row-reverse" : ""}`}>
      <span
        className={`transition ${
          currentLanguage === "en" ? "text-blue-600 font-semibold" : "text-gray-500"
        }`}
      >
        EN
      </span>

      <div className="relative h-5 w-10 rounded-full bg-gray-300">
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${
            currentLanguage === "ar" ? "right-5" : "left-1"
          }`}
        />
      </div>

      <span
        className={`transition ${
          currentLanguage === "ar" ? "text-blue-600 font-semibold" : "text-gray-500"
        }`}
      >
        AR
      </span>
    </Button>
  );
};

export default ToggleLanguage;
