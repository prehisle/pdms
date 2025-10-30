import { useCallback, useEffect, useState } from "react";

const enum BooleanString {
  True = "true",
  False = "false",
}

const readBooleanFromStorage = (key: string, fallback: boolean): boolean => {
  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem(key);
  if (saved === BooleanString.True) {
    return true;
  }
  if (saved === BooleanString.False) {
    return false;
  }
  return fallback;
};

/**
 * 持久化布尔状态到 localStorage，提供与 useState 相同的调用接口。
 */
export const usePersistentBoolean = (
  key: string,
  defaultValue: boolean,
): readonly [boolean, (value: boolean | ((prev: boolean) => boolean)) => void] => {
  const [value, setValue] = useState<boolean>(() => readBooleanFromStorage(key, defaultValue));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(key, value ? BooleanString.True : BooleanString.False);
  }, [key, value]);

  const update = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => (typeof next === "function" ? (next as (prev: boolean) => boolean)(prev) : next));
    },
    [],
  );

  return [value, update] as const;
};
