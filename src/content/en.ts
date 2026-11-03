/**
 * Every UI string of the site. Swap this file to change the language.
 * Legal citations keep their standard form (e.g. "Art. 15(5) AI Act", "Art. 36(4) LOPDGDD").
 * Strings marked "proposed" in comments were authored by the development team and await review.
 */

export const en = {
  site: {
    name: '{{SITE_NAME}}',
    descriptor: 'DPO service control and AI security by design',
    tagline: '{{TAGLINE}}',
    h1: '{{HOME_H1: one sentence saying what the site is}}',
    skipToContent: 'Skip to content',
    clockCity: 'Madrid',
  },
  menu: {
    label: 'Menu',
    dpo: 'DPO Initiative',
    cyber: 'Cybersecurity Initiative',
    how: "How it's implemented",
  },
  home: {
    identityLabel: 'Site',
    menuLabel: 'Menu',
    introLabel: 'About',
    workLabel: 'Initiatives',
    timeLabel: 'Local time',
    actionLabel: 'Start',
    rows: [
      { n: '01', name: 'DPO Initiative', category: 'DPO service control and documentation', year: '2026', to: '/dpo' },
      { n: '02', name: 'Cybersecurity Initiative', category: 'Security by design for AI systems', year: '2026', to: '/cybersecurity' },
    ],
    cta: 'Assess an AI system',
  },
  common: {
    pendingValidation: 'Pending validation',
    toBeConfirmed: 'To be confirmed',
    proposed: 'Proposed',
    more: 'more',
    less: 'less',
    show: 'Show',
    hide: 'Hide',
    back: 'Back',
    next: 'Next',
    close: 'Close',
    search: 'Search',
    all: 'All',
    none: 'None',
    yes: 'Yes',
    no: 'No',
    dontKnow: "I don't know",
    clearFilters: 'Clear filters',
    rowsShown: (n: number, total: number) => `${n} of ${total} rows`,
    noRows: 'No rows match.',
    print: 'Print or save as PDF',
    downloadJson: 'Download JSON',
    opensInNewTab: '(opens in a new tab)',
  },
};

export type Strings = typeof en;
