import { PageHead, Shell } from '../../components/Shell';
import { en } from '../../content/en';

export function CyberPage() {
  return (
    <Shell title={en.menu.cyber}>
      <PageHead title={en.menu.cyber} />
    </Shell>
  );
}
