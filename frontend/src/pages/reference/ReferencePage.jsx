import { useEffect, useRef } from "react";

const BLOCKED_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "style",
]);

const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "formaction", "action"]);

const isUnsafeUrl = (value) => {
  const normalized = value.trim().replace(/\s+/g, "").toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:")
  );
};

const sanitizeReferenceHtml = (html) => {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html ?? "";
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html ?? "", "text/html");

  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    if (BLOCKED_TAGS.has(element.tagName.toLowerCase())) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();

      if (attributeName.startsWith("on") || attributeName === "style" || attributeName === "srcdoc") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (URL_ATTRIBUTES.has(attributeName) && isUnsafeUrl(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return document.body.innerHTML;
};

export function ReferencePage({ html, page, onReady }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const rootElement = rootRef.current;

    rootElement.innerHTML = sanitizeReferenceHtml(html);
    onReady?.(rootElement);

    return () => {
      rootElement.innerHTML = "";
    };
  }, [html, onReady, page]);

  return <div ref={rootRef} className="h-full overflow-auto bg-slate-50" data-reference-page={page} />;
}
