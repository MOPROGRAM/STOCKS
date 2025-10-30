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
  // after creating the widget
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
  list.forEach((sym, idx) => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.title = sym;

    // index badge (1-based)
    const indexBadge = document.createElement('span');
    indexBadge.className = 'symbol-index';
    indexBadge.textContent = String(idx + 1);

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
  left.prepend(indexBadge);

    const actions = document.createElement('div');
  actions.className = 'symbol-actions';

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View';
  viewBtn.addEventListener('click', (e)=>{ e.stopPropagation(); onSelect(sym); });

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', (e)=>{ e.stopPropagation(); editSymbol(sym); });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', (e)=>{ e.stopPropagation(); removeSymbol(sym); });

    actions.appendChild(viewBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);

  // Select symbol when clicking the row (but ignore clicks on action buttons)
  li.addEventListener('click', (e)=>{ if(e.target.closest && e.target.closest('.symbol-actions')) return; onSelect(sym); });
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
  // refresh any local overlays for the newly selected symbol (QQE will update where active)
  try{ if(typeof updateQQE === 'function') updateQQE(); }catch(e){console.warn('local overlays update failed', e);} 
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

// Add current chart symbol to user watchlist (persisted)
function addCurrentToWatchlist(){
  if(!currentSymbol) return showToast('No symbol selected');
  const sym = currentSymbol.replace(/^[^:]+:/, '');
  let list = getActiveList();
  if(!Array.isArray(list)) list = [];
  // If already present, move to top
  list = list.filter(s => s !== sym);
  list.unshift(sym);
  saveActiveList(list);
  showToast(`${sym} added to watchlist`);
}

// Clear all user-saved watchlist symbols (keeps default data file untouched)
function clearAllWatchlist(){
  if(!confirm('Delete all symbols from your saved watchlist? This will empty your custom list.')) return;
  localStorage.setItem('user_watchlist', JSON.stringify([]));
  // remove lastSymbol as well
  localStorage.removeItem('lastSymbol');
  renderList([]);
  showToast('Saved watchlist cleared');
}

// Parse bulk input: accepts newline-separated or comma-separated values
function parseBulkInput(raw){
  if(!raw) return [];
  // normalize separators: replace commas with newlines, then split
  const cleaned = raw.replace(/,|;|\t/g, '\n');
  const lines = cleaned.split(/\n/).map(s=>s.trim()).filter(Boolean);
  // normalize to uppercase plain symbols
  return lines.map(s => s.toUpperCase().replace(/^NASDAQ:/i, '').replace(/^NYSE:/i, '').trim());
}

function bulkAddSymbols(){
  const raw = document.getElementById('bulk-input').value || '';
  const syms = parseBulkInput(raw);
  if(!syms.length) return alert('No symbols found in input');
  let list = getActiveList();
  // if no saved list and data file present, keep user list empty and add to it
  list = Array.isArray(list) ? list : [];
  let added = 0;
  syms.forEach(s => {
    if(!list.includes(s)){
      list.unshift(s);
      added++;
    }
  });
  saveActiveList(list);
  showToast(`${added} symbol${added!==1?'s':''} added`);
}

function bulkRemoveSymbols(){
  const raw = document.getElementById('bulk-input').value || '';
  const syms = parseBulkInput(raw);
  if(!syms.length) return alert('No symbols found in input');
  if(!confirm(`Remove ${syms.length} symbol${syms.length!==1?'s':''} from your watchlist? This cannot be undone.`)) return;
  let list = getActiveList();
  list = list.filter(s => !syms.includes(s));
  saveActiveList(list);
  showToast(`${syms.length} symbol${syms.length!==1?'s':''} removed`);
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
  // Special handling for ZigZag: it's a local overlay not a TradingView built-in study
  if(name === 'ZIGZAG'){
    // (ZigZag support removed)
    return;
  }
  if(!activeStudies.includes(name)){
    activeStudies.push(name);
    localStorage.setItem('tv_studies', JSON.stringify(activeStudies));
    // recreate widget with studies
    if(currentSymbol) createWidget(currentSymbol);
  }
}

function removeStudy(name){
  // Special handling for ZigZag
  if(name === 'ZIGZAG'){
    // ZigZag support removed — no-op
    activeStudies = activeStudies.filter(s => s !== 'ZIGZAG');
    localStorage.setItem('tv_studies', JSON.stringify(activeStudies));
    renderActiveStudies();
    return;
  }
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
    // no special-case chips remaining
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

  // Scanner: Alpha Vantage integration (optional)
  const avKeyInput = document.getElementById('av-key');
  if(avKeyInput){
    avKeyInput.value = localStorage.getItem('av_key') || '';
    avKeyInput.addEventListener('change', (e)=>{
      localStorage.setItem('av_key', e.target.value.trim());
    });
  }
  document.getElementById('run-scan').addEventListener('click', async ()=>{
    const provider = document.getElementById('data-provider').value;
    const avKey = (document.getElementById('av-key').value || '').trim();
    const fhKey = (document.getElementById('fh-key').value || '').trim();
    if(provider === 'alphavantage' && !avKey){
      if(!confirm('Alpha Vantage selected but no API key provided. Scanning will be limited. Continue?')) return;
    }
    if(provider === 'finnhub' && !fhKey){
      if(!confirm('Finnhub selected but no API key provided. Scanning will be limited. Continue?')) return;
    }
    localStorage.setItem('av_key', avKey);
    localStorage.setItem('fh_key', fhKey);
    const max = Math.max(1, Math.min(50, parseInt(document.getElementById('scan-count').value || '5')));
    runScan(max);
  });

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

  // Add current to watchlist button
  const addCur = document.getElementById('add-current-to-watchlist');
  if(addCur) addCur.addEventListener('click', addCurrentToWatchlist);

  // Clear all watchlist button
  const clearAllBtn = document.getElementById('clear-watchlist');
  if(clearAllBtn) clearAllBtn.addEventListener('click', clearAllWatchlist);

  // QQE on-chart toggle


  // Start
  loadWatchlist();
  // render active studies if any
  renderActiveStudies();
  // scanner advanced UI wiring
  const toggleAdv = document.getElementById('toggle-advanced');
  if(toggleAdv){
    toggleAdv.addEventListener('click', ()=>{
      const panel = document.getElementById('advanced-panel');
      if(panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });
  }
  // weight sliders
  ['sma','rsi','macd','stoch','qqe'].forEach(k=>{
    const el = document.getElementById('w-' + k);
    const val = document.getElementById('w-' + k + '-val');
    if(el && val){
      const saved = localStorage.getItem('w_' + k) || el.value;
      el.value = saved;
      val.textContent = parseFloat(el.value).toFixed(1);
      el.addEventListener('input', (e)=>{ val.textContent = parseFloat(e.target.value).toFixed(1); localStorage.setItem('w_' + k, e.target.value); });
    }
  });

  // Profiles: save/load/delete
  const saveBtn = document.getElementById('save-profile');
  const loadBtn = document.getElementById('load-profile');
  const delBtn = document.getElementById('delete-profile');
  const profilesList = document.getElementById('profiles-list');
  const profileNameInput = document.getElementById('profile-name');

  function loadProfiles(){
    const raw = localStorage.getItem('weight_profiles');
    let map = {};
    try{ map = raw ? JSON.parse(raw) : {}; }catch(e){ map = {}; }
    profilesList.innerHTML = '';
    Object.keys(map).forEach(name=>{
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      profilesList.appendChild(opt);
    });
  }

  function ensureDefaultProfiles(){
    const raw = localStorage.getItem('weight_profiles');
    if(raw) return; // already have profiles
    const defaults = {
      "Conservative": {sma:1.2, rsi:0.8, macd:0.6, stoch:0.4},
      "Balanced": {sma:1.0, rsi:1.0, macd:1.0, stoch:1.0},
      "Aggressive": {sma:0.8, rsi:1.2, macd:1.4, stoch:1.2}
    };
    localStorage.setItem('weight_profiles', JSON.stringify(defaults));
  }

  function saveProfile(){
    const name = (profileNameInput.value || '').trim();
    if(!name) return alert('Enter a profile name');
    const map = JSON.parse(localStorage.getItem('weight_profiles') || '{}');
    map[name] = getWeights();
    localStorage.setItem('weight_profiles', JSON.stringify(map));
    loadProfiles();
    showToast('Profile saved');
  }

  function applyProfile(name){
    const map = JSON.parse(localStorage.getItem('weight_profiles') || '{}');
    if(!map[name]) return alert('Profile not found');
    const w = map[name];
    ['sma','rsi','macd','stoch','qqe'].forEach(k=>{
      const el = document.getElementById('w-' + k);
      const val = document.getElementById('w-' + k + '-val');
      if(el && val && w[k] !== undefined){ el.value = w[k]; val.textContent = parseFloat(w[k]).toFixed(1); localStorage.setItem('w_' + k, w[k]); }
    });
    showToast('Profile loaded');
  }

  function deleteProfile(name){
    const map = JSON.parse(localStorage.getItem('weight_profiles') || '{}');
    if(!map[name]) return alert('Profile not found');
    delete map[name];
    localStorage.setItem('weight_profiles', JSON.stringify(map));
    loadProfiles();
    showToast('Profile deleted');
  }

  saveBtn.addEventListener('click', saveProfile);
  loadBtn.addEventListener('click', ()=>{
    const sel = profilesList.value;
    if(!sel) return alert('Select a profile to load');
    applyProfile(sel);
  });
  delBtn.addEventListener('click', ()=>{
    const sel = profilesList.value;
    if(!sel) return alert('Select a profile to delete');
    if(confirm(`Delete profile '${sel}'?`)) deleteProfile(sel);
  });

  loadProfiles();
  ensureDefaultProfiles();

  // ZigZag controls wiring
  // ZigZag removed — no controls to wire

  // Export/import handlers
  const exportBtn = document.getElementById('export-profiles');
  const importBtn = document.getElementById('import-profiles');
  const importInput = document.getElementById('import-file');
  exportBtn.addEventListener('click', ()=>{
    const raw = localStorage.getItem('weight_profiles') || '{}';
    const blob = new Blob([raw], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'weight_profiles.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('Profiles exported');
  });
  importBtn.addEventListener('click', ()=> importInput.click());
  importInput.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = function(){
      try{
        const parsed = JSON.parse(reader.result);
        if(typeof parsed !== 'object') throw new Error('Invalid format');
        localStorage.setItem('weight_profiles', JSON.stringify(parsed));
        loadProfiles();
        showToast('Profiles imported');
      }catch(err){
        alert('Failed to import profiles: invalid JSON');
      }
    };
    reader.readAsText(f);
  });
  ensureDefaultProfiles();

  // Bulk add/remove wiring
  const bulkAddBtn = document.getElementById('bulk-add-btn');
  const bulkRemoveBtn = document.getElementById('bulk-remove-btn');
  if(bulkAddBtn) bulkAddBtn.addEventListener('click', bulkAddSymbols);
  if(bulkRemoveBtn) bulkRemoveBtn.addEventListener('click', bulkRemoveSymbols);
});

// ---------- Scanner implementation ----------
async function runScan(maxCount = 5){
  const status = document.getElementById('scan-status');
  const recList = document.getElementById('recommendations');
  status.textContent = 'Preparing scan...';
  recList.innerHTML = '';

  // Build list to scan: user watchlist or default
  let list = getActiveList();
  if(!list.length){
    // fetch default quickly
    try{ const res = await fetch(WATCHLIST_URL); list = await res.json(); }catch(e){ list = []; }
  }
  list = list.slice(0, maxCount);

  const apiKey = localStorage.getItem('av_key') || '';
  const results = [];

  const provider = document.getElementById('data-provider') ? document.getElementById('data-provider').value : 'alphavantage';
  const fhKey = localStorage.getItem('fh_key') || '';
  const avKey = localStorage.getItem('av_key') || '';

  for(let i=0;i<list.length;i++){
    const sym = list[i];
    status.textContent = `Scanning ${i+1}/${list.length}: ${sym}`;
    try{
      let data = null;
      if(provider === 'finnhub' && fhKey){
        data = await fetchDailyFinnhub(sym, fhKey);
      }
      if(!data && avKey){
        data = await fetchDailyAlpha(sym, avKey);
      }
      if(!data || !data.closes || data.closes.length < 50){
        results.push({symbol: sym, score: 0, reason: 'insufficient data'});
      } else {
        const analysis = analyzeSeries(data);
        const weights = getWeights();
        // compute weighted score
        const comp = analysis.components || {};
        const weightedScore = (comp.sma || 0)*weights.sma + (comp.rsi||0)*weights.rsi + (comp.macd||0)*weights.macd + (comp.stoch||0)*weights.stoch + (comp.qqe||0)*weights.qqe;
        results.push({symbol: sym, score: weightedScore, reason: analysis.reason || '', components: comp});
      }
    }catch(e){
      results.push({symbol: sym, score: 0, reason: 'error fetching'});
    }
    // Respect free API rate limits: pause if apiKey is present or not
    await sleep(1200); // small delay to avoid burst; user should supply API key and limit scanCount
  }

  // Sort by score desc
  results.sort((a,b)=> (b.score||0) - (a.score||0));
  status.textContent = 'Scan complete';

  // Render recommendations (score >= 1)
  results.forEach(r=>{
    const li = document.createElement('li');
    li.className = 'rec-item';
    const left = document.createElement('div');
    left.innerHTML = `<div><strong>${r.symbol}</strong><div class="rec-reason">${r.reason || ''}</div></div>`;
    const right = document.createElement('div');
    right.innerHTML = `<span class="rec-badge">${(r.score||0).toFixed(1)}</span>`;
    li.appendChild(left);
    li.appendChild(right);
    recList.appendChild(li);
  });
}

function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

async function fetchDailyAlpha(symbol, apiKey){
  // alpha vantage: TIME_SERIES_DAILY_ADJUSTED
  if(!apiKey){
    // no API key: can't fetch reliable OHLC series
    return null;
  }
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  const series = json['Time Series (Daily)'] || null;
  if(!series) return null;
  // convert to descending (most recent first) arrays of closes, highs, lows
  const dates = Object.keys(series).sort((a,b)=> new Date(b) - new Date(a));
  const closes = [], highs = [], lows = [];
  dates.forEach(d => {
    const rec = series[d];
    closes.push(parseFloat(rec['4. close']));
    highs.push(parseFloat(rec['2. high']));
    lows.push(parseFloat(rec['3. low']));
  });
  return {closes, highs, lows};
}

async function fetchDailyFinnhub(symbol, apiKey){
  // Finnhub: /stock/candle?symbol=AAPL&resolution=D&from=...&to=...&token=
  if(!apiKey) return null;
  const to = Math.floor(Date.now()/1000);
  const from = to - (365 * 24 * 60 * 60); // 1 year
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  if(!json || json.s !== 'ok' || !json.c) return null;
  // Finnhub returns arrays: c (close), h (high), l (low)
  const closes = json.c.slice().reverse();
  const highs = json.h.slice().reverse();
  const lows = json.l.slice().reverse();
  return {closes, highs, lows};
}

function getWeights(){
  return {
    sma: parseFloat(localStorage.getItem('w_sma') || document.getElementById('w-sma').value) || 1,
    rsi: parseFloat(localStorage.getItem('w_rsi') || document.getElementById('w-rsi').value) || 1,
    macd: parseFloat(localStorage.getItem('w_macd') || document.getElementById('w-macd').value) || 1,
    stoch: parseFloat(localStorage.getItem('w_stoch') || document.getElementById('w-stoch').value) || 1
  };
}

function analyzeSeries(data){
  // data: {closes, highs, lows} with most recent first
  const closes = data.closes;
  const highs = data.highs;
  const lows = data.lows;

  // basic checks
  if(!closes || closes.length < 50) return {score:0, reason:'insufficient data'};

  const shortSMA = sma(closes, 10);
  const longSMA = sma(closes, 50);
  const rsiV = rsi(closes, 14);

  // MACD
  const mac = macd(closes, 12, 26, 9);
  // Stochastic
  const stoch = stochastic(highs, lows, closes, 14, 3);
  // QQE approximation based on smoothed RSI
  const qqe = qqeApprox(closes, 14);

  const components = {sma:0, rsi:0, macd:0, stoch:0, qqe:0};
  const reasons = [];

  // SMA crossover
  if(shortSMA && longSMA){
    if(shortSMA[0] > longSMA[0]){ components.sma = 1; reasons.push('SMA bullish (10>50)'); }
  }

  // RSI behavior
  if(rsiV){
    if(rsiV[0] < 30){ components.rsi = 1; reasons.push('RSI oversold'); }
    else if(rsiV[0] >=30 && rsiV[0] <=45){ components.rsi = 0.6; reasons.push('RSI favorable (30-45)'); }
  }

  // MACD signals
  if(mac && mac.macd && mac.signal){
    if(mac.macd[0] > mac.signal[0]){ components.macd += 1; reasons.push('MACD bullish cross'); }
    if(mac.hist && mac.hist.length > 1 && mac.hist[0] > mac.hist[1]){ components.macd += 0.5; reasons.push('MACD histogram rising'); }
    // cap
    components.macd = Math.min(2, components.macd);
  }

  // Stochastic: oversold and %K crossing up %D
  if(stoch && stoch.k && stoch.d){
    if(stoch.k[0] < 20){ components.stoch += 1; reasons.push('Stochastic oversold'); }
    if(stoch.k[0] > stoch.d[0] && stoch.k[1] <= stoch.d[1]){ components.stoch += 0.6; reasons.push('Stochastic K crossed up D'); }
    components.stoch = Math.min(2, components.stoch);
  }

  // QQE approx: smoothed RSI rising and below 55 (possible entry)
  if(qqe && qqe.smoothed && qqe.smoothed.length > 1){
    if(qqe.smoothed[0] > qqe.smoothed[1] && qqe.smoothed[0] < 55){ components.qqe = 0.8; reasons.push('QQE approx rising (below 55)'); }
  }

  const reason = reasons.length ? reasons.join(' · ') : 'no clear signal';
  return {components, reason};
}

// EMA helper (returns array most recent first)
function ema(arr, period){
  if(!arr || arr.length < period) return null;
  const out = [];
  const k = 2/(period+1);
  // compute EMA from oldest to newest then reverse
  const rev = [...arr].reverse();
  let prev = rev.slice(0,period).reduce((a,b)=>a+b,0)/period; // SMA as seed
  for(let i=period;i<rev.length;i++){
    const val = rev[i];
    prev = val * k + prev * (1-k);
    out.push(prev);
  }
  // out[0] is EMA at index period, we want full alignment most recent first
  return out.reverse();
}

function macd(closes, fast=12, slow=26, signal=9){
  // returns {macd:[], signal:[], hist:[]} most recent first
  if(!closes || closes.length < slow + signal) return null;
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  if(!emaFast || !emaSlow) return null;
  // align lengths: use the shorter length from the end
  const len = Math.min(emaFast.length, emaSlow.length);
  const macdLine = [];
  for(let i=0;i<len;i++) macdLine.push(emaFast[emaFast.length - len + i] - emaSlow[emaSlow.length - len + i]);
  // compute signal (EMA of macdLine)
  const signalArr = ema(macdLine, signal);
  if(!signalArr) return {macd:macdLine.reverse(), signal:[], hist:[]};
  // align and compute histogram
  const sigLen = Math.min(macdLine.length, signalArr.length);
  const macdAligned = macdLine.slice(macdLine.length - sigLen);
  const signalAligned = signalArr.slice(signalArr.length - sigLen);
  const hist = macdAligned.map((v,i)=> v - signalAligned[i]);
  return {macd: macdAligned.reverse(), signal: signalAligned.reverse(), hist: hist.reverse()};
}

function stochastic(highs, lows, closes, kPeriod=14, dPeriod=3){
  // returns {k:[], d:[]} most recent first
  if(!highs || !lows || !closes) return null;
  const len = closes.length;
  if(len < kPeriod + dPeriod) return null;
  const kArr = [];
  for(let i=0;i<=len - kPeriod;i++){
    const sliceHigh = highs.slice(i, i+kPeriod);
    const sliceLow = lows.slice(i, i+kPeriod);
    const highest = Math.max(...sliceHigh);
    const lowest = Math.min(...sliceLow);
    const close = closes[i];
    const k = highest === lowest ? 50 : ((close - lowest)/(highest - lowest))*100;
    kArr.push(k);
  }
  // simple %D as SMA of K
  const dArr = [];
  for(let i=0;i<=kArr.length - dPeriod;i++){
    const s = kArr.slice(i, i+dPeriod);
    dArr.push(s.reduce((a,b)=>a+b,0)/dPeriod);
  }
  return {k: kArr.reverse(), d: dArr.reverse()};
}

function qqeApprox(closes, rsiPeriod=14){
  // Approximate QQE by smoothing RSI with an EMA and return smoothed RSI
  const r = rsi(closes, rsiPeriod);
  if(!r || r.length < 3) return null;
  // smooth with short EMA (3)
  const smooth = ema(r, 3);
  return {smoothed: smooth || []};
}

function sma(arr, n){
  if(!arr || arr.length < n) return null;
  const out = [];
  for(let i=0;i<=arr.length - n;i++){
    const slice = arr.slice(i, i+n);
    const s = slice.reduce((a,b)=>a+b,0)/n;
    out.push(s);
  }
  return out; // most recent at index 0
}

function rsi(closes, period=14){
  // closes array most recent first
  if(!closes || closes.length < period+1) return null;
  // compute gains/losses from oldest->newest, so reverse
  const c = [...closes].reverse();
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){
    const diff = c[i] - c[i-1];
    if(diff>0) gains += diff; else losses += Math.abs(diff);
  }
  let avgGain = gains/period; let avgLoss = losses/period;
  const out = [];
  // first RSI corresponds to c[period]
  let rs = avgGain / (avgLoss || 1e-6);
  out.push(100 - (100/(1+rs)));
  for(let i=period+1;i<c.length;i++){
    const diff = c[i] - c[i-1];
    const gain = diff>0?diff:0; const loss = diff<0?Math.abs(diff):0;
    avgGain = (avgGain*(period-1)+gain)/period;
    avgLoss = (avgLoss*(period-1)+loss)/period;
    rs = avgGain / (avgLoss || 1e-6);
    out.unshift(100 - (100/(1+rs))); // keep most recent at index 0
  }
  return out;
}

// ZigZag feature removed: related functions and overlays deleted

// ---------- QQE (Quantitative Qualitative Estimation) implementation (JS translation of the Pine v4 script) ----------
// This code is adapted from the user's Pine script (MPL 2.0) and implemented in JS for a local mini panel.
// QQE indicator support removed per user request
