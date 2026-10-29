# ITsCash project

## Start the project

1. Extract this entire folder.
2. Open a terminal inside `ITsCash_Project`.
3. Run `python -m http.server 8000` (or `py -m http.server 8000` on Windows).
4. Open `http://localhost:8000` in your browser.

VS Code Live Server also works. Use the same host and port for every workspace so accounts, orders, payments, and inventory share the same browser data. Opening each HTML file directly is not recommended because browsers may isolate file storage. Keep the images and folders together.

## Folders

| Folder | Purpose | Main files |
| --- | --- | --- |
| `dashboard/` | Store dashboard, cart, checkout, product views and program filters | `index.html`, `store.js`, `presentation.js`, `programs.js` |
| `cashier/` | ITsCash dashboard, tickets, payment verification, tuition, receipts, notifications | `index.html`, `payments.js` |
| `proware/` | Uniform inventory, stock and price management, staff access and issuance | `index.html`, `inventory.js`, `inventory.css` |
| `shared/` | Common styles, photo catalog and workspace entry routing | `base.css`, `catalog.js`, `workspace.js` |
| `assets/images/` | Product images extracted from the single-file version | JPG, PNG and SVG assets |

Cashier's smaller scripts contain the earlier order manager and checkout integrations. Their loading order is preserved in each entry page.

## Direct pages

- Dashboard: `http://localhost:8000/dashboard/`
- Cashier: `http://localhost:8000/cashier/`
- Proware: `http://localhost:8000/proware/`

Cashier and Proware open their respective sign-in screens automatically.

## Demo accounts

On each sign-in screen, expand **First time here? Set up demo access** and click **Create demo accounts** before using these credentials.

| Workspace | Role | Username | Password |
| --- | --- | --- | --- |
| Cashier | Cashier | `demo.cashier` | `Cashier123!` |
| Cashier | Admin | `demo.admin` | `Admin123!` |
| Cashier | Student | `demo.student` | `Student123!` |
| Proware | Inventory Staff | `demo.inventory` | `Inventory123!` |
| Proware | Admin | `demo.admin` | `Admin123!` |

Cashier and Proware maintain separate account lists. Existing browser data remains available when served from the same origin. Starting on a new host or port starts a separate browser data store; saved records from a different address are not automatically transferred.

## Editing the code

Edit CSS and JavaScript in the relevant feature folder. Each page currently includes the common HTML layout and loads all feature scripts because checkout reservations, cashier payments and Proware inventory share the existing browser runtime. These are classic browser scripts, not ES modules: keep their script order and global function names intact. No bundler or npm install is needed.

Product photos are referenced relative to each entry page (`../assets/images/...`). Add or modify catalog metadata in `shared/catalog.js`; original store seeds remain in `dashboard/store.js`. The shared layout markup appears in all three entry pages, so apply common layout changes to each.

The QR-code library still uses the original CDN and needs internet access for QR rendering. This is a local browser demonstration: digital payments are simulated, and production account authorization and shared multi-user records require a backend.

## Latest interface changes

- Proware's inventory table and stock editor no longer display prices. Price values are preserved; administrators can still maintain uniform details.
- **Edit stock** changes the available quantity for one size. Saving asks **Would you like to update the stock?** No reason field is required. Cancel leaves the quantity unchanged.
- Inventory changes update store availability and visible cashier order stock across tabs served from the same browser origin. Keep all workspace tabs on the same host and port.
- Cashier navigation contains Dashboard, Tuition & balances, Uniform orders, Payment history, and Notifications.
- Duplicate Cashier/Proware shortcut buttons and the three store benefit cards have been removed. Workspace navigation remains available.

## Product details design

The product popup keeps its original layout, quantity input, size dropdown and two action buttons. Only text readability is adjusted in `dashboard/product-details.css`. The shopping-style product layout has been reverted.

## Student account and shopping templates

- Use **Student account → Create account** to register, or sign in with a student account. A student can edit their own profile and choose a JPEG/PNG profile photo up to 1 MB.
- **My Account** opens the profile editor. Saving asks for confirmation. Student number and username stay fixed so existing orders remain linked to the same account.
- **My Purchase** opens purchases directly without a repeated sign-in form. Signed-out visitors see an empty purchase view and can sign in through the account menu.
- Saved name, student number, course/program, year, email and phone are used for checkout. Complete the profile before placing an order. Checkout asks for confirmation before reserving stock.
- The product panel uses the original quantity field and size dropdown, with Add to Cart and Save for Later. There is no Share control. Product headings, price, stock and seller text have darker colors for readability.
- Edit `dashboard/student-account.js` and `.css` for the student menu, profile, and purchases. Profile persistence and ownership checks are in the student-facing API near the end of `cashier/payments.js`.

## Live stock refresh

Saving stock refreshes Proware Overview totals and alerts, the store cards, open product details and carts, and cashier stock references. Other tabs refresh when inventory storage changes or when the tab regains focus. Use the same browser, host and port for all workspaces. Product-card stock is the total across sizes; the product dropdown shows stock for the selected size.

## Opening login page

The project root (`http://localhost:8000/`) opens the new ITsCash login selection page. Choose **Student**, **Cashier**, or **Proware** to open that role's sign-in form. Student sign-in continues to the uniform store; Cashier and Proware continue to their respective workspaces. New students can create an account from the login page. Existing accounts and demo setup options remain available. The old course, learning-path and goals dashboard has been removed.

Edit `index.html` and `login/login.css` for the opening screen.

Login forms omit the store-back button. Student sign-in and registration omit the close button and account sidebar; profile and purchase navigation remain available after sign-in.

My Account and My Purchase now render within the store dashboard, beneath its header. **Back to store** restores the product catalog. Only sign-in and registration use the full-screen authentication view. Automatic legacy button icons are excluded from student account and product-detail controls to avoid duplicated close symbols.

## Student financial dashboard

Student sign-in now opens a financial overview matching the supplied sidebar-and-cards reference. Edit `dashboard/student-dashboard.js` and `.css` for this dashboard.

- Tuition figures and installment status are calculated from assigned fee assessments, authorized adjustments, and verified payments. Pending or rejected payments never reduce balances. If several terms exist, the overview offers a term selector.
- The uniform summary combines current cart value and active uniform orders. Pickup counts use orders marked Ready for Pickup. Completed and cancelled orders remain in My Purchase.
- Quick Payment opens an existing unpaid tuition assessment or uniform order. The existing payment flow and verification rules still apply.
- The uniform cards open the existing product popup to choose size and quantity. The cart total and Checkout Ticket use the existing cart and profile autofill.
- Transaction History, receipts, notifications, My Purchase and My Account are restricted to the signed-in student's records.
- Statement of Account opens a printable statement of the student's saved assessments, orders, and payment history. Allow browser popups, then use Print / Save as PDF.
- Student accounts with no assigned tuition or transaction records show empty states and zero totals, not the example amounts in the reference image.

## Tuition payment form and receipt

Choosing a tuition payment opens the reference-style details form. Student name, number and email come from the signed-in profile. Enter campus and section, review year level, choose a scheduled payment term or full remaining balance, and confirm the amount. The amount and details carry into the digital payment review. No payment is recorded during the first details confirmation.

Tuition terms map to the student's actual assessment schedule. Fully paid terms are disabled; full payment is checked against the current balance. Student submissions await cashier verification. Pending or rejected payments do not deduct balances or generate successful receipts. When the cashier verifies the payment, an open waiting screen automatically displays its receipt, including campus, section, payment term and remaining balance. Cashier-confirmed cash payments also open their receipt immediately. Receipts retain Print / Save as PDF and download actions.

## Sample tuition for testing

Students with no existing assessment receive a clearly marked ₱20,000 sample tuition assessment with four ₱5,000 monthly installments. This applies to existing saved students, new registrations, and the demo student. Existing assessments and payments are never replaced, and repeated sign-in does not duplicate or reset the sample balance. Pay an installment through Tuition Payments; pending digital submissions keep the balance unchanged until cashier verification.

## Editable tuition details and store header

Tuition first name, last name, student ID and email start from the profile and can be edited before payment. Changes remain in the review draft and appear on the receipt; the payment remains associated with the signed-in student account. If the entered student ID differs, the receipt also identifies the account student number. Existing profile information is not silently replaced.

The store header no longer contains the Login/Store/Cashier/Proware shortcuts or Login page button. Student dashboard navigation and account controls remain available.
# ITsCash2.0
ITsCash2.0
