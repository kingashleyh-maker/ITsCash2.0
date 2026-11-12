# ITsCash — Plain HTML, CSS, and JavaScript

This is the standalone conversion. The original `ITsCashFrontend` React project is unchanged. There is no React, JSX, Vite, CDN dependency, install step, or build step in this version. Pages use native ES modules and DOM event handlers. The QR encoder is bundled locally with its license.

## Run with Live Server

**SQL Server mode is also available:** see [the backend setup guide](../ITsCashBackend/README.md). It uses `http://127.0.0.1:5080` for SQL-backed accounts, email login, Admin account creation, and student profiles. Inventory, orders, tuition, and simulated payments still use browser storage. The Live Server instructions below run the original local demo.

1. In VS Code open **ITsCashVanilla** as the folder.
2. Right-click **index.html**, then choose **Open with Live Server**.
3. Sign in with your email and password, complete the demo OTP, and your saved role opens the correct workspace automatically.

Opening the outer project folder with Live Server also works: navigate to `ITsCashVanilla/index.html`. All links and image URLs resolve relative to the converted folder. Do not double-click HTML files (`file://` blocks browser module loading). Use localhost/127.0.0.1 for Web Crypto support.

| Workspace | School email (local test accounts) | Password |
| --- | --- | --- |
| Student | student@example.com | Student123! |
| Cashier | cashier@example.com | Cashier123! |
| Proware | proware@example.com | Proware123! |
| Cashier | cashier2@example.com | 123456789 |
| Proware | proware2@example.com | 123456789 |

Accounts initialize automatically. Refresh an already-open page to install Cashier2 and Proware2 without clearing saved records. All roles sign in with the email saved on their school-provisioned account; only an active Admin can create student accounts. The school email is read-only in the student profile. The example.com addresses above are local test accounts, not real school mailboxes. Email OTP and school-domain restrictions are not configured. Existing accounts keep their saved emails and passwords. New accounts require a unique email; usernames are retained only as internal compatibility fields. Accounts, records, and inventory are browser-local; there is no server or live payment gateway.

## Organization

- `index.html`: main entry point.
- `login/pages/index.html`: unified email/password sign-in.
- `login/pages/student-login.html`, `cashier-login.html`, `proware-login.html`: compatibility entry pages showing the same unified sign-in form.
- `login/pages/register.html`: compatibility redirect to student login; self-registration is disabled.
- `student/pages`, `student/scripts`, `student/styles`: dashboard, tuition, catalog, cart, purchases, history, notifications, profile, and compatibility links to login.
- `cashier/pages`, `cashier/scripts`, `cashier/styles`: dashboard, tickets, assessments, orders, history, notifications and login.
- `proware/pages`, `proware/scripts`, `proware/styles`: dashboard, inventory, pickup orders and login.
- `login/pages`, `login/scripts`, `login/styles`: unified sign-in, the old registration redirect, scripts and styling.
- `shared/scripts`: native DOM helpers, startup/session/navigation, payment/order workflows, and business rules.
- `shared/data`: original 20-product catalog.
- `shared/styles`: shared responsive styling and native dialog additions.
- `assets`: original images, preserved locally.
- `tests`: business-rule and conversion checks. Optional developer verification: `node --test tests/*.test.js` (Node 22.12+).

## Workflows

The student **My Purchase** page includes Shopping Cart below the order history. Store/product cart links open `orders.html#shopping-cart`; the older `cart.html` entry also renders this combined page. Notifications are opened from the boxed bell in the top-right workspace bar for Student and Cashier, rather than a sidebar entry. The bell shares its SVG with Settings and respects the unread-indicator preference.

### Appearance settings

Use the gear button beside Sign out in the sidebar to open Settings. Light, Dark, or System theme, Standard or Larger text, and Reduce motion apply immediately and are saved under `itscash_preferences_v1` in this browser. System theme follows device changes. Preferences also apply to the sign-in and OTP screens, persist across reloads and sign-out, and synchronize with tabs on the same origin. Reset to defaults restores System theme, Standard text, and normal motion; the device's reduced-motion preference is still respected. These preferences are browser-specific and do not change SQL accounts or inventory.

`shared/scripts/settings.js` renders the dialog; `preferences.js` validates, saves, and applies preferences; `shared/styles/vanilla.css` contains the theme and accessibility styles. The footer button is wired in `shared/scripts/app.js`.

Student, Cashier, and Proware profile pictures can be changed in **Settings > Account**: choose a JPG/PNG up to 10 MB, review the preview, and choose Save picture or Remove picture. SQL mode saves to the account's Avatar column; demo mode saves locally. Student accounts also retain their existing profile editor.

The Settings picture picker accepts source files up to 10 MB and prepares a profile image with a maximum dimension of 512 pixels before saving. This keeps profile displays and browser storage responsive while preserving PNG transparency.

Settings opens in a large overlay with a blurred backdrop and Account, Notifications, and Appearance sections in the left sidebar. Account shows the current school account; students can open their existing profile editor. Notifications saves preferences for informational update messages and sidebar unread badges; errors remain visible. Appearance contains theme, text size, and motion options. The content area scrolls independently, with compact section navigation on mobile. Password editing and email/push notification delivery are not added by this interface.

### Demo OTP interface

Student, Cashier, and Proware sign-in show a verification screen after a successful email/password check. Enter the code displayed in the yellow panel into the six digit boxes, then choose **Verify and continue**. Typing advances to the next box; pasting a complete code fills the boxes. No email is sent. Codes expire after five minutes with a live countdown, allow five incorrect attempts, and can be replaced after a visible 30-second resend cooldown. Resend is disabled during the cooldown and becomes available automatically; expiry disables verification until a new code is requested. **Back to sign in** signs out and returns to the credentials form.

This is a client-side interface prototype, not a second authentication factor. The existing SQL login already issues its normal session cookie before the screen appears; refreshing or navigating away can bypass the demo screen. Real OTP must use a backend challenge and defer session creation until the code is verified. The same interface also runs in the Live Server demo. Sign out first if you are already on a dashboard.

Code locations: `login/scripts/login.js` renders the screen and routes to each role's dashboard; `login/scripts/demo-otp.js` controls demo code generation/expiry; `login/styles/login.css` styles the interface; `shared/scripts/app.js` preserves the pending screen during re-renders. Tests are in `tests/demo-otp.test.js`.

Student: sign in with an assigned email and password, view balances and installment schedules, print statements, pay through simulated digital methods or submit cashier tickets, search/filter/sort uniforms, save favorites, choose size and quantity, update cart, edit checkout contact details, place/cancel unpaid orders, track pickup, view receipts/history/notifications, update profile and photo.

Cashier: search/filter ticket queue, acknowledge tickets, add internal notes, create full/installment tuition assessments, record cash payments and change, handle simulated digital outcomes, print receipts, update pickup status, review payment history and send notices.

Proware: search/filter inventory, update per-size stock and price, and prepare/hand over paid pickup orders. Stock and order changes are shared across role pages on the same browser origin.

The catalog retains original quantities, including **Unassigned** stock. Before ordering a product, Proware must move its unassigned units into the appropriate size quantities. Conversion does not invent opening stock or sample tuition assessments. Cashier can assign a tuition assessment to the initialized Student account.

Only existing Admin accounts can manage accounts/refunds, as in the source app. The three initialized accounts retain their own role permissions.

## Storage

The converted app uses `itscash_vanilla_v1` and `itscash_vanilla_actor`. It does not overwrite the React keys (`itscash_react_v2`, `itscash_actor`). Different localhost ports are different browser origins and keep separate records. Use the same Live Server URL for all roles. Each tab has its own signed-in actor; use separate tabs to operate Student, Cashier and Proware together. Original legacy storage migration remains supported without deleting original legacy keys.

Digital payment success/failure controls are simulations. No actual funds move. Receipts and statements can be printed or saved as PDF with the browser print dialog.


Cashier updates: student uniform orders and payment status changes appear automatically in the Cashier dashboard activity panel and Notifications. Digital tuition payments also create cashier queue entries. Pending or failed digital payments do not reduce balances. Keep Student and Cashier open in separate tabs at the same Live Server origin to receive live updates. Browser-local storage does not synchronize across devices or different browser profiles.
