import { useEffect, useRef } from "react";

/**
 * Corre `callback` solo cuando el componente se desmonta, siempre con la
 * version mas reciente del callback (evita el problema de closure viejo
 * que tendria un useEffect con cleanup y deps vacias).
 */
export function useEffectOnUnmount(callback: () => void): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return () => callbackRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
