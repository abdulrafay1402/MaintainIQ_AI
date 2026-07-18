import { useEffect, useState } from 'react';

// Debounces fast-changing values (search inputs) so each keystroke
// doesn't trigger a server round-trip.
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
