// Enhanced controller for TradingView widget + editable watchlist
const WATCHLIST_URL = '/data/watchlist.json';
let tvWidget = null;
let currentSymbol = null;
let currentInterval = localStorage.getItem('tv_interval') || '60';
let activeStudies = JSON.parse(localStorage.getItem('tv_studies') || '[]');

function createWidget(symbol){
  const container = document.getElementById('tv_chart_container');
  container.innerHTML = '';

  const sel = document.getElementById('selected-symbol');
  if(sel) sel.textContent = symbol.replace(/^[^:]+:/, '');

  const cfg = {
    autosize: true,
    symbol: symbol,
    interval: currentInterval,
    intervals: ['60','120','240','D','W','M'],
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    enable_publishing: false,
    allow_symbol_change: true,
    details: true,
    studies: activeStudies.length ? activeStudies : [],
    container_id: 'tv_chart_container'
  };

  // create the widget
  tvWidget = new TradingView.widget(cfg);

  // Highlight active interval button
  document.querySelectorAll('.interval-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.interval === currentInterval);
  });
}

function normalizeSymbol(sym){
  if(!sym) return sym;
  if(sym.includes(':')) return sym;
  return 'NASDAQ:' + sym;
}

async function loadWatchlist(){
  try{
    const res = await fetch(WATCHLIST_URL);
    const list = await res.json();

    // Check for user-saved watchlist in localStorage
    const saved = JSON.parse(localStorage.getItem('user_watchlist') || 'null');
    const activeList = saved && Array.isArray(saved) && saved.length ? saved : list;

    renderList(activeList);

    const last = localStorage.getItem('lastSymbol');
    let initial = last || activeList[0];
    if(initial){
      const s = normalizeSymbol(initial);
      currentSymbol = s;
      createWidget(s);
      highlightActive(initial);
    }
  }catch(e){
    console.error('Failed to load watchlist', e);
    document.getElementById('symbols').innerHTML = '<li class="meta">Failed to load watchlist</li>';
  }
}

function renderList(list){
  const ul = document.getElementById('symbols');
  ul.innerHTML = '';
  list.forEach(sym => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.title = sym;

    const badge = document.createElement('span');
    badge.className = 'symbol-badge';
    badge.textContent = sym.slice(0,3).toUpperCase();

    const name = document.createElement('span');
    name.className = 'symbol';
    name.textContent = sym;

    const left = document.createElement('div');
    left.className = 'symbol-row';
    left.appendChild(badge);
    left.appendChild(name);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', ()=> onSelect(sym));

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', ()=> editSymbol(sym));

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', ()=> removeSymbol(sym));

    actions.appendChild(viewBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);

    li.addEventListener('keydown', (e)=>{ if(e.key=== 'Enter') onSelect(sym); });
    ul.appendChild(li);
  });
}

function highlightActive(sym){
  document.querySelectorAll('#symbols li').forEach(li=>{
    const s = li.querySelector('.symbol').textContent;
    if(s === sym) li.classList.add('active'); else li.classList.remove('active');
  });
}

function onSelect(sym){
  const n = normalizeSymbol(sym);
  if(n === currentSymbol) return;
  currentSymbol = n;
  createWidget(n);
  highlightActive(sym);
  localStorage.setItem('lastSymbol', sym);
}

// Watchlist editing helpers (persisted in localStorage)
function getActiveList(){
  const saved = JSON.parse(localStorage.getItem('user_watchlist') || 'null');
  if(saved && Array.isArray(saved) && saved.length) return saved;
  // fallback to data file
  // NOTE: loadWatchlist will render default if no saved list; here call fetch synchronously is avoided
  return [];
}

function saveActiveList(list){
  localStorage.setItem('user_watchlist', JSON.stringify(list));
  renderList(list);
}

function addSymbol(sym){
  if(!sym) return;
  const list = getActiveList();
  if(list.includes(sym)) return;
  list.unshift(sym);
  saveActiveList(list);
}

function removeSymbol(sym){
  let list = getActiveList();
  list = list.filter(s => s !== sym);
  saveActiveList(list);
}

function editSymbol(oldSym){
  const newVal = prompt('Edit symbol', oldSym);
  if(!newVal) return;
  let list = getActiveList();
  const idx = list.indexOf(oldSym);
  if(idx === -1) return;
  list[idx] = newVal.trim();
  saveActiveList(list);
}

function resetWatchlist(){
  localStorage.removeItem('user_watchlist');
  localStorage.removeItem('lastSymbol');
  loadWatchlist();
}

function exportWatchlist(){
  const list = getActiveList();
  const blob = new Blob([JSON.stringify(list, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'watchlist.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Studies manager
function addStudy(name){
  if(!name) return;
  if(name === 'QQE'){
    // QQE may not be available in the basic widget; still store request so we try to add it
  }
  if(!activeStudies.includes(name)){
    activeStudies.push(name);
    localStorage.setItem('tv_studies', JSON.stringify(activeStudies));
    // recreate widget with studies
    if(currentSymbol) createWidget(currentSymbol);
  }
}

function removeStudy(name){
  activeStudies = activeStudies.filter(s => s !== name);
  localStorage.setItem('tv_studies', JSON.stringify(activeStudies));
  renderActiveStudies();
  if(currentSymbol) createWidget(currentSymbol);
}

function renderActiveStudies(){
  const container = document.getElementById('active-studies');
  if(!container) return;
  container.innerHTML = '';
  activeStudies.forEach(s => {
    const chip = document.createElement('span');
    chip.className = 'study-chip';
    const label = document.createElement('span');
    label.textContent = s.replace(/@.*$/, '');
    const btn = document.createElement('button');
    btn.title = 'Remove study';
    btn.textContent = '✕';
    btn.addEventListener('click', ()=> removeStudy(s));
    chip.appendChild(label);
    chip.appendChild(btn);
    container.appendChild(chip);
  });
}

function showToast(msg, ms = 3500){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  t.setAttribute('aria-hidden', 'false');
  setTimeout(()=>{
    t.classList.remove('show');
    t.setAttribute('aria-hidden', 'true');
  }, ms);
}

function clearStudies(){
  activeStudies = [];
  localStorage.removeItem('tv_studies');
  if(currentSymbol) createWidget(currentSymbol);
}

// Wire UI and start
document.addEventListener('DOMContentLoaded', ()=>{
  // Filter control
  const filterInput = document.getElementById('filter');
  if(filterInput){
    filterInput.addEventListener('input', (e)=>{
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('#symbols li').forEach(li => {
        const symEl = li.querySelector('.symbol');
        const sym = symEl ? symEl.textContent.toLowerCase() : '';
        li.style.display = sym.includes(q) ? '' : 'none';
      });
    });
  }

  // Watchlist add/reset/export
  document.getElementById('add-symbol').addEventListener('click', ()=>{
    const v = document.getElementById('new-symbol').value.trim().toUpperCase();
    if(!v) return alert('Enter a symbol');
    const list = getActiveList();
    list.unshift(v);
    saveActiveList(list);
    document.getElementById('new-symbol').value = '';
  });
  document.getElementById('reset-watchlist').addEventListener('click', ()=>{
    if(confirm('Reset watchlist to the default set from data/watchlist.json?')) resetWatchlist();
  });
  document.getElementById('export-watchlist').addEventListener('click', exportWatchlist);

  // Interval buttons
  document.querySelectorAll('.interval-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      currentInterval = b.dataset.interval;
      localStorage.setItem('tv_interval', currentInterval);
      document.querySelectorAll('.interval-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      if(currentSymbol) createWidget(currentSymbol);
    });
  });

  // Studies controls
  document.getElementById('add-study').addEventListener('click', ()=>{
    const sel = document.getElementById('study-select');
    if(sel.value === 'QQE'){
      showToast('QQE may not be available in the public widget — it will be added if supported.');
    }
    addStudy(sel.value);
    renderActiveStudies();
  });
  document.getElementById('clear-studies').addEventListener('click', ()=>{
    if(confirm('Clear all studies?')) clearStudies();
  });

  // Toggle watchlist on small screens
  const toggle = document.getElementById('toggle-list');
  if(toggle){
    toggle.addEventListener('click', ()=>{
      const panel = document.getElementById('watchlist');
      if(!panel) return;
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });
  }

  // Start
  loadWatchlist();
  // render active studies if any
  renderActiveStudies();
});
