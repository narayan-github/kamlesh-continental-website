/* ==========================================================================
   Kamlesh Continental · weddings page
   Venue finder, ritual timeline, celebration planner and gallery lightbox.
   Builds on window.KC from site.js (both scripts are deferred; site.js runs first).
   ========================================================================== */
(() => {
  'use strict';

  const start = () => {
    const KC = window.KC;
    if (!KC || !document.getElementById('planner')) return;
    const { $, $$ } = KC;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const num = n => Number(n).toLocaleString('en-IN');
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const DESK = KC.phone.weddings;

    /* ---- venues: capacities are the hotel's own published numbers ---- */
    const VENUES = [
      { id: 'board', name: 'Board Room', min: 1, max: 20 },
      { id: 'halls', name: 'Banquet Halls', min: 100, max: 600 },
      { id: 'lawn', name: 'The Lawn', min: 100, max: 800 },
      { id: 'combo', name: 'Lawn + Halls', min: 600, max: Infinity },
    ];
    const bestVenue = n => VENUES.find(v => n <= v.max);
    const venueLabel = n => { const b = bestVenue(n); return b.id === 'halls' ? (n <= 300 ? 'Banquet Halls (one or two)' : 'Banquet Halls (combined)') : b.name; };
    const layoutFor = n => n <= 20 ? 'Board room table, with a screen and AV on request'
      : n < 100 ? 'One hall with round tables and a low stage'
      : n <= 300 ? 'One or two halls, round tables, a stage and a buffet line'
      : n <= 600 ? 'Halls combined, banquet rounds, stage, dance floor and buffet counters'
      : n <= 800 ? 'The lawn, with a mandap or stage and buffet counters along the edge'
      : 'Lawn and halls together: the ceremony outdoors, dinner indoors and out';

    /* ---- venue finder ---- */
    const range = $('#guestRange'), nOut = $('#nOut');
    const paintFinder = n => {
      nOut.textContent = num(n);
      range.style.setProperty('--p', ((clamp(n, +range.min, +range.max) - range.min) / (range.max - range.min) * 100) + '%');
      range.setAttribute('aria-valuetext', `${num(n)} guests`);
      $('#layoutTxt').textContent = layoutFor(n);
      const best = bestVenue(n);
      $$('#venueCards .vcard').forEach(card => {
        const v = VENUES.find(x => x.id === card.dataset.v), tag = $('.fit', card);
        card.classList.remove('best', 'fits', 'roomy', 'no');
        if (n > v.max) { card.classList.add('no'); tag.textContent = 'Too small'; }
        else if (v === best) { card.classList.add('best'); tag.textContent = 'Best fit'; }
        else if (n >= v.min) { card.classList.add('fits'); tag.textContent = 'Also fits'; }
        else { card.classList.add('roomy'); tag.textContent = 'Roomier than you need'; }
      });
    };

    /* ---- planner ---- */
    const FUNCTIONS = ['Sagai', 'Haldi', 'Mehendi', 'Sangeet', 'Shaadi', 'Reception', 'Bachelor party', 'Birthday', 'Anniversary', 'Corporate gala'];
    const picked = new Set(['Shaadi', 'Reception']);
    const pGuests = $('#pGuests'), pRooms = $('#pRooms'), pNights = $('#pNights'), pDate = $('#pDate'), pFlex = $('#pFlex'), pName = $('#pName');
    const today = new Date();
    let food = 'Veg & non-veg';
    pDate.min = KC.iso(today);
    pDate.value = KC.iso(KC.addDays(today, 60));

    // details handed over by the booking widget on the home page
    const OCCASIONS = { wedding: 'Shaadi', reception: 'Reception', engagement: 'Sagai', birthday: 'Birthday', anniversary: 'Anniversary', 'corporate gala': 'Corporate gala' };
    const q = KC.params;
    let prefilled = false;
    const occ = OCCASIONS[(q.get('occasion') || '').trim().toLowerCase()];
    if (occ) { picked.clear(); picked.add(occ); prefilled = true; }
    const qd = q.get('date') || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(qd) && !isNaN(KC.parse(qd)) && qd >= KC.iso(today)) { pDate.value = qd; prefilled = true; }
    const qg = parseInt(q.get('guests'), 10);
    if (qg > 0) { pGuests.value = clamp(qg, 10, 2000); prefilled = true; }
    const qr = parseInt(q.get('rooms'), 10);
    if (qr >= 0) { pRooms.value = clamp(qr, 0, 80); prefilled = true; }

    const fnWrap = $('#fnChips');
    FUNCTIONS.forEach(f => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = f; b.dataset.fn = f;
      b.setAttribute('aria-pressed', picked.has(f));
      b.addEventListener('click', () => { picked.has(f) ? picked.delete(f) : picked.add(f); b.setAttribute('aria-pressed', picked.has(f)); updatePlan(); paintRitual(); });
      fnWrap.appendChild(b);
    });

    const clampInput = el => { const c = clamp(Math.round(+el.value || 0), +el.min, +el.max); el.value = c; return c; };
    const sliderFor = g => clamp(Math.round(g), +range.min, +range.max);   // any whole number of guests
    const syncFromPlanner = () => { const g = clampInput(pGuests); range.value = sliderFor(g); paintFinder(g); };

    function updatePlan() {
      const fns = FUNCTIONS.filter(f => picked.has(f));
      const g = Math.max(10, +pGuests.value || 10), rooms = +pRooms.value || 0, nights = +pNights.value || 1;
      const dateTxt = pDate.value ? KC.fmtLong(pDate.value) + (pFlex.checked ? ' (flexible)' : '') : (pFlex.checked ? 'Flexible' : 'To be decided');
      const venue = venueLabel(g);
      const roomsTxt = rooms ? `${plural(rooms, 'room')} × ${plural(nights, 'night')}` : 'Not needed';
      $('#sFns').textContent = fns.length ? fns.join(', ') : 'To be discussed';
      $('#sDate').textContent = dateTxt;
      $('#sGuests').textContent = 'About ' + num(g);
      $('#sVenue').textContent = venue;
      $('#sRooms').textContent = roomsTxt;
      $('#sFood').textContent = food;
      const name = pName.value.trim();
      const msg = [
        'Namaskar! I\'m planning a celebration at Kamlesh Continental.',
        '• Functions: ' + (fns.length ? fns.join(', ') : 'to be discussed'),
        '• Date: ' + dateTxt,
        '• Guests: about ' + num(g),
        '• Venue we\'re thinking of: ' + venue,
        '• Rooms for guests: ' + roomsTxt,
        '• Food: ' + food,
        name ? '— ' + name : 'Please share availability and packages.',
      ].join('\n');
      $('#bubble').textContent = msg;
      $('#pWa').href = KC.wa(DESK, msg);
    }

    $$('[data-step]').forEach(b => b.addEventListener('click', () => {
      const el = document.getElementById(b.dataset.step);
      el.value = (+el.value || 0) + +b.dataset.d; clampInput(el);
      if (el === pGuests) syncFromPlanner();
      updatePlan();
    }));
    pGuests.addEventListener('change', () => { syncFromPlanner(); updatePlan(); });
    pGuests.addEventListener('input', () => { const g = +pGuests.value; if (g >= 10) { range.value = sliderFor(g); paintFinder(g); updatePlan(); } });
    [pRooms, pNights].forEach(el => el.addEventListener('change', () => { clampInput(el); updatePlan(); }));
    [pDate, pFlex, pName].forEach(el => el.addEventListener('input', updatePlan));
    const foodBtns = $$('#pFood button');
    foodBtns.forEach(b => b.addEventListener('click', () => {
      food = b.dataset.food;
      foodBtns.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      updatePlan();
    }));
    $('#pform').addEventListener('submit', e => e.preventDefault());

    range.addEventListener('input', () => { const n = +range.value; paintFinder(n); pGuests.value = n; updatePlan(); });
    $('#useCount').addEventListener('click', () => { pGuests.value = range.value; updatePlan(); KC.toast(`${num(range.value)} guests added to your planner`); });

    /* ---- rituals: where each function could happen. Sizes are suggestions, not limits. ---- */
    const tbc = t => ` <span class="tbc">${t}</span>`;
    const RITUALS = [
      { n: 'Sagai', sub: 'Nirbandha · the engagement', img: 'banquet-dining', story: 'Two families, one room and the first ring. A single banquet hall, a low stage for the exchange, and round tables for dinner.', set: [['Where', 'One banquet hall'], ['When', 'Evening'], ['Works for', '100 to 200 guests'], ['Styling', 'A marigold toran at the door, a rose-petal aisle']] },
      { n: 'Haldi', sub: 'Mangana · turmeric and blessings', img: 'pool-wide', story: 'Morning light, turmeric and a lot of laughter, out on the lawn or beside Ripples pool, where nobody minds a little yellow.', set: [['Where', 'The lawn, or poolside' + tbc('poolside to confirm')], ['When', 'Morning'], ['Works for', '50 to 150 guests'], ['Styling', 'Yellow and green drapes, a brass urli with floating flowers']] },
      { n: 'Mehendi', sub: 'Henna, chai and folk songs', img: 'lawn', story: 'A long, slow afternoon of henna and chai under a shamiana on the lawn, with the aunties in charge of the playlist.', set: [['Where', 'The lawn'], ['When', 'Afternoon'], ['Works for', '50 to 300 guests'], ['Styling', 'Floor seating with bolsters, a corner for the mehendi artists']] },
      { n: 'Sangeet', sub: 'Music and dance night', img: 'banquet-hall', story: 'Choreographed cousins, a stage and a dance floor, with the halls opened into one big room for the night.', set: [['Where', 'Banquet halls, combined'], ['When', 'Night'], ['Works for', 'Up to 600 guests'], ['Music', 'DJ and cut-off time' + tbc('to confirm')]] },
      { n: 'Shaadi', sub: 'Bahaghara · the vows', img: 'wedding-cards', story: 'The mandap under an open sky, the lawn holding up to 800 of your nearest and dearest, and the halls ready if the weather turns.', set: [['Where', 'The lawn, with the halls as backup'], ['When', 'By the muhurat'], ['Works for', 'Up to 800 guests'], ['Styling', 'Mandap, marigold and mango-leaf torans']] },
      { n: 'Reception', sub: 'The grand dinner', img: 'catering-pano', story: 'The rituals are done and everyone is hungry. The lawn and halls together take more than a thousand guests, with a buffet worth queuing for.', set: [['Where', 'Lawn and halls together'], ['When', 'Night'], ['Works for', '1,000+ guests'], ['Food', 'Buffet counters from the hotel kitchen']] },
      { n: 'Bachelor party', sub: 'One last night out', img: 'nectar-fire', story: 'The friends, a round of flaming cocktails at the Nectar bar, and nobody driving home. The rooms are upstairs.', set: [['Where', 'Nectar bar, first floor'], ['When', 'Night'], ['Works for', 'A small group'], ['Booking', 'Private hire' + tbc('to confirm')]] },
    ];
    const stepsEl = $('#steps'), two = n => String(n).padStart(2, '0');
    let cur = 0;
    RITUALS.forEach((r, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'step'; b.id = 'step-' + i;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'ritualPanel');
      b.innerHTML = `<i>${two(i + 1)}</i><b>${r.n}</b><small>${r.sub.split(' · ')[0]}</small>`;
      b.addEventListener('click', () => selectRitual(i, true));
      stepsEl.appendChild(b);
    });
    function paintRitual() {
      const fn = RITUALS[cur].n;
      $('#rAdd').textContent = picked.has(fn) ? `✓ ${fn} is in your planner` : `Add ${fn} to my planner`;
    }
    function selectRitual(i, focus) {
      cur = (i + RITUALS.length) % RITUALS.length;
      const r = RITUALS[cur], active = $('#step-' + cur);
      $$('.step', stepsEl).forEach((s, k) => { s.setAttribute('aria-selected', k === cur); s.tabIndex = k === cur ? 0 : -1; });
      if (focus) active.focus({ preventScroll: true });
      stepsEl.scrollTo({ left: active.offsetLeft - stepsEl.clientWidth / 2 + active.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
      $('#ritualPanel').setAttribute('aria-labelledby', 'step-' + cur);
      const img = $('#rImg');
      img.style.opacity = 0;
      setTimeout(() => { img.src = `img/${r.img}.jpg`; img.alt = `A possible setting for the ${r.n}`; img.style.opacity = 1; }, reduce ? 0 : 220);
      $('#rNum').textContent = `${two(cur + 1)} / ${two(RITUALS.length)}`;
      $('#rName').textContent = r.n; $('#rSub').textContent = r.sub; $('#rStory').textContent = r.story;
      $('#rSetting').innerHTML = r.set.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      const t = $('#rText'); t.classList.remove('fade'); void t.offsetWidth; t.classList.add('fade');
      paintRitual();
    }
    stepsEl.addEventListener('keydown', e => {
      const go = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: RITUALS.length - 1 }[e.key];
      if (go === undefined) return;
      e.preventDefault(); selectRitual(go, true);
    });
    $('#rPrev').addEventListener('click', () => selectRitual(cur - 1));
    $('#rNext').addEventListener('click', () => selectRitual(cur + 1));
    $('#rAdd').addEventListener('click', () => {
      const fn = RITUALS[cur].n;
      if (picked.has(fn)) return KC.toast(`${fn} is already in your planner`);
      picked.add(fn);
      $(`[data-fn="${fn}"]`, fnWrap).setAttribute('aria-pressed', 'true');
      updatePlan(); paintRitual(); KC.toast(`${fn} added to your planner`);
    });

    /* ---- gallery lightbox (the filter buttons are wired by site.js and set [hidden]) ---- */
    const items = $$('.g-item'), lb = $('#lb'), lbImg = $('#lbImg');
    const lbBtns = [$('#lbClose'), $('#lbPrev'), $('#lbNext')];
    let gi = 0, lastFocus = null;
    const shown = () => items.filter(x => !x.hidden);
    const showLb = i => {
      const list = shown(); if (!list.length) return;
      gi = (i + list.length) % list.length;
      const it = list[gi], im = $('img', it);
      lbImg.src = im.currentSrc || im.src; lbImg.alt = im.alt;
      $('#lbCap').textContent = it.dataset.cap; $('#lbCount').textContent = `${gi + 1} / ${list.length}`;
    };
    const openLb = it => { lastFocus = it; showLb(shown().indexOf(it)); lb.classList.add('on'); document.body.style.overflow = 'hidden'; lbBtns[0].focus(); };
    const closeLb = () => { lb.classList.remove('on'); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
    items.forEach(it => it.addEventListener('click', () => openLb(it)));
    lbBtns[0].addEventListener('click', closeLb);
    lbBtns[1].addEventListener('click', () => showLb(gi - 1));
    lbBtns[2].addEventListener('click', () => showLb(gi + 1));
    lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
    addEventListener('keydown', e => {
      if (!lb.classList.contains('on')) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowRight') showLb(gi + 1);
      else if (e.key === 'ArrowLeft') showLb(gi - 1);
      else if (e.key === 'Tab') { // keep focus inside the viewer
        e.preventDefault();
        const k = lbBtns.indexOf(document.activeElement);
        lbBtns[(k + (e.shiftKey ? -1 : 1) + lbBtns.length) % lbBtns.length].focus();
      }
    });

    /* ---- site-visit link ---- */
    $$('[data-visit]').forEach(a => { a.href = KC.wa(DESK, 'Namaskar, I\'d like to arrange a site visit of the banquet halls and lawn at Kamlesh Continental.'); });

    /* ---- first paint ---- */
    const g0 = clampInput(pGuests);
    range.value = sliderFor(g0);
    paintFinder(g0);
    selectRitual(0);
    updatePlan();
    if (prefilled) setTimeout(() => KC.toast('Your details from the home page are filled in'), 600);
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
