import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";

interface UseTreeSiderStateOptions {
  widthStorageKey: string;
  collapsedStorageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  contentMinWidth: number;
}

const parseWidth = (value: string | null, fallback: number, min: number, max: number): number => {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (Number.isFinite(parsed)) {
    return Math.min(Math.max(parsed, min), max);
  }
  return fallback;
};

const readCollapseState = (key: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const saved = window.localStorage.getItem(key);
  return saved === "true";
};

const readWidth = (
  key: string,
  fallback: number,
  minWidth: number,
  maxWidth: number,
): number => {
  if (typeof window === "undefined") {
    return fallback;
  }
  const saved = window.localStorage.getItem(key);
  return parseWidth(saved, fallback, minWidth, maxWidth);
};

const enum BooleanString {
  True = "true",
  False = "false",
}

export interface TreeSiderState {
  layoutRef: RefObject<HTMLDivElement>;
  treeWidth: number;
  treeCollapsed: boolean;
  isResizing: boolean;
  toggleButtonStyle: CSSProperties;
  siderDynamicStyle: CSSProperties;
  toggleCollapsed: () => void;
  handleResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
  handleResizeTouchStart: (event: ReactTouchEvent<HTMLDivElement>) => void;
  clampWidth: (width: number) => number;
}

/**
 * 管理分类侧边栏的宽度、折叠状态以及拖拽事件。
 */
export const useTreeSiderState = ({
  widthStorageKey,
  collapsedStorageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  contentMinWidth,
}: UseTreeSiderStateOptions): TreeSiderState => {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [treeCollapsed, setTreeCollapsed] = useState(() => readCollapseState(collapsedStorageKey));
  const [treeWidth, setTreeWidth] = useState(() =>
    readWidth(widthStorageKey, defaultWidth, minWidth, maxWidth),
  );
  const [isResizing, setIsResizing] = useState(false);

  const clampWidth = useCallback(
    (candidate: number) => {
      const layoutWidth = layoutRef.current?.getBoundingClientRect().width ?? maxWidth;
      const maxAllowed = Math.max(minWidth, Math.min(maxWidth, layoutWidth - contentMinWidth));
      return Math.round(Math.min(Math.max(candidate, minWidth), maxAllowed));
    },
    [contentMinWidth, maxWidth, minWidth],
  );

  const persistWidth = useCallback(
    (width: number) => {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.setItem(widthStorageKey, String(width));
    },
    [widthStorageKey],
  );

  const persistCollapsed = useCallback(
    (collapsed: boolean) => {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.setItem(collapsedStorageKey, collapsed ? BooleanString.True : BooleanString.False);
    },
    [collapsedStorageKey],
  );

  const handleResize = useCallback(
    (clientX: number) => {
      if (treeCollapsed) {
        return;
      }
      const layoutRect = layoutRef.current?.getBoundingClientRect();
      if (!layoutRect) {
        return;
      }
      const offsetX = clientX - layoutRect.left;
      const nextWidth = clampWidth(offsetX);
      setTreeWidth(nextWidth);
      persistWidth(nextWidth);
    },
    [clampWidth, persistWidth, treeCollapsed],
  );

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (treeCollapsed) {
        return;
      }
      event.preventDefault();
      setIsResizing(true);
      handleResize(event.clientX);
    },
    [handleResize, treeCollapsed],
  );

  const handleResizeTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (treeCollapsed) {
        return;
      }
      event.preventDefault();
      setIsResizing(true);
      handleResize(event.touches[0]?.clientX ?? 0);
    },
    [handleResize, treeCollapsed],
  );

  const toggleCollapsed = useCallback(() => {
    setTreeCollapsed((prev) => {
      const next = !prev;
      persistCollapsed(next);
      if (!next) {
        setTreeWidth((prevWidth) => {
          const width = clampWidth(prevWidth);
          persistWidth(width);
          return width;
        });
      }
      return next;
    });
  }, [clampWidth, persistCollapsed, persistWidth]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      handleResize(event.clientX);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        handleResize(touch.clientX);
      }
    };
    const handleTouchEnd = () => {
      setIsResizing(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleResize, isResizing]);

  useEffect(() => {
    if (treeCollapsed && isResizing) {
      setIsResizing(false);
    }
  }, [isResizing, treeCollapsed]);

  useEffect(() => {
    const handleWindowResize = () => {
      setTreeWidth((prev) => {
        const next = clampWidth(prev);
        persistWidth(next);
        return next;
      });
    };

    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [clampWidth, persistWidth]);

  const toggleButtonStyle = useMemo<CSSProperties>(() => {
    if (treeCollapsed) {
      return {
        width: 32,
        height: 32,
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 20,
      };
    }
    return {
      width: 32,
      height: 32,
      position: "absolute",
      top: 16,
      right: -12,
      zIndex: 20,
    };
  }, [treeCollapsed]);

  const siderDynamicStyle = useMemo<CSSProperties>(
    () => ({
      position: "relative",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      alignItems: treeCollapsed ? "center" : "stretch",
      justifyContent: treeCollapsed ? "center" : "flex-start",
      gap: treeCollapsed ? 0 : 16,
      overflow: treeCollapsed ? "visible" : "hidden",
    }),
    [treeCollapsed],
  );

  return {
    layoutRef,
    treeWidth,
    treeCollapsed,
    isResizing,
    toggleButtonStyle,
    siderDynamicStyle,
    toggleCollapsed,
    handleResizeStart,
    handleResizeTouchStart,
    clampWidth,
  };
};
