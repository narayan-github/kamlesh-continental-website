/* ==========================================================================
   Kamlesh Continental · custom form controls
   Replaces the browser's own date picker, dropdown and number spinner with
   controls drawn in the site's style: a calendar, a list, and − / + buttons.
   The original <input> or <select> stays in the page (hidden) as the single
   source of truth, so every other script keeps reading and writing .value
   exactly as before. On phones the calendar and lists open as a bottom sheet.
   ========================================================================== */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = v => (v ? new Date(v + 'T00:00') : null);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LOCALES = { en: 'en-IN', hi: 'hi-IN', or: 'or-IN' };
  const locale = () => LOCALES[document.documentElement.lang] || 'en-IN';
  const t = s => (window.KC && KC.t ? KC.t(s) : s);                 // translated once the language script is loaded
  // Dates are written with the dictionary's own weekday and month names when a language has them,
  // because browsers do not carry names for every language (Odia, for one).
  const names = () => (window.KC && KC.i18n && KC.i18n.names && KC.i18n.names()) || null;
  const dg = s => (window.KC && KC.i18n && KC.i18n.digits ? KC.i18n.digits(s) : String(s));      // the language's own numerals
  const fmtShort = d => { const n = names(); return dg(n ? `${n.wd[d.getDay()]}, ${d.getDate()} ${n.mo[d.getMonth()]}` : d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })); };
  const fmtFull = d => { const n = names(); return dg(n ? `${n.wd[d.getDay()]}, ${d.getDate()} ${(n.moLong || n.mo)[d.getMonth()]} ${d.getFullYear()}` : d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })); };
  const fmtMonth = d => { const n = names(); return dg(n ? `${(n.moLong || n.mo)[d.getMonth()]} ${d.getFullYear()}` : d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })); };
  const dowNames = () => { const n = names(); return n ? n.wd : [...Array(7)].map((_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'short' })); };   // 1 Jan 2023 was a Sunday
  const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const isSheet = () => matchMedia('(max-width: 640px)').matches;
  const ICON = {
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.500h17M8 3v4M16 3v4"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  };

  // Scripts assign input.value directly, which fires no event. This runs `after`
  // on every such assignment so the visible control never goes stale.
  function hook(el, prop, after) {
    let proto = Object.getPrototypeOf(el), d;
    while (proto && !(d = Object.getOwnPropertyDescriptor(proto, prop))) proto = Object.getPrototypeOf(proto);
    if (!d || !d.set) return;
    Object.defineProperty(el, prop, { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); after(); } });
  }

  // The words that label a field: its <label> text, or aria-label / aria-labelledby.
  function labelOf(el) {
    const wrap = el.closest('label'), span = wrap && $('span', wrap);
    if (span) return span.textContent.trim();
    const by = el.getAttribute('aria-labelledby'), ref = by && document.getElementById(by);
    if (ref) return ref.textContent.trim();
    const lab = el.id && $(`label[for="${el.id}"]`);
    return (lab ? lab.textContent : el.getAttribute('aria-label') || '').trim();
  }

  /* ---------- one shared popover (a bottom sheet on phones) ---------- */
  let pop, back, current = null;
  function ensurePop() {
    if (pop) return;
    back = document.createElement('div'); back.className = 'kc-pop-back'; back.hidden = true;
    pop = document.createElement('div'); pop.className = 'kc-pop'; pop.hidden = true; pop.setAttribute('data-no-i18n', '');
    document.body.append(back, pop);
    back.addEventListener('click', () => closePop(true));
    document.addEventListener('pointerdown', e => {
      if (!current || pop.contains(e.target) || current.trigger.contains(e.target) || (current.anchor && current.anchor.contains(e.target))) return;
      closePop(false);
    }, true);
    addEventListener('resize', () => current && place());
    addEventListener('scroll', e => { if (current && !pop.contains(e.target)) place(); }, true);
    pop.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(true); }
      else if (e.key === 'Tab' && current && current.cycle) {            // a small form: Tab moves between its buttons
        const f = $$('button:not(:disabled)', pop), i = f.indexOf(document.activeElement);
        e.preventDefault(); if (f.length) f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
      else if (e.key === 'Tab') { e.preventDefault(); closePop(true); }
      else if (current && current.key) current.key(e);
    });
  }
  function place() {
    if (!current) return;
    const sheet = isSheet();
    pop.classList.toggle('kc-sheet', sheet); back.hidden = !sheet;
    if (sheet) { pop.style.cssText = ''; return; }
    const r = (current.anchor || current.trigger).getBoundingClientRect(), m = 12;
    pop.style.minWidth = current.matchWidth ? Math.round(r.width) + 'px' : '';
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let top = r.bottom + 8;
    if (top + h > innerHeight - m && r.top - 8 - h > m) top = r.top - 8 - h;       // open upwards when there is no room below
    pop.style.left = Math.round(Math.min(Math.max(m, r.left), innerWidth - w - m)) + 'px';
    pop.style.top = Math.round(Math.max(m, top)) + 'px';
  }
  function openPop(o) {
    ensurePop();
    if (current) closePop(false);
    current = o;
    pop.innerHTML = ''; pop.hidden = false; pop.onclick = pop.onmouseover = pop.onmouseleave = null;
    o.trigger.setAttribute('aria-expanded', 'true');
    const focus = o.build(pop);
    place();
    if (focus) focus();
  }
  function closePop(refocus) {
    if (!current) return;
    const c = current; current = null;
    pop.hidden = true; back.hidden = true; pop.innerHTML = '';
    c.trigger.setAttribute('aria-expanded', 'false');
    if (refocus) c.trigger.focus({ preventScroll: true });
  }
  const sheetHead = label => `<div class="kc-pop-head"><span>${esc(label)}</span><button type="button" class="kc-pop-x" aria-label="${esc(t('Close'))}">×</button></div>`;

  /* ---------- date picker ---------- */
  const dates = new Map();
  function enhanceDate(input) {
    if (dates.has(input)) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'kc-trigger kc-date'; btn.setAttribute('data-no-i18n', '');
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span class="kc-val"></span>${ICON.cal}`;
    input.before(btn);
    input.classList.add('kc-native'); input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
    const api = { input, btn, pair: null, role: null };
    api.paint = () => {
      const d = parse(input.value), v = $('.kc-val', btn);
      v.textContent = d ? fmtShort(d) : t('Select a date');
      v.classList.toggle('kc-empty', !d);
      btn.setAttribute('aria-label', `${labelOf(input)}: ${d ? fmtFull(d) : t('Select a date')}`);
    };
    hook(input, 'value', api.paint);
    input.addEventListener('change', api.paint);
    btn.addEventListener('click', () => (current && current.trigger === btn ? closePop(true) : openCal(api)));
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); openCal(api); } });
    dates.set(input, api); api.paint();
  }
  // A check-in / check-out pair behaves as one range: pick the first date and the
  // calendar moves straight on to the second, shading the nights in between.
  function pairUp(start, end) {
    const a = dates.get(start), b = dates.get(end);
    if (!a || !b) return;
    a.pair = b; a.role = 'start'; b.pair = a; b.role = 'end';
  }

  function openCal(api) {
    const { input, btn } = api;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const minOf = () => {
      let m = parse(input.min);
      if (api.role === 'end' && api.pair.input.value) { const s = addDays(parse(api.pair.input.value), 1); if (!m || s > m) m = s; }
      return m;
    };
    const first = parse(input.value) || minOf() || today;
    let view = new Date(first.getFullYear(), first.getMonth(), 1), hover = null;
    const label = labelOf(input);

    // shade the nights between check-in and check-out (or up to the day under the pointer)
    const paintRange = () => {
      const days = $$('.kc-day', pop), sel = parse(input.value);
      let rs = null, re = null;
      if (api.pair) {
        rs = parse(api.role === 'start' ? input.value : api.pair.input.value);
        re = parse(api.role === 'end' ? input.value : api.pair.input.value);
        if (api.role === 'end' && hover && rs && hover > rs) re = hover;
        if (rs && re && re <= rs) re = null;
      }
      days.forEach(b => {
        const d = parse(b.dataset.d);
        b.classList.toggle('is-in', !!(rs && re && d > rs && d < re));
        b.classList.toggle('is-start', !!(rs && re && +d === +rs));
        b.classList.toggle('is-end', !!(rs && re && +d === +re));
        b.classList.toggle('is-sel', !!(sel && +d === +sel) || !!(rs && !re && +d === +rs));
      });
      const foot = $('.kc-cal-foot span', pop);
      if (foot) {
        const n = rs && re ? Math.round((re - rs) / 864e5) : 0;
        foot.innerHTML = n ? `<b>${esc(t(n === 1 ? '1 night' : `${n} nights`))}</b>` : esc(t(api.role === 'start' ? 'Choose your check-in date' : api.role === 'end' ? 'Choose your check-out date' : 'Choose a date'));
      }
    };

    const render = focusIso => {
      const min = minOf(), sel = parse(input.value);
      const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      const dow = dowNames();
      let cells = '<span></span>'.repeat(view.getDay());
      for (let n = 1; n <= dim; n++) {
        const d = new Date(view.getFullYear(), view.getMonth(), n);
        cells += `<button type="button" class="kc-day${+d === +today ? ' is-today' : ''}" data-d="${iso(d)}" tabindex="-1"${min && d < min ? ' disabled' : ''}${sel && +d === +sel ? ' aria-pressed="true"' : ''} aria-label="${esc(fmtFull(d))}">${dg(n)}</button>`;
      }
      const noPrev = min && new Date(view.getFullYear(), view.getMonth(), 0) < min;
      pop.innerHTML = `${sheetHead(label)}<div class="kc-cal" role="dialog" aria-label="${esc(label)}">
        <div class="kc-cal-head">
          <button type="button" class="kc-cal-nav" data-nav="-1" aria-label="${esc(t('Previous month'))}"${noPrev ? ' disabled' : ''}>←</button>
          <div class="kc-cal-title" aria-live="polite">${esc(fmtMonth(view))}</div>
          <button type="button" class="kc-cal-nav" data-nav="1" aria-label="${esc(t('Next month'))}">→</button>
        </div>
        <div class="kc-cal-grid">${dow.map(x => `<span class="kc-dow">${esc(x)}</span>`).join('')}${cells}</div>
        <div class="kc-cal-foot"><span></span>${api.pair ? `<em>${esc(label)}</em>` : ''}</div>
      </div>`;
      paintRange();
      const f = (focusIso && $(`.kc-day[data-d="${focusIso}"]:not(:disabled)`, pop)) || $('.kc-day.is-sel:not(:disabled)', pop) || $('.kc-day.is-today:not(:disabled)', pop) || $('.kc-day:not(:disabled)', pop);
      if (f) { f.tabIndex = 0; f.focus({ preventScroll: true }); }
      place();
    };

    const choose = k => {
      input.value = k; fire(input);
      if (api.role === 'start') { closePop(false); openCal(api.pair); }      // straight on to the check-out date
      else closePop(true);
    };

    openPop({
      trigger: btn, anchor: btn.closest('.bw label') || btn,
      build() {
        pop.onclick = e => {
          if (e.target.closest('.kc-pop-x')) return closePop(true);
          const nav = e.target.closest('.kc-cal-nav'), day = e.target.closest('.kc-day');
          if (nav && !nav.disabled) { view = new Date(view.getFullYear(), view.getMonth() + +nav.dataset.nav, 1); render(); const again = $(`.kc-cal-nav[data-nav="${nav.dataset.nav}"]:not(:disabled)`, pop); if (again) again.focus({ preventScroll: true }); }
          else if (day && !day.disabled) choose(day.dataset.d);
        };
        pop.onmouseover = e => { const day = e.target.closest('.kc-day'); if (day && !day.disabled) { hover = parse(day.dataset.d); paintRange(); } };
        pop.onmouseleave = () => { hover = null; paintRange(); };
        return () => render();
      },
      key(e) {
        const b = e.target.closest('.kc-day'); if (!b) return;
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        let d = parse(b.dataset.d);
        if (step) d = addDays(d, step);
        else if (e.key === 'PageUp') d.setMonth(d.getMonth() - 1);
        else if (e.key === 'PageDown') d.setMonth(d.getMonth() + 1);
        else if (e.key === 'Home') d = addDays(d, -d.getDay());
        else if (e.key === 'End') d = addDays(d, 6 - d.getDay());
        else return;
        e.preventDefault();
        const min = minOf(); if (min && d < min) d = min;
        hover = d;
        if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) { view = new Date(d.getFullYear(), d.getMonth(), 1); render(iso(d)); return; }
        const next = $(`.kc-day[data-d="${iso(d)}"]`, pop);
        if (next && !next.disabled) { $$('.kc-day', pop).forEach(x => { x.tabIndex = -1; }); next.tabIndex = 0; next.focus({ preventScroll: true }); paintRange(); }
      },
    });
  }

  /* ---------- dropdown ---------- */
  const selects = new Map();
  function enhanceSelect(sel) {
    if (selects.has(sel) || sel.multiple) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'kc-trigger kc-select'; btn.setAttribute('data-no-i18n', '');
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span class="kc-val"></span>${ICON.chev}`;
    sel.before(btn);
    sel.classList.add('kc-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    const paint = () => {
      const o = sel.options[sel.selectedIndex], txt = o ? o.textContent.trim() : '';
      $('.kc-val', btn).textContent = txt;
      btn.setAttribute('aria-label', `${labelOf(sel)}: ${txt}`);
    };
    hook(sel, 'value', paint); hook(sel, 'selectedIndex', paint);
    sel.addEventListener('change', paint);
    new MutationObserver(paint).observe(sel, { childList: true, subtree: true, characterData: true });   // options added, removed or translated
    btn.addEventListener('click', () => (current && current.trigger === btn ? closePop(true) : openList(sel, btn)));
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList(sel, btn); } });
    selects.set(sel, { paint }); paint();
  }

  function openList(sel, btn) {
    const label = labelOf(sel), opts = [...sel.options];
    let items = [], typed = '', typedAt = 0;
    const focusAt = i => { const it = items[Math.max(0, Math.min(items.length - 1, i))]; if (it) { it.focus({ preventScroll: true }); it.scrollIntoView({ block: 'nearest' }); } };
    const pick = i => { if (!opts[i] || opts[i].disabled) return; sel.selectedIndex = i; fire(sel); closePop(true); };
    openPop({
      trigger: btn, anchor: btn.closest('.bw label') || btn, matchWidth: true,
      build() {
        pop.innerHTML = `${sheetHead(label)}<ul class="kc-list" role="listbox" aria-label="${esc(label)}">${opts.map((o, i) =>
          `<li role="option" data-i="${i}" tabindex="-1" aria-selected="${i === sel.selectedIndex}"${o.disabled ? ' aria-disabled="true"' : ''}>${esc(o.textContent.trim())}</li>`).join('')}</ul>`;
        items = $$('li', pop);
        pop.onclick = e => {
          if (e.target.closest('.kc-pop-x')) return closePop(true);
          const li = e.target.closest('li[role=option]'); if (li) pick(+li.dataset.i);
        };
        return () => focusAt(Math.max(0, sel.selectedIndex));
      },
      key(e) {
        const li = e.target.closest('li[role=option]'), i = li ? +li.dataset.i : sel.selectedIndex;
        if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
        else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
        else if (e.key === 'End') { e.preventDefault(); focusAt(items.length - 1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (li) pick(i); }
        else if (e.key.length === 1) {                                         // type a letter to jump to an option
          const now = Date.now(); typed = now - typedAt > 700 ? e.key : typed + e.key; typedAt = now;
          const hit = opts.findIndex(o => o.textContent.trim().toLowerCase().startsWith(typed.toLowerCase()));
          if (hit > -1) focusAt(hit);
        }
      },
    });
  }

  /* ---------- number fields in the booking box get − and + buttons ---------- */
  let numSeq = 0;
  function enhanceNumber(input) {
    if (input.dataset.kcNum) return;
    input.dataset.kcNum = '1';
    const wrap = document.createElement('span'); wrap.className = 'kc-num';
    const mk = (dir, label) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kc-num-btn'; b.textContent = dir < 0 ? '−' : '+'; b.setAttribute('aria-label', label);
      b.addEventListener('click', () => {
        // data-step: a bigger jump for the buttons, while any whole number can still be typed
        const step = +input.dataset.step || +input.step || 1, min = input.min === '' ? -Infinity : +input.min, max = input.max === '' ? Infinity : +input.max;
        input.value = Math.min(max, Math.max(min, (+input.value || 0) + dir * step)); fire(input);
      });
      return b;
    };
    input.before(wrap); wrap.append(mk(-1, 'Fewer'), input, mk(1, 'More'));
    // A <label> passes its hover and click to the first control inside it, which would be the minus button.
    // Pointing the label at the number box instead keeps the buttons independent.
    const lab = input.closest('label');
    if (lab) { if (!input.id) input.id = `kc-num-${++numSeq}`; lab.htmlFor = input.id; }
  }

  /* ---- guests: adults and children, each with − and + ----
     The field is <input type="hidden" data-guests value="2,0"> (adults,children). */
  const GUESTS = { a: { min: 1, max: 10 }, k: { min: 0, max: 6 } };
  const readGuests = v => {
    const [a, k] = String(v || '').split(',').map(n => parseInt(n, 10));
    return { a: Math.min(GUESTS.a.max, Math.max(GUESTS.a.min, a || 2)), k: Math.min(GUESTS.k.max, Math.max(GUESTS.k.min, k || 0)) };
  };
  const guestParts = v => { const { a, k } = readGuests(v); return [a === 1 ? '1 adult' : `${a} adults`].concat(k ? [k === 1 ? '1 child' : `${k} children`] : []); };
  const guestFields = new Map();
  function enhanceGuests(input) {
    if (guestFields.has(input)) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'kc-trigger kc-guests'; btn.setAttribute('data-no-i18n', '');
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span class="kc-val"></span>${ICON.chev}`;
    input.before(btn);
    const paint = () => { const txt = guestParts(input.value).map(t).join(', '); $('.kc-val', btn).textContent = txt; btn.setAttribute('aria-label', `${labelOf(input)}: ${txt}`); };
    hook(input, 'value', paint);
    btn.addEventListener('click', () => (current && current.trigger === btn ? closePop(true) : openGuests(input, btn)));
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); openGuests(input, btn); } });
    guestFields.set(input, { paint }); paint();
  }
  function openGuests(input, btn) {
    const label = labelOf(input);
    const row = (g, title, note) => `<div class="kc-guest-row"><div><b>${esc(t(title))}</b>${note ? `<small>${esc(t(note))}</small>` : ''}</div>
      <div class="kc-count"><button type="button" data-g="${g}" data-d="-1" aria-label="${esc(t(g === 'a' ? 'Fewer adults' : 'Fewer children'))}">−</button><output data-o="${g}"></output><button type="button" data-g="${g}" data-d="1" aria-label="${esc(t(g === 'a' ? 'More adults' : 'More children'))}">+</button></div></div>`;
    const paint = () => {
      const v = readGuests(input.value);
      ['a', 'k'].forEach(g => {
        $(`[data-o="${g}"]`, pop).textContent = dg(v[g]);
        $(`[data-g="${g}"][data-d="-1"]`, pop).disabled = v[g] <= GUESTS[g].min;
        $(`[data-g="${g}"][data-d="1"]`, pop).disabled = v[g] >= GUESTS[g].max;
      });
    };
    openPop({
      trigger: btn, anchor: btn.closest('.bw label') || btn, cycle: true,
      build() {
        pop.innerHTML = `${sheetHead(label)}<div class="kc-guest" role="dialog" aria-label="${esc(label)}">${row('a', 'Adults')}${row('k', 'Children', 'Under 6 stay free')}<button type="button" class="btn btn-solid kc-done">${esc(t('Done'))}</button></div>`;
        pop.onclick = e => {
          if (e.target.closest('.kc-pop-x, .kc-done')) return closePop(true);
          const b = e.target.closest('[data-g]'); if (!b || b.disabled) return;
          const v = readGuests(input.value); v[b.dataset.g] += +b.dataset.d;
          input.value = `${v.a},${v.k}`; fire(input); paint();
          if (b.disabled) { const other = $(`[data-g="${b.dataset.g}"]:not(:disabled)`, pop); if (other) other.focus({ preventScroll: true }); }
        };
        paint();
        return () => { const f = $('[data-g="a"][data-d="1"]:not(:disabled)', pop) || $('.kc-done', pop); f.focus({ preventScroll: true }); };
      },
    });
  }

  function enhance(root = document) {
    $$('input[type=date]', root).forEach(enhanceDate);
    $$('select', root).forEach(enhanceSelect);
    $$('.bw input[type=number]', root).forEach(enhanceNumber);
    $$('input[data-guests]', root).forEach(enhanceGuests);
    $$('form', root).forEach(f => { if (f.elements.cin && f.elements.cout) pairUp(f.elements.cin, f.elements.cout); });
    const a = $('#mCin', root), b = $('#mCout', root); if (a && b) pairUp(a, b);
  }
  const repaint = () => { dates.forEach(a => a.paint()); selects.forEach(a => a.paint()); guestFields.forEach(a => a.paint()); };
  window.KCUI = { enhance, repaint, close: () => closePop(false) };
  document.addEventListener('kc:lang', () => { closePop(false); repaint(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance()); else enhance();
})();
