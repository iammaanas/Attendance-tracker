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

const profiles = {maanas:'Maanas','friend-a':'Friend A','friend-b':'Friend B'};
const PROFILE_KEY = 'itm-attendance-current-profile';
const DATA_PREFIX = 'itm-attendance-data-';
const profileSelect = document.getElementById('profile');
const profileLabel = document.getElementById('profileLabel');
const welcome = document.getElementById('welcome');
const grid = document.getElementById('grid');
const resetButton = document.getElementById('reset');
let currentProfile = localStorage.getItem(PROFILE_KEY) || 'maanas';
if (!profiles[currentProfile]) currentProfile = 'maanas';
profileSelect.value = currentProfile;

function getData(){try{return JSON.parse(localStorage.getItem(DATA_PREFIX+currentProfile)||'{}')}catch{return {}}}
function save(data){localStorage.setItem(DATA_PREFIX+currentProfile,JSON.stringify(data))}
function fmt(n){return Number.isInteger(n)?String(n):n.toFixed(2)}

function render(){
  const data=getData();
  const name=profiles[currentProfile];
  profileLabel.textContent=name;
  welcome.textContent=`${name}'s attendance.`;
  grid.innerHTML='';
  subjects.forEach(([subject,totalHours])=>{
    const missed=Math.min(totalHours,Math.max(0,Number(data[subject]??0)));
    const required=totalHours*.75;
    const maximumAbsence=totalHours*.25;
    const canStillMiss=maximumAbsence-missed;
    const attendance=((totalHours-missed)/totalHours)*100;
    let status='safe',label='SAFE';
    if(attendance<75){status='danger';label='BELOW 75%'}
    else if(canStillMiss<=2){status='warn';label='CLOSE TO LIMIT'}
    const card=document.createElement('article');
    card.className='card';
    card.innerHTML=`<div class="card-top"><div><h3>${subject}</h3><p>${fmt(totalHours)} total hours · ${fmt(required)} required</p></div><span class="status ${status}">${label}</span></div><div class="percent">${attendance.toFixed(1)}<small>%</small></div><div class="bar"><i class="bar-fill" style="width:${Math.min(100,Math.max(0,attendance))}%"></i></div><div class="stats"><div><span>Hours missed</span><strong>${fmt(missed)} hrs</strong></div><div><span>Can still miss</span><strong>${fmt(Math.max(0,canStillMiss))} hrs</strong></div></div><label class="input-label">Hours missed<input type="number" min="0" max="${totalHours}" step="0.5" value="${missed}" data-subject="${subject}"></label>`;
    grid.appendChild(card);
  });
  grid.querySelectorAll('input[data-subject]').forEach(input=>input.addEventListener('change',e=>{const data=getData();const subject=e.target.dataset.subject;const max=Number(e.target.max);data[subject]=Math.min(max,Math.max(0,Number(e.target.value)||0));save(data);render()}));
}
profileSelect.addEventListener('change',e=>{currentProfile=e.target.value;localStorage.setItem(PROFILE_KEY,currentProfile);render()});
resetButton.addEventListener('click',()=>{const name=profiles[currentProfile];if(confirm(`Reset all attendance figures for ${name}?`)){localStorage.removeItem(DATA_PREFIX+currentProfile);render()}});
render();