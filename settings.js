(() => {
  const client = new Appwrite.Client()
    .setEndpoint('https://sgp.cloud.appwrite.io/v1')
    .setProject('6a88fdfe001ce0435833');
  const account = new Appwrite.Account(client);

  let user = null;
  let overlay = null;

  function makeButton() {
    const actions = document.querySelector('.header-actions');
    const logout = document.getElementById('logout');
    if (!actions || !logout || document.getElementById('settingsButton')) return;

    const button = document.createElement('button');
    button.id = 'settingsButton';
    button.className = 'ghost settings-button';
    button.textContent = '⚙ Settings';
    button.addEventListener('click', openSettings);
    actions.insertBefore(button, logout);
  }

  function makeOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'settings-overlay hidden';
    overlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-top">
          <div>
            <span class="pill">Account</span>
            <h2>Settings</h2>
            <p>Manage your profile and sign-in options.</p>
          </div>
          <button class="ghost" id="closeSettings">Close</button>
        </div>

        <section class="settings-section">
          <h3>Profile</h3>
          <div class="settings-account">
            <div><span>Name</span><strong id="settingsCurrentName">—</strong></div>
            <div><span>Email</span><strong id="settingsCurrentEmail">—</strong></div>
          </div>
          <form id="nameForm" class="settings-form">
            <label>Display name
              <input id="settingsName" type="text" maxlength="128" autocomplete="name" required>
            </label>
            <button class="primary" type="submit">Save name</button>
          </form>
        </section>

        <section class="settings-section">
          <h3>Security</h3>
          <p id="passwordHint" class="settings-hint">Set a password so you can sign in with email and password on any device.</p>
          <form id="passwordForm" class="settings-form">
            <label>Current password <span>(optional for OAuth accounts setting one for the first time)</span>
              <input id="currentPassword" type="password" autocomplete="current-password" placeholder="Leave blank if not set yet">
            </label>
            <label>New password
              <input id="newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required>
            </label>
            <label>Confirm new password
              <input id="confirmPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Repeat your new password" required>
            </label>
            <button class="primary" type="submit">Save password</button>
          </form>
        </section>

        <p id="settingsMessage" class="message hidden"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeSettings();
    });
    overlay.querySelector('#closeSettings').addEventListener('click', closeSettings);
    overlay.querySelector('#nameForm').addEventListener('submit', saveName);
    overlay.querySelector('#passwordForm').addEventListener('submit', savePassword);
  }

  function setMessage(text, error = false) {
    const box = document.getElementById('settingsMessage');
    if (!box) return;
    box.textContent = text;
    box.className = `message ${error ? 'error' : ''}`;
  }

  function closeSettings() {
    overlay?.classList.add('hidden');
  }

  async function openSettings() {
    try {
      user = await account.get();
      document.getElementById('settingsCurrentName').textContent = user.name || 'Not set';
      document.getElementById('settingsCurrentEmail').textContent = user.email || 'Not available';
      document.getElementById('settingsName').value = user.name || '';
      setMessage('');
      document.getElementById('settingsMessage').classList.add('hidden');
      document.getElementById('passwordHint').textContent = 'For GitHub/OAuth accounts, you can set a password without knowing an old password. After that, email + password login works too.';
      overlay.classList.remove('hidden');
    } catch (error) {
      console.error(error);
      alert(error.message || 'Could not open settings.');
    }
  }

  async function saveName(event) {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const name = document.getElementById('settingsName').value.trim();
      if (!name) throw new Error('Please enter a display name.');
      await account.updateName({ name });
      user = await account.get();
      document.getElementById('settingsCurrentName').textContent = user.name || name;
      const badge = document.getElementById('userBadge');
      if (badge) badge.textContent = `@${user.name || user.email || user.$id}`;
      setMessage('Name updated.');
      document.getElementById('settingsMessage').classList.remove('hidden');
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Could not update your name.', true);
      document.getElementById('settingsMessage').classList.remove('hidden');
    } finally {
      button.disabled = false;
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    const button = event.submitter;
    const oldPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 8) {
      setMessage('Your new password must be at least 8 characters.', true);
      document.getElementById('settingsMessage').classList.remove('hidden');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('The new passwords do not match.', true);
      document.getElementById('settingsMessage').classList.remove('hidden');
      return;
    }

    button.disabled = true;
    try {
      const payload = { password: newPassword };
      if (oldPassword) payload.oldPassword = oldPassword;
      await account.updatePassword(payload);

      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
      setMessage('Password saved. You can now sign in with email + password on other devices.');
      document.getElementById('settingsMessage').classList.remove('hidden');
    } catch (error) {
      console.error(error);
      setMessage(error.message || 'Could not update your password.', true);
      document.getElementById('settingsMessage').classList.remove('hidden');
    } finally {
      button.disabled = false;
    }
  }

  async function init() {
    try {
      user = await account.get();
      makeButton();
      makeOverlay();
    } catch {
      // Not logged in; the main app owns the login UI.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
