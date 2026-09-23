interface BarItem {
  label: string;
  count: number;
}

interface BarListProps {
  items: BarItem[];
  emptyLabel?: string;
  accent?: boolean;
  max?: number;
}

export default function BarList({ items, emptyLabel = 'No data yet', accent = true, max }: BarListProps) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-ink-mute py-6 text-center">{emptyLabel}</p>;
  }

  const peak = max ?? Math.max(...items.map((i) => i.count), 1);

  const widthPct = (count: number) => {
    if (count <= 0) return 0;
    return Math.max((count / peak) * 100, count > 0 ? 2 : 0);
  };

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="w-24 sm:w-28 truncate text-xs text-ink-soft capitalize" title={item.label}>
            {item.label}
          </span>
          <div className="flex-1 h-2 rounded-full bg-dark-800 overflow-hidden min-w-0">
            <div
              className={`h-full rounded-full transition-all duration-500 ${accent ? 'accent-bg' : 'bg-emerald-500'}`}
              style={{ width: `${widthPct(item.count)}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs tabular-nums text-ink-mute">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}
