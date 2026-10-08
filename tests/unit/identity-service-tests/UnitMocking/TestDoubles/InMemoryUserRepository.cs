using IdentityService.Models;
using IdentityService.Repositories;

namespace IdentityServiceTests.UnitMocking.TestDoubles;

/// <summary>
/// Hand-written <b>fake</b> repository: real (in-memory) behaviour instead of scripted answers,
/// so multi-step flows (register → read back, update → read back) can be tested as state changes.
/// Email lookup is case-insensitive, matching the MySQL utf8mb4_unicode_ci collation.
/// </summary>
public sealed class InMemoryUserRepository : IUserRepository
{
    private readonly Dictionary<int, User> _users = new();
    private int _nextId = 1;

    public int UpdateCalls { get; private set; }

    public User Seed(string fullName, string email, string role = AppRoles.Customer, bool isActive = true, string passwordHash = "hash")
    {
        var user = new User
        {
            UserId = _nextId++,
            FullName = fullName,
            Email = email,
            PasswordHash = passwordHash,
            IsActive = isActive,
            Roles = [role]
        };
        _users[user.UserId] = user;
        return user;
    }

    public Task<User?> GetByEmailAsync(string email) =>
        Task.FromResult(_users.Values.FirstOrDefault(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)));

    public Task<User?> GetByIdAsync(int userId) => Task.FromResult(_users.GetValueOrDefault(userId));

    public Task<int> CreateUserWithRoleAsync(User user, string roleName)
    {
        user.UserId = _nextId++;
        user.Roles = [roleName];
        _users[user.UserId] = user;
        return Task.FromResult(user.UserId);
    }

    public Task<List<string>> GetUserRolesAsync(int userId) =>
        Task.FromResult(_users.TryGetValue(userId, out var u) ? u.Roles.ToList() : new List<string>());

    public Task<bool> UpdateUserProfileAsync(int userId, string fullName, string email, string? phoneNumber)
    {
        UpdateCalls++;
        if (!_users.TryGetValue(userId, out var user)) return Task.FromResult(false);
        user.FullName = fullName;
        user.Email = email;
        user.PhoneNumber = phoneNumber;
        return Task.FromResult(true);
    }
}
