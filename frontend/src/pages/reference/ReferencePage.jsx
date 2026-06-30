import { useEffect, useRef } from "react";

export function ReferencePage({ html, page, onReady }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const rootElement = rootRef.current;

    rootElement.innerHTML = html;
    onReady?.(rootElement);

    return () => {
      rootElement.innerHTML = "";
    };
  }, [html, onReady, page]);

  return <div ref={rootRef} className="h-full overflow-auto bg-slate-50" data-reference-page={page} />;
}
