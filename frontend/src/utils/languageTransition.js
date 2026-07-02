const LANGUAGE_TRANSITION_DURATION = 620;

export function runLanguageTransition(nextLanguage, applyChange) {
  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const finishLanguageMotion = () => {
    root.classList.remove("language-switching", "language-switch-rtl", "language-switch-ltr");
  };

  root.classList.add("language-switching", nextLanguage === "ar" ? "language-switch-rtl" : "language-switch-ltr");

  if (!prefersReducedMotion && document.startViewTransition) {
    const transition = document.startViewTransition(applyChange);
    transition.finished.finally(finishLanguageMotion);
    return transition;
  }

  applyChange();
  window.setTimeout(finishLanguageMotion, LANGUAGE_TRANSITION_DURATION);
  return null;
}
