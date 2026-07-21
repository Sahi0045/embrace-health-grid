import { useMemo } from "react";

/** Deterministic decorative QR-style grid. Not a scannable code. */
export function QrPlaceholder({ value, size = 220 }: { value: string; size?: number }) {
  const cells = 21;
  const grid = useMemo(() => {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
    const out: boolean[] = [];
    for (let i = 0; i < cells * cells; i++) {
      h = (h * 1103515245 + 12345) | 0;
      out.push(((h >> 16) & 1) === 1);
    }
    return out;
  }, [value]);

  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return inBox(0, 0) || inBox(0, cells - 7) || inBox(cells - 7, 0);
  };

  const finderFill = (r: number, c: number) => {
    const local = (br: number, bc: number) => {
      const rr = r - br,
        cc = c - bc;
      if (rr === 0 || rr === 6 || cc === 0 || cc === 6) return true;
      if (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4) return true;
      return false;
    };
    if (r < 7 && c < 7) return local(0, 0);
    if (r < 7 && c >= cells - 7) return local(0, cells - 7);
    if (r >= cells - 7 && c < 7) return local(cells - 7, 0);
    return false;
  };

  const cellSize = size / cells;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md bg-card">
      <rect width={size} height={size} fill="var(--card)" />
      {grid.map((on, i) => {
        const r = Math.floor(i / cells);
        const c = i % cells;
        const fill = isFinder(r, c) ? finderFill(r, c) : on;
        if (!fill) return null;
        return (
          <rect
            key={i}
            x={c * cellSize}
            y={r * cellSize}
            width={cellSize}
            height={cellSize}
            fill="var(--foreground)"
          />
        );
      })}
    </svg>
  );
}
