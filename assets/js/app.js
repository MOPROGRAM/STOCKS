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

  // Scanner: Alpha Vantage integration (optional)
  const avKeyInput = document.getElementById('av-key');
  if(avKeyInput){
    avKeyInput.value = localStorage.getItem('av_key') || '';
    avKeyInput.addEventListener('change', (e)=>{
      localStorage.setItem('av_key', e.target.value.trim());
    });
  }
  document.getElementById('run-scan').addEventListener('click', async ()=>{
    const key = (document.getElementById('av-key').value || '').trim();
    if(!key){
      if(!confirm('No API key provided. Scanning is limited without an Alpha Vantage API key. Continue?')) return;
    } else {
      localStorage.setItem('av_key', key);
    }
    const max = Math.max(1, Math.min(20, parseInt(document.getElementById('scan-count').value || '5')));
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

  // Start
  loadWatchlist();
  // render active studies if any
  renderActiveStudies();
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

  for(let i=0;i<list.length;i++){
    const sym = list[i];
    status.textContent = `Scanning ${i+1}/${list.length}: ${sym}`;
    try{
      const data = await fetchDailyAlpha(sym, apiKey);
      // data: {closes, highs, lows}
      if(!data || !data.closes || data.closes.length < 50){
        results.push({symbol: sym, score: 0, reason: 'insufficient data'});
      } else {
        const scoreObj = analyzeSeries(data);
        results.push(Object.assign({symbol: sym}, scoreObj));
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

  let score = 0; const reasons = [];

  // SMA crossover
  if(shortSMA && longSMA){
    if(shortSMA[0] > longSMA[0]){ score += 1.0; reasons.push('SMA bullish (10>50)'); }
  }

  // RSI behavior
  if(rsiV){
    if(rsiV[0] < 30){ score += 1.0; reasons.push('RSI oversold'); }
    else if(rsiV[0] >=30 && rsiV[0] <=45){ score += 0.6; reasons.push('RSI favorable (30-45)'); }
  }

  // MACD signals
  if(mac && mac.macd && mac.signal){
    if(mac.macd[0] > mac.signal[0]){ score += 1.1; reasons.push('MACD bullish cross'); }
    // positive and rising histogram
    if(mac.hist && mac.hist.length > 1 && mac.hist[0] > mac.hist[1]){ score += 0.5; reasons.push('MACD histogram rising'); }
  }

  // Stochastic: oversold and %K crossing up %D
  if(stoch && stoch.k && stoch.d){
    if(stoch.k[0] < 20){ score += 0.8; reasons.push('Stochastic oversold'); }
    if(stoch.k[0] > stoch.d[0] && stoch.k[1] <= stoch.d[1]){ score += 0.6; reasons.push('Stochastic K crossed up D'); }
  }

  // QQE approx: smoothed RSI rising and below 50 (possible entry)
  if(qqe && qqe.smoothed && qqe.smoothed.length){
    if(qqe.smoothed[0] > qqe.smoothed[1] && qqe.smoothed[0] < 55){ score += 0.7; reasons.push('QQE approx rising (below 55)'); }
  }

  const reason = reasons.length ? reasons.join(' · ') : 'no clear signal';
  return {score, reason};
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
