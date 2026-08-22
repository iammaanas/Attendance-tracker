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

const STORAGE_KEY = 'itm-attendance-data-v2';
const grid = document.getElementById('grid');
const resetButton = document.getElementById('reset');

let data = {};
try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { data = {}; }

const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(2);

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function render() {
  grid.innerHTML = '';

  subjects.forEach(([subject, totalHours]) => {
    const missed = Math.min(totalHours, Math.max(0, Number(data[subject] ?? 0)));
    const requiredHours = totalHours * 0.75;
    const maximumAbsence = totalHours * 0.25;
    const canStillMiss = maximumAbsence - missed;
    const attendedHours = totalHours - missed;
    const attendance = (attendedHours / totalHours) * 100;

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
          <p>${fmt(totalHours)} total hours · ${fmt(requiredHours)} required</p>
        </div>
        <span class="status ${status}">${label}</span>
      </div>

      <div class="percent">${attendance.toFixed(1)}<small>%</small></div>
      <div class="bar"><i class="bar-fill" style="width:${Math.min(100, Math.max(0, attendance))}%"></i></div>

      <div class="stats">
        <div>
          <span>Hours missed</span>
          <strong>${fmt(missed)} hrs</strong>
        </div>
        <div>
          <span>Can still miss</span>
          <strong>${fmt(Math.max(0, canStillMiss))} hrs</strong>
        </div>
      </div>

      <label class="input-label">
        Hours missed
        <input type="number" min="0" max="${totalHours}" step="0.5" value="${missed}" data-subject="${subject}">
      </label>
    `;

    grid.appendChild(card);
  });

  grid.querySelectorAll('input[data-subject]').forEach(input => {
    input.addEventListener('change', event => {
      const subject = event.target.dataset.subject;
      const max = Number(event.target.max);
      data[subject] = Math.min(max, Math.max(0, Number(event.target.value) || 0));
      save();
      render();
    });
  });
}

resetButton.addEventListener('click', () => {
  if (confirm('Reset all saved attendance figures?')) {
    data = {};
    save();
    render();
  }
});

render();