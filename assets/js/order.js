// ===== Tiny helpers =====
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const toInt = (v, d=0) => { const n = parseInt(v,10); return Number.isFinite(n)?n:d; };

// ===== DOM refs =====
const catalogEl   = $('#catalog');
const formEl      = $('#order-form') || $('#orderForm');
const startEl     = $('#startDate') || $('#start');
const endEl       = $('#endDate')   || $('#end');

// 24h time controls (dropdowns + hidden HH:MM fields)
const startTimeEl = $('#startTime');
const endTimeEl   = $('#endTime');
const startHourEl = $('#startHour');
const endHourEl   = $('#endHour');

// Methods + details
const receiveEl   = $('#receiveMethod');
const returnEl    = $('#returnMethod');
const receiveExtra     = $('#receiveExtra');
const returnExtra      = $('#returnExtra');
const receiveDetailsEl = $('#receiveDetails');
const returnDetailsEl  = $('#returnDetails');

// Summary numbers
const sumItemsEl  = $('#sumItems');
const sumDaysEl   = $('#sumDays');
const sumTotalEl  = $('#sumTotal');
const orderJsonEl = $('#order_json');

if(!catalogEl || !formEl || !startEl || !endEl || !receiveEl || !returnEl || !sumItemsEl || !sumDaysEl || !sumTotalEl || !orderJsonEl){
  // Required nodes missing – quit silently to avoid errors
  console.warn('Order page: some required nodes are missing.');
}

// ===== Delivery fees =====
const DELIVERY_FEES = { zone1: 6, zone2: 20, zone3: 25, airport_arlanda: 20 };

// ===== Image resolver (works with multiple folders / extensions) =====
const IMG_BASES = ['/assets/images/products/', '/assets/images/', '/images/'];
function swapExt(name){
  if(!name) return name;
  const lower = name.toLowerCase();
  if(lower.endsWith('.png'))  return name.replace(/\.png$/i, '.webp');
  if(lower.endsWith('.webp')) return name.replace(/\.webp$/i, '.png');
  return name;
}
function setSmartSrc(img, filename){
  if(!filename){ img.removeAttribute('src'); return; }
  const candidates = [];
  if(/^\//.test(filename)){
    candidates.push(filename);
    candidates.push(swapExt(filename));
  }
  IMG_BASES.forEach(base => {
    candidates.push(base + filename);
    candidates.push(base + swapExt(filename));
  });
  let i = 0;
  const tryNext = ()=>{ if(i < candidates.length) img.src = candidates[i++]; };
  img.addEventListener('error', tryNext);
  tryNext();
}

// ===== State =====
let products = [];
const selection = new Map(); // id -> qty

// ===== Utils =====
function parseDate(val){
  if(!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}
function rentalDays(){
  const s = parseDate(startEl.value);
  const e = parseDate(endEl.value);
  if(!s || !e) return 1;
  const ms = e.setHours(0,0,0,0) - s.setHours(0,0,0,0);
  const d = Math.floor(ms/86400000) + 1; // min 1 day
  return Math.max(d,1);
}
function fmtMoney(n){ return `€${n}`; }

// ===== Render =====
function groupByCategory(list){
  const order = ['Strollers','Sleeping Cot','Car Seats','High Chairs','Carriers','Toys & Books','Outerwear','Baby Cots','Wellness'];
  const map = new Map();
  list.forEach(p=>{ map.set(p.category, (map.get(p.category)||[]).concat(p)); });
  return order.filter(k=>map.has(k)).map(k=>({ name:k, items: map.get(k) }));
}

function render(){
  if(!catalogEl) return;
  catalogEl.innerHTML = '';
  const groups = groupByCategory(products);
  groups.forEach(g=>{
    const h = document.createElement('h3');
    h.className = 'catalog-heading';
    h.textContent = g.name;
    catalogEl.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'catalog-grid';
    catalogEl.appendChild(grid);

    g.items.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'card';

      const img = document.createElement('img');
      img.alt = p.name;
      setSmartSrc(img, p.image || '');

      const info = document.createElement('div');
      info.className = 'info';
      const title = document.createElement('a');
      title.className = 'title';
      title.textContent = p.name;
      if(p.link){ title.href = p.link; title.target = '_blank'; rel='noopener'; }
      const price = document.createElement('div');
      price.className = 'price';
      price.textContent = fmtMoney(p.pricePerDay) + ' / day';

      info.appendChild(title);
      info.appendChild(price);

      const qtyWrap = document.createElement('div');
      qtyWrap.className = 'qty';
      const dec = document.createElement('button'); dec.type='button'; dec.className='step'; dec.textContent='−';
      const qty = document.createElement('input');
      qty.type='number'; qty.min='0'; qty.max='10'; qty.step='1'; qty.inputMode='numeric'; qty.pattern='[0-9]*';
      qty.value = selection.get(p.id) || 0;
      const inc = document.createElement('button'); inc.type='button'; inc.className='step'; inc.textContent='+';

      const apply = (val)=>{
        const v = Math.max(0, Math.min(10, toInt(val,0)));
        qty.value = v;
        if(v>0) selection.set(p.id, v); else selection.delete(p.id);
        recalc();
      };
      dec.addEventListener('click', ()=>apply(toInt(qty.value,0)-1));
      inc.addEventListener('click', ()=>apply(toInt(qty.value,0)+1));
      qty.addEventListener('input', ()=>apply(qty.value));

      qtyWrap.appendChild(dec);
      qtyWrap.appendChild(qty);
      qtyWrap.appendChild(inc);

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(qtyWrap);
      grid.appendChild(card);
    });
  });
}

// ===== Calculation & payload =====
function recalc(){
  const days = rentalDays();
  let itemsCount = 0;
  let total = 0;
  const chosen = [];

  selection.forEach((qty, id)=>{
    const p = products.find(x=>x.id===id);
    if(!p) return;
    itemsCount += qty;
    total += p.pricePerDay * qty * days;
    chosen.push({ id:p.id, name:p.name, qty, pricePerDay:p.pricePerDay, category:p.category });
  });

  // delivery fees (receive + return)
  const recv = receiveEl ? receiveEl.value : 'pickup';
  const ret  = returnEl  ? returnEl.value  : 'pickup';
  if(DELIVERY_FEES[recv]) total += DELIVERY_FEES[recv];
  if(DELIVERY_FEES[ret])  total += DELIVERY_FEES[ret];

  if(sumItemsEl) sumItemsEl.textContent = String(itemsCount);
  if(sumDaysEl)  sumDaysEl.textContent  = String(days);
  if(sumTotalEl) sumTotalEl.textContent = fmtMoney(total);

  const payload = {
    startDate: startEl ? startEl.value : '',
    endDate:   endEl   ? endEl.value   : '',
    receiveTime: startTimeEl ? startTimeEl.value : '',
    returnTime:  endTimeEl   ? endTimeEl.value   : '',
    receiveMethod: recv,
    receiveDetails: receiveDetailsEl ? receiveDetailsEl.value : '',
    returnMethod: ret,
    returnDetails: returnDetailsEl ? returnDetailsEl.value : '',
    deliveryFee: (DELIVERY_FEES[recv]||0) + (DELIVERY_FEES[ret]||0),
    items: chosen,
    days,
    estimatedTotal: total
  };
  if(orderJsonEl) orderJsonEl.value = JSON.stringify(payload, null, 2);
}

// ===== Events =====
function attachEvents(){
  if(!startEl || !endEl) return;
  startEl.addEventListener('change', recalc);
  endEl.addEventListener('change', recalc);

  // Time dropdown sync (forces 24h across browsers)
  function syncTimeHidden(){
    if(startHourEl && startTimeEl){ startTimeEl.value = startHourEl.value || '10:00'; }
    if(endHourEl && endTimeEl){ endTimeEl.value = endHourEl.value || '10:00'; }
  }
  if(startHourEl) startHourEl.addEventListener('change', ()=>{ syncTimeHidden(); recalc(); });
  if(endHourEl)   endHourEl.addEventListener('change', ()=>{ syncTimeHidden(); recalc(); });
  syncTimeHidden();

  if(receiveEl) receiveEl.addEventListener('change', ()=>{
    const show = receiveEl.value && receiveEl.value !== 'pickup';
    if(receiveExtra) receiveExtra.style.display = show ? 'block' : 'none';
    recalc();
  });
  if(returnEl) returnEl.addEventListener('change', ()=>{
    const show = returnEl.value && returnEl.value !== 'pickup';
    if(returnExtra) returnExtra.style.display = show ? 'block' : 'none';
    recalc();
  });
}

// ===== Fetch products =====
async function loadProducts(){
  const url = '/assets/data/products.json';
  try{
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if(!Array.isArray(data)) throw new Error('Invalid products.json');
    products = data;
    render();
    recalc();
  }catch(err){
    console.error('Could not load products:', err);
    if(catalogEl){
      const p = document.createElement('p');
      p.className = 'error';
      p.textContent = 'Could not load products. Please try again later.';
      catalogEl.innerHTML = '';
      catalogEl.appendChild(p);
    }
  }
}

// ===== Init =====
attachEvents();
loadProducts();