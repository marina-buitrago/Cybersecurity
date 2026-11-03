import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { PageHead, Shell } from '../../components/Shell';
import { fmtDate } from '../../components/format';
import { en } from '../../content/en';
import { demo } from '../../engine/dpo';
import { ClientPage } from './ClientPage';
import { Clients } from './Clients';
import { Documents } from './Documents';
import { Knowledge } from './Knowledge';
import { Today } from './Today';
import { UrgentRoute } from './UrgentRoute';

const D = en.dpo;
const VIEWS = [
  { to: '', label: D.views.today, end: true },
  { to: 'clients', label: D.views.clients, end: false },
  { to: 'documents', label: D.views.documents, end: false },
  { to: 'knowledge', label: D.views.knowledge, end: false },
];

export function DpoPage() {
  const [urgentOpen, setUrgentOpen] = useState(false);
  return (
    <Shell title={en.menu.dpo}>
      <PageHead title={D.title} lead={<p>{D.lead}</p>}>
        <div className="dpo-bar">
          <nav className="segmented" aria-label={D.viewsLabel}>
            {VIEWS.map((v) => (
              <NavLink key={v.label} to={v.to === '' ? '/dpo' : `/dpo/${v.to}`} end={v.end}>
                {v.label}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="btn btn-primary" onClick={() => setUrgentOpen(true)}>
            {D.urgent.button}
          </button>
        </div>
        <p className="small muted">{D.demoDate(fmtDate(demo.demoDate))} · {demo.notice}</p>
      </PageHead>
      <Routes>
        <Route index element={<Today />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientPage />} />
        <Route path="documents" element={<Documents />} />
        <Route path="knowledge" element={<Knowledge />} />
        <Route path="*" element={<Navigate to="/dpo" replace />} />
      </Routes>
      <UrgentRoute open={urgentOpen} onClose={() => setUrgentOpen(false)} />
    </Shell>
  );
}
