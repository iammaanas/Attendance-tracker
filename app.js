const { Client, Account, TablesDB, Query, ID, Permission, Role } = Appwrite;

const CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io/v1',
  projectId: '6a88fdfe001ce0435833',
  databaseId: '6a8901620005cf5899f7',
  tableId: 'attendance',
  userIdColumn: 'User-ID',
  subjectColumn: 'Subject',
  missedColumn: 'Missed-Hours'
};

const subjects = [
  ['Business Accounting', 45], ['Business Management', 30], ['Introduction to AI & ML', 30],
  ['Business Communication', 45], ['Professional Office Applications', 45], ['Business Economics', 30],
  ['German Language', 45], ['Foundation of Indian Knowledge System', 45],
  ['Personal Growth & Awareness Lab', 30], ['Lifestyle & Wellness Management', 30]
];

const client = new Client().setEndpoint(CONFIG.endpoint).setProject(CONFIG.projectId);
const account = new Account(client);
const tables = new TablesDB(client);

const loginPanel = document.getElementById('loginPanel');
const appPanel = document.getElementById('appPanel');
const loginForm = document.getElementById('loginForm');
const githubLoginButton = document.getElementById('githubLogin');
const logoutButton = document.getElementById('logout');
const userBadge = document.getElementById('userBadge');
const subtitle = document.getElementById('subtitle');
const profileLabel = document.getElementById('profileLabel');
const welcome = document.getElementById('welcome');
const grid = document.getElementById('grid');
const message = document.getElementById('message');

let currentUser = null;
let rows = [];

function fmt(n) {
  return Number.isInteger(Number(n)) ? String(n) : Number(n).toFixed(2);
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.className = `message ${error ? 'error' : ''}`;
}

function hideMessage() {
  message.className = 'message hidden';
}

async function getSession() {
  try { return await account.get(); } catch { return null; }
}

async function signInWithEmail(event) {
  event.preventDefault();
  hideMessage();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    await account.createEmailPasswordSession(email, password);
    window.location.reload();
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'Email sign-in failed.', true);
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
  try { await account.deleteSession('current'); }
  finally { window.location.reload(); }
}

async function loadRows() {
  const result = await tables.listRows({
    databaseId: CONFIG.databaseId,
    tableId: CONFIG.tableId,
    queries: [Query.equal(CONFIG.userIdColumn, currentUser.$id), Query.limit(100)],
    ttl: 0
  });
  return result.rows;
}

function rowForSubject(subject) {
  return rows.find(row => row[CONFIG.subjectColumn] === subject);
}

async function saveSubject(subject, value, row) {
  const totalHours = subjects.find(([name]) => name === subject)?.[1] ?? 0;
  const missed = Math.min(totalHours, Math.max(0, Number(value) || 0));
  const data = {
    [CONFIG.userIdColumn]: currentUser.$id,
    [CONFIG.subjectColumn]: subject,
    [CONFIG.missedColumn]: missed
  };

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
        Permission.read(Role.user(currentUser.$id)),
        Permission.update(Role.user(currentUser.$id)),
        Permission.delete(Role.user(currentUser.$id))
      ]
    });
  }
}

function buildCard(subject, totalHours, missed) {
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
        <h3>${subject}</h3>
        <p>${fmt(totalHours)} total hours · ${fmt(required)} required</p>
      </div>
      <span class="status ${status}">${label}</span>
    </div>
    <div class="percent">${attendance.toFixed(1)}<small>%</small></div>
    <div class="bar"><i style="width:${Math.min(100, Math.max(0, attendance))}%"></i></div>
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
      await saveSubject(subject, event.target.value, rowForSubject(subject));
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

async function render() {
  rows = await loadRows();
  grid.innerHTML = '';
  subjects.forEach(([subject, totalHours]) => {
    const row = rowForSubject(subject);
    grid.appendChild(buildCard(subject, totalHours, row?.[CONFIG.missedColumn] || 0));
  });
}

async function init() {
  try {
    currentUser = await getSession();

    if (!currentUser) {
      loginPanel.classList.remove('hidden');
      appPanel.classList.add('hidden');
      loginForm?.addEventListener('submit', signInWithEmail);
      githubLoginButton?.addEventListener('click', signInWithGitHub);
      return;
    }

    loginPanel.classList.add('hidden');
    appPanel.classList.remove('hidden');
    logoutButton.classList.remove('hidden');
    userBadge.classList.remove('hidden');
    userBadge.textContent = `@${currentUser.name || currentUser.email || currentUser.$id}`;
    subtitle.textContent = 'Your attendance is stored securely in Appwrite.';
    profileLabel.textContent = currentUser.name || currentUser.$id;
    welcome.textContent = `${currentUser.name || 'Your'} attendance.`;
    logoutButton.addEventListener('click', signOut);

    await render();
  } catch (error) {
    console.error(error);
    showMessage(`Appwrite error: ${error.message || 'Unable to load your attendance.'}`, true);
  }
}

init();
