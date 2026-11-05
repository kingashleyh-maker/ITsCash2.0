# ITsCash — Plain HTML, CSS, and JavaScript

This is the standalone conversion. The original `ITsCashFrontend` React project is unchanged. There is no React, JSX, Vite, CDN dependency, install step, or build step in this version. Pages use native ES modules and DOM event handlers. The QR encoder is bundled locally with its license.

## Run with Live Server

1. In VS Code open **ITsCashVanilla** as the folder.
2. Right-click **index.html**, then choose **Open with Live Server**.
3. Choose Student, Cashier, or Proware and sign in.

Opening the outer project folder with Live Server also works: navigate to `ITsCashVanilla/index.html`. All links and image URLs resolve relative to the converted folder. Do not double-click HTML files (`file://` blocks browser module loading). Use localhost/127.0.0.1 for Web Crypto support.

| Workspace | Username | Password |
| --- | --- | --- |
| Student | student | Student123! |
| Cashier | cashier | Cashier123! |
| Proware | proware | Proware123! |
| Cashier | Cashier2 | 123456789 |
| Proware | Proware2 | 123456789 |

Accounts initialize automatically. Refresh an already-open page to install Cashier2 and Proware2 without clearing saved records. Student registration is also available. Existing usernames keep their passwords. Accounts, records, and inventory are browser-local; there is no server or live payment gateway.

## Organization

- `index.html`: role selection.
- `student/pages`, `student/scripts`, `student/styles`: dashboard, tuition, catalog, cart, purchases, history, notifications, profile, login and registration entry pages.
- `cashier/pages`, `cashier/scripts`, `cashier/styles`: dashboard, tickets, assessments, orders, history, notifications and login.
- `proware/pages`, `proware/scripts`, `proware/styles`: dashboard, inventory, pickup orders and login.
- `login/scripts`, `login/styles`: shared role selection and authentication presentation.
- `shared/scripts`: native DOM helpers, startup/session/navigation, payment/order workflows, and business rules.
- `shared/data`: original 20-product catalog.
- `shared/styles`: shared responsive styling and native dialog additions.
- `assets`: original images, preserved locally.
- `tests`: business-rule and conversion checks. Optional developer verification: `node --test tests/*.test.js` (Node 22.12+).

## Workflows

Student: register/sign in, view balances and installment schedules, print statements, pay through simulated digital methods or submit cashier tickets, search/filter/sort uniforms, save favorites, choose size and quantity, update cart, edit checkout contact details, place/cancel unpaid orders, track pickup, view receipts/history/notifications, update profile and photo.

Cashier: search/filter ticket queue, acknowledge tickets, add internal notes, create full/installment tuition assessments, record cash payments and change, handle simulated digital outcomes, print receipts, update pickup status, review payment history and send notices.

Proware: search/filter inventory, update per-size stock and price, and prepare/hand over paid pickup orders. Stock and order changes are shared across role pages on the same browser origin.

The catalog retains original quantities, including **Unassigned** stock. Before ordering a product, Proware must move its unassigned units into the appropriate size quantities. Conversion does not invent opening stock or sample tuition assessments. Cashier can assign a tuition assessment to the initialized Student account.

Only existing Admin accounts can manage accounts/refunds, as in the source app. The three initialized accounts retain their own role permissions.

## Storage

The converted app uses `itscash_vanilla_v1` and `itscash_vanilla_actor`. It does not overwrite the React keys (`itscash_react_v2`, `itscash_actor`). Different localhost ports are different browser origins and keep separate records. Use the same Live Server URL for all roles. Each tab has its own signed-in actor; use separate tabs to operate Student, Cashier and Proware together. Original legacy storage migration remains supported without deleting original legacy keys.

Digital payment success/failure controls are simulations. No actual funds move. Receipts and statements can be printed or saved as PDF with the browser print dialog.
