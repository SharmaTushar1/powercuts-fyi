import { useEffect, useState } from 'react';

export function formatDuration(
  fromIso: string,
  toIso?: string,
  _tick = 0,
): string {
  const start = new Date(fromIso).getTime();
  const end = toIso ? new Date(toIso).getTime() : Date.now();
  const totalMin = Math.max(0, Math.floor((end - start) / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function useElapsed(fromIso: string, toIso?: string): string {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (toIso) {
      return;
    }
    const id = setInterval(() => setTick((current) => current + 1), 30_000);
    return () => clearInterval(id);
  }, [fromIso, toIso]);

  return formatDuration(fromIso, toIso, tick);
}
