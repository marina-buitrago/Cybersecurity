import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { CyberPage } from './pages/cyber/CyberPage';
import { DpoPage } from './pages/dpo/DpoPage';
import { HowPage } from './pages/how/HowPage';

/** Move focus to the main region on route change so keyboard and screen-reader users land on the content. */
function FocusOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

// Hash routing keeps the static build working on any host without server rewrites.
export function App() {
  return (
    <HashRouter>
      <FocusOnNavigate />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dpo/*" element={<DpoPage />} />
        <Route path="/cybersecurity/*" element={<CyberPage />} />
        <Route path="/how-it-works/*" element={<HowPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
