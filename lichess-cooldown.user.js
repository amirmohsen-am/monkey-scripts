// ==UserScript==
// @name         Lichess Cooldown
// @namespace    https://github.com/amirmohsen-am/monkey-scripts
// @version      1.1.0
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
  const SHOW_FILL     = true;                       // false = countdown number only

  /* -------------------------------------------------------------------- */

  const ATTR = 'data-cooldown';
  const FILL = '--cooldown-fill';

  // Everything visual hangs off the data attribute, so releasing the button is
  // just removing it. The label is drawn with ::after rather than by rewriting
  // textContent: lichess renders this view with snabbdom, and a child node we
  // add ourselves is something a patch can discard. The attribute and the
  // custom property appear in neither the old nor the new vnode, so snabbdom's
  // attribute and style modules leave them alone.
  const style = document.createElement('style');
  style.textContent = `
    .new-opponent[${ATTR}] {
      pointer-events: none;
      opacity: .55;
      /* Flat grey first, so a browser without color-mix still shows a bar. */
      background-image: linear-gradient(to right,
        rgba(128, 128, 128, .35) var(${FILL}, 0%), transparent 0);
      background-image: linear-gradient(to right,
        color-mix(in srgb, currentColor 22%, transparent) var(${FILL}, 0%), transparent 0);
    }
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

    // Set before the first frame, so the button is never briefly live.
    button.setAttribute(ATTR, String(DELAY_SECONDS));

    const started = performance.now();
    let shown = null;

    requestAnimationFrame(function tick(now) {
      // Elapsed time comes from the clock, not from counting frames. A
      // backgrounded tab stops painting, and on return this computes the real
      // elapsed time and finishes rather than owing the full wait again.
      const progress = Math.min((now - started) / (DELAY_SECONDS * 1000), 1);
      const left = Math.max(Math.ceil(DELAY_SECONDS - progress * DELAY_SECONDS), 0);

      if (left !== shown) {
        shown = left;
        button.setAttribute(ATTR, String(left));
      }
      if (SHOW_FILL) {
        button.style.setProperty(FILL, (100 - progress * 100).toFixed(2) + '%');
      }

      if (progress < 1) requestAnimationFrame(tick);
      else release(button);
    });
  }

  function release(button) {
    button.removeAttribute(ATTR);
    button.style.removeProperty(FILL);
  }
})();
