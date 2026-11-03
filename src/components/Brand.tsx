import { Link, NavLink } from 'react-router-dom';
import { en } from '../content/en';

export function Identity() {
  return (
    <div>
      <Link to="/" className="identity-name">
        {en.site.name}
      </Link>
      <span className="logo-line" aria-hidden="true" />
      <p className="identity-descriptor">{en.site.descriptor}</p>
    </div>
  );
}

export const MENU = [
  { to: '/cybersecurity', label: en.menu.cyber },
  { to: '/how-it-works', label: en.menu.how },
];

export function Menu() {
  return (
    <nav aria-label={en.menu.label}>
      <ul className="menu">
        {MENU.map((m) => (
          <li key={m.to}>
            <NavLink to={m.to}>
              <span className="arrow" aria-hidden="true">
                →
              </span>
              {m.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
