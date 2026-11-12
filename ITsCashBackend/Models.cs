using System.Net.Mail;

// PasswordHash is deliberately absent from this record: only these fields reach the browser.
public record AccountView(
    string Id, string Email, string Name, string Role, string StudentNumber,
    string Course, string Year, string Phone, string Gender, string DateOfBirth,
    string Avatar, bool Active, DateTime CreatedAt, string Username);

public record LoginRequest(string Email, string Password, string Workspace = "auto");
public record CreateAccountRequest(
    string Email, string Password, string Name, string Role,
    string? StudentNumber = null, string? Course = null, string? Year = null,
    string? Phone = null);
// Only these four profile fields may be changed by a student. Photos have a separate endpoint.
public record ProfileRequest(string? Username = null, string? Phone = null,
    string? Gender = null, string? DateOfBirth = null);
public record StoredAccount(AccountView View, string PasswordHash);
public record AvatarRequest(string Avatar);

public sealed class RequestError(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}

public static class AccountRules
{
    public static string Avatar(string? value)
    {
        if (value == "") return "";
        if (value is null || value.Length > 14_000_000) throw new RequestError("Choose a JPEG or PNG image up to 10 MB.");
        var png = value.StartsWith("data:image/png;base64,", StringComparison.Ordinal);
        var jpeg = value.StartsWith("data:image/jpeg;base64,", StringComparison.Ordinal);
        if (!png && !jpeg) throw new RequestError("Choose a JPEG or PNG image.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(value[(value.IndexOf(',') + 1)..]); }
        catch (FormatException) { throw new RequestError("The image could not be read."); }
        if (bytes.Length > 10_485_760 || (png && !bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            || (jpeg && !bytes.AsSpan().StartsWith(new byte[] { 255, 216, 255 })))
            throw new RequestError("Choose a valid JPEG or PNG image up to 10 MB.");
        return value;
    }
    public static readonly string[] Roles = ["Student", "Cashier", "Proware", "Admin", "Inventory Staff"];
    public static string Email(string? value)
    {
        var email = value?.Trim().ToLowerInvariant() ?? "";
        if (email.Length > 254 || !MailAddress.TryCreate(email, out var parsed)
            || parsed.Address != email || !email.Contains('.') || email.Any(char.IsWhiteSpace))
            throw new RequestError("Enter a valid school email.");
        return email;
    }

    public static string Text(string? value, string label, int max, bool required = true)
    {
        var text = value?.Trim() ?? "";
        if ((required && text.Length == 0) || text.Length > max)
            throw new RequestError($"Enter {label} using {(required ? "1" : "0")}–{max} characters.");
        return text;
    }

    public static void Password(string? value)
    {
        if (value is null || value.Length < 8 || value.Length > 128)
            throw new RequestError("Use a password with 8–128 characters.");
    }

    public static bool CanAccess(string role, string workspace) => workspace switch
    {
        "auto" => Roles.Contains(role),
        "student" => role == "Student",
        "cashier" => role is "Cashier" or "Admin",
        "proware" => role is "Proware" or "Inventory Staff" or "Admin",
        _ => false
    };
    public static string WorkspaceForRole(string role) => role switch
    {
        "Student" => "student",
        "Cashier" or "Admin" => "cashier",
        "Proware" or "Inventory Staff" => "proware",
        _ => throw new RequestError("This account does not have an assigned workspace.", 403)
    };
}
