(function(){
  // ===== Helpers =====
  const $ = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
  const toInt = (v, d=0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
  const euro = (n) => `€${(Math.round(n*100)/100).toFixed(0)}`;

  // ===== Elements =====
  const catalogEl = $('#catalog');
  // Image resolution helpers – keep current image locations
  const IMG_BASES = ['/assets/images/products/', '/assets/images/'];
  function swapExt(name){
    if(!name) return name;
    const lower = name.toLowerCase();
    if(lower.endsWith('.png')) return name.replace(/\.png$/i, '.webp');
    if(lower.endsWith('.webp')) return name.replace(/\.webp$/i, '.png');
    return name;
  }
  function setSmartSrc(img, filename){
    if(!filename){ img.removeAttribute('src'); return; }
    const candidates = [];
    // If filename already contains a leading slash or folder, try as-is first
    if(/^\//.test(filename) || /\//.test(filename)){
      candidates.push(filename);
      candidates.push(swapExt(filename));
    } else {
      IMG_BASES.forEach(base => {
        candidates.push(base + filename);
        candidates.push(base + swapExt(filename));
      });
    }
    let i = 0;
    const tryNext = () => {
      if(i >= candidates.length) return; // give up silently when exhausted
      img.src = candidates[i++];
    };
    img.addEventListener('error', tryNext);
    tryNext();
  }
  const sumItemsEl = $('#sumItems');
  const sumDaysEl  = $('#sumDays');
  const sumTotalEl = $('#sumTotal');
  const startEl    = $('#startDate');
  const endEl      = $('#endDate');
  const methodEl   = $('#method');
  const deliveryExtra = $('#deliveryExtra');
  const deliveryDetailsEl = $('#deliveryDetails');
  const orderJsonEl= $('#order_json');
  const formEl     = $('#order-form');

  // ===== Config =====
  const DELIVERY_FEES = { zone1: 6, zone2: 20, zone3: 25 };

  const quickSelect = $('#quickAddSelect');
  const quickBtn = $('#quickAddBtn');

  if(!catalogEl || !formEl || !startEl || !endEl || !methodEl || !sumItemsEl || !sumDaysEl || !sumTotalEl || !orderJsonEl){
    return; // required nodes missing
  }

  // ===== State =====
  let products = [];
  const selection = new Map(); // id -> qty

  // ===== Dates =====
  function isoToday(){
    const d=new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }
  function isoTomorrow(){
    const d=new Date();
    d.setDate(d.getDate()+1);
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }
  function initDates(){
    const t = isoToday();
    const tm = isoTomorrow();
    startEl.min = t; endEl.min = t;
    if(!startEl.value) startEl.value = t;
    if(!endEl.value || endEl.value < startEl.value) endEl.value = tm;
  }
  function diffDaysInclusive(){
    const s = new Date(startEl.value);
    const e = new Date(endEl.value);
    if(isNaN(+s) || isNaN(+e)) return 1;
    const ms = e - s;
    const days = Math.floor(ms/(1000*60*60*24)) + 1;
    return Math.max(1, days);
  }

  // ===== Category ordering =====
  const PRIORITY = [
    'Strollers',
    'Sleeping Cot',
    'Car Seats',
    'High Chairs'
  ];
  function catKey(cat){
    const c = String(cat||'').trim();
    const idx = PRIORITY.findIndex(x => c.toLowerCase() === x.toLowerCase());
    return idx >= 0 ? idx : 100 + c.toLowerCase().charCodeAt(0);
  }

  // ===== Rendering =====
  function render(){
    const days = diffDaysInclusive();
    catalogEl.innerHTML = '';
    const byCat = new Map();
    products.forEach(p=>{
      const cat = p.category || 'Other';
      if(!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(p);
    });

    const cats = Array.from(byCat.keys()).sort((a,b)=>{
      const ka = catKey(a), kb = catKey(b);
      if(ka !== kb) return ka - kb;
      return String(a).localeCompare(String(b));
    });

    const frag = document.createDocumentFragment();
    cats.forEach(cat=>{
      const items = byCat.get(cat) || [];
      // Skip Delivery category if present
      if (String(cat).toLowerCase() === 'delivery') return;

      const h = document.createElement('h3');
      h.className = 'cat-title';
      h.textContent = cat;
      frag.appendChild(h);

      items.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));
      items.forEach(p=>{
        const card = document.createElement('div');
        card.className = 'card';
        card.style.backgroundColor = '#fff';
        card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        card.style.borderRadius = '4px';
        card.style.padding = '10px';
        card.style.marginBottom = '10px';

        const img = document.createElement('img');
        setSmartSrc(img, p.image || '');
        img.alt = p.name || '';
        img.loading = 'lazy';

        const meta = document.createElement('div');
        meta.className = 'meta';
        const nm = document.createElement('div');
        nm.className = 'name';
        if(p.link){
          const a = document.createElement('a');
          a.href = p.link; a.target = '_blank'; a.rel='noopener';
          a.textContent = p.name;
          nm.appendChild(a);
        } else {
          nm.textContent = p.name;
        }
        const pr = document.createElement('div');
        pr.className = 'price';
        const unit = toInt(p.pricePerDay ?? p.price ?? 0, 0);
        pr.textContent = (p.priceType === 'flat')
          ? `${euro(unit)} flat`
          : `${euro(unit)} / day`;

        meta.appendChild(nm);
        meta.appendChild(pr);

        const qtyWrap = document.createElement('div');
        qtyWrap.className = 'qty';
        const qty = document.createElement('input');
        qty.type='number'; qty.min='0'; qty.max='10'; qty.step='1';
        qty.value = selection.get(p.id) || 0;
        qty.addEventListener('input', ()=>{
          const v = Math.max(0, Math.min(10, toInt(qty.value, 0)));
          if(v>0) selection.set(p.id, v); else selection.delete(p.id);
          recalc();
        });
        qtyWrap.appendChild(qty);

        card.appendChild(img);
        card.appendChild(meta);
        card.appendChild(qtyWrap);
        frag.appendChild(card);
      });
    });

    catalogEl.appendChild(frag);
    recalc();
  }

  // ===== Recalc & serialize =====
  function recalc(){
    const days = diffDaysInclusive();
    let itemsCount = 0;
    let total = 0;
    const items = [];

    products.forEach(p=>{
      const q = selection.get(p.id) || 0;
      if(q>0){
        itemsCount += q;
        const unit = toInt(p.pricePerDay ?? p.price ?? 0, 0);
        const subtotal = (p.priceType === 'flat') ? unit * q : unit * q * days;
        total += subtotal;
        items.push({
          id: p.id, name: p.name, category: p.category,
          qty: q, unitPrice: unit, priceType: p.priceType || 'per-day',
          subtotal
        });
      }
    });

    // delivery fee
    const m = methodEl.value;
    if (DELIVERY_FEES[m]) {
      total += DELIVERY_FEES[m];
    }

    sumItemsEl.textContent = String(itemsCount);
    sumDaysEl.textContent  = String(days);
    sumTotalEl.textContent = euro(total);

    const payload = {
      startDate: startEl.value,
      endDate: endEl.value,
      daysCharged: days,
      method: methodEl.value,
      deliveryDetails: deliveryDetailsEl ? deliveryDetailsEl.value : '',
      items,
      totalEstimated: total,
      deliveryFee: DELIVERY_FEES[methodEl.value] || 0,
      quickAddLast: quickSelect ? quickSelect.value : '',
    };
    orderJsonEl.value = JSON.stringify(payload, null, 2);
  }

  // ===== Delivery toggle =====
  methodEl.addEventListener('change', ()=>{
    const val = methodEl.value;
    const show = val && val !== 'pickup';
    if(deliveryExtra) deliveryExtra.style.display = show ? 'block' : 'none';
    recalc();
  });

  // Dates listeners
  startEl.addEventListener('change', ()=>{
    if(endEl.value < startEl.value) endEl.value = startEl.value;
    recalc();
  });
  endEl.addEventListener('change', recalc);

  // Validate minimal selection on submit
  formEl.addEventListener('submit', (e)=>{
    const hasItems = Array.from(selection.values()).some(q => q>0);
    if(!hasItems){
      e.preventDefault();
      alert('Please add at least one item to your order.');
      return false;
    }
    recalc(); // ensure hidden field up-to-date
    return true;
  });

  if (quickBtn && quickSelect) {
    quickBtn.addEventListener('click', ()=>{
      const id = quickSelect.value;
      if(!id) return;
      const p = products.find(x=> x.id===id);
      if(!p) return;
      const q = (selection.get(id) || 0) + 1;
      selection.set(id, Math.min(10, q));
      render();
      // keep same selection in dropdown
      quickSelect.value = id;
    });
  }

  // ===== Image resolver =====
  // Helper for swapping file extensions
  function swapExt(filename){
    return filename.replace(/\.(jpe?g|png|webp)$/i, (m) =>
      m.toLowerCase() === '.jpg' ? '.png' : '.jpg'
    );
  }
  // Known image base paths
  const IMG_BASES = [
    '/assets/images/',
    '/images/',
    '/static/images/',
  ];
  // Smarter image src resolver
  function setSmartSrc(img, filename){
    if(!filename){ img.removeAttribute('src'); return; }
    const candidates = [];
    // If filename is already absolute (starts with "/"), try it as-is and with swapped extension
    if(/^\//.test(filename)){
      candidates.push(filename);
      candidates.push(swapExt(filename));
    }
    // Always try with our known bases, even if filename contains subfolders (e.g., "products/TrippTrapp1.png")
    IMG_BASES.forEach(base => {
      candidates.push(base + filename);
      candidates.push(base + swapExt(filename));
    });
    let i = 0;
    const tryNext = () => {
      if(i >= candidates.length) return; // exhausted
      img.src = candidates[i++];
    };
    img.addEventListener('error', tryNext);
    tryNext();
  }

  // ===== Fetch products =====
  function loadProducts(){
    // Fetch as TEXT first so we can show clear parse errors if JSON is malformed
    const fetchText = (url) => fetch(url, { cache: 'no-store' })
      .then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`); return r.text(); });

    return fetchText('/assets/data/products.json')
      .catch(()=> fetchText('assets/data/products.json'))
      .then(txt => {
        // Trim BOM and odd whitespace
        if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
        const cleaned = txt.trim();
        try {
          const j = JSON.parse(cleaned);
          return Array.isArray(j) ? j : (j.products || []);
        } catch (e) {
          // Surface a clear message in the UI with a snippet
          const snippet = cleaned.slice(0, 400).replace(/[\n\r]/g, ' ');
          catalogEl.innerHTML = `<p style="text-align:center;">Products JSON parse error.<br><small>${e.message}</small><br><small>Snippet: <code>${snippet}</code></small></p>`;
          throw e;
        }
      });
  }

  // ===== Init =====
  initDates();
  loadProducts()
    .then(list => {
      products = list;
      render();
      if (quickSelect) {
        const dropdown = products
          .filter(p => String(p.category||'').toLowerCase() !== 'delivery')
          .slice()
          .sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));
        quickSelect.innerHTML = '<option value="">Select a product…</option>' + dropdown.map(p=>`<option value="${p.id}">${p.name} — €${p.pricePerDay ?? p.price ?? 0}${p.priceType==='flat'?' flat':'/day'}</option>`).join('');
      }
    })
    .catch(e => {
      console.error('Product load error:', e);
      const hint = (location && location.origin) ? `${location.origin}/assets/data/products.json` : '/assets/data/products.json';
      if (!catalogEl.innerHTML) {
        catalogEl.innerHTML = `<p style="text-align:center;">Could not load products.<br><small>Expected at: <code>${hint}</code></small></p>`;
      }
    });
})();