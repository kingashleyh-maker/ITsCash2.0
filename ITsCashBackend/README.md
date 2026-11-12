# ITsCash SQL Server backend

This step moves **accounts, email/password login, Admin account creation, and student profiles** into SQL Server. Existing inventory, cart, order, tuition, and simulated payment screens still use browser storage. The SQL tables for those workflows are ready for a later migration; creating tables does not migrate browser records automatically. A demo OTP interface appears after login for all three workspaces, but no email is sent and real OTP authentication is not implemented. The normal cookie is issued by the existing password endpoint before this client-side screen; the screen can be bypassed by refreshing. Real OTP will need a backend challenge before issuing the session cookie.

## Start from the project folder

Open a terminal in the inner `ITsCash2.0-main` folder containing `ITsCashBackend`, `ITsCashVanilla`, and `database`.

```powershell
dotnet restore .\ITsCashBackend
dotnet run --project .\ITsCashBackend -- --apply-schema
dotnet run --project .\ITsCashBackend -- --create-admin
dotnet run --project .\ITsCashBackend
```

The Admin command asks for a school email, full name, and a password with confirmation. Password entry is hidden. It creates the first active Admin only; additional accounts are created after signing in. There are no default SQL passwords or seeded school accounts.

Open **http://127.0.0.1:5080** and sign in using the single email/password form. After the demo OTP step, the saved account role determines the workspace: Student goes to Student, Cashier to Cashier, and Proware/Inventory Staff to Proware. Admin opens Cashier by default and can switch to Proware using the sidebar. As Admin, open **Accounts** to create the Student, Cashier, and Proware accounts assigned by the school. Students cannot register themselves.

Use this backend URL for SQL accounts. Opening port 5500 through Live Server keeps the original browser-only demo. The two modes have separate accounts and records. If SQL Server is unavailable, SQL mode reports the error instead of falling back to demo credentials.

SQL mode uses one login session per browser profile, shared by its tabs. To test Student and Cashier simultaneously, use separate browser profiles or a normal and a private browser window. The original Live Server demo continues to use independent per-tab actor IDs.

## Connection and SSMS

The default connection is `(localdb)\MSSQLLocalDB`, database `ITsCash`, using the Windows account that runs the backend. The database must already exist. Connection settings are in `appsettings.json`. For a different server/database, use an environment variable named `ConnectionStrings__ITsCash` or an ignored `appsettings.Local.json`. Do not put a SQL password in frontend JavaScript.

The local connection trusts the development SQL certificate. Before hosting beyond this computer, use HTTPS, a trusted SQL certificate, deployment-specific settings, and an appropriate hosted SQL Server instance. LocalDB is intended for local development. This server binds to loopback by default.

To inspect the schema in SSMS:

```sql
USE ITsCash;
SELECT name FROM sys.tables ORDER BY name;
SELECT Email, FullName, Role, StudentNumber, Active FROM dbo.Accounts;
```

Run `../database/001-schema.sql`, followed by `../database/002-student-username.sql`, directly in SSMS with `ITsCash` selected. The `--apply-schema` command applies both files. It uses a transaction, creates only missing tables, and never clears existing rows. Currency columns use integer centavos: `72000` means PHP 720.00. Foreign keys connect accounts to student orders, assessments, and payments. Unique email and student-number constraints prevent duplicate identities.

## Follow the code

1. `../ITsCashVanilla/login/scripts/login.js`: collects email/password and the chosen workspace.
2. `../ITsCashVanilla/shared/scripts/auth-client.js`: sends requests to the same-origin backend.
3. `Program.cs`: checks passwords and workspace permissions, issues an HttpOnly session cookie, and provides the account/profile endpoints. Authentication is controlled by the server, not a browser-supplied account ID or role.
4. `Database.cs`: executes parameterized SQL against `dbo.Accounts`. Password hashes are excluded from all account response objects.
5. `Models.cs`: validates incoming fields and defines safe response fields. The `username` property is a separate editable student display name; sign-in continues to use the school email.
6. `../ITsCashVanilla/shared/scripts/store.js`: uses the API for SQL accounts and leaves existing business simulations in browser storage. `app.js` restores the server session on each page and signs out through the server.
7. `../ITsCashVanilla/shared/scripts/runtime.js`: defaults to demo mode. The backend serves a replacement module enabling SQL mode. Only frontend folders are served, so backend settings, SQL scripts, tests, and key files are not public.

## API

| Method and route | Purpose |
| --- | --- |
| `GET /api/health` | Check SQL connectivity and the Accounts table |
| `GET /api/session` | Restore the signed-in account; anonymous responses contain no directory |
| `POST /api/auth/login` | Email/password login; saved role determines the returned workspace. An optional explicit workspace is still permission-checked. |
| `POST /api/auth/logout` | Clear the session cookie |
| `GET /api/accounts` | Admin: all accounts; Cashier: own account and student directory; others: own account |
| `POST /api/accounts` | Admin-only account creation |
| `PUT /api/profile` | Student editing of username, phone, gender, and birthdate only; school identity fields remain unchanged |
| `PUT /api/profile/avatar` | Student/Cashier/Proware/Inventory Staff/Admin: update or remove the signed-in account's own JPG/PNG picture, up to 10 MB |

Mutating requests require the `X-ITsCash-Request: 1` header and a matching browser Origin. No cross-origin access is enabled. Login attempts are rate-limited. Each protected endpoint checks that the account is still active and looks up its current role in SQL Server.

Student, Cashier, and Proware can choose, preview, save, or remove a profile picture under **Settings > Account**. SQL mode stores the image in the existing `dbo.Accounts.Avatar` column; no schema migration is needed. The endpoint identifies the account from its authenticated session, validates image type/size/signature, and does not allow a client-supplied account ID to choose another user's picture. The sidebar and Settings identity update after saving. Live Server demo mode saves the picture in browser storage instead.

## Checks

```powershell
dotnet build .\ITsCashBackend
node .\ITsCashBackend\tests\integration.mjs
node --test .\ITsCashVanilla\tests\*.test.js
```

The integration check creates an isolated `ITsCash_Verification_*` database, tests real login, account/profile persistence, permissions, and the frontend adapter, then removes only that temporary database. It never inserts test accounts into `ITsCash`.

Official references: [Microsoft.Data.SqlClient](https://learn.microsoft.com/sql/connect/ado-net), [LocalDB](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb), and [ASP.NET Core cookie authentication](https://learn.microsoft.com/aspnet/core/security/authentication/cookie).

Students manage personal details under **Settings > Account**. Only username, phone number, gender, and birthdate can be edited there. School email, full name, student number, course, and year level remain school-managed. Migration `002-student-username.sql` adds an optional, unique username without changing existing emails or names. Usernames use 3-50 letters, numbers, dots, underscores, or hyphens. The old student profile URL opens Account settings, and My Account is removed from the sidebar.
