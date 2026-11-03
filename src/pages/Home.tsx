import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Identity, Menu } from '../components/Brand';
import { en } from '../content/en';

/** Home: identity, menu and one button. */
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
        <main id="main" className="block home-action" tabIndex={-1}>
          <h1 className="visually-hidden">{en.site.name}</h1>
          <span className="label">{en.home.actionLabel}</span>
          <Link to="/cybersecurity" className="btn btn-primary">
            {en.home.cta}
          </Link>
        </main>
      </div>
    </>
  );
}
