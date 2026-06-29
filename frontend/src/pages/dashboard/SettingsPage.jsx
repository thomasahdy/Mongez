import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router-dom";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { getCurrentUser, updateProfile } from "../../lib/usersApi";

function SettingsPage() {
  const { setPath } = useOutletContext();
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [profile, setProfile] = useState({ name: "", email: "", language: "en" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setPath?.([
      { name: t("common.workspace"), color: "text-slate-400", ref: "/spaces" },
      { name: t("legacySettingsPage.breadcrumb"), color: "text-slate-800", ref: "" },
    ]);
  }, [setPath, t]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        setProfile({
          name: user?.name || "",
          email: user?.email || "",
          language: user?.language || "en",
        });
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleChange = (field) => (event) => {
    setProfile((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess("");

    try {
      await updateProfile({
        name: profile.name,
        language: profile.language,
      });
      setSuccess(t("legacySettingsPage.success"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">{t("legacySettingsPage.loading")}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 px-8 py-8" dir={isRTL ? "rtl" : "ltr"}>
      <div className={`mx-auto max-w-4xl space-y-6 ${isRTL ? "text-right" : "text-left"}`}>
        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-500">{t("legacySettingsPage.eyebrow")}</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">{t("legacySettingsPage.title")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{t("legacySettingsPage.description")}</p>
        </section>

        <form onSubmit={handleSubmit} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_16px_35px_rgba(15,23,42,0.05)] space-y-4">
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

          <label className="block text-sm font-medium text-slate-700">
            {t("legacySettingsPage.name")}
            <input
              className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 ${isRTL ? "text-right" : "text-left"}`}
              value={profile.name}
              onChange={handleChange("name")}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t("legacySettingsPage.email")}
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 text-left"
              value={profile.email}
              readOnly
              dir="ltr"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t("legacySettingsPage.language")}
            <select
              className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 ${isRTL ? "text-right" : "text-left"}`}
              value={profile.language}
              onChange={handleChange("language")}
            >
              <option value="en">{t("settingsProfilePage.english")}</option>
              <option value="ar">{t("settingsProfilePage.arabic")}</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {saving ? t("legacySettingsPage.saving") : t("legacySettingsPage.saveChanges")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SettingsPage;
