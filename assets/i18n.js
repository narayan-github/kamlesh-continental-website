/* ==========================================================================
   Kamlesh Continental · languages (English, Hindi, Odia)
   The pages are written in English. For another language this script loads a
   dictionary (assets/lang/hi.js or or.js) and swaps each piece of text for its
   translation, including text that other scripts write later. Anything the
   dictionary does not know stays in English, so a missing line never breaks a page.

   Dictionary keys are the English text itself, with:
     <1>…</1>   an inline element (emphasis, a link) that the translation may move
     <1/>       an element kept as it is (for example a "to confirm" tag)
     {0} {1}    numbers, carried over unchanged
     {d0}       a date such as "Wed, 25 Nov", re-written in the chosen language
   Changing language reloads the page, so every page always starts from English.
   ========================================================================== */
(() => {
  'use strict';
  const KC = window.KC; if (!KC) return;
  const LANGS = { en: 'English', hi: 'हिन्दी', or: 'ଓଡ଼ିଆ' };
  const root = document.documentElement, dicts = {};
  const collect = KC.params.get('i18n') === 'collect';       // lists every string on the page, for translators
  let lang = 'en';
  try { lang = KC.params.get('lang') || localStorage.getItem('kc-lang') || 'en'; } catch (e) {}
  if (!LANGS[lang] || collect) lang = 'en';
  try { if (KC.params.get('lang') && !collect) localStorage.setItem('kc-lang', lang); } catch (e) {}   // a link with ?lang= is remembered on the next pages

  const L = /\p{L}/u;
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TOKEN = new RegExp(`(${WD.join('|')}), (\\d{1,2}) (${MO.join('|')})(?:,? (\\d{4}))?|\\d+(?:[.,:]\\d+)*`, 'g');
  const bare = k => k.replace(/\{d?\d+\}|<[^>]+>/g, '');

  // Numbers are shown in the language's own numerals: "₹3,200" reads "₹३,२००" in Hindi and "₹୩,୨୦୦" in Odia.
  // Left as they are: phone numbers (people dial and copy them), email and web addresses, and codes that
  // mix letters and digits such as a GSTIN. Dictionaries keep ordinary digits; the swap happens here.
  const DIGITS = { hi: '०१२३४५६७८९', or: '୦୧୨୩୪୫୬୭୮୯' };
  const PHONE = /\+91[\d ]{8,14}\d|\b0\d{4} ?\d{6}\b|\b\d{5} \d{5}\b|\b\d{10}\b/g;
  function nd(s) {
    const map = DIGITS[lang];
    if (!map || !/\d/.test(s)) return s;
    const keep = [];
    return s.replace(PHONE, m => `\u0001${String.fromCharCode(97 + keep.push(m) - 1)}\u0001`)
      .replace(/\S+/g, tok => (/[A-Za-z]\d|\d[A-Za-z]|@|\.com\b|https?:/.test(tok) ? tok : tok.replace(/\d/g, d => map[d])))
      .replace(/\u0001([a-z])\u0001/g, (m, c) => keep[c.charCodeAt(0) - 97]);
  }

  // "Wed, 25 Nov · 3 nights" -> key "{d0} · {0} nights", plus the values to put back
  function tokenize(src) {
    const dates = [], nums = [];
    const key = src.split(/(<\/?\d+\/?>|<br>)/).map(seg => (/^<.*>$/.test(seg) ? seg : seg.replace(TOKEN, (m, w, d, mo, y) =>
      (w ? `{d${dates.push([WD.indexOf(w), d, MO.indexOf(mo), y]) - 1}}` : `{${nums.push(m) - 1}}`)))).join('');
    return { key, dates, nums };
  }
  function fill(tpl, tok) {
    const d = dicts[lang] || {};
    return tpl.replace(/\{d(\d+)\}/g, (m, i) => { const x = tok.dates[+i]; return x ? `${(d.wd || WD)[x[0]]}, ${x[1]} ${(d.mo || MO)[x[2]]}${x[3] ? ', ' + x[3] : ''}` : m; })
      .replace(/\{(\d+)\}/g, (m, i) => (tok.nums[+i] != null ? tok.nums[+i] : m));
  }
  function lookupOne(src) {
    const d = dicts[lang];
    if (d.strings[src] != null) return d.strings[src];
    const tok = tokenize(src);
    if (tok.key === src) return null;
    if (d.strings[tok.key] != null) return fill(d.strings[tok.key], tok);
    return tok.dates.length && !L.test(bare(tok.key)) ? fill(tok.key, tok) : null;      // only dates and numbers: just localise the dates
  }
  function lookup(src) {
    if (!dicts[lang]) return null;
    const whole = lookupOne(src); if (whole != null) return whole;
    // a list such as "Shaadi, Reception" or "Breakfast · Wi-Fi · Pool": translate it item by item
    for (const sep of [' · ', ', ']) {
      if (!src.includes(sep) || /<\d/.test(src)) continue;
      const parts = src.split(sep).map(p => (L.test(p) ? lookupOne(p) : p));
      if (parts.every(x => x != null)) return parts.join(sep);
    }
    return null;
  }

  /* ---- collecting (for translators): every key seen on this page ---- */
  const seenKeys = new Set(); let marked = 0;
  const seen = src => { if (!collect) return; const k = tokenize(src).key; if (L.test(bare(k))) seenKeys.add(k); };

  /* ---- reading and rewriting one piece of text ---- */
  const INLINE = new Set(['EM', 'I', 'B', 'STRONG', 'A', 'SPAN', 'SMALL', 'SUP', 'SUB', 'U', 'MARK', 'CITE', 'TIME']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'IFRAME', 'CODE']);
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'data-cap'];   // data-cap: the captions of the photo slideshow
  const skip = el => el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || SKIP.has(el.tagName) || el.hasAttribute('data-no-i18n') || el.hasAttribute('lang');
  const hasText = el => { for (const n of el.childNodes) if (n.nodeType === 3 && L.test(n.nodeValue)) return true; return false; };
  const simple = el => INLINE.has(el.tagName) && !el.children.length && !el.classList.contains('tbc') && !skip(el) && el.textContent.trim() !== '';

  function describe(el) {
    const kids = []; let src = '';
    el.childNodes.forEach(c => {
      if (c.nodeType === 3) src += c.nodeValue;
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') { src += '<br>'; return; }
        const n = kids.push({ el: c, simple: simple(c) });
        src += kids[n - 1].simple ? `<${n}>${c.textContent}</${n}>` : `<${n}/>`;
      }
    });
    return { src: norm(src), kids };
  }
  function rebuild(el, kids, tr) {
    const out = [], used = new Set(), re = /<(\d+)>([\s\S]*?)<\/\1>|<(\d+)\/>|<br>/g;
    let last = 0, m;
    while ((m = re.exec(tr))) {
      if (m.index > last) out.push(document.createTextNode(nd(tr.slice(last, m.index))));
      if (m[0] === '<br>') out.push(document.createElement('br'));
      else {
        const k = kids[+(m[1] || m[3]) - 1];
        if (k && !used.has(k)) { used.add(k); if (m[1] && k.simple) k.el.textContent = nd(m[2]); out.push(k.el); }
      }
      last = re.lastIndex;
    }
    if (last < tr.length) out.push(document.createTextNode(nd(tr.slice(last))));
    kids.forEach(k => { if (!used.has(k)) out.push(k.el); });          // never drop an element a translation forgot
    el.replaceChildren(...out);
  }
  function attrs(el) {
    ATTRS.forEach(a => {
      const v = el.getAttribute(a); if (!v || !L.test(v)) return;
      const src = norm(v); seen(src);
      const tr = lang === 'en' ? null : lookup(src);
      if (tr != null && nd(tr) !== v) el.setAttribute(a, nd(tr));
    });
  }
  // Number boxes: a browser only shows ordinary digits in <input type="number">. In Hindi and Odia each one
  // becomes a text box that shows the language's numerals, while scripts keep reading ordinary digits from .value.
  const toLatin = v => String(v).replace(/[०-९]/g, d => d.charCodeAt(0) - 0x966).replace(/[୦-୯]/g, d => d.charCodeAt(0) - 0xB66);
  function localNumber(inp) {
    if (inp.dataset.kcLocal) return;
    inp.dataset.kcLocal = '1';
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'), cur = d.get.call(inp);
    inp.type = 'text'; inp.inputMode = 'numeric';
    Object.defineProperty(inp, 'value', { configurable: true, get() { return toLatin(d.get.call(this)); }, set(v) { d.set.call(this, nd(String(v))); } });
    inp.value = cur;
    inp.addEventListener('input', () => { d.set.call(inp, nd(toLatin(d.get.call(inp)).replace(/\D/g, ''))); }, true);   // typed digits are shown in the language's numerals
  }
  // numbers that stand alone ("₹3,200", "12:00") are not lines to translate, but still get the language's numerals
  function digits(el) {
    if (!DIGITS[lang] || el.closest('a[href^="tel:"]')) return;
    el.childNodes.forEach(n => {
      if (n.nodeType !== 3 || !/\d/.test(n.nodeValue) || /[A-Za-z]{2}/.test(n.nodeValue)) return;
      const v = nd(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v;
    });
  }
  // labels drawn inside a diagram (the map on the business page); the logo is left alone
  function scanSvg(el) {
    const svg = el.tagName === 'svg' ? el : el.closest('svg');
    if (!svg || svg.querySelector('symbol') || svg.closest('[data-no-i18n]')) return;
    svg.querySelectorAll('text').forEach(t => {
      if (t.children.length) return;
      const src = norm(t.textContent); if (!L.test(src)) return;
      seen(src);
      const tr = lang === 'en' ? null : lookup(src);
      if (tr != null && nd(tr) !== t.textContent) t.textContent = nd(tr);
    });
  }
  function scan(el) {
    if (el.nodeType !== 1) return;
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') { scanSvg(el); return; }
    if (skip(el)) return;
    attrs(el);
    if (!hasText(el)) { if (lang !== 'en') digits(el); [...el.children].forEach(scan); return; }
    const { src, kids } = describe(el);
    seen(src);
    const tr = lang === 'en' ? null : lookup(src);
    if (tr != null) rebuild(el, kids, tr);
    else if (lang !== 'en') {                                          // no translation for the whole line: try its parts
      el.childNodes.forEach(n => {
        if (n.nodeType !== 3 || !L.test(n.nodeValue)) return;
        const t = lookup(norm(n.nodeValue)); if (t != null) n.nodeValue = n.nodeValue.replace(/^(\s*)[\s\S]*?(\s*)$/, `$1${nd(t).replace(/\$/g, '$$$$')}$2`);
      });
      kids.forEach(k => { if (k.simple) { const t = lookup(norm(k.el.textContent)); if (t != null) k.el.textContent = nd(t); } });
      digits(el);
    }
    kids.forEach(k => { if (!k.simple) scan(k.el); else attrs(k.el); });
  }

  /* ---- keep translating whatever other scripts write later ---- */
  const mo = new MutationObserver(recs => {
    const todo = new Set();
    recs.forEach(r => {
      let el = r.type === 'characterData' ? r.target.parentElement : r.target;
      if (!el || !el.isConnected) return;
      if (r.type === 'attributes') { if (!el.closest('[data-no-i18n]')) attrs(el); return; }
      if (el.closest('[data-no-i18n]')) return;
      while (el !== document.body && el.parentElement && INLINE.has(el.tagName) && hasText(el.parentElement)) el = el.parentElement;   // part of a longer line
      todo.add(el);
    });
    todo.forEach(el => { for (const o of todo) if (o !== el && o.contains(el)) return; if (el.isConnected) scan(el); });
    mo.takeRecords();                                                  // ignore the changes this script just made
  });
  const watch = () => mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  function apply() {
    root.lang = lang;
    const t = lookup(norm(document.title)); if (t != null) document.title = nd(t);
    if (DIGITS[lang]) document.querySelectorAll('input[type=number]').forEach(localNumber);
    scan(document.body);
    watch();
    document.dispatchEvent(new CustomEvent('kc:lang', { detail: lang }));
    root.classList.remove('kc-i18n-wait');
  }

  /* ---- the language menu in the header ---- */
  function setLang(l) {
    if (!LANGS[l] || l === lang) return;
    try { localStorage.setItem('kc-lang', l); } catch (e) {}
    const u = new URL(location.href);
    if (l === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', l);
    location.assign(u.href);
  }
  function addSwitcher() {
    const cta = document.querySelector('.hdr-cta'); if (!cta) return;
    const wrap = document.createElement('label');
    wrap.className = 'lang'; wrap.setAttribute('data-no-i18n', '');
    wrap.innerHTML = '<span class="sr">Language · भाषा · ଭାଷା</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.800 3 2.800 15 0 18M12 3c-2.800 3-2.800 15 0 18"/></svg>' +
      `<select>${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" lang="${k}"${k === lang ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    cta.prepend(wrap);
    wrap.querySelector('select').addEventListener('change', e => setLang(e.target.value));
    if (window.KCUI) KCUI.enhance(wrap);
  }
  // carry the language to the other pages even where the browser will not remember it (files opened from disk)
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a || lang === 'en') return;
    const href = a.getAttribute('href');
    if (/^(index|weddings|business)\.html/.test(href) && !/[?&]lang=/.test(href)) a.setAttribute('href', href.replace(/^([^?#]*)(\?[^#]*)?/, (m, p, q) => `${p}${q ? q + '&' : '?'}lang=${lang}`));
  }, true);

  const fonts = {
    hi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600&family=Tiro+Devanagari+Hindi&display=swap',
    or: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@400;500;600&family=Noto+Serif+Oriya:wght@400;500&display=swap',
  };

  KC.lang = lang;
  KC.t = s => { const src = norm(String(s)); seen(src); if (lang === 'en') return s; const tr = lookup(src); return nd(tr != null ? tr : String(s)); };
  KC.i18n = {
    langs: LANGS, set: setLang,
    names: () => (lang !== 'en' && dicts[lang]) || null,          // weekday and month names, for the calendar
    digits: s => nd(String(s)),                                    // 12 -> १२ or ୧୨ in the chosen language
    register(code, dict) { dicts[code] = dict; if (code === lang) apply(); },
    catalog: () => [...seenKeys],
    mark() { marked = seenKeys.size; },
    fresh: () => [...seenKeys].slice(marked),
    // lines on this page that the current dictionary does not cover
    missing() { const out = new Set(), was = lang; if (!dicts[was]) return []; const walk = el => { if (el.nodeType !== 1 || skip(el)) return; if (hasText(el)) { const s = describe(el).src; if (/[A-Za-z]{3}/.test(bare(s)) && !/[\u0900-\u097F\u0B00-\u0B7F]/.test(s)) out.add(s); } [...el.children].forEach(walk); }; walk(document.body); return [...out]; },
  };

  addSwitcher();
  if (collect) {
    ['Select a date', 'Close', 'Previous month', 'Next month', '1 night', '2 nights', 'Choose your check-in date', 'Choose your check-out date', 'Choose a date', 'Fewer', 'More', 'Adults', 'Children', 'Under 6 stay free', 'Done', 'Fewer adults', 'More adults', 'Fewer children', 'More children', '1 adult', '2 adults', '1 child', '2 children'].forEach(seen);
    seen(norm(document.title)); scan(document.body); watch();
    setTimeout(() => {                                                 // leave the list in the page so it can be saved from a dump of the DOM
      const s = document.createElement('script'); s.type = 'application/json'; s.id = 'kc-catalog';
      s.textContent = JSON.stringify([...seenKeys]).replace(/</g, '\\u003c');
      document.body.appendChild(s);
    }, 2500);
  } else if (lang !== 'en') {
    root.lang = lang;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = fonts[lang]; document.head.appendChild(link);
    const s = document.createElement('script'); s.src = `assets/lang/${lang}.js?v=10`;
    s.onerror = () => root.classList.remove('kc-i18n-wait');
    document.head.appendChild(s);
  }
})();
