import { useEffect, useRef } from "react";

/**
 * Corre `callback` solo cuando el componente se desmonta de verdad, siempre
 * con la version mas reciente del callback (evita el problema de closure
 * viejo que tendria un useEffect con cleanup y deps vacias).
 *
 * En desarrollo, React StrictMode desmonta y vuelve a montar cada componente
 * nada mas crearlo para detectar efectos impuros. Sin proteccion, ese
 * desmontaje de prueba ejecutaria el callback (en el checkout: liberar las
 * butacas recien reservadas) y la compra fallaria siempre. Por eso el
 * callback se difiere un tick y se cancela si el componente ya volvio a
 * montarse.
 */
export function useEffectOnUnmount(callback: () => void): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setTimeout(() => {
        if (!isMountedRef.current) callbackRef.current();
      }, 0);
    };
  }, []);
}
