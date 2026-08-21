# monkey-scripts

Personal userscripts — small tweaks to sites I use, run by
[Tampermonkey](https://www.tampermonkey.net/) (Chrome/desktop) or
[Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) / 
[Stay](https://apps.apple.com/us/app/stay-userscript-extension/id1591620171) (iOS Safari).

## Scripts

| Script | What it does | Install |
|---|---|---|
| `reddit-delay.user.js` | Covers the Reddit **homepage** before it renders. Requires clicking "Continue", then waits 5 seconds before revealing the page. Once per tab — reloads and in-tab navigation stay quiet, a new tab re-gates. | [install](https://raw.githubusercontent.com/amirmohsen-am/monkey-scripts/main/reddit-delay.user.js) |

## Installing

1. Install Tampermonkey from the Chrome Web Store.
2. Go to `chrome://extensions`, open Tampermonkey's **Details**, and enable
   **"Allow user scripts"** (required under Manifest V3).
3. Click an install link above — Tampermonkey shows an install prompt.

Every script carries `@updateURL`, so pushing a commit with a bumped `@version`
updates it automatically on every device within Tampermonkey's check interval
(or immediately via its dashboard → *Check for userscript updates*).

## Changing a script

Each script starts with a `config` block — delays, messages, and toggles live
there, so the common tweaks need no code reading. For example, in
`reddit-delay.user.js`:

```js
const DELAY_SECONDS = 5;                                // wait after clicking Continue
const EXIT_URL      = 'about:blank';                    // where "Nope" goes with no history
const ONCE_PER_TAB  = true;                             // false = gate every single load
const MESSAGE       = 'Do you actually want to be here?';
```

## Developing

Fastest loop is Tampermonkey's built-in editor: paste the script body in, save,
reload the page. When it's right, copy it back into the repo file, bump
`@version`, and push.

Keep only one copy installed — a dev copy in the editor *and* the copy installed
from the raw URL will both fire.

## Conventions

- Plain JS, `@grant none`, no `@require` — so the same file runs unmodified
  under Tampermonkey, Violentmonkey, and the iOS Safari managers.
- Bump `@version` on every push, or nothing auto-updates.
