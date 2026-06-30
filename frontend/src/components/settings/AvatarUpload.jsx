import { useCallback, useRef } from 'react'
import { useTranslation } from "react-i18next";
import Button from '../ui/Button';

const AvatarUpload = ({ initials = "TH", src, onFileSelect, onRemove }) => {
  const { t } = useTranslation();
  const fileRef = useRef(null);

  const handleChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect?.(file);
    e.target.value = "";
  }, [onFileSelect]);

  return (
    <div className="flex items-center gap-5 pb-6 mb-6 border-b border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative w-20 h-20 rounded-full shrink-0 overflow-hidden shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
        aria-label={t("settingsProfilePage.uploadAvatarPhoto")}
      >
        {src ? (
          <img src={src} alt={t("settingsProfilePage.profileAvatar")} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-500 text-white text-[28px] font-bold select-none">
            {initials}
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
          <i className="fa-solid fa-camera text-white text-[20px]" aria-hidden="true" />
        </div>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="flex gap-3">
        <Button variant="outline" size="md" onClick={() => fileRef.current?.click()}>
          {t("settingsProfilePage.uploadAvatar")}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={onRemove}
          className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
        >
          {t("settingsProfilePage.remove")}
        </Button>
      </div>
    </div>
  );
}

export default AvatarUpload
