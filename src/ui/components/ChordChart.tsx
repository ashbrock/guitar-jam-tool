// A light, monochrome chord chart (DESIGN.md §7): nut at the top, low E on the left, circles only,
// 6 strings × 5 frets. Proportions come from the chart width.
import type { PlacedShape } from '../../theory/shapes';

export function ChordChart({ shape, width }: { shape: PlacedShape; width: number }) {
  const w = width;
  const top = w * 0.16;
  const left = w * 0.12;
  const right = w * 0.06;
  const gs = (w - left - right) / 5;
  const fh = gs * 1.22;
  const frets = 5;
  const gridH = fh * frets;
  const h = top + gridH + w * 0.03;
  const r = gs * 0.24;
  const base = shape.baseFret;
  const yOf = (f: number) => top + (f - base + 0.5) * fh;
  const barre = shape.barre;

  return (
    <svg class="chart" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <rect x={left + i * gs - 0.5} y={top} width={1} height={gridH} fill="var(--chart-line)" />
      ))}
      {Array.from({ length: frets + 1 }, (_, f) => {
        const nut = f === 0 && base === 1;
        return (
          <rect
            x={left - 0.5}
            y={top + f * fh - (nut ? 1.5 : 0.5)}
            width={gs * 5 + 1}
            height={nut ? 3 : 1}
            rx={nut ? 1 : 0}
            fill={nut ? 'var(--text)' : 'var(--chart-line)'}
          />
        );
      })}
      {base > 1 && (
        <text x={left - gs * 0.4} y={top + fh * 0.62} text-anchor="end" font-size={Math.max(10, w * 0.07)} fill="var(--muted)">
          {base}
        </text>
      )}
      {barre && (
        <rect
          x={left + barre[1] * gs - r}
          y={yOf(barre[0]) - r * 0.8}
          width={(barre[2] - barre[1]) * gs + 2 * r}
          height={r * 1.6}
          rx={r * 0.8}
          fill="var(--text)"
        />
      )}
      {shape.frets.map((f, i) => {
        const x = left + i * gs;
        const yTop = top - fh * 0.5;
        const s = r * 0.7;
        if (f < 0) {
          return (
            <path
              d={`M${x - s} ${yTop - s}L${x + s} ${yTop + s}M${x + s} ${yTop - s}L${x - s} ${yTop + s}`}
              stroke="var(--muted)"
              stroke-width={1.2}
              stroke-linecap="round"
            />
          );
        }
        if (f === 0) return <circle cx={x} cy={yTop} r={s} fill="none" stroke="var(--text)" stroke-width={1.2} />;
        const onBarre = barre && f === barre[0] && i >= barre[1] && i <= barre[2];
        return onBarre ? null : <circle cx={x} cy={yOf(f)} r={r} fill="var(--text)" />;
      })}
    </svg>
  );
}
