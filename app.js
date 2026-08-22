const subjects = [
  ['Business Accounting',45],
  ['Business Management',30],
  ['Introduction to AI & ML',30],
  ['Business Communication',45],
  ['Professional Office Applications',45],
  ['Business Economics',30],
  ['German Language',45],
  ['Foundation of Indian Knowledge System',45],
  ['Personal Growth & Awareness Lab',30],
  ['Lifestyle & Wellness Management',30]
];

const profiles = {
  '1': 'Maanas',
  '2': 'Friend A',
  '3': 'Friend B'
};

const PROFILE_KEY = 'itm-attendance-profile';
const DATA_PREFIX = 'itm-attendance-data-';

const profileSelect = document.getElementById('profile');
const profileLabel = document.getElementById('profileLabel');
const welcome = document.getElementById('welcome');
const grid = document.getElementById('grid');
const resetButton = document.getElementById('reset');

let currentProfile = localStorage.getItem(PROFILE_KEY) || '1';
if (!profiles[currentProfile]) currentProfile = '1';
profileSelect.value = currentProfile;

function getData() {
  try {
    return JSON.parse(localStorage.getItem(DATA_PREFIX + currentProfile) || '{}');
  } catch {
    return {};
  }
}

function saveData(data) {
  localStorage.setItem(DATA_PREFIX + currentProfile, JSON.stringify(data));
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function render() {
  const data = getData();
  const name = profiles[currentProfile];

  profileLabel.textContent = name;
  welcome.textContent = `${name}'s attendance.`;
  grid.innerHTML = '';

  subjects.forEach(([subject, hours]) => {
    const missed = Math.max(0, Number(data[subject] ?? 0));
    const required = hours * 0.75;
    const maxMissed = hours * 0.25;
    const remaining = maxMissed - missed;
    const attended = Math.max(0, hours - missed);
    const percentage = (attended / hours) * 100;

    let statusClass = 'safe';
    let statusLabel = 'SAFE';
    if (percentage < 75) {
      statusClass = 'danger';
      statusLabel = 'BELOW 75%';
    } else if (remaining <= 2) {
      statusClass = 'warn';
      statusLabel = 'CLOSE TO LIMIT';
    }

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${subject}</h3>
          <p>${fmt(hours)} total hours · ${fmt(required)} required</p>
        </div>
        <span class="status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="percent">${percentage.toFixed(1)}<small>%</small></div>
      <div class="bar"><i style="width:${Math.min(100, Math.max(0, percentage))}%"></i></div>
      <div class="stats">
        <div><span>Hours missed</span><strong>${fmt(missed)} hrs</strong></div>
        <div><span>Can still miss</span><strong>${fmt(Math.max(0, remaining))} hrs</strong></div>
      </div>
      <label class="input-label">
        Update hours missed
        <input type="number" min="0" max="${hours}" step="0.5" value="${missed}" data-subject="${subject}">
      </label>
    `;

    grid.appendChild(card);
  });

  grid.querySelectorAll('input[data-subject]').forEach(input => {
    input.addEventListener('change', event => {
      const data = getData();
      const subject = event.target.dataset.subject;
      const max = Number(event.target.max);
      const value = Math.min(max, Math.max(0, Number(event.target.value) || 0));
      data[subject] = value;
      saveData(data);
      render();
    });
  });
}

profileSelect.addEventListener('change', event => {
  currentProfile = event.target.value;
  localStorage.setItem(PROFILE_KEY, currentProfile);
  render();
});

resetButton.addEventListener('click', () => {
  const name = profiles[currentProfile];
  if (confirm(`Reset all attendance data for ${name}?`)) {
    localStorage.removeItem(DATA_PREFIX + currentProfile);
    render();
  }
});

render();