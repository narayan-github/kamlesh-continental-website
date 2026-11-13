/* ==========================================================================
   Kamlesh Continental · shared behaviour
   Loaded (deferred) on every page. Exposes a small global, KC, that the
   page scripts (weddings.js, business.js) build on.
   ========================================================================== */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');

  const KC = window.KC = {
    $, $$,
    phone: { desk: '+916764236281', wa: '918280409425', weddings: '918599006715', email: 'info@kamleshcontinental.com' },
    // Indicative rates until the hotel confirms them. Change them here only:
    // every price on the site is filled in from this list.
    rooms: [
      { id: 'standard', name: 'Standard Room', rate: 3200 },
      { id: 'deluxe', name: 'Deluxe Room', rate: 3800 },
      { id: 'suite', name: 'Executive Suite', rate: 5200 },
    ],
    // GST on rooms follows the government slab (in force since 22 Sep 2025):
    // 5% for rooms up to ₹7,500 a night, 18% above that.
    gst: 0.05,
    gstFor: rate => (rate > 7500 ? 0.18 : 0.05),
    // Dates are handled as local dates. toISOString() would shift them by a day in IST.
    iso: d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    parse: v => new Date(v + 'T00:00'),
    addDays: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
    fmt: v => KC.parse(v).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    fmtLong: v => KC.parse(v).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    nights: (a, b) => Math.max(1, Math.round((KC.parse(b) - KC.parse(a)) / 864e5)),
    inr: n => '₹' + Math.round(n).toLocaleString('en-IN'),
    // "2,1" (adults,children) from the guests picker -> "2 adults and 1 child", for the WhatsApp message
    guestsText: v => { const [a, k] = String(v).split(',').map(n => parseInt(n, 10) || 0); return `${a || 1} adult${a === 1 ? '' : 's'}` + (k ? ` and ${k} child${k === 1 ? '' : 'ren'}` : ''); },
    wa: (num, text) => `https://wa.me/${num}?text=${encodeURIComponent(text)}`,
    params: new URLSearchParams(location.search),
    ist: () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })),
    toast(msg) {
      let t = $('.toast');
      if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
      t.textContent = msg; t.classList.add('on');
      clearTimeout(KC._tt); KC._tt = setTimeout(() => t.classList.remove('on'), 2600);
    },
    openStay() {}, // replaced by initStay when the modal is on the page
  };

  /* ---- header: transparent over the hero, solid once scrolled ---- */
  function initHeader() {
    const hdr = $('#hdr'); if (!hdr) return;
    const always = document.body.hasAttribute('data-solid-header');
    const on = () => hdr.classList.toggle('solid', always || scrollY > 60);
    addEventListener('scroll', on, { passive: true }); on();
    const mnav = $('#mnav'), burger = $('#burger');
    if (!mnav || !burger) return;
    const set = open => { mnav.classList.toggle('on', open); burger.setAttribute('aria-expanded', open); };
    burger.addEventListener('click', () => { set(true); $('.x', mnav).focus(); });
    $('.x', mnav).addEventListener('click', () => { set(false); burger.focus(); });
    $$('a', mnav).forEach(a => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  /* ---- reveal on scroll ---- */
  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) return els.forEach(el => el.classList.add('in'));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach(el => io.observe(el));
  }

  /* ---- hero slideshow (home) ---- */
  function initSlides() {
    const slides = $$('.hero .slide'), dots = $('#dots'), cap = $('#cap');
    if (slides.length < 2 || !dots) return;
    let i = 0, timer;
    const go = (n, user) => {
      slides[i].classList.remove('on'); dots.children[i].classList.remove('on');
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('on'); dots.children[i].classList.add('on');
      if (cap) cap.textContent = slides[i].dataset.cap || '';
      if (user) { clearInterval(timer); timer = setInterval(() => go(i + 1), 6500); }
    };
    slides.forEach((_, n) => { const b = document.createElement('button'); b.setAttribute('aria-label', 'Show photo ' + (n + 1)); b.addEventListener('click', () => go(n, true)); dots.appendChild(b); });
    dots.children[0].classList.add('on');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => go(i + 1), 6500);
  }

  /* ---- booking widget: Stay opens the stay modal; Meeting and Celebration
         hand their answers to the page that owns that enquiry ---- */
  function initWidget() {
    const bw = $('#bw'); if (!bw) return;
    const today = new Date(), v = n => (bw.elements[n] || {}).value || '';
    $$('input[type=date]', bw).forEach(i => { i.min = KC.iso(today); });
    const cin = bw.elements.cin, cout = bw.elements.cout;
    cin.value = KC.iso(today); cout.value = cout.min = KC.iso(KC.addDays(today, 1));
    cin.addEventListener('change', () => { const n = KC.iso(KC.addDays(KC.parse(cin.value), 1)); cout.min = n; if (cout.value <= cin.value) cout.value = n; });
    if (bw.elements.mdate) bw.elements.mdate.value = KC.iso(KC.addDays(today, 7));
    if (bw.elements.edate) bw.elements.edate.value = KC.iso(KC.addDays(today, 60));
    const tabs = $$('.bw-tabs button', bw), panels = $$('.bw-panel', bw);
    const show = name => {
      tabs.forEach(t => { const on = t.dataset.bw === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
      panels.forEach(p => p.classList.toggle('on', p.dataset.panel === name));
    };
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.bw)));
    bw.addEventListener('submit', e => {
      e.preventDefault();
      const tab = ($('.bw-tabs .on', bw) || tabs[0]).dataset.bw;
      if (tab === 'stay') return KC.openStay({ cin: v('cin'), cout: v('cout'), guests: v('guests'), room: v('room') });
      if (tab === 'meet') location.href = 'business.html?' + new URLSearchParams({ date: v('mdate'), n: v('mn'), format: v('mformat'), dur: v('mdur') }) + '#quote';
      else location.href = 'weddings.html?' + new URLSearchParams({ date: v('edate'), guests: v('eguests'), occasion: v('eoccasion'), rooms: v('erooms') }) + '#planner';
    });
  }

  /* ---- stay modal: dates, room, trip type -> a ready-written WhatsApp message ---- */
  function initStay() {
    const modal = $('#stayModal'); if (!modal) return;
    const cin = $('#mCin'), cout = $('#mCout'), guests = $('#mGuests'), rooms = $('#mRooms'), code = $('#mCode'), sum = $('#mSummary'), waBtn = $('#mWa');
    const today = new Date();
    cin.min = cin.value = KC.iso(today); cout.min = cout.value = KC.iso(KC.addDays(today, 1));
    rooms.innerHTML = KC.rooms.map((r, i) => `<label class="m-room${i ? '' : ' on'}"><span><input type="radio" name="mRoom" value="${r.id}"${i ? '' : ' checked'}><b>${r.name}</b></span><span>from ${KC.inr(r.rate)} / night</span></label>`).join('');
    let trip = document.body.dataset.trip || 'Leisure', opener = null;
    const seg = $$('#mTrip button');
    const setTrip = t => { trip = t; seg.forEach(b => b.classList.toggle('on', b.dataset.v === t)); };
    const render = () => {
      if (cout.value <= cin.value) cout.value = KC.iso(KC.addDays(KC.parse(cin.value), 1));
      cout.min = KC.iso(KC.addDays(KC.parse(cin.value), 1));
      const id = ($('input[name=mRoom]:checked', rooms) || {}).value, room = KC.rooms.find(r => r.id === id) || KC.rooms[0];
      $$('.m-room', rooms).forEach(l => l.classList.toggle('on', $('input', l).checked));
      const n = KC.nights(cin.value, cout.value), g = KC.gstFor(room.rate), base = room.rate * n, tax = base * g;
      sum.innerHTML = [
        ['Dates', `${KC.fmt(cin.value)} → ${KC.fmt(cout.value)} · ${n} night${n > 1 ? 's' : ''}`],
        [`${room.name} × ${n}`, KC.inr(base)],
        [`GST (${Math.round(g * 100)}%)`, KC.inr(tax)],
        ['Total <span class="tbc">indicative</span>', KC.inr(base + tax), 'total'],
        ['Included', 'Breakfast · Wi-Fi · Pool'],
      ].map(([k, val, cls]) => `<div${cls ? ` class="${cls}"` : ''}><span>${k}</span><b>${val}</b></div>`).join('');
      const msg = `Hello Kamlesh Continental, I'd like to book a ${room.name} for ${KC.guestsText(guests.value)}, ${KC.fmt(cin.value)} to ${KC.fmt(cout.value)} (${n} night${n > 1 ? 's' : ''}). Trip: ${trip}${trip === 'Business' ? ' (GST invoice needed)' : ''}.` +
        (code.value.trim() ? ` Corporate code: ${code.value.trim()}.` : '') + ` The website showed about ${KC.inr(base + tax)} including taxes.`;
      waBtn.href = KC.wa(KC.phone.wa, msg);
    };
    const close = () => { modal.classList.remove('on'); if (opener) opener.focus(); };
    KC.openStay = (o = {}) => {
      opener = document.activeElement;
      if (o.cin) cin.value = o.cin;
      if (o.cout) cout.value = o.cout;
      if (o.guests) guests.value = o.guests;
      if (o.trip) trip = o.trip;
      if (o.room) { const r = $(`input[value="${o.room}"]`, rooms); if (r) r.checked = true; }
      setTrip(trip); render(); modal.classList.add('on'); $('.x', modal).focus();
    };
    seg.forEach(b => b.addEventListener('click', () => { setTrip(b.dataset.v); render(); }));
    modal.addEventListener('input', render);
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('on')) close(); });
    // any element with data-book opens the modal; data-room preselects a room
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-book]'); if (!b) return;
      e.preventDefault(); KC.openStay({ room: b.dataset.room });
    });
  }

  /* ---- prices: <span data-rate="standard"></span> is filled from KC.rooms ---- */
  function initRates() {
    $$('[data-rate]').forEach(el => { const r = KC.rooms.find(x => x.id === el.dataset.rate); if (r) el.textContent = KC.inr(r.rate); });
  }

  /* ---- open/closed pills: data-hours="07:30-10:30,12:30-15:00" | "24h";
         data-happy="14:00-18:00" words it as a happy hour. Times are IST. ---- */
  function initStatus() {
    const els = $$('[data-hours],[data-happy]'); if (!els.length) return;
    const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    const upd = () => {
      const now = KC.ist(), cur = now.getHours() * 60 + now.getMinutes();
      els.forEach(el => {
        const happy = el.hasAttribute('data-happy'), spec = el.dataset.happy || el.dataset.hours;
        if (spec === '24h') { el.textContent = 'Open now · 24 hours'; el.classList.add('open'); return; }
        const slots = spec.split(',').map(s => s.split('-').map(toMin));
        const on = slots.find(([a, b]) => cur >= a && cur < b), next = slots.find(([a]) => a > cur) || slots[0];
        el.classList.toggle('open', !!on);
        el.textContent = on ? `${happy ? 'Happy hour now' : 'Open now'} · until ${hm(on[1])}` : happy ? `Happy hour ${hm(next[0])}–${hm(next[1])}` : `Closed · opens ${hm(next[0])}`;
      });
    };
    upd(); setInterval(upd, 60000);
  }

  /* ---- generic tabs: <div data-tabs> with <button data-tab="x"> and, anywhere
         in the same [data-tabs-scope] (or the page), <div class="tabpanel" data-tabpanel="x"> ---- */
  function initTabs() {
    $$('[data-tabs]').forEach(bar => {
      const scope = bar.closest('[data-tabs-scope]') || document, btns = $$('[data-tab]', bar);
      const show = name => {
        btns.forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
        $$('[data-tabpanel]', scope).forEach(p => p.classList.toggle('on', p.dataset.tabpanel === name));
        bar.dispatchEvent(new CustomEvent('kc:tab', { detail: name, bubbles: true }));
      };
      btns.forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
    });
    // dining tabs also swap the photos beside them
    const dine = $('#dineTabs'), img = $('#dineImg'), fl = $('#dineFloat');
    if (dine && img) dine.addEventListener('kc:tab', e => {
      const p = $(`[data-tabpanel="${e.detail}"]`); if (!p || !p.dataset.img) return;
      img.style.opacity = 0;
      setTimeout(() => { img.src = p.dataset.img; if (fl && p.dataset.float) fl.src = p.dataset.float; img.style.opacity = 1; }, 250);
    });
  }

  /* ---- horizontal rails: buttons with data-rail="railId" data-dir="1|-1", plus mouse drag ---- */
  function initRails() {
    $$('[data-rail]').forEach(b => b.addEventListener('click', () => { const r = document.getElementById(b.dataset.rail); if (r) r.scrollBy({ left: +b.dataset.dir * 364, behavior: 'smooth' }); }));
    $$('.rail').forEach(rail => {
      let down = false, sx = 0, sl = 0;
      rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = rail.scrollLeft; rail.style.scrollSnapType = 'none'; });
      addEventListener('pointerup', () => { if (down) { down = false; rail.style.scrollSnapType = ''; } });
      rail.addEventListener('pointermove', e => { if (down) { e.preventDefault(); rail.scrollLeft = sl - (e.clientX - sx); } });
    });
  }

  /* ---- filters: <div data-filter="#grid"> buttons data-f; items carry data-t="a b" ---- */
  function initFilters() {
    $$('[data-filter]').forEach(bar => {
      const grid = $(bar.dataset.filter); if (!grid) return;
      $$('button', bar).forEach(b => b.addEventListener('click', () => {
        $$('button', bar).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
        [...grid.children].forEach(c => { c.hidden = !(b.dataset.f === 'all' || (c.dataset.t || '').split(' ').includes(b.dataset.f)); });
      }));
    });
  }

  /* ---- small things ---- */
  function initMisc() {
    // rotating quotes
    $$('[data-rotate]').forEach(box => {
      const qs = $$('blockquote', box); if (qs.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      let q = 0; setInterval(() => { qs[q].classList.remove('on'); q = (q + 1) % qs.length; qs[q].classList.add('on'); }, 6000);
    });
    // gentle parallax on photo banners
    $$('[data-parallax]').forEach(img => {
      const sec = img.closest('section'); if (!sec || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const move = () => { const r = sec.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) img.style.transform = `translateY(${(r.top / innerHeight) * -40}px)`; };
      addEventListener('scroll', move, { passive: true }); move();
    });
    // floating contact button: the panel opens while the pointer is over the button or the panel,
    // and a click keeps it open until the next click, a click elsewhere or Escape
    const c = $('#connect');
    if (c) {
      const btn = $('.connect-btn', c); let pinned = false, timer;
      const set = on => { c.classList.toggle('on', on); btn.setAttribute('aria-expanded', on); };
      if (matchMedia('(hover: hover)').matches) {
        c.addEventListener('mouseenter', () => { clearTimeout(timer); set(true); });
        c.addEventListener('mouseleave', () => { if (!pinned) timer = setTimeout(() => set(false), 220); });
      }
      btn.addEventListener('click', () => { pinned = !pinned; clearTimeout(timer); set(pinned); });
      document.addEventListener('click', e => { if (!c.contains(e.target)) { pinned = false; set(false); } });
      addEventListener('keydown', e => { if (e.key === 'Escape') { pinned = false; set(false); } });
    }
    // "to confirm" tags on/off (remembered on this device only)
    const root = document.documentElement, tg = $('[data-tbc-toggle]');
    let hide = false; try { hide = localStorage.getItem('kc-no-tbc') === '1'; } catch (e) {}
    const apply = () => { root.classList.toggle('no-tbc', hide); if (tg) tg.textContent = hide ? 'Show "to confirm" tags' : 'Hide "to confirm" tags'; };
    apply();
    if (tg) tg.addEventListener('click', () => { hide = !hide; try { localStorage.setItem('kc-no-tbc', hide ? '1' : '0'); } catch (e) {} apply(); });
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
    // a thin line at the top of the window that fills as you scroll down the page
    const bar = document.createElement('div'); bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
    const fill = () => { const max = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`; };
    addEventListener('scroll', fill, { passive: true }); addEventListener('resize', fill); fill();
  }

  const start = () => [initHeader, initReveal, initSlides, initStay, initWidget, initRates, initStatus, initTabs, initRails, initFilters, initMisc].forEach(f => f());
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
