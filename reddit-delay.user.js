// ==UserScript==
// @name         Reddit Intention Gate
// @namespace    https://github.com/amirmohsen-am/monkey-scripts
// @version      1.0.0
// @description  Requires a deliberate click + 5s wait before the Reddit homepage is revealed
// @author       amirmohsen-am
// @match        https://www.reddit.com/
// @match        https://www.reddit.com/?*
// @match        https://reddit.com/
// @match        https://reddit.com/?*
// @run-at       document-start
// @noframes
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/reddit-delay.user.js
// @updateURL    https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/reddit-delay.user.js
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------ config ------------------------------ */

  const DELAY_SECONDS = 5;                                // wait after clicking Continue
  const EXIT_URL      = 'about:blank';                    // where "Nope" goes with no history
  const ONCE_PER_TAB  = true;                             // false = gate every single load
  const MESSAGE       = 'Do you actually want to be here?';
  const WAIT_MESSAGE  = 'Hold on.';

  /* -------------------------------------------------------------------- */

  const FLAG = 'rd-gate-passed';

  // Homepage only. The match patterns already narrow this down, but a query
  // string can slip past them, so check the path directly.
  if (location.pathname !== '/') return;
  if (ONCE_PER_TAB && read(FLAG)) return;

  // The page is hidden by making <html> invisible and the overlay visible
  // again. visibility is inherited, so this blanks everything underneath
  // without touching the DOM, and cleanup is just dropping this one element.
  const style = document.createElement('style');
  style.textContent = `
    html { visibility: hidden !important; overflow: hidden !important; }
    #rd-gate, #rd-gate * { visibility: visible !important; }

    #rd-gate {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 28px;
      background: #0f0f0f; color: #ededed;
      font: 400 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #rd-gate .rd-msg {
      font-size: 26px; font-weight: 500; letter-spacing: -0.01em;
      text-align: center; padding: 0 24px; margin: 0;
    }
    #rd-gate .rd-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
    #rd-gate button {
      font: inherit; font-size: 15px; padding: 11px 22px;
      border: 1px solid transparent; border-radius: 8px; cursor: pointer;
      transition: opacity .15s ease, color .15s ease, border-color .15s ease;
    }
    #rd-gate .rd-go { background: #ededed; color: #0f0f0f; font-weight: 500; }
    #rd-gate .rd-go:hover { opacity: .85; }
    #rd-gate .rd-out { background: transparent; color: #8a8a8a; border-color: #2e2e2e; }
    #rd-gate .rd-out:hover { color: #ededed; border-color: #4a4a4a; }
    #rd-gate .rd-count {
      font-size: 88px; font-weight: 200; line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    #rd-gate .rd-hint { font-size: 13px; color: #6a6a6a; }
  `;
  document.documentElement.appendChild(style);

  // <body> does not exist yet at document-start, but <html> does.
  const gate = document.createElement('div');
  gate.id = 'rd-gate';

  const msg = document.createElement('div');
  msg.className = 'rd-msg';
  msg.textContent = MESSAGE;

  const row = document.createElement('div');
  row.className = 'rd-row';

  const go = document.createElement('button');
  go.className = 'rd-go';
  go.textContent = 'Continue to Reddit';

  const out = document.createElement('button');
  out.className = 'rd-out';
  out.textContent = 'Nope, take me back';

  const hint = document.createElement('div');
  hint.className = 'rd-hint';
  hint.textContent = 'Esc to leave';

  row.append(go, out);
  gate.append(msg, row, hint);
  document.documentElement.appendChild(gate);

  go.addEventListener('click', startCountdown);
  out.addEventListener('click', leave);
  document.addEventListener('keydown', onKey, true);

  function startCountdown() {
    let left = DELAY_SECONDS;

    msg.textContent = WAIT_MESSAGE;
    row.remove();

    const count = document.createElement('div');
    count.className = 'rd-count';
    count.textContent = left;
    gate.insertBefore(count, hint);

    const timer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        reveal();
        return;
      }
      count.textContent = left;
    }, 1000);
  }

  // The flag is only set here, at the end of the wait, so bailing out
  // mid-countdown does not buy a free pass on the next visit.
  function reveal() {
    if (ONCE_PER_TAB) write(FLAG, '1');
    document.removeEventListener('keydown', onKey, true);
    gate.remove();
    style.remove();
  }

  function leave() {
    if (history.length > 1) history.back();
    else location.replace(EXIT_URL);
  }

  function onKey(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    leave();
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
