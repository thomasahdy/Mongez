import { useMemo, useState } from "react";

export function useVirtualList(items, { itemHeight = 72, overscan = 6 } = {}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const count = items.length;
  const totalHeight = count * itemHeight;

  const range = useMemo(() => {
    if (!count || !viewportHeight) {
      return { start: 0, end: Math.min(count, overscan * 2) };
    }

    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(viewportHeight / itemHeight);
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(count, visibleStart + visibleCount + overscan);
    return { start, end };
  }, [count, itemHeight, overscan, scrollTop, viewportHeight]);

  const virtualItems = useMemo(
    () =>
      items.slice(range.start, range.end).map((item, offset) => {
        const index = range.start + offset;
        return {
          item,
          index,
          offsetTop: index * itemHeight,
        };
      }),
    [items, itemHeight, range.end, range.start],
  );

  const handleScroll = (event) => {
    setScrollTop(event.currentTarget.scrollTop);
    setViewportHeight(event.currentTarget.clientHeight);
  };

  const measureViewport = (node) => {
    if (node) {
      setViewportHeight(node.clientHeight);
    }
  };

  return {
    handleScroll,
    measureViewport,
    totalHeight,
    virtualItems,
  };
}
