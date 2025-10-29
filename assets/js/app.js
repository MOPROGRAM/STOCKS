// Enhanced controller for TradingView widget + watchlist
const WATCHLIST_URL = '/data/watchlist.json';
let tvWidget = null;
let currentSymbol = null;

function createWidget(symbol) {
  // Replace container to ensure a fresh widget instance
  const container = document.getElementById('tv_chart_container');
  container.innerHTML = '';

  // Update toolbar text quickly
  const sel = document.getElementById('selected-symbol');
  if(sel) sel.textContent = symbol.replace(/^[^:]+:/, '');

  new TradingView.widget({
    autosize: true,
    symbol: symbol,
    interval: 'D',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    enable_publishing: false,
    allow_symbol_change: true,
    details: true,
    studies: ['Moving Average@tv-basicstudies'],
    container_id: 'tv_chart_container'
  });
}

function normalizeSymbol(sym){
  if(!sym) return sym;
  if(sym.includes(':')) return sym;
  // If symbol contains dash or dot, leave as-is prefixed by NASDAQ as a best guess
  return 'NASDAQ:' + sym;
}

async function loadWatchlist(){
  try{
    const res = await fetch(WATCHLIST_URL);
    const list = await res.json();
    renderList(list);

    // Try to restore last selected symbol
    const last = localStorage.getItem('lastSymbol');
    let initial = last || list[0];
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

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = 'View';

    li.appendChild(left);
    li.appendChild(meta);

    li.addEventListener('click', () => onSelect(sym));
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

// Filter control
document.addEventListener('DOMContentLoaded', ()=>{
  const filterInput = document.getElementById('filter');
  if(filterInput){
    filterInput.addEventListener('input', (e)=>{
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('#symbols li').forEach(li => {
        const sym = li.querySelector('.symbol').textContent.toLowerCase();
        li.style.display = sym.includes(q) ? '' : 'none';
      });
    });
  }

  // Toggle watchlist on small screens
  const toggle = document.getElementById('toggle-list');
  if(toggle){
    toggle.addEventListener('click', ()=>{
      const panel = document.getElementById('watchlist');
      if(!panel) return;
      if(panel.style.display === 'none') panel.style.display = ''; else panel.style.display = 'none';
    });
  }

  // Start
  loadWatchlist();
});
