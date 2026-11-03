import { Suspense, lazy, useEffect, useRef } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { AnswersProvider } from './pages/cyber/state';

// Sections load on demand so the home page does not download the catalogue data.
const CyberPage = lazy(() => import('./pages/cyber/CyberPage').then((m) => ({ default: m.CyberPage })));
const HowPage = lazy(() => import('./pages/how/HowPage').then((m) => ({ default: m.HowPage })));

/**
 * After a navigation (not on first load), move focus to the new page's main region so keyboard and
 * screen-reader users land on the content. Waits for lazily loaded pages to render.
 */
function FocusOnNavigate() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    window.scrollTo(0, 0);
    let tries = 0;
    let frame = 0;
    const focusMain = () => {
      const main = document.getElementById('main');
      if (main && main.childElementCount > 0) main.focus({ preventScroll: true });
      else if (tries++ < 60) frame = requestAnimationFrame(focusMain);
    };
    frame = requestAnimationFrame(focusMain);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}

// Hash routing keeps the static build working on any host without server rewrites.
export function App() {
  return (
    <HashRouter>
      <AnswersProvider>
        <FocusOnNavigate />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cybersecurity/*" element={<CyberPage />} />
            <Route path="/how-it-works/*" element={<HowPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AnswersProvider>
    </HashRouter>
  );
}
