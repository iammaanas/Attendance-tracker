const { Client, Account, Functions, TablesDB, Query, ID, Permission, Role } = Appwrite;

const CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io/v1',
  projectId: '6a88fdfe001ce0435833',
  databaseId: '6a8901620005cf5899f7',
  tableId: 'attendance',
  userIdColumn: 'User-ID',
  userNameColumn: 'User-Name',
  subjectColumn: 'Subject',
  missedColumn: 'Missed-Hours',
  moderatorTeamId: '6a89049f001c27b0bde8',
  moderatorFunctionId: 'moderator-users'
};

const subjects = [
  ['Business Accounting', 45],
  ['Business Management', 30],
  ['Introduction to AI & ML', 30],
  ['Business Communication', 45],
  ['Professional Office Applications', 45],
  ['Business Economics', 30],
  ['German Language', 45],
  ['Foundation of Indian Knowledge System', 45],
  ['Personal Growth & Awareness Lab', 30],
  ['Lifestyle & Wellness Management', 30]
];

const client = new Client().setEndpoint(CONFIG.endpoint).setProject(CONFIG.projectId);
const account = new Account(client);
const functions = new Functions(client);
const tables = new TablesDB(client);

const loginPanel = document.getElementById('loginPanel');
const appPanel = document.getElementById('appPanel');
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const nameInput = document.getElementById('name');
const nameField = document.getElementById('nameField');
const emailSubmit = document.getElementById('emailSubmit');
const authTitle = document.getElementById('authTitle');
const authDescription = document.getElementById('authDescription');
const authToggle = document.getElementById('authToggle');
const githubLogin = document.getElementById('githubLogin');
const logoutButton = document.getElementById('logout');
const userBadge = document.getElementById('userBadge');
const subtitle = document.getElementById('subtitle');
const profileLabel = document.getElementById('profileLabel');
const profileTitle = document.getElementById('profileTitle');
const welcome = document.getElementById('welcome');
const heroDescription = document.getElementById('heroDescription');
const grid = document.getElementById('grid');
const message = document.getElementById('message');

let currentUser = null;
let rows = [];
let moderatorUsers = [];
let isModerator = false;
let authMode = 'login';
let selectedUserId = 'self';
let moderatorButton = null;
let moderatorOverlay = null;
let moderatorBanner = null;
let hasUserNameColumn = false;

function fmt(n) {
  return Number.isInteger(Number(n)) ? String(n) : Number(n).toFixed(2);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.className = `message ${error ? 'error' : ''}`;
}

function hideMessage() {
  message.className = 'message hidden';
}

async function getSession() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  authTitle.textContent = registering ? 'Create your profile.' : 'Welcome back.';
  authDescription.textContent = registering
    ? 'Create an account with your email and password, or use GitHub.'
    : 'Sign in with your email and password, or continue with GitHub.';
  nameField.classList.toggle('hidden', !registering);
  nameInput.required = registering;
  emailSubmit.textContent = registering ? 'Create account' : 'Sign in';
  authToggle.textContent = registering
    ? 'Already have an account? Sign in'
    : 'Need an account? Create one';
}

async function emailAuth(event) {
  event.preventDefault();
  hideMessage();
  emailSubmit.disabled = true;

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (authMode === 'register') {
      await account.create({
        userId: ID.unique(),
        email,
        password,
        name: nameInput.value.trim()
      });
      await account.createEmailPasswordSession({ email, password });
    } else {
      await account.createEmailPasswordSession({ email, password });
    }

    window.location.reload();
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'Authentication failed.', true);
  } finally {
    emailSubmit.disabled = false;
  }
}

async function signInWithGitHub() {
  hideMessage();
  try {
    const redirect = window.location.href.split('#')[0];
    await account.createOAuth2Session('github', redirect, redirect);
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'GitHub sign-in failed.', true);
  }
}

async function signOut() {
  try {
    await account.deleteSession('current');
  } finally {
    window.location.reload();
  }
}

async function detectUserNameColumn() {
  try {
    await tables.getColumn({
      databaseId: CONFIG.databaseId,
      tableId: CONFIG.tableId,
      key: CONFIG.userNameColumn
    });
    hasUserNameColumn = true;
  } catch {
    hasUserNameColumn = false;
  }
}

async function loadRows() {
  const userId = selectedUserId === 'self' ? currentUser.$id : selectedUserId;
  const result = await tables.listRows({
    databaseId: CONFIG.databaseId,
    tableId: CONFIG.tableId,
    queries: [
      Query.equal(CONFIG.userIdColumn, userId),
      Query.limit(100)
    ],
    ttl: 0
  });
  return result.rows;
}

async function getModeratorUsers() {
  const execution = await functions.createExecution({
    functionId: CONFIG.moderatorFunctionId,
    body: '',
    async: false,
    path: '/',
    method: 'GET'
  });

  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) {
    let detail = '';
    try {
      detail = JSON.parse(execution.responseBody || '{}').error || '';
    } catch {
      detail = execution.responseBody || '';
    }
    throw new Error(detail || `Moderator function returned ${execution.responseStatusCode}.`);
  }

  const payload = JSON.parse(execution.responseBody || '{}');
  if (!Array.isArray(payload.users)) {
    throw new Error(payload.error || 'Moderator function returned an invalid user list.');
  }
  return payload.users;
}

async function checkModerator() {
  try {
    // The function itself is restricted to the moderator team role in Appwrite.
    // A successful execution is therefore the authoritative frontend check.
    moderatorUsers = await getModeratorUsers();
    return true;
  } catch (error) {
    // Ordinary users should silently fail this check so they never see the button.
    console.info('Moderator access not granted.');
    moderatorUsers = [];
    return false;
  }
}

function getUserLabel(userId) {
  if (userId === currentUser.$id) {
    return currentUser.name || currentUser.email || 'You';
  }

  const user = moderatorUsers.find(item => item.id === userId);
  return user?.name || user?.email || `User ${userId.slice(-8)}`;
}

async function saveSubject(subject, value, row) {
  const totalHours = subjects.find(([name]) => name === subject)?.[1] ?? Number.MAX_SAFE_INTEGER;
  const missed = Math.min(totalHours, Math.max(0, Number(value) || 0));
  const userId = row?.[CONFIG.userIdColumn] || (selectedUserId === 'self' ? currentUser.$id : selectedUserId);
  const data = {
    [CONFIG.userIdColumn]: userId,
    [CONFIG.subjectColumn]: subject,
    [CONFIG.missedColumn]: missed
  };

  if (hasUserNameColumn) {
    data[CONFIG.userNameColumn] = getUserLabel(userId);
  }

  if (row) {
    await tables.updateRow({
      databaseId: CONFIG.databaseId,
      tableId: CONFIG.tableId,
      rowId: row.$id,
      data
    });
  } else {
    await tables.createRow({
      databaseId: CONFIG.databaseId,
      tableId: CONFIG.tableId,
      rowId: ID.unique(),
      data,
      permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
        Permission.read(Role.team(CONFIG.moderatorTeamId, ['moderator'])),
        Permission.update(Role.team(CONFIG.moderatorTeamId, ['moderator'])),
        Permission.delete(Role.team(CONFIG.moderatorTeamId, ['moderator']))
      ]
    });
  }
}

function buildCard(subject, totalHours, missed, ownerId) {
  missed = Math.min(totalHours, Math.max(0, Number(missed || 0)));
  const required = totalHours * 0.75;
  const canStillMiss = totalHours * 0.25 - missed;
  const attendance = ((totalHours - missed) / totalHours) * 100;

  let status = 'safe';
  let label = 'SAFE';
  if (attendance < 75) {
    status = 'danger';
    label = 'BELOW 75%';
  } else if (canStillMiss <= 2) {
    status = 'warn';
    label = 'CLOSE TO LIMIT';
  }

  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-top">
      <div>
        <h3>${escapeHtml(subject)}</h3>
        <p>${fmt(totalHours)} total hours · ${fmt(required)} required</p>
      </div>
      <span class="status ${status}">${label}</span>
    </div>
    <div class="percent">${attendance.toFixed(1)}<small>%</small></div>
    <div class="bar"><i class="bar-fill" style="width:${Math.min(100, Math.max(0, attendance))}%"></i></div>
    <div class="stats">
      <div><span>Hours missed</span><strong>${fmt(missed)} hrs</strong></div>
      <div><span>Can still miss</span><strong>${fmt(Math.max(0, canStillMiss))} hrs</strong></div>
    </div>
    <label class="input-label">Hours missed
      <input type="number" min="0" max="${totalHours}" step="0.5" value="${missed}">
    </label>
  `;

  card.querySelector('input').addEventListener('change', async event => {
    try {
      event.target.disabled = true;
      const row = rows.find(item => item[CONFIG.subjectColumn] === subject);
      await saveSubject(subject, event.target.value, row);
      await render();
      showMessage('Saved.');
    } catch (error) {
      console.error(error);
      showMessage(`Could not save: ${error.message || 'unknown error'}`, true);
      event.target.disabled = false;
    }
  });

  return card;
}

function updateModeratorView() {
  if (!isModerator) return;

  const viewingSelf = selectedUserId === 'self';

  if (viewingSelf) {
    moderatorBanner?.classList.add('hidden');
    profileTitle.textContent = 'Profile';
    profileLabel.textContent = currentUser.name || currentUser.email || currentUser.$id;
    welcome.textContent = `${currentUser.name || 'Your'} attendance.`;
    heroDescription.innerHTML = 'Each subject already has its total course hours. Update only <strong>Hours Missed</strong> and the tracker calculates your attendance automatically.';
  } else {
    moderatorBanner?.classList.remove('hidden');
    const label = getUserLabel(selectedUserId);
    const viewingLabel = moderatorBanner?.querySelector('[data-moderator-user]');
    if (viewingLabel) viewingLabel.textContent = label;
    const idLabel = moderatorBanner?.querySelector('[data-moderator-id]');
    if (idLabel) idLabel.textContent = selectedUserId;

    profileTitle.textContent = 'Viewing';
    profileLabel.textContent = label;
    welcome.textContent = `${label}'s attendance.`;
    heroDescription.innerHTML = 'You are viewing this user as a moderator. Changes to <strong>Hours Missed</strong> are saved to their attendance record.';
  }
}

function closeModeratorPicker() {
  moderatorOverlay?.classList.add('hidden');
}

async function backToMyAttendance() {
  selectedUserId = 'self';
  hideMessage();
  await render();
}

async function openModeratorPicker() {
  if (!moderatorOverlay) return;

  hideMessage();
  const usersBox = moderatorOverlay.querySelector('#moderatorUsers');
  usersBox.innerHTML = '<p class="muted">Loading users...</p>';
  moderatorOverlay.classList.remove('hidden');

  try {
    // Refresh authorization and the directory each time the picker opens.
    moderatorUsers = await getModeratorUsers();
    usersBox.innerHTML = '';

    moderatorUsers.forEach(user => {
      const label = user.name || user.email || `User ${user.id.slice(-8)}`;
      const button = document.createElement('button');
      button.className = 'moderator-user';
      button.type = 'button';
      button.innerHTML = `
        <span class="moderator-avatar">${escapeHtml(label.slice(0, 1).toUpperCase())}</span>
        <span>
          <strong>${escapeHtml(label)}${user.id === currentUser.$id ? ' · You' : ''}</strong>
          <small>${escapeHtml(user.email || user.id)}</small>
        </span>
        <span class="moderator-arrow">›</span>
      `;

      button.addEventListener('click', async () => {
        selectedUserId = user.id === currentUser.$id ? 'self' : user.id;
        closeModeratorPicker();
        await render();
      });

      usersBox.appendChild(button);
    });

    if (!moderatorUsers.length) {
      usersBox.innerHTML = '<p class="muted">No users found.</p>';
    }
  } catch (error) {
    console.error(error);
    closeModeratorPicker();
    showMessage(`Moderator access failed: ${error.message || 'unknown error'}`, true);
  }
}

function createModeratorUI() {
  if (!isModerator || moderatorButton) return;

  moderatorButton = document.createElement('button');
  moderatorButton.className = 'ghost moderator-button';
  moderatorButton.textContent = 'Moderator';
  moderatorButton.type = 'button';
  moderatorButton.addEventListener('click', openModeratorPicker);
  logoutButton.parentNode.insertBefore(moderatorButton, logoutButton);

  moderatorBanner = document.createElement('section');
  moderatorBanner.className = 'moderator-banner hidden';
  moderatorBanner.innerHTML = `
    <div>
      <span class="pill">Moderator view</span>
      <strong data-moderator-user>Selected user</strong>
      <small data-moderator-id></small>
    </div>
    <button id="backToMyAttendance" class="ghost" type="button">← My attendance</button>
  `;

  appPanel.insertBefore(moderatorBanner, appPanel.firstElementChild);
  moderatorBanner.querySelector('#backToMyAttendance').addEventListener('click', backToMyAttendance);

  moderatorOverlay = document.createElement('div');
  moderatorOverlay.className = 'moderator-overlay hidden';
  moderatorOverlay.innerHTML = `
    <div class="moderator-modal">
      <div class="moderator-modal-top">
        <div>
          <span class="pill">Moderator</span>
          <h2>Choose a user</h2>
          <p>Select an account to open their attendance profile.</p>
        </div>
        <button class="ghost" id="closeModerator" type="button">Close</button>
      </div>
      <div id="moderatorUsers" class="moderator-users"></div>
    </div>
  `;

  document.body.appendChild(moderatorOverlay);
  moderatorOverlay.addEventListener('click', event => {
    if (event.target === moderatorOverlay) closeModeratorPicker();
  });
  moderatorOverlay.querySelector('#closeModerator').addEventListener('click', closeModeratorPicker);
}

async function render() {
  rows = await loadRows();
  grid.innerHTML = '';

  for (const [subject, totalHours] of subjects) {
    const row = rows.find(item => item[CONFIG.subjectColumn] === subject);
    grid.appendChild(
      buildCard(
        subject,
        totalHours,
        row?.[CONFIG.missedColumn] ?? 0,
        row?.[CONFIG.userIdColumn] || (selectedUserId === 'self' ? currentUser.$id : selectedUserId)
      )
    );
  }

  updateModeratorView();
}

async function showAuthenticatedApp() {
  loginPanel.classList.add('hidden');
  appPanel.classList.remove('hidden');
  logoutButton.classList.remove('hidden');
  userBadge.classList.remove('hidden');

  const label = currentUser.name || currentUser.email || currentUser.$id;
  userBadge.textContent = `@${label}`;
  subtitle.textContent = 'Your attendance data is tied to your authenticated account.';
  profileTitle.textContent = 'Profile';
  profileLabel.textContent = label;
  welcome.textContent = `${currentUser.name || 'Your'} attendance.`;
  heroDescription.innerHTML = 'Each subject already has its total course hours. Update only <strong>Hours Missed</strong> and the tracker calculates your attendance automatically.';
}

async function init() {
  currentUser = await getSession();

  if (!currentUser) {
    loginPanel.classList.remove('hidden');
    appPanel.classList.add('hidden');
    logoutButton.classList.add('hidden');
    userBadge.classList.add('hidden');
    authForm.onsubmit = emailAuth;
    githubLogin.onclick = signInWithGitHub;
    authToggle.onclick = () => setAuthMode(authMode === 'login' ? 'register' : 'login');
    setAuthMode('login');
    return;
  }

  try {
    await showAuthenticatedApp();
    logoutButton.onclick = signOut;
    await detectUserNameColumn();

    // Only moderators receive the button. Normal users simply get false here.
    isModerator = await checkModerator();
    if (isModerator) createModeratorUI();

    await render();
  } catch (error) {
    console.error(error);
    showMessage(`Could not load the application: ${error.message || 'unknown error'}`, true);
  }
}

init().catch(error => {
  console.error(error);
  showMessage(error.message || 'Could not initialize the application.', true);
});
