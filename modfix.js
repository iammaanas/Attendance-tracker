(() => {
  const CONFIG = {
    endpoint: 'https://sgp.cloud.appwrite.io/v1',
    projectId: '6a88fdfe001ce0435833',
    databaseId: '6a8901620005cf5899f7',
    tableId: 'attendance',
    userIdColumn: 'User-ID',
    userNameColumn: 'User-Name',
    subjectColumn: 'Subject',
    missedColumn: 'Missed-Hours',
    teamId: '6a89049f001c27b0bde8',
    moderatorUserId: '6a8906289bb27d3020fe'
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

  const client = new Appwrite.Client()
    .setEndpoint(CONFIG.endpoint)
    .setProject(CONFIG.projectId);
  const account = new Appwrite.Account(client);
  const teams = new Appwrite.Teams(client);
  const tables = new Appwrite.TablesDB(client);

  let currentUser = null;
  let modal = null;
  let selectedUser = null;
  let originalHero = null;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const fmt = n => Number.isInteger(Number(n)) ? String(n) : Number(n).toFixed(2);

  async function isModerator() {
    try {
      currentUser = await account.get();
      if (currentUser.$id === CONFIG.moderatorUserId) return true;

      const memberships = await teams.listMemberships({
        teamId: CONFIG.teamId,
        queries: [Appwrite.Query.equal('userId', currentUser.$id)],
        total: false
      });

      return memberships.memberships.some(m =>
        m.userId === currentUser.$id &&
        Array.isArray(m.roles) &&
        m.roles.includes('moderator')
      );
    } catch (error) {
      console.warn('Moderator check failed:', error);
      return false;
    }
  }

  async function getRows() {
    const result = await tables.listRows({
      databaseId: CONFIG.databaseId,
      tableId: CONFIG.tableId,
      queries: [Appwrite.Query.limit(100)],
      ttl: 0
    });
    return result.rows;
  }

  function userLabel(userId, rows) {
    if (userId === currentUser.$id) return currentUser.name || currentUser.email || 'You';
    const row = rows.find(r => r[CONFIG.userIdColumn] === userId);
    return row?.[CONFIG.userNameColumn] || `User ${userId.slice(-8)}`;
  }

  function buildCard(subject, total, row, userId) {
    const missed = Math.min(total, Math.max(0, Number(row?.[CONFIG.missedColumn] || 0)));
    const required = total * 0.75;
    const canStillMiss = total * 0.25 - missed;
    const attendance = ((total - missed) / total) * 100;
    const status = attendance < 75 ? 'danger' : canStillMiss <= 2 ? 'warn' : 'safe';
    const label = attendance < 75 ? 'BELOW 75%' : canStillMiss <= 2 ? 'CLOSE TO LIMIT' : 'SAFE';

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${esc(subject)}</h3>
          <p>${fmt(total)} total hours · ${fmt(required)} required</p>
        </div>
        <span class="status ${status}">${label}</span>
      </div>
      <div class="percent">${attendance.toFixed(1)}<small>%</small></div>
      <div class="bar"><i class="bar-fill" style="width:${Math.max(0, Math.min(100, attendance))}%"></i></div>
      <div class="stats">
        <div><span>Hours missed</span><strong>${fmt(missed)} hrs</strong></div>
        <div><span>Can still miss</span><strong>${fmt(Math.max(0, canStillMiss))} hrs</strong></div>
      </div>
      <label class="input-label">Hours missed
        <input type="number" min="0" max="${total}" step="0.5" value="${missed}" data-subject="${esc(subject)}">
      </label>
    `;

    const input = card.querySelector('input');
    input.addEventListener('change', async event => {
      try {
        event.target.disabled = true;
        const existing = row;
        const data = {
          [CONFIG.userIdColumn]: userId,
          [CONFIG.subjectColumn]: subject,
          [CONFIG.missedColumn]: Math.max(0, Number(event.target.value) || 0)
        };

        if (existing) {
          await tables.updateRow({
            databaseId: CONFIG.databaseId,
            tableId: CONFIG.tableId,
            rowId: existing.$id,
            data
          });
        } else {
          await tables.createRow({
            databaseId: CONFIG.databaseId,
            tableId: CONFIG.tableId,
            rowId: Appwrite.ID.unique(),
            data,
            permissions: [
              Appwrite.Permission.read(Appwrite.Role.user(userId)),
              Appwrite.Permission.update(Appwrite.Role.user(userId)),
              Appwrite.Permission.delete(Appwrite.Role.user(userId)),
              Appwrite.Permission.read(Appwrite.Role.team(CONFIG.teamId, ['moderator'])),
              Appwrite.Permission.update(Appwrite.Role.team(CONFIG.teamId, ['moderator'])),
              Appwrite.Permission.delete(Appwrite.Role.team(CONFIG.teamId, ['moderator']))
            ]
          });
        }
        await openUser(userId);
      } catch (error) {
        console.error(error);
        event.target.disabled = false;
        alert(error.message || 'Could not save attendance.');
      }
    });

    return card;
  }

  async function openUser(userId) {
    selectedUser = userId;
    const allRows = await getRows();
    const grid = document.getElementById('grid');
    if (!grid) return;

    grid.innerHTML = '';
    for (const [subject, total] of subjects) {
      const row = allRows.find(r =>
        r[CONFIG.userIdColumn] === userId &&
        r[CONFIG.subjectColumn] === subject
      );
      grid.appendChild(buildCard(subject, total, row, userId));
    }

    const label = userLabel(userId, allRows);
    document.getElementById('profileTitle').textContent = 'Moderator view';
    document.getElementById('profileLabel').textContent = label;
    document.getElementById('welcome').textContent = `${label}'s attendance.`;
    document.getElementById('heroDescription').innerHTML =
      'You are viewing this account as a moderator. Changes to <strong>Hours Missed</strong> are saved to their attendance record.';

    let banner = document.getElementById('modFixBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'modFixBanner';
      banner.className = 'moderator-banner';
      document.getElementById('appPanel').insertBefore(banner, document.getElementById('appPanel').firstElementChild);
    }
    banner.innerHTML = `
      <div>
        <span class="pill">Moderator view</span>
        <strong>${esc(label)}</strong>
        <small>${esc(userId)}</small>
      </div>
      <button class="ghost" id="modFixBack" type="button">← My attendance</button>
    `;
    banner.querySelector('#modFixBack').onclick = () => window.location.reload();
  }

  async function openPicker() {
    if (!modal) return;
    const box = modal.querySelector('#modFixUsers');
    box.innerHTML = '<p class="muted">Loading users...</p>';
    modal.classList.remove('hidden');

    try {
      const rows = await getRows();
      const ids = [...new Set(rows.map(r => r[CONFIG.userIdColumn]).filter(Boolean))];
      if (!ids.includes(currentUser.$id)) ids.unshift(currentUser.$id);

      box.innerHTML = '';
      ids.sort((a, b) => a === currentUser.$id ? -1 : b === currentUser.$id ? 1 : userLabel(a, rows).localeCompare(userLabel(b, rows)));

      ids.forEach(id => {
        const label = userLabel(id, rows);
        const count = rows.filter(r => r[CONFIG.userIdColumn] === id).length;
        const button = document.createElement('button');
        button.className = 'moderator-user';
        button.type = 'button';
        button.innerHTML = `
          <span class="moderator-avatar">${esc(label.slice(0,1).toUpperCase())}</span>
          <span>
            <strong>${esc(label)}${id === currentUser.$id ? ' · You' : ''}</strong>
            <small>${esc(id)} · ${count} attendance record${count === 1 ? '' : 's'}</small>
          </span>
          <span class="moderator-arrow">›</span>
        `;
        button.onclick = async () => {
          modal.classList.add('hidden');
          await openUser(id);
        };
        box.appendChild(button);
      });
    } catch (error) {
      box.innerHTML = `<p class="message error">Could not load users: ${esc(error.message || 'unknown error')}</p>`;
    }
  }

  function makeUI() {
    if (document.getElementById('moderatorFixButton')) return;

    const logout = document.getElementById('logout');
    if (!logout || logout.classList.contains('hidden')) return false;

    const button = document.createElement('button');
    button.id = 'moderatorFixButton';
    button.className = 'ghost moderator-button';
    button.type = 'button';
    button.textContent = 'Moderator';
    button.onclick = openPicker;
    logout.parentNode.insertBefore(button, logout);

    modal = document.createElement('div');
    modal.className = 'moderator-overlay hidden';
    modal.innerHTML = `
      <div class="moderator-modal">
        <div class="moderator-modal-top">
          <div>
            <span class="pill">Moderator</span>
            <h2>Choose a user</h2>
            <p>Select an account to open their attendance profile.</p>
          </div>
          <button class="ghost" id="modFixClose" type="button">Close</button>
        </div>
        <div id="modFixUsers" class="moderator-users"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#modFixClose').onclick = () => modal.classList.add('hidden');
    modal.onclick = event => { if (event.target === modal) modal.classList.add('hidden'); };
    return true;
  }

  async function init() {
    if (!(await isModerator())) return;
    if (!makeUI()) setTimeout(init, 500);
  }

  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    if (await isModerator()) {
      clearInterval(timer);
      makeUI();
    } else if (attempts >= 20) {
      clearInterval(timer);
    }
  }, 500);
})();
