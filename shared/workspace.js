// Open the workspace associated with the current entry page.
window.addEventListener('DOMContentLoaded', () => {
  const workspace = document.body.dataset.workspace;
  const params = new URLSearchParams(window.location.search);
  if (workspace === 'dashboard' && params.has('register')) StudentAccount.openSignIn(true);
  else if (workspace === 'dashboard' && params.has('login')) StudentAccount.openSignIn(false, () => {StudentAccount.close();StudentDashboard.open();});
  if (workspace === 'cashier') CashierSystem.open();
  if (workspace === 'proware') Proware.open();
});
