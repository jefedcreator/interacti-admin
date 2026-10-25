import { useCallback, useEffect, useRef } from 'react';

/**
 * Dandys' `useDebounce`: the function it returns calls `callback` with the last value it was given,
 * once `delay` ms pass without another call. A call still waiting is dropped on unmount.
 *
 * Two changes from Dandys': the returned function keeps one identity across renders, and the
 * timeout calls the latest `callback` rather than the one from the render that started it.
 */
export function useDebounce(
  callback: (value: string) => void,
  delay = 500,
): (value: string) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return useCallback(
    (value: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callbackRef.current(value), delay);
    },
    [delay],
  );
}
