import { useId, useMemo, useState, type ReactNode } from 'react';
import { en } from '../content/en';
import { MoreText } from './ui';

export interface Column<T> {
  header: string;
  /** Text used for display (when no render) and for search. */
  text: (row: T) => string | null | undefined;
  render?: (row: T) => ReactNode;
  /** Truncate long text with "more". */
  long?: boolean;
  mono?: boolean;
  minWidth?: number;
}

export interface Filter<T> {
  label: string;
  values: (row: T) => string[];
  /** Fixed order of chips; defaults to sorted distinct values. */
  order?: string[];
}

/** Table with sticky header, search box, filter chips and its own horizontal scroll. */
export function DataTable<T>({
  caption,
  rows,
  columns,
  filters = [],
  rowKey,
}: {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  filters?: Filter<T>[];
  rowKey: (row: T, i: number) => string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<number, string[]>>({});

  const chipValues = useMemo(
    () =>
      filters.map((f) => {
        const all = new Set(rows.flatMap((r) => f.values(r)));
        return f.order ? f.order.filter((v) => all.has(v)) : [...all].sort((a, b) => a.localeCompare(b));
      }),
    [filters, rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      for (const [i, f] of filters.entries()) {
        const sel = selected[i];
        if (sel?.length && !f.values(r).some((v) => sel.includes(v))) return false;
      }
      if (!q) return true;
      return columns.some((c) => (c.text(r) ?? '').toLowerCase().includes(q));
    });
  }, [rows, filters, selected, query, columns]);

  const toggle = (i: number, v: string) => {
    const cur = selected[i] ?? [];
    setSelected({ ...selected, [i]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const active = query !== '' || Object.values(selected).some((s) => s.length);

  return (
    <div className="data-table">
      <div className="dt-controls">
        <label className="dt-search">
          <span className="visually-hidden">
            {en.common.search} {caption}
          </span>
          <input type="search" placeholder={en.common.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-controls={id} />
        </label>
        <span className="small muted" aria-live="polite">
          {en.common.rowsShown(visible.length, rows.length)}
        </span>
        {active && (
          <button
            type="button"
            className="btn-link small"
            onClick={() => {
              setQuery('');
              setSelected({});
            }}
          >
            {en.common.clearFilters}
          </button>
        )}
      </div>
      {filters.map((f, i) => (
        <div key={f.label} className="chips" role="group" aria-label={f.label}>
          <span className="chips-label">{f.label}</span>
          {chipValues[i].map((v) => (
            <button key={v} type="button" className="chip" aria-pressed={(selected[i] ?? []).includes(v)} onClick={() => toggle(i, v)}>
              {v}
            </button>
          ))}
        </div>
      ))}
      <div className="table-scroll dt-scroll" tabIndex={0} role="region" aria-label={caption}>
        <table className="table" id={id}>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" style={c.minWidth ? { minWidth: c.minWidth } : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={rowKey(r, i)}>
                {columns.map((c) => {
                  const t = c.text(r);
                  return (
                    <td key={c.header} className={c.mono ? 'mono' : undefined} style={c.minWidth ? { minWidth: c.minWidth } : undefined}>
                      {c.render ? c.render(r) : t ? c.long ? <MoreText text={t} limit={140} /> : <span className="pre">{t}</span> : <span className="muted">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="muted">
                  {en.common.noRows}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
