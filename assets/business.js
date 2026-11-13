/* ==========================================================================
   Kamlesh Continental · business page
   Rates toggle, commute panel, meeting quote builder and the corporate rate
   request. Builds on window.KC from site.js, which loads before this file.
   ========================================================================== */
(() => {
  'use strict';

  const start = () => {
    const KC = window.KC; if (!KC) return;
    const { $, $$ } = KC;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const nightsText = n => `${n} night${n === 1 ? '' : 's'}`;
    const today = new Date(), todayIso = KC.iso(today);
    const goodDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !isNaN(KC.parse(v)) && v >= todayIso;

    /* segmented control: returns set(value, silent) */
    function segmented(root, onChange) {
      const btns = $$('button', root);
      const set = (v, silent) => {
        if (!btns.some(b => b.dataset.v === v)) return false;
        btns.forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
        root.dataset.value = v;
        if (!silent && onChange) onChange(v);
        return true;
      };
      root.dataset.value = (btns.find(b => b.classList.contains('on')) || btns[0]).dataset.v;
      root.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(b.dataset.v); });
      return set;
    }

    /* steppers: − [number] + */
    $$('.stepper').forEach(s => {
      const input = $('input', s);
      s.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        input.value = clamp((parseInt(input.value, 10) || 0) + +b.dataset.d, +input.min || 0, +input.max || 99);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      input.addEventListener('change', () => { input.value = clamp(parseInt(input.value, 10) || 0, +input.min || 0, +input.max || 99); });
    });

    /* ---------------- rates: per night, or for the dates in the booking box ---------------- */
    const bw = $('#bw'), rateCards = $$('.rate'), stayLbl = $('#stayLbl');
    let mode = 'night';
    const stayDates = () => (bw ? [bw.elements.cin.value, bw.elements.cout.value] : ['', '']);
    const stayNights = () => { const [a, b] = stayDates(); return a && b ? KC.nights(a, b) : 1; };
    function renderRates() {
      const n = stayNights(), k = mode === 'stay' ? n : 1;
      if (stayLbl) stayLbl.textContent = `Your stay (${nightsText(n)})`;
      rateCards.forEach(card => {
        const r = KC.rooms.find(x => x.id === card.dataset.room); if (!r) return;
        const g = KC.gstFor(r.rate), base = r.rate * k, tax = base * g;
        $('.rate-amt', card).textContent = KC.inr(base);
        $('.rate-unit', card).textContent = mode === 'stay' ? `for ${nightsText(n)}` : 'per night';
        $('.rate-tax', card).textContent = `+ ${KC.inr(tax)} GST (${Math.round(g * 100)}%)`;
        $('.rate-total b', card).textContent = KC.inr(base + tax);
      });
    }
    if ($('#rateMode')) segmented($('#rateMode'), v => { mode = v; renderRates(); });
    if (bw) bw.addEventListener('change', () => {
      renderRates();
      // keep the stay modal on the same dates, so "Reserve" opens with them
      const [a, b] = stayDates(), mIn = $('#mCin'), mOut = $('#mCout');
      if (a && b && mIn && mOut) { mIn.value = a; mOut.value = b; }
    });
    renderRates();

    /* ---------------- commute panel ---------------- */
    // ok:true = confirmed by the hotel's site or its Google listing; the rest are approximate
    const MAPQ = 'https://www.google.com/maps/dir/?api=1&origin=20.8349281,85.103498&destination=';
    const DEST = [
      { id: 'bus', name: 'New Bus Stand', lbl: 'Bus Stand', k: 'tr', km: 'Nearby', t: '5 min', ok: true, mode: 'Auto', brg: 170, r: 38, q: 'Angul New Bus Stand, Odisha', note: 'The hotel is near the new bus terminal.' },
      { id: 'rail', name: 'Angul Railway Station', lbl: 'Railway Stn', k: 'tr', km: '~4 km', t: '15 min', ok: true, mode: 'Taxi', brg: 255, r: 80, q: 'Angul Railway Station, Odisha', note: 'Ask the front desk to call you a taxi.' },
      { id: 'nalco', name: 'NALCO Smelter Plant', lbl: 'NALCO', k: 'ind', km: '~8 km', t: '~15 min', mode: 'Taxi / company cab', brg: 95, r: 112, q: 'NALCO Smelter Plant, Angul, Odisha', note: 'The reason our founder built this hotel.' },
      { id: 'jspl', name: 'JSPL Angul', lbl: 'JSPL', k: 'ind', km: '~15 km', t: '~25 min', mode: 'Taxi / company cab', brg: 315, r: 142, q: 'Jindal Steel and Power, Angul, Odisha', note: 'An early breakfast at the Coffee Shop gets you on the road in time.' },
      { id: 'ntpc', name: 'NTPC Talcher Thermal', lbl: 'NTPC', k: 'ind', km: '~20 km', t: '~35 min', mode: 'Taxi / company cab', brg: 42, r: 138, q: 'NTPC Talcher Thermal Power Station, Odisha', note: 'Close to Bhimkhand, the rock-cut sleeping Vishnu.' },
      { id: 'mcl', name: 'MCL Talcher Coalfields', lbl: 'MCL', k: 'ind', km: '~22 km', t: '~30 min', mode: 'Taxi / company cab', brg: 18, r: 164, q: 'Mahanadi Coalfields Talcher, Odisha', note: 'Talcher is the coal and power town next door.' },
      { id: 'bbi', name: 'Bhubaneswar Airport (BBI)', lbl: 'BBI Airport', k: 'air', km: '~130 km', t: '~3 h', mode: 'Pre-booked car', brg: 140, r: 180, q: 'Biju Patnaik International Airport, Bhubaneswar', note: 'Ask reservations to arrange a car.' },
    ];
    const svg = $('#cmap'), list = $('#dests');
    if (svg && list) {
      const NS = 'http://www.w3.org/2000/svg';
      const el = (tag, attrs, parent = svg, text) => {
        const n = document.createElementNS(NS, tag);
        Object.entries(attrs).forEach(([a, v]) => n.setAttribute(a, v));
        if (text) n.textContent = text;
        parent.appendChild(n); return n;
      };
      const pt = d => { const a = d.brg * Math.PI / 180; return [200 + d.r * Math.sin(a), 200 - d.r * Math.cos(a)]; };
      [[60, 'Town'], [125, 'Industrial belt'], [185, 'Regional']].forEach(([r, label]) => {
        el('circle', { class: 'ring', cx: 200, cy: 200, r });
        el('text', { class: 'ring-l', x: 200, y: 200 + r - 5, 'text-anchor': 'middle' }, svg, label);
      });
      el('text', { class: 'north', x: 200, y: 12, 'text-anchor': 'middle' }, svg, 'N');
      const route = el('line', { class: 'route', x1: 200, y1: 200, x2: 200, y2: 200 });
      const pts = {};
      DEST.forEach(d => {
        const [x, y] = pt(d), g = el('g', { class: 'mpt', 'data-id': d.id, 'data-k': d.k });
        el('circle', { cx: x, cy: y, r: 6 }, g);
        const right = x >= 200;
        el('text', { x: right ? x + 10 : x - 10, y: y + 4, 'text-anchor': right ? 'start' : 'end' }, g, d.lbl);
        g.addEventListener('click', () => select(d.id));
        pts[d.id] = g;
      });
      el('circle', { class: 'pulse', cx: 200, cy: 200, r: 14 });
      el('circle', { class: 'home', cx: 200, cy: 200, r: 7 });
      el('text', { class: 'home-l', x: 200, y: 183, 'text-anchor': 'middle' }, svg, 'Kamlesh Continental');

      list.innerHTML = DEST.map(d => `<div class="dest-row"><button type="button" class="dest" data-id="${d.id}" data-k="${d.k}" aria-pressed="false"><i></i><span><b>${esc(d.name)}</b><small>${esc(d.km)} · ${esc(d.mode)}</small></span><span class="t"><span>${esc(d.t)}</span>${d.ok ? '' : '<span class="tbc">approx.</span>'}</span></button><a class="dest-dir" href="${MAPQ + encodeURIComponent(d.q)}" target="_blank" rel="noopener" aria-label="Directions" title="Directions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 12 12 21 3 12z"/><path d="M9 14v-2.500h5M12.200 9.200 14.500 11.500l-2.300 2.300"/></svg></a></div>`).join('');
      $$('.dest', list).forEach(b => b.addEventListener('click', () => select(b.dataset.id)));

      function select(id) {
        const d = DEST.find(x => x.id === id); if (!d) return;
        const [x, y] = pt(d);
        $$('.dest', list).forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id));
        Object.entries(pts).forEach(([k, g]) => { g.classList.toggle('on', k === id); $('circle', g).setAttribute('r', k === id ? 8 : 6); });
        route.setAttribute('x2', x); route.setAttribute('y2', y);
        const len = Math.hypot(x - 200, y - 200);
        route.style.transition = 'none'; route.style.strokeDasharray = len; route.style.strokeDashoffset = reduce ? 0 : len;
        route.getBoundingClientRect(); // restart the draw-in
        if (!reduce) { route.style.transition = 'stroke-dashoffset .6s ease'; route.style.strokeDashoffset = 0; }
        $('#rKm').textContent = d.km; $('#rT').textContent = d.t; $('#rMode').textContent = d.mode.split(' / ')[0];
        $('#rNote').textContent = d.note + (d.ok ? '' : ' Distance and time are approximate.');
        $('#rDir').href = MAPQ + encodeURIComponent(d.q);
      }
      select('rail');
    }

    /* ---------------- meeting quote builder ---------------- */
    const qN = $('#qN'), qNum = $('#qNum'), qFmt = $('#qFmt'), qDate = $('#qDate'), qRooms = $('#qRooms'), qAdds = $('#qAdds');
    let applyMeeting = () => false;
    if (qN && qNum) {
      const MIN = +qN.min, MAX = +qN.max;
      qDate.min = todayIso; qDate.value = KC.iso(KC.addDays(today, 7));

      const updQuote = () => {
        const n = +qN.value, v = n <= 20 ? 'board' : n <= 600 ? 'hall' : 'lawn';
        const names = { board: 'Board Room', hall: n < 100 ? 'Banquet hall (smallest set-up)' : 'Banquet Halls', lawn: 'The Lawn' };
        $$('.mv').forEach(m => m.classList.toggle('fit', m.dataset.v === v));
        const adds = $$('.chip[aria-pressed="true"]', qAdds).map(c => c.textContent.trim());
        const dur = $('#qDur').dataset.value, fmt = qFmt.value, rooms = parseInt(qRooms.value, 10) || 0;
        const when = qDate.value ? KC.fmt(qDate.value) : 'a date to be decided';
        $('#qVenue').textContent = names[v];
        $('#qPlan').textContent = `${fmt} · ${dur}`;
        $('#qAddsOut').textContent = adds.length ? `${adds.length} selected` : 'None';
        $('#qWa').href = KC.wa(KC.phone.wa, `Hello Kamlesh Continental sales team, please quote for a ${fmt.toLowerCase()} for ${n} people, ${dur.toLowerCase()}, on ${when}. Suggested venue: ${names[v]}. Add-ons: ${adds.join(', ') || 'none'}. Rooms for delegates: ${rooms}.`);
      };
      const setDur = segmented($('#qDur'), updQuote);

      qN.addEventListener('input', () => { qNum.value = qN.value; updQuote(); });
      qNum.addEventListener('input', () => { const v = parseInt(qNum.value, 10); if (!isNaN(v)) { qN.value = clamp(v, MIN, MAX); updQuote(); } });
      qNum.addEventListener('change', () => { qNum.value = qN.value = clamp(parseInt(qNum.value, 10) || 12, MIN, MAX); updQuote(); });
      [qFmt, qDate, qRooms].forEach(f => { f.addEventListener('change', updQuote); f.addEventListener('input', updQuote); });
      qAdds.addEventListener('click', e => {
        const c = e.target.closest('.chip'); if (!c) return;
        c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true'); updQuote();
      });
      $('#quote').addEventListener('submit', e => e.preventDefault());

      // fill the builder from the booking widget's Meeting tab (same page, or arriving from another page)
      applyMeeting = (o, announce) => {
        let used = false;
        if (goodDate(o.date)) { qDate.value = o.date; used = true; }
        const n = parseInt(o.n, 10);
        if (!isNaN(n)) { qN.value = qNum.value = clamp(n, MIN, MAX); used = true; }
        if (o.format && [...qFmt.options].some(op => op.value === o.format)) { qFmt.value = o.format; used = true; }
        if (o.dur && setDur(o.dur, true)) used = true;
        updQuote();
        if (used && announce) KC.toast('Your meeting details are filled in. Add the rest and send.');
        return used;
      };
      const p = KC.params;
      if (['date', 'n', 'format', 'dur'].some(k => p.has(k))) applyMeeting({ date: p.get('date'), n: p.get('n'), format: p.get('format'), dur: p.get('dur') }, true);
      else updQuote();
    }

    // On this page the widget's Meeting tab fills the builder in place instead of reloading.
    // Capturing on document runs before site.js's own submit handler on the form.
    if (bw) document.addEventListener('submit', e => {
      if (e.target !== bw) return;
      const tab = $('.bw-tabs .on', bw);
      if (!tab || tab.dataset.bw !== 'meet' || !$('#quote')) return;
      e.preventDefault(); e.stopPropagation();
      const v = n => (bw.elements[n] || {}).value || '';
      applyMeeting({ date: v('mdate'), n: v('mn'), format: v('mformat'), dur: v('mdur') }, true);
      $('#quote').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, true);

    /* ---------------- corporate rate request ---------------- */
    const cf = $('#corpForm'), done = $('#corpDone');
    if (cf && done) {
      const f = id => $('#' + id);
      cf.addEventListener('submit', e => {
        e.preventDefault();
        let ok = true;
        const mark = (id, bad) => { f(id).closest('.field').classList.toggle('bad', bad); if (bad) ok = false; };
        const company = f('cCompany').value.trim(), name = f('cName').value.trim(), email = f('cEmail').value.trim();
        const digits = f('cPhone').value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
        const gst = f('cGst').value.trim().toUpperCase(); f('cGst').value = gst;
        mark('cCompany', !company);
        mark('cName', !name);
        mark('cPhone', !/^[6-9]\d{9}$/.test(digits));
        mark('cEmail', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        mark('cGst', !!gst && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst));
        if (!ok) { const first = $('.field.bad input', cf); if (first) first.focus(); return; }
        const rows = [['Company', company], ['Contact', name], ['Mobile', '+91 ' + digits], ['Email', email], ['GSTIN', gst || 'Not given'], ['Room-nights a month', f('cNights').value], ['Bill to company', f('cBill').checked ? 'Yes' : 'No']];
        const notes = f('cNotes').value.trim(); if (notes) rows.push(['Notes', notes]);
        $('#corpSummary').innerHTML = rows.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
        const text = 'Corporate rate request\n' + rows.map(([k, v]) => `${k}: ${v}`).join('\n');
        $('#corpWa').href = KC.wa(KC.phone.wa, 'Hello Kamlesh Continental, ' + text);
        $('#corpMail').href = `mailto:${KC.phone.email}?subject=${encodeURIComponent('Corporate rate request: ' + company)}&body=${encodeURIComponent(text)}`;
        cf.hidden = true; done.hidden = false; done.focus();
      });
      cf.addEventListener('input', e => { const fl = e.target.closest('.field'); if (fl) fl.classList.remove('bad'); });
      $('#corpEdit').addEventListener('click', () => { done.hidden = true; cf.hidden = false; f('cCompany').focus(); });
    }
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
