// ==UserScript==
// @name         Intention Gate
// @namespace    https://github.com/amirmohsen-am/monkey-scripts
// @version      1.4.0.1
// @description  [DEBUG BUILD — logs to an on-screen badge] Requires a deliberate keypress or tap + an unbroken, focused wait before Reddit, X, Hacker News or the lichess lobby is revealed
// @author       amirmohsen-am
// @match        https://www.reddit.com/
// @match        https://www.reddit.com/?*
// @match        https://reddit.com/
// @match        https://reddit.com/?*
// @match        https://x.com/
// @match        https://x.com/?*
// @match        https://x.com/home
// @match        https://x.com/home?*
// @match        https://www.x.com/
// @match        https://www.x.com/?*
// @match        https://www.x.com/home
// @match        https://www.x.com/home?*
// @match        https://news.ycombinator.com/
// @match        https://news.ycombinator.com/?*
// @match        https://news.ycombinator.com/news
// @match        https://news.ycombinator.com/news?*
// @match        https://lichess.org/
// @match        https://lichess.org/?*
// @run-at       document-start
// @noframes
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/debug-ios-gate/intention-gate.user.js
// @updateURL    https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/debug-ios-gate/intention-gate.user.js
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------ config ------------------------------ */

  const DELAY_SECONDS = 5;                              // wait after confirming, unless a site overrides it
  const EXIT_URL      = 'about:blank';                  // where abort goes with no history
  const ONCE_PER_TAB  = true;                           // false = gate every single load
  const WAITING       = '> opening in';
  const TYPE_MS       = 32;                             // typing speed, ms per character

  // One entry per gated site. `host` is matched with any leading "www."
  // stripped; `paths` lists the feeds worth gating — deep links (a specific
  // post, a profile, a game in progress) are left alone, since the point is to
  // stop aimless opening, not to block the site. `seconds` and `once` override
  // the defaults above for that site, and `via` lists query or hash markers
  // that mean "the site sent me here mid-action". Adding a site here also needs
  // a matching pair of @match lines in the header above.
  const SITES = [
    { id: 'reddit',  host: 'reddit.com',  paths: ['/'],          prompt: '> confirm intent to open reddit' },
    { id: 'x',       host: 'x.com',       paths: ['/', '/home'], prompt: '> confirm intent to open x' },
    // Hacker News serves the front page from both "/" and "/news".
    { id: 'hn',      host: 'news.ycombinator.com', paths: ['/', '/news'], prompt: '> confirm intent to open hacker news' },
    // The lobby is the one lichess page that starts games, and it is worth a
    // longer wait; `once: false` re-gates it on every load, so coming back for
    // another game costs the wait again. lichess-cooldown.user.js holds the
    // post-game "New opponent" button on the round pages.
    //
    // That button does not start a game itself: it sends you to the lobby
    // carrying a pairing instruction — "/?hook_like=<gameId>" for a lobby game,
    // "/#pool/3+2" for a quick pairing — and lichess bounces you into the new
    // game a moment later. `via` lets those hand-offs through, since the wait
    // was already served on the button; gating them only flashed the prompt
    // over a page you never actually see.
    { id: 'lichess', host: 'lichess.org', paths: ['/'],          prompt: '> confirm intent to open lichess',
      via: ['?hook_like=', '#pool/'], seconds: 15, once: false },
    // For test/index.html only. Inert in a real install: no @match covers
    // localhost, so the gate can never fire there via the extension.
    { id: 'test',    host: 'localhost',   paths: ['/'],          prompt: '> confirm intent to open reddit' },
  ];

  /* ------------------------------ debug ------------------------------- */

  // DEBUG BUILD. Every run appends lines to localStorage (survives new tabs,
  // unlike sessionStorage) and shows them in a corner badge. Tap the badge to
  // expand. A load with no lines at all means the script never ran.
  const DBG_KEY = 'intent-gate-debug';
  const DBG_MAX = 80;
  const RUN = Math.random().toString(36).slice(2, 6);
  let dbgHost = null, dbgBody = null, dbgHead = null, dbgOpen = false;

  function dbgNav() {
    try { const n = performance.getEntriesByType('navigation')[0]; return n ? n.type : 'none'; }
    catch (e) { return 'err'; }
  }
  function dbgState() {
    return 'ready=' + document.readyState + ' vis=' + document.visibilityState +
      ' focus=' + document.hasFocus() + (document.prerendering ? ' PRERENDER' : '');
  }
  function dbgAll() {
    try { return JSON.parse(localStorage.getItem(DBG_KEY) || '[]'); } catch (e) { return []; }
  }
  function dbg(event, extra) {
    const line = new Date().toTimeString().slice(0, 8) + ' ' + RUN + ' +' +
      Math.round(performance.now()) + 'ms ' + event + (extra ? ' ' + extra : '') + ' | ' + dbgState();
    const all = dbgAll().concat(line).slice(-DBG_MAX);
    try { localStorage.setItem(DBG_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    try { console.log('[intent-gate]', line); } catch (e) { /* ignore */ }
    dbgRender(all);
  }
  function dbgEnsure() {
    if (dbgHost) return;
    const st = document.createElement('style');
    st.textContent = '#intent-gate-debug { visibility: visible !important; position: fixed !important;' +
      ' left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 2147483647 !important;' +
      ' display: block !important; pointer-events: none !important; }';
    document.documentElement.appendChild(st);
    dbgHost = document.createElement('div');
    dbgHost.id = 'intent-gate-debug';
    const r = dbgHost.attachShadow({ mode: 'closed' });
    r.innerHTML = '<style>' +
      '.b{pointer-events:auto;margin:0 6px max(6px,env(safe-area-inset-bottom));background:#222;color:#ff0;' +
      'font:11px/1.35 ui-monospace,Menlo,monospace;border:1px solid #ff0;border-radius:4px;' +
      'letter-spacing:normal;word-spacing:normal;text-transform:none;text-align:left;font-variant:normal}' +
      '.h{display:flex;gap:8px;align-items:center;padding:6px 8px}.h span{flex:1}' +
      'button{font:inherit;color:#ff0;background:#000;border:1px solid #ff0;padding:4px 8px}' +
      'pre{display:none;margin:0;padding:0 8px 8px;max-height:55vh;overflow:auto;white-space:pre-wrap;word-break:break-all}' +
      '.o pre{display:block}</style>' +
      '<div class="b"><div class="h"><span></span><button class="c">clear</button><button class="t">log</button></div><pre></pre></div>';
    const box = r.querySelector('.b');
    dbgHead = r.querySelector('span');
    dbgBody = r.querySelector('pre');
    r.querySelector('.t').addEventListener('click', function () {
      dbgOpen = !dbgOpen; box.className = dbgOpen ? 'b o' : 'b';
      dbgBody.scrollTop = dbgBody.scrollHeight;
    });
    r.querySelector('.c').addEventListener('click', function () {
      try { localStorage.removeItem(DBG_KEY); } catch (e) { /* ignore */ }
      dbgRender([]);
    });
    document.documentElement.appendChild(dbgHost);
  }
  function dbgRender(all) {
    try {
      dbgEnsure();
      dbgHead.textContent = 'gate dbg · run ' + RUN + ' · ' + all.length + ' lines';
      dbgBody.textContent = all.join('\n');
      dbgBody.scrollTop = dbgBody.scrollHeight;
    } catch (e) { /* ignore */ }
  }

  dbg('start', 'nav=' + dbgNav() + ' url=' + location.pathname + location.search + location.hash +
    ' ref=' + (document.referrer ? document.referrer.slice(0, 40) : 'none') + ' hist=' + history.length +
    ' name=' + (!window.name ? 'empty' : String(window.name).indexOf('intent-gate-tab:') === 0 ? 'tagged' : 'other'));
  ['visibilitychange', 'DOMContentLoaded', 'prerenderingchange'].forEach(function (t) {
    document.addEventListener(t, function () { dbg('ev:' + t); });
  });
  ['focus', 'blur', 'load', 'pagehide'].forEach(function (t) {
    window.addEventListener(t, function () { dbg('ev:' + t); });
  });
  window.addEventListener('pageshow', function (e) { dbg('ev:pageshow', 'persisted=' + e.persisted); });

  /* -------------------------------------------------------------------- */

  // The match patterns already narrow this down, but a query string can slip
  // past them, so resolve the site from the live location instead of trusting
  // them. X also serves the feed from two paths: "/" redirects to "/home"
  // once you are logged in.
  const hostname = location.hostname.replace(/^www\./, '');
  const site = SITES.find(function (s) {
    return s.host === hostname && s.paths.indexOf(location.pathname) !== -1;
  });
  if (!site) { dbg('skip: no site entry for this url'); return; }

  // A `via` marker only passes when the site itself put it there: same-origin
  // navigation carries a referrer, typing the URL by hand does not, so the
  // markers cannot be used as a way in.
  const arrived = location.search + location.hash;
  const handedOver = (site.via || []).some(function (marker) {
    return arrived.indexOf(marker) !== -1;
  });
  if (handedOver && document.referrer.indexOf('https://' + site.host + '/') === 0) { dbg('skip: via hand-off'); return; }

  const PROMPT  = site.prompt;
  const SECONDS = site.seconds || DELAY_SECONDS;
  const ONCE    = site.once === undefined ? ONCE_PER_TAB : site.once;
  // sessionStorage is per-origin, so the id only guards against a site
  // gaining a second entry later. The value is a tab token, not a bare flag —
  // see passed() for why a stored pass alone is not enough.
  const FLAG = 'intent-gate-passed:' + site.id;
  // Declared up here, not down with the helpers: passed() runs on the next
  // line, and a `const` is not readable before its declaration is reached.
  const TAB_TAG = 'intent-gate-tab:';

  dbg('site=' + site.id, 'once=' + ONCE + ' stored=' + (read(FLAG) || 'none') + ' tabTag=' + (tabToken() || 'none'));
  if (ONCE && passed()) { dbg('skip: already passed in this tab', revisit() ? '(reload/back)' : '(token match)'); return; }

  // Page-level CSS does two things only: blank the page, and pin our host
  // element. Everything else lives inside the shadow root, out of reach of
  // the page's own stylesheets — which load after this one and would otherwise
  // win the cascade on shared selectors like `button`.
  const pageStyle = document.createElement('style');
  pageStyle.textContent = `
    html { visibility: hidden !important; overflow: hidden !important; }
    #intent-gate {
      visibility: visible !important;
      position: fixed !important; inset: 0 !important;
      z-index: 2147483647 !important; display: block !important;
      margin: 0 !important; padding: 0 !important; border: 0 !important;
      opacity: 1 !important; transform: none !important; filter: none !important;
    }
  `;
  document.documentElement.appendChild(pageStyle);

  // <body> does not exist yet at document-start, but <html> does.
  const host = document.createElement('div');
  host.id = 'intent-gate';
  const root = host.attachShadow({ mode: 'closed' });

  // Inherited properties (font, color, line-height, letter-spacing) still
  // cross the shadow boundary, so .wrap declares all of them outright.
  root.innerHTML = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      .wrap {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; justify-content: center;
        gap: clamp(18px, 4vh, 26px);
        /* Sized off the viewport so one rule covers a phone and a desktop, and
           kept clear of the notch and the home indicator. env() is 0 without
           viewport-fit=cover, which is the desktop case anyway. */
        padding: max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
                 max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
        overflow-y: auto;              /* a short landscape phone can still reach the buttons */
        background: #000; color: #33ff66;
        font: 400 clamp(17px, 4.6vw, 22px)/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: normal; word-spacing: normal; text-align: left;
        text-transform: none; font-variant: normal;
        transition: opacity .3s ease;
      }
      .msg { min-height: 1.5em; white-space: pre-wrap; overflow-wrap: anywhere; }
      .cur {
        display: inline-block; width: .6ch; height: 1.1em; vertical-align: -.15em;
        background: #33ff66; animation: blink 1s steps(1) infinite;
      }
      @keyframes blink { 50% { opacity: 0; } }
      /* One cell per second, so a 15s bar is ~20 characters: it has to shrink
         with the screen or it runs off the side of a phone. */
      .bar { font-size: clamp(12px, 3.6vw, 20px); letter-spacing: .05em; white-space: pre; }
      .bar:empty { display: none; }
      .row { display: flex; gap: 12px; flex-wrap: wrap; }
      button {
        font: inherit; font-size: 16px; padding: 12px 18px; min-height: 48px;
        background: transparent; color: #33ff66;
        border: 1px solid #145c2a; border-radius: 2px;
        cursor: pointer; appearance: none; -webkit-appearance: none;
        touch-action: manipulation;               /* no double-tap-to-zoom delay */
        -webkit-tap-highlight-color: transparent;
        transition: background .12s ease, border-color .12s ease;
      }
      @media (hover: hover) {
        button:hover:not([disabled]) { background: #0b2b16; border-color: #33ff66; }
      }
      button:active:not([disabled]) { background: #0b2b16; border-color: #33ff66; }
      button:focus-visible { outline: 1px solid #33ff66; outline-offset: 2px; }
      button[disabled] { opacity: .4; cursor: default; }
      .out { color: #2a8f45; }
      .hint { font-size: 13px; color: #1f7a38; }
      /* Touch screens have no keys to press and no Esc to fall back on, so the
         key prefixes come off and the hint points at the button instead. */
      .tap { display: none; }
      @media (pointer: coarse) {
        .key { display: none; }
        .keys { display: none; }
        .tap { display: inline; }
        .row { gap: 10px; }
        button { flex: 1 1 40%; min-height: 54px; }
      }
    </style>
    <div class="wrap">
      <div class="msg"></div>
      <div class="bar"></div>
      <div class="row">
        <button class="go"><span class="key">[y] </span>continue</button>
        <button class="out"><span class="key">[n] </span>abort</button>
      </div>
      <div class="hint"><span class="keys">esc or n to abort</span><span class="tap">tap abort to leave</span></div>
    </div>
  `;
  document.documentElement.appendChild(host);
  if (dbgHost) document.documentElement.appendChild(dbgHost);   // keep the badge above the gate
  dbg('gate shown');

  const wrap = root.querySelector('.wrap');
  const msg  = root.querySelector('.msg');
  const bar  = root.querySelector('.bar');
  const go   = root.querySelector('.go');
  const out  = root.querySelector('.out');

  let typer = null;
  let ticker = null;
  let counting = false;

  type(PROMPT);
  // Nothing here checks that the page has focus first. Only a tap or a
  // keypress starts a wait, and neither reaches a window you are not looking
  // at. document.hasFocus() was the unreliable half of such a check: iOS
  // Safari leaves it false for the first moment after a navigation, while the
  // URL bar still holds focus — which is exactly while the prompt is still
  // typing itself out, so an early tap was swallowed and the gate looked dead.
  // The wait itself is still guarded, by onFocusChange below.
  go.addEventListener('pointerdown', function () { dbg('pointerdown continue'); });
  go.addEventListener('click', function () { dbg('click continue', 'counting=' + counting); startCountdown(); });
  out.addEventListener('click', leave);
  document.addEventListener('keydown', onKey, true);

  // Types the prompt out one character at a time, cursor trailing behind it.
  function type(text) {
    let i = 0;
    clearInterval(typer);
    typer = setInterval(function () {
      i += 1;
      render(text.slice(0, i));
      if (i >= text.length) clearInterval(typer);
    }, TYPE_MS);
  }

  function render(text) {
    msg.textContent = text;
    const cursor = document.createElement('span');
    cursor.className = 'cur';
    msg.appendChild(cursor);
  }

  function startCountdown() {
    if (counting) return;
    counting = true;

    clearInterval(typer);
    render(WAITING);
    // Abort stays live through the whole wait: Esc is the desktop way out, and
    // a phone has no Esc to fall back on. Confirm is only dimmed, never
    // removed — dropping it would slide abort sideways into the finger that
    // just tapped, and the click that follows a tap would land on it.
    go.disabled = true;

    document.addEventListener('visibilitychange', onFocusChange);
    window.addEventListener('blur', onFocusChange);

    // Seconds left come off the clock rather than off a count of ticks, so a
    // throttled or delayed timer still shows the true time remaining and can
    // never shorten the wait. The bar only changes once a second, so a timer
    // is all it needs — a frame loop would redraw the same string 60 times a
    // second to show it.
    const started = performance.now();
    draw(SECONDS);
    ticker = setInterval(function () {
      const left = Math.max(Math.ceil((SECONDS * 1000 - (performance.now() - started)) / 1000), 0);
      draw(left);
      if (left === 0) reveal();
    }, 250);
  }

  // One cell per second, filled off whole seconds left, so the bar ticks in
  // lockstep with the counter beside it.
  function draw(left) {
    bar.textContent = '[' + '#'.repeat(SECONDS - left) + ' '.repeat(left) + '] ' + left + 's';
  }

  function focused() {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  // Leaving the tab or the window voids the wait outright rather than pausing
  // it: the gate goes back to asking, and the next confirmation starts a fresh
  // countdown. Waiting it out somewhere else is the loophole this closes —
  // requestAnimationFrame stops in a hidden tab, but a visible window with the
  // focus elsewhere would otherwise keep counting.
  function onFocusChange(event) {
    dbg('countdown ' + (event && event.type) + ' -> ' + (focused() ? 'kept' : 'CANCELLED'));
    if (focused()) return;
    stopCountdown();
    bar.textContent = '';                        // the bar goes with the wait
    render(PROMPT);                              // whole prompt back at once, not retyped
    go.disabled = false;                         // confirm live again, where it was
  }

  // Leaves the bar alone: reveal() calls this too, and a filled bar should stay
  // put under the fade rather than blink out just before it.
  function stopCountdown() {
    counting = false;
    clearInterval(ticker);
    document.removeEventListener('visibilitychange', onFocusChange);
    window.removeEventListener('blur', onFocusChange);
  }

  // The flag is only set here, at the end of the wait, so bailing out
  // mid-countdown does not buy a free pass on the next visit.
  function reveal() {
    dbg('revealed');
    stopCountdown();
    if (ONCE) write(FLAG, tagTab());
    document.removeEventListener('keydown', onKey, true);

    // Unhide the page first, then fade the gate out over it.
    pageStyle.remove();
    wrap.style.opacity = '0';
    setTimeout(function () { host.remove(); }, 320);
  }

  function leave() {
    dbg('abort');
    if (history.length > 1) history.back();
    else location.replace(EXIT_URL);
  }

  function onKey(event) {
    if (event.key === 'Escape' || (!counting && event.key.toLowerCase() === 'n')) {
      event.preventDefault();
      leave();
      return;
    }
    if (!counting && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      startCountdown();
    }
  }

  // "Once per tab" rests on sessionStorage, which is per-tab everywhere except
  // at the moment a tab is opened from another one: the new tab starts with a
  // *copy* of the opener's whole session storage, all origins included. Safari
  // does this for every link opened in a new tab, which on iOS is most of them
  // — the tab arrived already carrying the pass, so the gate never showed.
  //
  // window.name is the per-tab value that is not copied: a new tab starts with
  // it empty. So the pass is stored as a token that has to match the tag on
  // this tab, and an inherited pass names a tab that is not this one.
  function passed() {
    const token = read(FLAG);
    if (!token) return false;
    // A reload or a back/forward is unambiguously this same tab, and stays
    // passing even where the page has since taken window.name for itself.
    if (revisit()) return true;
    return tabToken() === token;
  }

  function revisit() {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      return !!nav && (nav.type === 'reload' || nav.type === 'back_forward');
    } catch (e) { return false; }
  }

  function tabToken() {
    const name = String(window.name || '');
    return name.indexOf(TAB_TAG) === 0 ? name.slice(TAB_TAG.length) : null;
  }

  // Tagging is best effort: the page may already own window.name, or overwrite
  // ours later. A lost tag only costs one extra gate on the next load in this
  // tab — it can never hand out a free pass.
  function tagTab() {
    const existing = tabToken();
    if (existing) return existing;
    const token = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    if (!window.name) {
      try { window.name = TAB_TAG + token; } catch (e) { /* ignore */ }
    }
    return token;
  }

  // sessionStorage survives reloads, and throws outright under some privacy
  // settings, so neither access is allowed to break the script.
  function read(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function write(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
})();
