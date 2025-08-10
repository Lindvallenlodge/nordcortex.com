(function(){
  // ===== Helpers =====
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const toInt = (v, d=0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const fmtEuro = (n) => `€${(Math.round(n*100)/100).toFixed(0)}`;

  // ===== Elements =====
  const overlay   = $('#order-overlay');
  const openBtn   = $('#openOrderOverlay');
  const closeBtn  = $('#closeOrderOverlay');
  const backdrop  = overlay ? overlay.querySelector('.overlay-backdrop') : null;
  const catalogEl = $('#catalogContainer');
  const linesEl   = $('#orderSummary .summary-lines');
  const totalEl   = $('#orderTotal');
  const submitBtn = $('#submitOrder');
  const startDateEl = $('#startDate');
  const endDateEl   = $('#endDate');
  const deliveryEl  = $('#deliveryOption');

  if(!overlay || !openBtn || !closeBtn || !catalogEl || !linesEl || !totalEl || !submitBtn || !startDateEl || !endDateEl || !deliveryEl){
    // Required nodes not present; abort quietly.
    return;
  }

  // ===== Config =====
  const DELIVERY_FEES = { zone1: 6, zone2: 20, zone3: 25 }; // flat fees
  const MAIL_TO = 'hello@strollbystockholm.com';
  const MAIL_SUBJECT = 'Order request – Strollby Stockholm';
  const STORAGE_KEY = 'sbs_cart_v1';

  // ===== State =====
  let products = [];               // full list from products.json
  const selection = new Map();     // id -> qty

  // ===== Dates =====
  function todayISO(){
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }
  function tomorrowISO(){
    const d = new Date();
    d.setDate(d.getDate()+1);
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }
  function diffDaysInclusive(){
    const s = new Date(startDateEl.value);
    const e = new Date(endDateEl.value);
    if(isNaN(+s) || isNaN(+e)) return 1;
    const ms = e - s;
    const days = Math.floor(ms / (1000*60*60*24)) + 1; // inclusive
    return Math.max(1, days);
  }

  // Default date values and min guards
  function initDates(){
    const t = todayISO();
    const tm = tomorrowISO();
    startDateEl.min = t;
    endDateEl.min = t;
    if(!startDateEl.value) startDateEl.value = t;
    if(!endDateEl.value || endDateEl.value < startDateEl.value) endDateEl.value = tm;
  }

  // ===== Persistence =====
  function saveState(){
    const obj = {
      sel: Array.from(selection.entries()),
      start: startDateEl.value,
      end: endDateEl.value,
      delivery: deliveryEl.value
    };
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }catch(_){ }
  }
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const obj = JSON.parse(raw);
      if(Array.isArray(obj.sel)){
        selection.clear();
        obj.sel.forEach(([id, q])=> selection.set(id, toInt(q,0)) );
      }
      if(obj.start) startDateEl.value = obj.start;
      if(obj.end) endDateEl.value = obj.end;
      if(obj.delivery) deliveryEl.value = obj.delivery;
    }catch(_){ }
  }

  // ===== Calculation & Rendering =====
  function recalc(){
    const days = diffDaysInclusive();
    let text = '';
    let total = 0;

    products.forEach(p=>{
      const qty = selection.get(p.id) || 0;
      if(qty>0){
        const unit = toInt(p.pricePerDay ?? p.price ?? 0, 0);
        const subtotal = (p.priceType === 'flat') ? unit * qty : unit * qty * days;
        total += subtotal;
        text += `${qty}× ${p.name} — ${fmtEuro(subtotal)}\n`;
      }
    });

    const dKey = deliveryEl.value;
    if(dKey && DELIVERY_FEES[dKey]){
      const fee = DELIVERY_FEES[dKey];
      total += fee;
      text += `Delivery (${dKey.toUpperCase()}) — ${fmtEuro(fee)}\n`;
    }

    text += `Days charged: ${days}`;
    linesEl.textContent = text.trim();
    totalEl.textContent = fmtEuro(total);
    saveState();
  }

  function renderCatalog(){
    catalogEl.innerHTML = '';

    // Group by category (simple stable grouping)
    const byCat = new Map();
    products.forEach(p=>{
      if((p.category||'').toLowerCase() === 'delivery') return; // skip delivery rows here
      const key = p.category || 'Other';
      if(!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(p);
    });

    const frag = document.createDocumentFragment();
    for(const [cat, items] of byCat.entries()){
      const h = document.createElement('h4');
      h.textContent = cat;
      h.style.margin = '12px 0 6px';
      frag.appendChild(h);

      items.forEach(p=>{
        const card = document.createElement('div');
        card.className = 'product-card';

        const img = document.createElement('img');
        img.alt = p.name || '';
        img.loading = 'lazy';
        img.src = (p.image || '').startsWith('/') ? p.image : (p.image ? `/assets/images/${p.image}` : '');

        const meta = document.createElement('div');
        meta.className = 'product-meta';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        if(p.link){
          const a = document.createElement('a');
          a.href = p.link; a.target = '_blank'; a.rel = 'noopener';
          a.textContent = p.name;
          nameDiv.appendChild(a);
        } else {
          nameDiv.textContent = p.name;
        }
        const priceDiv = document.createElement('div');
        const unit = toInt(p.pricePerDay ?? p.price ?? 0, 0);
        priceDiv.textContent = p.priceType === 'flat' ? `${fmtEuro(unit)} flat` : `${fmtEuro(unit)} / day`;

        meta.appendChild(nameDiv);
        meta.appendChild(priceDiv);

        const qtyWrap = document.createElement('div');
        qtyWrap.className = 'qty-wrap';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0'; input.max = '10'; input.step = '1';
        input.value = clamp(toInt(selection.get(p.id) || 0, 0), 0, 10);
        input.addEventListener('input', ()=>{
          const val = clamp(toInt(input.value||'0',0), 0, 10);
          if(val>0) selection.set(p.id, val); else selection.delete(p.id);
          recalc();
        });
        qtyWrap.appendChild(input);

        card.appendChild(img);
        card.appendChild(meta);
        card.appendChild(qtyWrap);
        frag.appendChild(card);
      });
    }

    catalogEl.appendChild(frag);
    recalc();
  }

  // ===== Overlay open/close =====
  function openOverlay(){ overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
  function closeOverlay(){ overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

  openBtn.addEventListener('click', (e)=>{ e.preventDefault(); openOverlay(); });
  closeBtn.addEventListener('click', closeOverlay);
  backdrop && backdrop.addEventListener('click', closeOverlay);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeOverlay(); });

  // Open overlay if URL hash includes #order
  if (location.hash && location.hash.toLowerCase().includes('order')) {
    // Wait a tick so DOM is ready
    setTimeout(openOverlay, 0);
  }

  // Recalc triggers
  startDateEl.addEventListener('change', ()=>{ if(endDateEl.value < startDateEl.value) endDateEl.value = startDateEl.value; recalc(); });
  endDateEl.addEventListener('change', recalc);
  deliveryEl.addEventListener('change', recalc);

  // ===== Submit =====
  submitBtn.addEventListener('click', ()=>{
    const days = diffDaysInclusive();
    const items = [];
    products.forEach(p=>{ const q = selection.get(p.id) || 0; if(q>0) items.push({name:p.name, qty:q}); });
    const del = deliveryEl.value || 'pickup';
    const body = [
      'Order request from website',
      '',
      `Start date: ${startDateEl.value}`,
      `End date: ${endDateEl.value}`,
      `Days: ${days}`,
      `Delivery: ${del}`,
      '',
      'Items:',
      items.length ? items.map(i=>`- ${i.qty}× ${i.name}`).join('\n') : '(none)',
      '',
      `Shown total: ${totalEl.textContent}`,
      '',
      'Please reply with availability and next steps.'
    ].join('\n');

    const url = `mailto:${encodeURIComponent(MAIL_TO)}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  });

  // ===== Init =====
  initDates();
  loadState();
  fetch('/assets/data/products.json', { cache: 'no-store' })
    .then(r=>r.json())
    .then(json=>{ products = Array.isArray(json) ? json : (json.products || []); renderCatalog(); })
    .catch(()=>{ catalogEl.innerHTML = '<p style="text-align:center;">Could not load products. Please try again later.</p>'; });
})();