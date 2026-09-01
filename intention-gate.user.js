// ==UserScript==
// @name         Intention Gate
// @namespace    https://github.com/amirmohsen-am/monkey-scripts
// @version      1.3.0
// @description  Requires a deliberate keypress + an unbroken, focused wait before Reddit, X or the lichess lobby is revealed
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
// @match        https://lichess.org/
// @match        https://lichess.org/?*
// @run-at       document-start
// @noframes
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/intention-gate.user.js
// @updateURL    https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/intention-gate.user.js
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
  // the defaults above for that site. Adding a site here also needs a matching
  // pair of @match lines in the header above.
  const SITES = [
    { id: 'reddit',  host: 'reddit.com',  paths: ['/'],          prompt: '> confirm intent to open reddit' },
    { id: 'x',       host: 'x.com',       paths: ['/', '/home'], prompt: '> confirm intent to open x' },
    // The lobby is the one lichess page that starts games, and it is worth a
    // longer wait; `once: false` re-gates it on every load, so coming back for
    // another game costs the wait again. lichess-cooldown.user.js holds the
    // post-game "New opponent" button on the round pages.
    { id: 'lichess', host: 'lichess.org', paths: ['/'],          prompt: '> confirm intent to open lichess',
      seconds: 15, once: false },
    // For test/index.html only. Inert in a real install: no @match covers
    // localhost, so the gate can never fire there via the extension.
    { id: 'test',    host: 'localhost',   paths: ['/'],          prompt: '> confirm intent to open reddit' },
  ];

  /* -------------------------------------------------------------------- */

  // The match patterns already narrow this down, but a query string can slip
  // past them, so resolve the site from the live location instead of trusting
  // them. X also serves the feed from two paths: "/" redirects to "/home"
  // once you are logged in.
  const hostname = location.hostname.replace(/^www\./, '');
  const site = SITES.find(function (s) {
    return s.host === hostname && s.paths.indexOf(location.pathname) !== -1;
  });
  if (!site) return;

  const PROMPT  = site.prompt;
  const SECONDS = site.seconds || DELAY_SECONDS;
  const ONCE    = site.once === undefined ? ONCE_PER_TAB : site.once;
  // sessionStorage is per-origin, so the id only guards against a site
  // gaining a second entry later.
  const FLAG = 'intent-gate-passed:' + site.id;

  if (ONCE && read(FLAG)) return;

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
        gap: 26px; padding: 0 8vw;
        background: #000; color: #33ff66;
        font: 400 22px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: normal; word-spacing: normal; text-align: left;
        text-transform: none; font-variant: normal;
        transition: opacity .3s ease;
      }
      .msg { min-height: 1.5em; white-space: pre-wrap; }
      .cur {
        display: inline-block; width: .6ch; height: 1.1em; vertical-align: -.15em;
        background: #33ff66; animation: blink 1s steps(1) infinite;
      }
      @keyframes blink { 50% { opacity: 0; } }
      .stage:empty { display: none; }
      .bar { font-size: 20px; letter-spacing: .05em; white-space: pre; }
      .row { display: flex; gap: 12px; flex-wrap: wrap; }
      button {
        font: inherit; font-size: 16px; padding: 8px 14px;
        background: transparent; color: #33ff66;
        border: 1px solid #145c2a; border-radius: 2px;
        cursor: pointer; appearance: none; -webkit-appearance: none;
        transition: background .12s ease, border-color .12s ease;
      }
      button:hover { background: #0b2b16; border-color: #33ff66; }
      button:focus-visible { outline: 1px solid #33ff66; outline-offset: 2px; }
      .out { color: #2a8f45; }
      .hint { font-size: 13px; color: #1f7a38; }
    </style>
    <div class="wrap">
      <div class="msg"></div>
      <div class="stage"></div>
      <div class="row">
        <button class="go">[y] continue</button>
        <button class="out">[n] abort</button>
      </div>
      <div class="hint">esc or n to abort</div>
    </div>
  `;
  document.documentElement.appendChild(host);

  const wrap  = root.querySelector('.wrap');
  const msg   = root.querySelector('.msg');
  const stage = root.querySelector('.stage');
  const row   = root.querySelector('.row');

  let typer = null;
  let frame = null;
  let counting = false;

  type(PROMPT);
  root.querySelector('.go').addEventListener('click', startCountdown);
  root.querySelector('.out').addEventListener('click', leave);
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
    // Only a focused wait counts, so a gate confirmed in a background tab
    // cannot start draining before you are actually looking at it.
    if (!focused()) return;
    counting = true;

    clearInterval(typer);
    render(WAITING);
    row.remove();

    const bar = document.createElement('div');
    bar.className = 'bar';
    stage.appendChild(bar);

    document.addEventListener('visibilitychange', onFocusChange);
    window.addEventListener('blur', onFocusChange);

    const started = performance.now();
    frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - started) / (SECONDS * 1000), 1);
      const left = Math.max(Math.ceil(SECONDS - progress * SECONDS), 0);
      // One cell per second, filled off whole seconds elapsed rather than the
      // raw progress, so the bar ticks in lockstep with the counter beside it.
      const filled = SECONDS - left;

      bar.textContent = '[' + '#'.repeat(filled) + ' '.repeat(left) + '] ' + left + 's';

      if (progress < 1) frame = requestAnimationFrame(tick);
      else reveal();
    });
  }

  function focused() {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  // Leaving the tab or the window voids the wait outright rather than pausing
  // it: the gate goes back to asking, and the next confirmation starts a fresh
  // countdown. Waiting it out somewhere else is the loophole this closes —
  // requestAnimationFrame stops in a hidden tab, but a visible window with the
  // focus elsewhere would otherwise keep counting.
  function onFocusChange() {
    if (focused()) return;
    stopCountdown();
    stage.textContent = '';                      // the bar goes with the wait
    render(PROMPT);                              // whole prompt back at once, not retyped
    wrap.insertBefore(row, stage.nextSibling);   // back where the markup put it
  }

  // Leaves the stage alone: reveal() calls this too, and the filled bar should
  // stay put under the fade rather than blink out a frame before it.
  function stopCountdown() {
    counting = false;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', onFocusChange);
    window.removeEventListener('blur', onFocusChange);
  }

  // The flag is only set here, at the end of the wait, so bailing out
  // mid-countdown does not buy a free pass on the next visit.
  function reveal() {
    stopCountdown();
    if (ONCE) write(FLAG, '1');
    document.removeEventListener('keydown', onKey, true);

    // Unhide the page first, then fade the gate out over it.
    pageStyle.remove();
    wrap.style.opacity = '0';
    setTimeout(function () { host.remove(); }, 320);
  }

  function leave() {
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

  // sessionStorage is per-tab and survives reloads: a new tab re-gates, the
  // current one stays quiet. It also throws outright under some privacy
  // settings, so neither access is allowed to break the script.
  function read(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function write(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
})();
