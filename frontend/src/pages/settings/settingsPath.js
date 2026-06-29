export function buildSettingsPath(t, currentLabel, currentRef) {
  return [
    {
      name: t("settingsProfilePage.breadcrumbSettings"),
      color: "text-slate-400",
      ref: "/settings",
    },
    {
      name: currentLabel,
      color: "text-slate-800",
      ref: currentRef,
    },
  ];
}
