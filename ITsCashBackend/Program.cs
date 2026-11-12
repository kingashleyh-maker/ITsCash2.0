using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.FileProviders;

var backendRoot = new DirectoryInfo(AppContext.BaseDirectory);
while (backendRoot.Parent is not null && !File.Exists(Path.Combine(backendRoot.FullName, "ITsCashBackend.csproj")))
    backendRoot = backendRoot.Parent;
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = [], ContentRootPath = backendRoot.FullName });
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
builder.WebHost.UseUrls(builder.Configuration["Urls"] ?? "http://127.0.0.1:5080");
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 16_000_000);
builder.Services.AddSingleton<Database>();
builder.Services.Configure<PasswordHasherOptions>(options => options.IterationCount = 210_000);
builder.Services.AddSingleton<IPasswordHasher<object>, PasswordHasher<object>>();
var protection = builder.Services.AddDataProtection().SetApplicationName("ITsCash")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(backendRoot.FullName, ".data-protection")));
if (OperatingSystem.IsWindows()) protection.ProtectKeysWithDpapi();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "ITsCash.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = false;
    options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.OnRejected = async (context, _) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(new { error = "Too many sign-in attempts. Wait a minute and try again." });
    };
});

var app = builder.Build();
var database = app.Services.GetRequiredService<Database>();
var hasher = app.Services.GetRequiredService<IPasswordHasher<object>>();
var hashContext = new object();

// Maintenance commands are deliberately local: there is no public Admin signup endpoint.
if (args.Contains("--apply-schema"))
{
    var schema = Path.GetFullPath(Path.Combine(backendRoot.FullName, "../database/001-schema.sql"));
    await database.ApplySchema(await File.ReadAllTextAsync(schema));
    await database.ApplySchema(await File.ReadAllTextAsync(Path.Combine(Path.GetDirectoryName(schema)!, "002-student-username.sql")));
    Console.WriteLine("ITsCash tables are ready. Existing data was preserved.");
    return;
}
if (args.Contains("--check"))
{
    await database.Verify();
    Console.WriteLine("Connected to SQL Server. dbo.Accounts is available.");
    return;
}
if (args.Contains("--create-admin"))
{
    Console.Write("Admin school email: ");
    var email = AccountRules.Email(Console.ReadLine());
    Console.Write("Full name: ");
    var name = AccountRules.Text(Console.ReadLine(), "the full name", 150);
    Console.Write("Password (hidden): ");
    var password = ReadPassword();
    AccountRules.Password(password);
    Console.Write("Confirm password (hidden): ");
    if (ReadPassword() != password) throw new RequestError("Passwords do not match.");
    var account = await database.Create(new(email, password, name, "Admin"), hasher.HashPassword(hashContext, password), bootstrap: true);
    Console.WriteLine($"Admin created for {account.Email}. You can sign in through Cashier or Proware.");
    return;
}
await database.Verify();
var dummyHash = hasher.HashPassword(hashContext, Guid.NewGuid().ToString());

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers.XContentTypeOptions = "nosniff";
        if (context.Request.Method is not ("GET" or "HEAD" or "OPTIONS"))
        {
            // Same-origin browser requests must carry this custom header. No CORS policy is enabled.
            var origin = context.Request.Headers.Origin.ToString();
            var expectedOrigin = $"{context.Request.Scheme}://{context.Request.Host}";
            if (context.Request.Headers["X-ITsCash-Request"] != "1" ||
                (origin.Length > 0 && !origin.Equals(expectedOrigin, StringComparison.OrdinalIgnoreCase)))
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new { error = "Use the ITsCash website to make this request." });
                return;
            }
        }
    }
    try { await next(); }
    catch (RequestError error)
    {
        context.Response.StatusCode = error.Status;
        await context.Response.WriteAsJsonAsync(new { error = error.Message });
    }
    catch (SqlException error) when (error.Number is 2601 or 2627)
    {
        context.Response.StatusCode = 409;
        await context.Response.WriteAsJsonAsync(new { error = "That email, student number, or username is already registered." });
    }
    catch (SqlException error)
    {
        app.Logger.LogError(error, "A SQL Server operation failed.");
        context.Response.StatusCode = 503;
        await context.Response.WriteAsJsonAsync(new { error = "The database is unavailable. Please try again." });
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapGet("/api/health", async () => { await database.Verify(); return Results.Ok(new { database = "connected" }); });
app.MapGet("/api/session", async (HttpContext context) =>
{
    var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
    var stored = id is null ? null : await database.FindId(id);
    if (stored?.View.Active != true)
    {
        if (id is not null) await context.SignOutAsync();
        return Results.Ok(new { actor = (string?)null, accounts = Array.Empty<AccountView>() });
    }
    return Results.Ok(new { actor = stored.View.Id, accounts = await database.VisibleAccounts(stored.View) });
});
app.MapPost("/api/auth/login", async (LoginRequest request, HttpContext context) =>
{
    if (request.Password is null || request.Password.Length > 128 || request.Email is null || request.Email.Length > 254)
        throw new RequestError("School email or password is incorrect.", 401);
    var account = await database.FindEmail(AccountRules.Email(request.Email));
    var verification = hasher.VerifyHashedPassword(hashContext, account?.PasswordHash ?? dummyHash, request.Password);
    if (account?.View.Active != true || verification == PasswordVerificationResult.Failed)
        throw new RequestError("School email or password is incorrect.", 401);
    if (!AccountRules.CanAccess(account.View.Role, request.Workspace))
        throw new RequestError("This account cannot access that workspace.", 403);
    if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        await database.UpdateHash(account.View.Id, hasher.HashPassword(hashContext, request.Password));
    var identity = new ClaimsIdentity([
        new Claim(ClaimTypes.NameIdentifier, account.View.Id), new Claim(ClaimTypes.Name, account.View.Email)
    ], CookieAuthenticationDefaults.AuthenticationScheme);
    await context.SignInAsync(new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = false });
    return Results.Ok(new { actor = account.View.Id, workspace = AccountRules.WorkspaceForRole(account.View.Role), accounts = await database.VisibleAccounts(account.View) });
}).RequireRateLimiting("login");

app.MapPost("/api/auth/logout", async (HttpContext context) =>
{
    await context.SignOutAsync();
    return Results.Ok(new { actor = (string?)null, accounts = Array.Empty<AccountView>() });
});
app.MapGet("/api/accounts", async (HttpContext context) =>
{
    var actor = await CurrentAccount(context, database);
    return Results.Ok(new { actor = actor.Id, accounts = await database.VisibleAccounts(actor) });
}).RequireAuthorization();
app.MapPost("/api/accounts", async (CreateAccountRequest request, HttpContext context) =>
{
    var actor = await CurrentAccount(context, database);
    if (actor.Role != "Admin") throw new RequestError("Only administrators can create accounts.", 403);
    AccountRules.Password(request.Password);
    var created = await database.Create(request, hasher.HashPassword(hashContext, request.Password));
    return Results.Ok(new { value = created.Id, actor = actor.Id, accounts = await database.VisibleAccounts(actor) });
}).RequireAuthorization();
app.MapPut("/api/profile", async (ProfileRequest request, HttpContext context) =>
{
    var actor = await CurrentAccount(context, database);
    await database.UpdateProfile(actor, request);
    var updated = (await database.FindId(actor.Id))!.View;
    return Results.Ok(new { actor = actor.Id, accounts = await database.VisibleAccounts(updated) });
}).RequireAuthorization();

app.MapPut("/api/profile/avatar", async (AvatarRequest request, HttpContext context) =>
{
    var actor = await CurrentAccount(context, database);
    await database.UpdateAvatar(actor, request.Avatar);
    var updated = (await database.FindId(actor.Id))!.View;
    return Results.Ok(new { actor = actor.Id, accounts = await database.VisibleAccounts(updated) });
}).RequireAuthorization();

// Only frontend folders are served. SQL scripts, backend settings, and build files stay private.
var frontendRoot = Path.GetFullPath(Path.Combine(backendRoot.FullName, "../ITsCashVanilla"));
var publicFolders = new[] { "/login", "/student", "/cashier", "/proware", "/shared", "/assets" };
app.UseWhen(context => context.Request.Path != "/shared/scripts/runtime.js" &&
    (context.Request.Path == "/index.html" || publicFolders.Any(folder => context.Request.Path.StartsWithSegments(folder))),
    branch => branch.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(frontendRoot) }));
// Serving this module through the backend enables SQL mode; Live Server keeps the local demo mode.
app.MapGet("/shared/scripts/runtime.js", () => Results.Text("export const sqlBackend = true;", "text/javascript"));
app.MapGet("/", () => Results.Redirect("/index.html"));
Console.WriteLine("Open http://127.0.0.1:5080 to use SQL-backed accounts and login.");
await app.RunAsync();

static async Task<AccountView> CurrentAccount(HttpContext context, Database database)
{
    var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
    var account = id is null ? null : await database.FindId(id);
    if (account?.View.Active != true) throw new RequestError("Sign in with an active account.", 401);
    return account.View;
}

static string ReadPassword()
{
    if (Console.IsInputRedirected) return Console.ReadLine() ?? "";
    var password = new System.Text.StringBuilder();
    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return password.ToString(); }
        if (key.Key == ConsoleKey.Backspace) { if (password.Length > 0) password.Length--; }
        else if (!char.IsControl(key.KeyChar)) password.Append(key.KeyChar);
    }
}
