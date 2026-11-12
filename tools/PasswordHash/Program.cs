using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

// Match ITsCashBackend/Program.cs. No database connection is needed.
var hasher = new PasswordHasher<object>(Options.Create(new PasswordHasherOptions { IterationCount = 210_000 }));
var context = new object();
if (args.Contains("--self-test"))
{
    var sample = Guid.NewGuid().ToString();
    var first = hasher.HashPassword(context, sample);
    var second = hasher.HashPassword(context, sample);
    if (first == second || hasher.VerifyHashedPassword(context, first, sample) != PasswordVerificationResult.Success
        || hasher.VerifyHashedPassword(context, first, "incorrect") != PasswordVerificationResult.Failed)
        throw new InvalidOperationException("Password hash verification failed.");
    Console.WriteLine("PASS: salted hashes match the backend format; correct passwords verify and incorrect passwords fail.");
    return;
}
Console.Write("New account password (hidden): ");
var password = ReadPassword();
if (password.Length is < 8 or > 128)
{
    Console.Error.WriteLine("Use a password with 8–128 characters.");
    Environment.ExitCode = 1;
    return;
}
Console.Write("Confirm password (hidden): ");
if (password != ReadPassword())
{
    Console.Error.WriteLine("Passwords do not match. No hash was generated.");
    Environment.ExitCode = 1;
    return;
}
Console.WriteLine("\nCopy this entire hash into PasswordHash in SSMS:");
Console.WriteLine(hasher.HashPassword(context, password));

static string ReadPassword()
{
    if (Console.IsInputRedirected) return Console.ReadLine() ?? "";
    var value = new StringBuilder();
    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return value.ToString(); }
        if (key.Key == ConsoleKey.Backspace) { if (value.Length > 0) value.Length--; }
        else if (!char.IsControl(key.KeyChar)) value.Append(key.KeyChar);
    }
}
