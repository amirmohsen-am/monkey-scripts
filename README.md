# monkey-scripts

Personal userscripts — small tweaks to sites I use, run by
[Tampermonkey](https://www.tampermonkey.net/) (Chrome/desktop) or
[Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) /
[Stay](https://apps.apple.com/us/app/stay-userscript-extension/id1591620171) (iOS Safari).

## Scripts

| Script | What it does | Install |
|---|---|---|
| `intention-gate.user.js` | Covers the **Reddit homepage**, the **X feed** (`x.com/` and `x.com/home`) and the **lichess lobby** (`lichess.org/`) before they render, with a terminal-style prompt. Requires `y` (or clicking continue), then a wait before revealing the page — 5 seconds for Reddit and X, 15 for lichess; `n` or Esc aborts. Once per tab for Reddit and X; lichess re-gates on every load, except the lobby it only passes through on its way into a game. Leaving the tab or the window mid-countdown cancels it back to the prompt. | [install](https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/intention-gate.user.js) |
| `lichess-cooldown.user.js` | Holds lichess's **New opponent** button after a game ends: it arrives dimmed, reading `(15)`, and the first click on it is swallowed and starts the countdown. Only 15 unbroken, focused seconds arm it — leaving the tab or the window cancels the wait, and coming back means clicking again. Rematch and Analysis board are left alone. | [install](https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/lichess-cooldown.user.js) |

## Installing

1. Install Tampermonkey from the Chrome Web Store.
2. Go to `chrome://extensions`, enable **Developer mode**, open Tampermonkey's
   **Details**, and turn on **"Allow user scripts"** (required under Manifest V3).
   Toggle the extension off and on if it doesn't take effect.
3. Click an install link above. If the install page hangs, use Tampermonkey
   **Dashboard → Utilities → Install from URL** instead.

Every script carries `@updateURL`, so pushing a commit with a bumped `@version`
updates it automatically on every device within Tampermonkey's check interval
(or immediately via its dashboard → *Check for userscript updates*).

## Changing a script

Each script starts with a `config` block — delays, copy, and toggles live there,
so the common tweaks need no code reading. For example, in `intention-gate.user.js`:

```js
const DELAY_SECONDS = 5;                              // wait after confirming, unless a site overrides it
const EXIT_URL      = 'about:blank';                  // where abort goes with no history
const ONCE_PER_TAB  = true;                           // false = gate every single load
const TYPE_MS       = 32;                             // typing speed, ms per character
```

The gated sites live in the same block, one entry each:

```js
const SITES = [
  { id: 'reddit',  host: 'reddit.com',  paths: ['/'],          prompt: '> confirm intent to open reddit' },
  { id: 'x',       host: 'x.com',       paths: ['/', '/home'], prompt: '> confirm intent to open x' },
  { id: 'lichess', host: 'lichess.org', paths: ['/'],          prompt: '> confirm intent to open lichess',
    via: ['?hook_like=', '#pool/'], seconds: 15, once: false },
];
```

`host` is matched with any leading `www.` stripped, and `paths` lists the feeds
worth gating — deep links (a post, a profile, a game in progress) are
deliberately left alone. `seconds` and `once` override the two defaults above
for that site: lichess waits 15 seconds and re-gates on every load, so coming
back to the lobby for another game costs the wait again. `via` lists query or
hash markers that mean the site itself sent you mid-action — lichess's **New
opponent** button hands you to the lobby as `/?hook_like=<gameId>` or
`/#pool/3+2` and bounces you into the next game, and that wait was already
served on the button. A marker only passes with a same-site referrer, so typing
one by hand is still gated. Adding a site needs a
matching pair of `@match` lines in the header too, or the script never runs
there in the first place.

And in `lichess-cooldown.user.js`:

```js
const DELAY_SECONDS   = 15;                         // hold before the button arms
const BUTTON_SELECTOR = '.follow-up .new-opponent'; // lichess's post-game button
```

## Developing

- **`test/`** — two mock pages, served together:

  ```sh
  python3 -m http.server 8765 -d test
  ```

  - `/` (`index.html`) — isolation test for the gate. Applies deliberately
    hostile CSS of the kind Reddit uses, so a broken gate is obvious. It must be
    served at path `/` on `localhost`, which `SITES` carries an entry for. That
    entry is inert in a real install — no `@match` covers localhost, so the
    extension never runs the script there.
  - `/lichess.html` — stands in for a lichess round page. Injects the follow-up
    buttons *after* load, so the cooldown's MutationObserver path is exercised
    rather than just the initial scan, and can fake a framework re-render
    mid-countdown.

  Both pages carry a **focus rule** check: start a countdown, then switch tab or
  click another window. Neither countdown may survive that — the gate drops back
  to its prompt, the button freezes back at `(15)`, and only a fresh
  confirmation starts a new wait.

Fastest edit loop is Tampermonkey's built-in editor: paste the script body in,
save, reload. When it's right, copy it back into the repo file, bump
`@version`, and push. Keep only one copy installed — a dev copy in the editor
*and* the copy installed from the raw URL will both fire.

## Conventions

- Plain JS, `@grant none`, no `@require` — so the same file runs unmodified
  under Tampermonkey, Violentmonkey, and the iOS Safari managers.
- UI a script *owns* renders inside a **shadow root**. Page stylesheets load
  after the script and would otherwise override shared selectors like `button`.
  Restyling a site's *own* element is the exception — that needs a page
  stylesheet, scoped tightly to that element (see `lichess-cooldown.user.js`,
  which keeps all its state in one `data-cooldown` attribute, so releasing the
  button is just removing it).
- A wait only counts while `document.visibilityState === 'visible' &&
  document.hasFocus()`. Both scripts cancel outright on
  `visibilitychange`/`blur` rather than pausing, since a wait you can serve in
  another tab is not a wait at all.
- Bump `@version` on every push, or nothing auto-updates.
