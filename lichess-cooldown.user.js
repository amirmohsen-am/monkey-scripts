// ==UserScript==
// @name         Lichess Cooldown
// @namespace    https://github.com/amirmohsen-am/monkey-scripts
// @version      1.3.0
// @description  Swallows the first click on "New opponent" and arms it only after 15 unbroken, focused seconds
// @author       amirmohsen-am
// @match        https://lichess.org/*
// @run-at       document-start
// @noframes
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/lichess-cooldown.user.js
// @updateURL    https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/lichess-cooldown.user.js
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------ config ------------------------------ */

  const DELAY_SECONDS   = 15;                              // hold before the button arms
  const BUTTON_SELECTOR = '.follow-up .new-opponent';      // lichess's post-game button

  /* -------------------------------------------------------------------- */

  const ATTR = 'data-cooldown';

  // The button holds like this: the first click is swallowed and starts the
  // wait, and only DELAY_SECONDS of unbroken, focused time arms it. Leaving the
  // tab or the window cancels outright rather than rewinding, so coming back
  // means clicking again.
  //
  // The whole state is this one attribute, so releasing the button is just
  // removing it. The seconds are drawn with ::after rather than by
  // rewriting textContent: lichess renders this view with snabbdom, and a child
  // node we add ourselves is something a patch can discard. The attribute
  // appears in neither the old nor the new vnode, so snabbdom's attribute
  // module leaves it alone.
  //
  // Dimming is all the stylesheet does. pointer-events: none would swallow the
  // click too well — the event would retarget to .follow-up, closest() would no
  // longer find the button, and the click that is meant to *start* the wait
  // would never be seen. The capture-phase guard below blocks mouse and
  // keyboard alike, so it is the only thing that needs to.
  const style = document.createElement('style');
  style.textContent = `
    .new-opponent[${ATTR}]        { opacity: .55; }
    .new-opponent[${ATTR}]::after { content: ' (' attr(${ATTR}) ')'; }
  `;
  document.documentElement.appendChild(style);

  // Resting state is the absence of an entry, so a follow-up panel lichess
  // re-creates comes back gated for free.
  const buttons = new WeakMap();  // button -> { state, timer }

  // div.follow-up is inserted whole when the game ends, so only added nodes
  // need looking at — a full-document scan on every mutation would run on each
  // move added to the move list.
  new MutationObserver(function (records) {
    for (let i = 0; i < records.length; i += 1) {
      const added = records[i].addedNodes;
      for (let j = 0; j < added.length; j += 1) {
        const node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.matches(BUTTON_SELECTOR)) freeze(node);
        else collect(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Nothing exists yet at document-start; this only matters if @run-at is
  // ever moved later, when the button may already be on the page.
  collect(document);

  function collect(root) {
    const found = root.querySelectorAll(BUTTON_SELECTOR);
    for (let i = 0; i < found.length; i += 1) freeze(found[i]);
  }

  // The button arrives already dimmed and reading (15), so it is visibly
  // gated the moment the game ends, and the number sits still until clicked.
  function freeze(button) {
    if (buttons.has(button)) return;
    buttons.set(button, { state: 'frozen', timer: null });
    button.setAttribute(ATTR, String(DELAY_SECONDS));
  }

  function startButton(button) {
    const entry = buttons.get(button);
    entry.state = 'counting';
    entry.timer = countdown(
      function paint(left) {
        if (!button.isConnected) return false;
        button.setAttribute(ATTR, String(left));
        return true;
      },
      function done() {
        entry.state = 'armed';
        entry.timer = null;
        button.removeAttribute(ATTR);
      },
      function cancel() {
        entry.state = 'frozen';
        entry.timer = null;
        button.setAttribute(ATTR, String(DELAY_SECONDS));
      }
    );
  }

  /* ------------------------------ guard ------------------------------- */

  // lichess binds its handler on the button itself, so stopping the event here
  // — at document, during capture — means it never reaches that handler. Enter
  // or Space on the focused button synthesises a click of its own, which this
  // same listener catches, so the keyboard needs no separate guard.
  document.addEventListener('click', function (event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    const button = target.closest(BUTTON_SELECTOR);
    if (!button) return;

    const entry = buttons.get(button);
    if (!entry || entry.state === 'armed') return;

    event.preventDefault();
    event.stopPropagation();
    // A click while it is already counting neither restarts nor shortens it.
    if (entry.state === 'frozen' && focused()) startButton(button);
  }, true);

  /* ---------------------------- countdown ----------------------------- */

  function focused() {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  // paint(left) draws one second and returns false if its element is gone;
  // done() releases the button; cancel() voids the wait. Returns a handle
  // whose stop() every exit path goes through, so no timer or listener
  // outlives the button it was started for.
  function countdown(paint, done, cancel) {
    const started = performance.now();
    let timer = null;

    const handle = {
      stop: function () {
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', onFocusChange);
        window.removeEventListener('blur', onFocusChange);
      }
    };

    if (!paint(DELAY_SECONDS)) {
      handle.stop();
      return handle;
    }

    document.addEventListener('visibilitychange', onFocusChange);
    window.addEventListener('blur', onFocusChange);
    timer = setTimeout(step, 1000);
    return handle;

    // Losing focus voids the wait here and now, not at the next tick: a flick
    // to another window lasting less than a second still has to cost the full
    // hold, and a background tab's timers are throttled to a second at best.
    function onFocusChange() {
      if (focused()) return;
      handle.stop();
      cancel();
    }

    function step() {
      // Seconds left come from the clock rather than from counting ticks, so
      // a throttled or delayed timer shows the true remaining time and cannot
      // drift the release later than the wait actually is.
      const elapsed = performance.now() - started;
      const left = Math.ceil((DELAY_SECONDS * 1000 - elapsed) / 1000);

      if (left <= 0) {
        handle.stop();
        done();
        return;
      }
      if (!paint(left)) {
        handle.stop();
        return;
      }
      timer = setTimeout(step, 1000 - (elapsed % 1000)); // land on the next whole second
    }
  }
})();
