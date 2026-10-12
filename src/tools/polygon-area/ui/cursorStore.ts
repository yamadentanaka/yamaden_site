// カーソル位置のピクセル座標。座標表示だけが購読し、カーソルが動くたびにツール全体を描き直さないようにする
import { useEffect, useState } from "preact/hooks";

export type CursorPixel = readonly [number, number] | null;

export interface CursorStore {
  get: () => CursorPixel;
  set: (pixel: CursorPixel) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createCursorStore(): CursorStore {
  let current: CursorPixel = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (pixel) => {
      if (current?.[0] === pixel?.[0] && current?.[1] === pixel?.[1]) return;
      current = pixel;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useCursorPixel(store: CursorStore): CursorPixel {
  const [pixel, setPixel] = useState(store.get());
  useEffect(() => store.subscribe(() => setPixel(store.get())), [store]);
  return pixel;
}
