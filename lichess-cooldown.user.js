// ==UserScript==
// @name         Lichess Cooldown
// @namespace    https://github.com/amirmohsen-am/monkey-scripts
// @version      1.2.0
// @description  Holds the "New opponent" button for 15 seconds after a game, with the countdown drawn on the button
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

  const DELAY_SECONDS = 15;                         // hold before the button arms
  const SELECTOR      = '.follow-up .new-opponent'; // lichess's post-game button

  /* -------------------------------------------------------------------- */

  const ATTR = 'data-cooldown';

  // The whole state is this one attribute, so releasing the button is just
  // removing it. The seconds are drawn with ::after rather than by rewriting
  // textContent: lichess renders this view with snabbdom, and a child node we
  // add ourselves is something a patch can discard. The attribute appears in
  // neither the old nor the new vnode, so snabbdom's attribute module leaves
  // it alone.
  const style = document.createElement('style');
  style.textContent = `
    .new-opponent[${ATTR}] { pointer-events: none; opacity: .55; }
    .new-opponent[${ATTR}]::after { content: ' (' attr(${ATTR}) ')'; }
  `;
  document.documentElement.appendChild(style);

  const gated = new WeakSet();

  // div.follow-up is inserted whole when the game ends, so only added nodes
  // need looking at — a full-document scan on every mutation would run on each
  // move added to the move list.
  new MutationObserver(function (records) {
    for (let i = 0; i < records.length; i += 1) {
      const added = records[i].addedNodes;
      for (let j = 0; j < added.length; j += 1) {
        const node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.matches(SELECTOR)) hold(node);
        else collect(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Nothing exists yet at document-start; this only matters if @run-at is
  // ever moved later, when the button may already be on the page.
  collect(document);

  // pointer-events blocks the mouse but not Enter or Space on a focused
  // button, which still fire a click. lichess binds its handler on the element
  // itself, so stopping the event here — at document, during capture — means
  // it never reaches that handler.
  document.addEventListener('click', function (event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const button = target.closest(SELECTOR);
    if (button && button.hasAttribute(ATTR)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  function collect(root) {
    const found = root.querySelectorAll(SELECTOR);
    for (let i = 0; i < found.length; i += 1) hold(found[i]);
  }

  function hold(button) {
    if (gated.has(button)) return;
    gated.add(button);

    // Set before the first tick, so the button is never briefly live.
    button.setAttribute(ATTR, String(DELAY_SECONDS));

    const started = performance.now();

    (function step() {
      // Seconds left come from the clock rather than from counting ticks, so
      // a throttled or delayed timer shows the true remaining time and cannot
      // drift the release later than the wait actually is.
      const elapsed = performance.now() - started;
      const left = Math.ceil((DELAY_SECONDS * 1000 - elapsed) / 1000);

      if (left <= 0) {
        button.removeAttribute(ATTR);
        return;
      }
      button.setAttribute(ATTR, String(left));
      setTimeout(step, 1000 - (elapsed % 1000)); // land on the next whole second
    })();
  }
})();
