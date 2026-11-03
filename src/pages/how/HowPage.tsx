import { PageHead, Shell } from '../../components/Shell';
import { en } from '../../content/en';

export function HowPage() {
  return (
    <Shell title={en.menu.how}>
      <PageHead title={en.menu.how} />
    </Shell>
  );
}
