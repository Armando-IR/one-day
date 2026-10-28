const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IconHome = () => (
  <svg {...base}><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /></svg>
);
export const IconInvoices = () => (
  <svg {...base}><path d="M7 3.5h7l4 4V20.5H7z" /><path d="M14 3.5v4h4" /><path d="M10 12h5M10 15.5h5" /></svg>
);
export const IconPlans = () => (
  <svg {...base}><path d="M6 21V4" /><path d="M6 4.5h11l-2.5 4 2.5 4H6" /></svg>
);
export const IconMonths = () => (
  <svg {...base}><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></svg>
);
export const IconPlus = () => (
  <svg {...base} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconSettings = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></svg>
);
export const IconClose = () => (
  <svg {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconCheck = () => (
  <svg {...base} width={16} height={16} strokeWidth={2.6}><path d="M5 12.5l4.2 4L19 7" /></svg>
);
export const IconBack = () => (
  <svg {...base}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconDown = () => (
  <svg {...base} width={20} height={20} strokeWidth={2.2}><path d="M6 9.5l6 6 6-6" /></svg>
);
export const IconForward = () => (
  <svg {...base}><path d="M9 5l7 7-7 7" /></svg>
);
