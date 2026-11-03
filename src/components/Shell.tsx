import { useEffect, type ReactNode } from 'react';
import { en } from '../content/en';
import { Identity, Menu } from './Brand';

/** Inner-page layout: identity and menu on the left, content on the right. */
export function Shell({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · ${en.site.name}`;
  }, [title]);
  return (
    <>
      <a className="skip-link" href="#main">
        {en.site.skipToContent}
      </a>
      <div className="hairline-grid shell">
        <aside className="shell-side">
          <div className="shell-side-sticky">
            <div className="block">
              <Identity />
            </div>
            <div className="block">
              <Menu />
            </div>
          </div>
        </aside>
        <main id="main" className="shell-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}

export function PageHead({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {lead && <div className="lead">{lead}</div>}
      {children}
    </header>
  );
}
