import { useEffect, useRef } from "react";

export function ReferencePage({ html, page, onReady }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    rootRef.current.innerHTML = html;
    onReady?.(rootRef.current);

    return () => {
      if (rootRef.current) {
        rootRef.current.innerHTML = "";
      }
    };
  }, [html, onReady, page]);

  return <div ref={rootRef} className="h-full overflow-auto bg-slate-50" data-reference-page={page} />;
}
