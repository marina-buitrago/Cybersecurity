import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Identity, Menu } from '../components/Brand';
import { en } from '../content/en';

/** Home: exactly six blocks (identity, menu, H1, initiatives, tagline and clock, one button). */
export function Home() {
  useEffect(() => {
    document.title = en.site.name;
  }, []);
  return (
    <>
      <a className="skip-link" href="#main">
        {en.site.skipToContent}
      </a>
      <div className="hairline-grid home">
        <header className="block home-identity">
          <span className="label">{en.home.identityLabel}</span>
          <Identity />
        </header>
        <div className="block home-menu">
          <span className="label">{en.home.menuLabel}</span>
          <Menu />
        </div>
        <div className="block home-time">
          <span className="label">{en.home.timeLabel}</span>
          <p className="tagline">{en.site.tagline}</p>
          <Clock />
        </div>
        <main id="main" className="block home-intro" tabIndex={-1}>
          <span className="label">{en.home.introLabel}</span>
          <h1>{en.site.h1}</h1>
        </main>
        <div className="block home-action">
          <span className="label">{en.home.actionLabel}</span>
          <Link to="/cybersecurity" className="btn btn-primary">
            {en.home.cta}
          </Link>
        </div>
        <section className="block home-work" aria-labelledby="work-label">
          <h2 id="work-label" className="label">
            {en.home.workLabel}
          </h2>
          <ul className="work-list">
            {en.home.rows.map((r) => (
              <li key={r.n}>
                <Link to={r.to} className="work-row">
                  <span className="work-n">{r.n}</span>
                  <span className="work-name">{r.name}</span>
                  <span className="work-cat">{r.category}</span>
                  <span className="work-year">{r.year}</span>
                  <span className="work-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
