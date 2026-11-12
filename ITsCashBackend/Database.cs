using System.Data;
using Microsoft.Data.SqlClient;

public sealed class Database(IConfiguration configuration)
{
    private readonly string connectionString = configuration.GetConnectionString("ITsCash")
        ?? throw new InvalidOperationException("The ITsCash connection string is missing.");
    // Read columns in order so large pictures can use sequential access without buffering/replaying rows.
    private const string Columns = "AccountId, Email, FullName, Role, StudentNumber, Course, YearLevel, Phone, Gender, DateOfBirth, Avatar, Active, CreatedAt, Username, PasswordHash";

    public async Task<SqlConnection> Open()
    {
        var connection = new SqlConnection(connectionString);
        try { await connection.OpenAsync(); return connection; }
        catch { await connection.DisposeAsync(); throw; }
    }

    public async Task Verify()
    {
        await using var connection = await Open();
        await using var command = new SqlCommand("SELECT TOP (0) AccountId FROM dbo.Accounts", connection);
        await command.ExecuteNonQueryAsync();
    }

    public async Task ApplySchema(string sql)
    {
        await using var connection = await Open();
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    public async Task<StoredAccount?> FindEmail(string email)
    {
        await using var connection = await Open();
        await using var command = new SqlCommand($"SELECT {Columns} FROM dbo.Accounts WHERE Email = @email", connection);
        command.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = email;
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SequentialAccess);
        return await reader.ReadAsync() ? Read(reader) : null;
    }

    public async Task<StoredAccount?> FindId(string id)
    {
        if (!Guid.TryParse(id, out var key)) return null;
        await using var connection = await Open();
        await using var command = new SqlCommand($"SELECT {Columns} FROM dbo.Accounts WHERE AccountId = @id", connection);
        command.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = key;
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SequentialAccess);
        return await reader.ReadAsync() ? Read(reader) : null;
    }

    public async Task<List<AccountView>> VisibleAccounts(AccountView actor)
    {
        await using var connection = await Open();
        // Cashiers need the student directory for assessments; other roles see only themselves.
        var filter = actor.Role == "Admin" ? "1 = 1"
            : actor.Role == "Cashier" ? "(Role = N'Student' OR AccountId = @id)" : "AccountId = @id";
        await using var command = new SqlCommand($"SELECT {Columns} FROM dbo.Accounts WHERE {filter} ORDER BY FullName", connection);
        command.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = Guid.Parse(actor.Id);
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SequentialAccess);
        var result = new List<AccountView>();
        while (await reader.ReadAsync()) result.Add(Read(reader).View);
        return result;
    }

    public async Task<AccountView> Create(CreateAccountRequest request, string hash, bool bootstrap = false)
    {
        var email = AccountRules.Email(request.Email);
        var name = AccountRules.Text(request.Name, "the full name", 150);
        if (!AccountRules.Roles.Contains(request.Role)) throw new RequestError("Choose a valid account role.");
        var studentNumber = AccountRules.Text(request.StudentNumber, "the student number", 50, request.Role == "Student");
        var course = AccountRules.Text(request.Course, "the course", 150, false);
        var year = AccountRules.Text(request.Year, "the year level", 50, false);
        var phone = AccountRules.Text(request.Phone, "the phone number", 30, false);
        var id = Guid.NewGuid();
        await using var connection = await Open();
        // Serializable isolation makes the one-time administrator bootstrap safe against concurrent runs.
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable);
        if (bootstrap)
        {
            await using var check = new SqlCommand("SELECT COUNT(*) FROM dbo.Accounts WITH (UPDLOCK, HOLDLOCK) WHERE Role = N'Admin' AND Active = 1", connection, transaction);
            if ((int)(await check.ExecuteScalarAsync())! > 0)
                throw new RequestError("An active Admin already exists. Sign in as that Admin to create more accounts.");
        }
        await using var command = new SqlCommand("""
            INSERT INTO dbo.Accounts (AccountId, Email, PasswordHash, FullName, Role, StudentNumber, Course, YearLevel, Phone)
            VALUES (@id, @email, @hash, @name, @role, @number, @course, @year, @phone)
            """, connection, transaction);
        command.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = id;
        command.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = email;
        command.Parameters.Add("@hash", SqlDbType.NVarChar, 512).Value = hash;
        command.Parameters.Add("@name", SqlDbType.NVarChar, 150).Value = name;
        command.Parameters.Add("@role", SqlDbType.NVarChar, 30).Value = request.Role;
        command.Parameters.Add("@number", SqlDbType.NVarChar, 50).Value = studentNumber.Length == 0 ? DBNull.Value : studentNumber;
        command.Parameters.Add("@course", SqlDbType.NVarChar, 150).Value = course;
        command.Parameters.Add("@year", SqlDbType.NVarChar, 50).Value = year;
        command.Parameters.Add("@phone", SqlDbType.NVarChar, 30).Value = phone;
        await command.ExecuteNonQueryAsync();
        await transaction.CommitAsync();
        return (await FindId(id.ToString()))!.View;
    }

    public async Task UpdateHash(string id, string hash)
    {
        await using var connection = await Open();
        await using var command = new SqlCommand("UPDATE dbo.Accounts SET PasswordHash = @hash WHERE AccountId = @id", connection);
        command.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = Guid.Parse(id);
        command.Parameters.Add("@hash", SqlDbType.NVarChar, 512).Value = hash;
        await command.ExecuteNonQueryAsync();
    }

    public async Task UpdateProfile(AccountView actor, ProfileRequest fields)
    {
        if (actor.Role != "Student") throw new RequestError("Only students can update this profile.", 403);
        var username = fields.Username?.Trim() ?? actor.Username;
        if (username.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(username, @"^[A-Za-z0-9._-]{3,50}$"))
            throw new RequestError("Use 3–50 letters, numbers, dots, underscores, or hyphens for your username.");
        var gender = fields.Gender ?? actor.Gender;
        if (!new[] { "Male", "Female", "Other", "Prefer not to say" }.Contains(gender))
            throw new RequestError("Choose a valid gender option.");
        DateTime? birthDate = null;
        var requestedBirthDate = fields.DateOfBirth ?? actor.DateOfBirth;
        if (!string.IsNullOrWhiteSpace(requestedBirthDate))
        {
            if (!DateTime.TryParseExact(requestedBirthDate, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out var parsed) || parsed > DateTime.UtcNow.AddHours(8).Date)
                throw new RequestError("Enter a valid date of birth.");
            birthDate = parsed;
        }
        await using var connection = await Open();
        await using var command = new SqlCommand("""
            UPDATE dbo.Accounts SET Username = @username, Phone = @phone,
                Gender = @gender, DateOfBirth = @dob WHERE AccountId = @id AND Active = 1
            """, connection);
        command.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = Guid.Parse(actor.Id);
        command.Parameters.Add("@username", SqlDbType.NVarChar, 50).Value = username.Length == 0 ? DBNull.Value : username;
        command.Parameters.Add("@phone", SqlDbType.NVarChar, 30).Value = AccountRules.Text(fields.Phone ?? actor.Phone, "the phone number", 30, false);
        command.Parameters.Add("@gender", SqlDbType.NVarChar, 50).Value = gender;
        command.Parameters.Add("@dob", SqlDbType.Date).Value = (object?)birthDate ?? DBNull.Value;
        await command.ExecuteNonQueryAsync();
    }

    public async Task UpdateAvatar(AccountView actor, string avatar)
    {
        if (!AccountRules.Roles.Contains(actor.Role))
            throw new RequestError("Sign in with an authorized account.", 403);
        var validated = AccountRules.Avatar(avatar);
        await using var connection = await Open();
        await using var command = new SqlCommand("UPDATE dbo.Accounts SET Avatar = @avatar WHERE AccountId = @id AND Active = 1", connection);
        command.Parameters.Add("@id", SqlDbType.UniqueIdentifier).Value = Guid.Parse(actor.Id);
        command.Parameters.Add("@avatar", SqlDbType.NVarChar, -1).Value = validated;
        await command.ExecuteNonQueryAsync();
    }

    private static StoredAccount Read(SqlDataReader r)
    {
        string Text(string column) { var value = r[column]; return value is DBNull ? "" : (string)value; }
        string BirthDate() { var value = r["DateOfBirth"]; return value is DBNull ? "" : ((DateTime)value).ToString("yyyy-MM-dd"); }
        var view = new AccountView(((Guid)r["AccountId"]).ToString(), Text("Email"), Text("FullName"), Text("Role"),
            Text("StudentNumber"), Text("Course"), Text("YearLevel"), Text("Phone"), Text("Gender"),
            BirthDate(),
            Text("Avatar"), (bool)r["Active"], DateTime.SpecifyKind((DateTime)r["CreatedAt"], DateTimeKind.Utc), Text("Username"));
        return new StoredAccount(view, Text("PasswordHash"));
    }
}
