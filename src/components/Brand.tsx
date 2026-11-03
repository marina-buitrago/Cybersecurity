import { useEffect, useState } from 'react';
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

const madridTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** "Madrid · HH:MM:SS" in the Europe/Madrid time zone. Not announced by screen readers on each tick. */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className="clock">
      {en.site.clockCity} · <time dateTime={now.toISOString()}>{madridTime.format(now)}</time>
    </p>
  );
}
