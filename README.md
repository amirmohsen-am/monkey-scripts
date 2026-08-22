# monkey-scripts

Personal userscripts — small tweaks to sites I use, run by
[Tampermonkey](https://www.tampermonkey.net/) (Chrome/desktop) or
[Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) /
[Stay](https://apps.apple.com/us/app/stay-userscript-extension/id1591620171) (iOS Safari).

## Scripts

| Script | What it does | Install |
|---|---|---|
| `intention-gate.user.js` | Covers the **Reddit homepage** and the **X feed** (`x.com/` and `x.com/home`) before they render, with a terminal-style prompt. Requires `y` (or clicking continue), then waits 5 seconds before revealing the page; `n` or Esc aborts. Once per tab, per site — reloads and in-tab navigation stay quiet, a new tab re-gates. | [install](https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/intention-gate.user.js) |
| `lichess-cooldown.user.js` | Holds lichess's **New opponent** button for 5 seconds after a game ends, dimming it and drawing the countdown on the button itself with a fill that drains as the timer runs. Rematch and Analysis board are left alone. | [install](https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/lichess-cooldown.user.js) |

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
const DELAY_SECONDS = 5;                              // wait after confirming
const EXIT_URL      = 'about:blank';                  // where abort goes with no history
const ONCE_PER_TAB  = true;                           // false = gate every single load
const TYPE_MS       = 32;                             // typing speed, ms per character
```

The gated sites live in the same block, one entry each:

```js
const SITES = [
  { id: 'reddit', host: 'reddit.com', paths: ['/'],          prompt: '> confirm intent to open reddit' },
  { id: 'x',      host: 'x.com',      paths: ['/', '/home'], prompt: '> confirm intent to open x' },
];
```

`host` is matched with any leading `www.` stripped, and `paths` lists the feeds
worth gating — deep links (a post, a profile) are deliberately left alone.
Adding a site needs a matching pair of `@match` lines in the header too, or the
script never runs there in the first place.

And in `lichess-cooldown.user.js`:

```js
const DELAY_SECONDS = 5;                          // hold before the button arms
const SELECTOR      = '.follow-up .new-opponent'; // lichess's post-game button
const SHOW_FILL     = true;                       // false = countdown number only
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
  which drives everything off one `data-cooldown` attribute so releasing the
  button is just removing it).
- Bump `@version` on every push, or nothing auto-updates.
