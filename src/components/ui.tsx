import { useId, useState, type ReactNode } from 'react';
import { en } from '../content/en';

export type TagKind = 'outline' | 'filled' | 'alert' | 'plain';

/** Status label: always text, optionally with a filled or outlined marker. Never colour alone. */
export function Tag({ kind = 'outline', children, title }: { kind?: TagKind; children: ReactNode; title?: string }) {
  const cls = kind === 'filled' ? 'tag tag-filled' : kind === 'alert' ? 'tag tag-alert tag-filled' : kind === 'plain' ? 'tag tag-plain' : 'tag';
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}

export const TbcTag = () => <Tag kind="alert">{en.common.toBeConfirmed}</Tag>;
export const Pending = () => <span className="muted">{en.common.pendingValidation}</span>;

/** Native <details>: keyboard accessible, prints when opened. */
export function Disclosure({
  summary,
  children,
  defaultOpen,
  className = '',
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details className={`disclosure ${className}`} open={defaultOpen}>
      <summary>{summary}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

/** In-page view switch (a group of toggle buttons). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Long text truncated with a "more" toggle. */
export function MoreText({ text, limit = 280, className = '' }: { text: string; limit?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (text.length <= limit) return <span className={`pre ${className}`}>{text}</span>;
  const cut = text.slice(0, limit).replace(/\s+\S*$/, '');
  return (
    <span className={`pre ${className}`} id={id}>
      {open ? text : `${cut}… `}
      <button type="button" className="btn-link small" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? en.common.less : en.common.more}
      </button>
    </span>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="visually-hidden"> {en.common.opensInNewTab}</span>
    </a>
  );
}

export const atlasTechniqueUrl = (id: string) => `https://atlas.mitre.org/techniques/${id}`;
export const atlasMitigationUrl = (id: string) => `https://atlas.mitre.org/mitigations/${id}`;

/** Download a JSON file built in the browser (nothing is sent anywhere). */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
