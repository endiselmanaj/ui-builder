import { useState, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const MIN_PERCENT = 20;
const MAX_PERCENT = 80;
const DEFAULT_PERCENT = 50;

function clampPercent(value: number): number {
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(value)));
}

export function useDivider() {
  const [leftPercent, setLeftPercent] = useState(DEFAULT_PERCENT);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    []
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const raw = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(clampPercent(raw));
    },
    [isDragging]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    []
  );

  const onDoubleClick = useCallback(() => {
    setLeftPercent(DEFAULT_PERCENT);
  }, []);

  return {
    leftPercent,
    isDragging,
    containerProps: {
      onPointerMove,
      onPointerUp,
      style: isDragging ? { userSelect: "none" as const } : {},
    },
    dividerProps: {
      onPointerDown,
      onDoubleClick,
    },
  };
}
