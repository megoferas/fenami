import { html } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';

const P = {
  coffee: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3v3M12 3v3"/>',
  gaming: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="18" cy="14" r=".9"/>',
  karting: '<path d="M3.5 14.5 5.5 9h13l2 5.5V18h-17z"/><circle cx="8" cy="18" r="1.7"/><circle cx="16" cy="18" r="1.7"/>',
  entertainment: '<circle cx="12" cy="13" r="8"/><circle cx="9.8" cy="10.5" r=".9"/><circle cx="13.6" cy="10.2" r=".9"/><circle cx="11.8" cy="13.4" r=".9"/>',
  padel: '<circle cx="12" cy="8.5" r="5.5"/><path d="M12 14v7"/><circle cx="10.3" cy="7" r=".8"/><circle cx="13.7" cy="7" r=".8"/><circle cx="12" cy="10.4" r=".8"/>',
  food: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2.5 1.5-3.5 4-3.5 7H17"/>',
  cinema: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14M3 10h5M16 10h5M3 14h5M16 14h5"/>',
  outdoors: '<circle cx="12" cy="9" r="6"/><path d="M12 15v6M9 21h6"/>',
  football: '<circle cx="12" cy="12" r="9"/><path d="m12 8.5 3 2.2-1.1 3.5h-3.8L9 10.7z"/>',
  culture: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  sports: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  plans: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  friends: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="10" r="2.4"/><path d="M16 14.2A4.6 4.6 0 0 1 20.5 19"/>',
  profile: '<circle cx="12" cy="8.5" r="3.7"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  phone: '<path d="M6 3h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
};

const attrs = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

export const iconSvg = (name, size = 22) =>
  `<svg width="${size}" height="${size}" ${attrs}>${P[name] || P.star}</svg>`;

export function Icon({ name, size = 24 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML=${{ __html: P[name] || P.star }} />`;
}

// tone decides the sticker colour: pink or green
export const CATS = {
  coffee: { icon: 'coffee', tone: 'pink' },
  food: { icon: 'food', tone: 'green' },
  gaming: { icon: 'gaming', tone: 'green' },
  padel: { icon: 'padel', tone: 'pink' },
  football: { icon: 'football', tone: 'green' },
  karting: { icon: 'karting', tone: 'pink' },
  entertainment: { icon: 'entertainment', tone: 'pink' },
  cinema: { icon: 'cinema', tone: 'green' },
  culture: { icon: 'culture', tone: 'pink' },
  outdoors: { icon: 'outdoors', tone: 'green' },
  sports: { icon: 'sports', tone: 'green' },
};

export const CAT_ORDER = ['coffee', 'food', 'gaming', 'entertainment', 'cinema', 'padel', 'football', 'karting', 'outdoors', 'culture', 'sports'];

// interest id -> place categories used for "Picked for you"
export const INTERESTS = [
  { id: 'coffee', cats: ['coffee'] },
  { id: 'food', cats: ['food'] },
  { id: 'gaming', cats: ['gaming', 'entertainment'] },
  { id: 'football', cats: ['football', 'sports'] },
  { id: 'padel', cats: ['padel'] },
  { id: 'cars', cats: ['karting'] },
  { id: 'movies', cats: ['cinema'] },
  { id: 'outdoors', cats: ['outdoors'] },
  { id: 'music', cats: ['culture'] },
  { id: 'photography', cats: ['outdoors', 'culture'] },
  { id: 'shopping', cats: [] },
];
