import { PageHead, Shell } from '../../components/Shell';
import { en } from '../../content/en';
import { HowCyber } from './HowCyber';

const H = en.how;

export function HowPage() {
  return (
    <Shell title={en.menu.how}>
      <PageHead title={H.title} lead={<p>{H.lead}</p>} />
      <HowCyber />
    </Shell>
  );
}
