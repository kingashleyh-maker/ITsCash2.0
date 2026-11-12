// Shared by Settings and the workspace notification control.
export const bellIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 3a2 2 0 0 1 4 0 7 7 0 0 1 5 7v4l2 3v1H3v-1l2-3v-4a7 7 0 0 1 5-7zM9 20h6a3 3 0 0 1-6 0z"/></svg>';
export const studentNavigationIcons = {
  orders: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="m5 6 10-5 2.5 4H8zM4 7h15a2 2 0 0 1 2 2v2h-4a4 4 0 0 0 0 8h4v2a2 2 0 0 1-2 2H4a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z"/><path fill-rule="evenodd" d="M17 12h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-5a3 3 0 0 1 0-6zm0 1.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>',
  store: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="3" y="2" width="5" height="8" rx="2.4"/><rect x="9.5" y="2" width="5" height="8" rx="2.4"/><rect x="16" y="2" width="5" height="8" rx="2.4"/><path d="M4 11a5 5 0 0 0 4-1 5 5 0 0 0 8 0 5 5 0 0 0 4 1v11h-6v-7h-4v7H4z"/></svg>',
  tuition: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><ellipse cx="8" cy="4.5" rx="6.5" ry="3"/><path d="M1.5 7v3c0 1.7 3 3 6.5 3h1v-3c-2.9.2-5.7-.7-7.5-3zm0 6v3c0 1.7 3 3 6.5 3h1v-3c-3 .2-5.8-.8-7.5-3zm0 6v1c0 1.7 3 3 6.5 3h2.7A5.6 5.6 0 0 1 9 20.9c-3 .2-5.8-.7-7.5-1.9z"/><ellipse cx="16.5" cy="10.5" rx="6" ry="3"/><path d="M10.5 13v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3c-3.3 2.6-8.7 2.6-12 0zm0 6v1c0 1.7 2.7 3 6 3s6-1.3 6-3v-1c-3.3 2.6-8.7 2.6-12 0z"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 4a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm-1 3v7l4-3 1.2 1.6-5.5 4.1A1.1 1.1 0 0 1 9 15.8V7h2z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3.3 8A10.5 10.5 0 0 1 15 2l-2-1m2 1-2 2"/></svg>'
};

// Overview: browser window, chart bars, and magnifying glass.
export const overviewIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.2 20H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6M2 8h20M5.5 14.5v2M9 12v4.5"/><circle cx="5.3" cy="5.2" r=".5" fill="currentColor"/><circle cx="8.5" cy="5.2" r=".5" fill="currentColor"/><circle cx="16.5" cy="16.5" r="3.7"/><path d="m19.2 19.2 3 3"/></svg>';

// Cashier navigation follows the ticket, coins, pending cart, and history references.
export const cashierNavigationIcons = {
  tickets: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 1h2a3 3 0 0 0 6 0h2a4 4 0 0 1 4 4v9h-4a1 1 0 0 0 0 2h4v3a4 4 0 0 1-4 4h-2a3 3 0 0 0-6 0H7a4 4 0 0 1-4-4v-3h4a1 1 0 0 0 0-2H3V5a4 4 0 0 1 4-4zm4 13a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2z"/></svg>',
  tuition: studentNavigationIcons.tuition,
  orders: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M1 3h2a2 2 0 0 1 2 1.7L5.3 6h8a7 7 0 0 0 8.4 8.3l-.7 3.2H7l.2 1H20v2H7a2 2 0 0 1-2-1.7L3.1 5H1z"/><circle cx="7.5" cy="22" r="1.8"/><circle cx="18" cy="22" r="1.8"/><path fill-rule="evenodd" d="M19 1a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-.8 2h1.6v3l1.9 1.8-1.1 1.1-2.4-2.3z"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 1 1-10 10h2.5A7.5 7.5 0 1 0 6.7 6.7L9 9H2V2l2.9 2.9A10 10 0 0 1 12 2z"/><path d="M10.5 7h2.5v6l2.6 2.6-1.8 1.8-3.3-3.4z"/></svg>'
};
