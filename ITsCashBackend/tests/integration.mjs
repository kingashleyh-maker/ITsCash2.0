// Requires SQL Server LocalDB, .NET 10, Node 22+, and a built backend.
// Creates its own database, never touches ITsCash, and removes only its test database.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const database = 'ITsCash_Verification_' + randomBytes(6).toString('hex');
assert.match(database, /^ITsCash_Verification_[0-9a-f]{12}$/);
const base = 'http://127.0.0.1:5081';
const dll = path.join(root, 'bin/Debug/net10.0/ITsCashBackend.dll');
const password = randomBytes(20).toString('base64url');
const env = { ...process.env, Urls: base, ConnectionStrings__ITsCash:
  `Server=(localdb)\\MSSQLLocalDB;Database=${database};Integrated Security=true;Encrypt=true;TrustServerCertificate=true;Connect Timeout=8` };
let server;
let created = false;
let logs = '';

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 60_000, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${executable} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
function sql(query) {
  return command('sqlcmd.exe', ['-S', '(localdb)\\MSSQLLocalDB', '-E', '-l', '8', '-b', '-I', '-Q', query]);
}
async function request(route, method = 'GET', body, cookie = '', extra = {}) {
  const response = await fetch(base + route, { method, redirect: 'manual',
    headers: { 'Content-Type': 'application/json', 'X-ITsCash-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, response, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
function clean(data) {
  const serialized = JSON.stringify(data);
  assert.ok(!serialized.includes(password));
  assert.doesNotMatch(serialized, /passwordHash|"hash"|"salt"/i);
}

try {
  sql(`CREATE DATABASE [${database}]`);
  created = true;
  command('dotnet', [dll, '--apply-schema']);
  command('dotnet', [dll, '--apply-schema']); // Schema must be repeatable.
  command('dotnet', [dll, '--create-admin'], { input: `admin@school.invalid\nTest Administrator\n${password}\n${password}\n` });
  server = spawn('dotnet', [dll], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  server.on('error', error => { logs += error.message; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await request('/api/health')).status === 200) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Backend did not become ready: ' + logs);
  assert.deepEqual((await request('/api/session')).data, { actor: null, accounts: [] });
  assert.equal((await request('/api/accounts')).status, 401);
  assert.equal((await request('/api/accounts', 'POST', {})).status, 401);
  const badLogin = await request('/api/auth/login', 'POST', { email: 'admin@school.invalid', password: 'incorrect', workspace: 'cashier' });
  assert.equal(badLogin.status, 401);
  const login = await request('/api/auth/login', 'POST', { email: ' ADMIN@SCHOOL.INVALID ', password, workspace: 'cashier' });
  assert.equal(login.status, 200);
  assert.match(login.response.headers.get('set-cookie'), /httponly/i);
  assert.match(login.response.headers.get('set-cookie'), /samesite=strict/i);
  clean(login.data);
  const adminCookie = login.cookie;
  const students = [];
  for (const role of ['Student', 'Cashier', 'Proware']) {
    const createdAccount = await request('/api/accounts', 'POST', {
      email: `${role.toLowerCase()}@school.invalid`, password, name: `Test ${role}`, role,
      studentNumber: role === 'Student' ? 'TEST-001' : '', course: 'BSIT', year: '1', phone: '09123456789'
    }, adminCookie);
    assert.equal(createdAccount.status, 200, JSON.stringify(createdAccount.data));
    clean(createdAccount.data);
    if (role === 'Student') students.push(createdAccount.data.value);
  }
  assert.equal((await request('/api/accounts', 'POST', {
    email: 'CASHIER@school.invalid', password, name: 'Duplicate', role: 'Proware'
  }, adminCookie)).status, 409);
  assert.equal((await request('/api/accounts', 'POST', {
    email: 'unknown@school.invalid', password, name: 'Invalid', role: 'Unexpected'
  }, adminCookie)).status, 400);
  const cookies = {};
  for (const workspace of ['student', 'cashier', 'proware']) {
    const result = await request('/api/auth/login', 'POST', { email: `${workspace}@school.invalid`, password });
    assert.equal(result.status, 200);
    assert.equal(result.data.workspace, workspace);
    clean(result.data);
    cookies[workspace] = result.cookie;
    const wrong = workspace === 'cashier' ? 'proware' : 'cashier';
    assert.equal((await request('/api/auth/login', 'POST', { email: `${workspace}@school.invalid`, password, workspace: wrong })).status, 403);
    assert.equal((await request('/api/accounts', 'POST', { email: 'forged@school.invalid', password, name: 'Forged', role: 'Admin', actor: login.data.actor }, result.cookie)).status, 403);
    const visible = (await request('/api/accounts', 'GET', undefined, result.cookie)).data.accounts;
    assert.equal(visible.length, workspace === 'cashier' ? 2 : 1);
    assert.ok(visible.every(a => a.email !== 'admin@school.invalid'));
  }
  console.log('PASS SQL accounts, hashed passwords, cookie sessions, server-side roles, and student directory isolation');

  const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  assert.equal((await request('/api/profile/avatar', 'PUT', { avatar })).status, 401);
  for (const role of ['student', 'cashier']) {
    assert.equal((await request('/api/profile/avatar', 'PUT', { avatar, accountId: login.data.actor }, cookies[role])).status, 200);
    assert.equal((await request('/api/session', 'GET', undefined, cookies[role])).data.accounts.find(a => a.role.toLowerCase() === role).avatar, avatar);
    assert.equal((await request('/api/session', 'GET', undefined, adminCookie)).data.accounts.find(a => a.role === 'Admin').avatar, '');
    assert.equal((await request('/api/profile/avatar', 'PUT', { avatar: '' }, cookies[role])).status, 200);
  }
  const photo = await request('/api/profile/avatar', 'PUT', { avatar, accountId: students[0] }, cookies.proware);
  assert.equal(photo.status, 200);
  assert.equal((await request('/api/session', 'GET', undefined, cookies.proware)).data.accounts[0].avatar, avatar);
  assert.equal((await request('/api/session', 'GET', undefined, cookies.student)).data.accounts[0].avatar, '');
  // Full-size SQL boundary checks are opt-in; normal browser uploads are resized to 512 pixels.
  if (process.env.ITSCASH_TEST_LARGE_UPLOAD === '1') {
  const maximumImage = Buffer.alloc(10_485_760);
  Buffer.from(avatar.split(',')[1], 'base64').copy(maximumImage);
  const maximumAvatar = 'data:image/png;base64,' + maximumImage.toString('base64');
  const largePhoto = await request('/api/profile/avatar', 'PUT', { avatar: maximumAvatar }, cookies.proware);
  assert.equal(largePhoto.status, 200);
  assert.equal(largePhoto.data.accounts[0].avatar.length, maximumAvatar.length);
  }
  for (const invalid of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,bm90LWltYWdl', 'data:image/png;base64,' + Buffer.alloc(10_485_761).toString('base64')]) {
    assert.equal((await request('/api/profile/avatar', 'PUT', { avatar: invalid }, cookies.proware)).status, 400);
  }
  assert.equal((await request('/api/profile/avatar', 'PUT', { avatar: '' }, cookies.proware)).status, 200);
  assert.equal((await request('/api/session', 'GET', undefined, cookies.proware)).data.accounts[0].avatar, '');
  console.log('PASS Student/Cashier/Proware picture persistence/removal, self-only updates, and invalid/oversized file rejection');

  const profile = (await request('/api/session', 'GET', undefined, cookies.student)).data.accounts[0];
  assert.equal((await request('/api/profile', 'PUT', { username: 'student.alias', phone: '09998887777', gender: 'Other', dateOfBirth: '2000-04-15',
    name: 'Forged name', email: 'changed@school.invalid', studentNumber: 'FORGED', course: 'FORGED', year: 'FORGED', role: 'Admin', avatar: 'FORGED' }, cookies.student)).status, 200);
  const updatedProfile = (await request('/api/session', 'GET', undefined, cookies.student)).data.accounts[0];
  assert.equal(updatedProfile.username, 'student.alias');
  assert.equal(updatedProfile.phone, '09998887777');
  assert.equal(updatedProfile.gender, 'Other');
  assert.equal(updatedProfile.dateOfBirth, '2000-04-15');
  for (const key of ['name', 'email', 'studentNumber', 'course', 'year', 'role', 'avatar']) assert.equal(updatedProfile[key], profile[key]);
  assert.equal((await request('/api/profile', 'PUT', { username: 'invalid username' }, cookies.student)).status, 400);
  assert.equal((await request('/api/profile', 'PUT', { dateOfBirth: '2999-01-01' }, cookies.student)).status, 400);
  sql(`UPDATE [${database}].dbo.Accounts SET Username = N'taken.alias' WHERE Role = N'Cashier'`);
  assert.equal((await request('/api/profile', 'PUT', { username: 'TAKEN.ALIAS' }, cookies.student)).status, 409);
  assert.equal((await request('/api/profile', 'PUT', profile, cookies.cashier)).status, 403);
  assert.equal((await request('/api/accounts', 'POST', {}, adminCookie, { Origin: 'https://unrelated.invalid' })).status, 403);
  assert.equal((await request('/api/auth/logout', 'POST', undefined, adminCookie, { 'X-ITsCash-Request': '' })).status, 403);
  for (const route of ['/appsettings.json', '/ITsCashBackend/Program.cs', '/tests/integration.mjs', '/database/001-schema.sql', '/.data-protection']) {
    assert.equal((await request(route)).status, 404, route);
  }
  assert.match((await request('/shared/scripts/runtime.js')).data, /sqlBackend = true/);
  assert.match((await request('/index.html')).data, /data-page="home"/);
  assert.equal((await request('/api/auth/logout', 'POST', undefined, cookies.student)).status, 200);
  console.log('PASS profile persistence, immutable school email, cross-origin protection, logout, and private backend files');

  // Exercise the actual frontend adapter against the server, without installing browser dependencies.
  const realFetch = globalThis.fetch;
  let clientCookie = '';
  globalThis.fetch = async (url, options = {}) => {
    const result = await realFetch(base + url, { ...options, headers: { ...options.headers, ...(clientCookie ? { Cookie: clientCookie } : {}) } });
    if (result.headers.has('set-cookie')) clientCookie = result.headers.get('set-cookie').split(';')[0];
    return result;
  };
  try {
    const source = (await readFile(path.join(root, '../ITsCashVanilla/shared/scripts/auth-client.js'), 'utf8'))
      .replace('import { sqlBackend } from "./runtime.js";', 'const sqlBackend = true;');
    const { authClient } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    assert.equal((await authClient.session()).actor, null);
    const session = await authClient.signIn('student@school.invalid', password, 'student');
    assert.equal(session.actor, students[0]);
    assert.equal((await authClient.session()).accounts[0].username, 'student.alias');
    await assert.rejects(authClient.register({ email: 'extra@school.invalid', name: 'Extra', role: 'Student', studentNumber: 'TEST-002' }, password), /administrators/);
    await authClient.signOut();
    assert.equal((await authClient.session()).actor, null);
  } finally { globalThis.fetch = realFetch; }
  console.log('PASS existing frontend auth adapter connects to the real SQL-backed API');

  // Deactivation must take effect even when an existing cookie still authenticates.
  sql(`UPDATE [${database}].dbo.Accounts SET Active = 0 WHERE Email = N'cashier@school.invalid'`);
  assert.equal((await request('/api/accounts', 'GET', undefined, cookies.cashier)).status, 401);
  console.log('PASS active-account checks on existing sessions; schema applied twice without data loss');
} catch (error) {
  console.error(logs.slice(-8000));
  throw error;
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await exited;
  }
  if (created) sql(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${database}];`);
}
