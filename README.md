# lil agents — Windows Edition

> Tiny AI companions that live on your **Windows taskbar**.

**Bruce** and **Jazz** walk back and forth above your taskbar. Click one to open a themed AI terminal. They walk, they think, they vibe — and they wait for your prompt while you work.

This is a full, native-feeling Windows port of the original macOS app (AppKit + AVFoundation), rebuilt on **Electron** so it keeps the exact same animations, assets, themes, sounds, and behavior.

> **Unofficial community port.** This is a fork / Windows port of [**lil agents**](https://github.com/ryanstephen/lil-agents) — the original macOS app by **Ryan Stephen** ([lilagents.xyz](https://lilagents.xyz)). It is an independent community contribution, **not affiliated with or endorsed by** the original author. Distributed under the MIT License; see [Credits & Legal](#credits--legal).

---

## Highlights

- **Same characters, same animation** — the original transparent HEVC walk-cycle videos, re-rendered frame-for-frame as transparent sprite sheets.
- **Lives on the taskbar** — a transparent, always-on-top overlay; the characters stroll along the bottom of your screen with the original easing/physics.
- **Click to chat** — a themed popover terminal with Markdown rendering, streaming responses, tool-use/result lines, and slash commands.
- **Six AI providers** — Claude, Codex, Copilot, Gemini, OpenCode (local CLIs) and OpenClaw (self-hosted gateway over WebSocket).
- **Four themes** — Peach, Midnight, Cloud, Moss.
- **Thinking bubbles + completion sounds** — playful phrases while your agent works, a chime when it's done.
- **System tray menu** — toggle characters, sounds, provider, size, theme, and target display.
- **First-run onboarding** — a friendly "hi!" and a welcome popover.

---

## Requirements

- Windows 10/11 (x64 or ARM64).
- At least one supported CLI installed (for local providers):

| Provider | Install |
|----------|---------|
| Claude Code | `irm https://claude.ai/install.ps1 \| iex` &nbsp;or&nbsp; `npm i -g @anthropic-ai/claude-code` |
| OpenAI Codex | `npm i -g @openai/codex` |
| GitHub Copilot | `npm i -g @github/copilot-cli` |
| Google Gemini | `npm i -g @google/gemini-cli` |
| OpenCode | `irm https://opencode.ai/install.ps1 \| iex` |
| OpenClaw | self-hosted gateway — configure via the tray's *Provider → Advanced Settings…* |

The app discovers CLIs on your `PATH` plus common npm/scoop/winget locations, and gracefully shows install instructions inside the popover if a provider isn't found.

---

## Install

Grab an installer from `dist/` and run it:

| Installer | For |
|-----------|-----|
| `lil-agents-<version>-setup.exe` | **Universal** — installs the correct build for any PC |
| `lil-agents-<version>-x64-setup.exe` | Intel / AMD (x64) |
| `lil-agents-<version>-arm64-setup.exe` | ARM64 Windows |

The installer is a friendly assisted flow (welcome → choose folder → finish), installs per-user (no admin prompt), and creates Desktop + Start-menu shortcuts. The app then runs in the background with a tray icon — right-click it for all options.

> **SmartScreen note:** unless built with a CA-issued certificate, Windows may show *"Windows protected your PC."* Click **More info → Run anyway**. See [Code signing](#code-signing) to remove this.

---

## Run from source

```powershell
cd windows-version
npm install
npm start
```

---

## Build the installers

```powershell
npm run dist          # both architectures (x64 + arm64)
npm run dist:x64      # x64 only
npm run dist:arm64    # arm64 only
```

Output lands in `dist/`. Building ARM64 from an x64 machine works out of the box (the app is pure JavaScript; electron-builder downloads the per-arch Electron runtime).

---

## Code signing

Signing is **wired up** through electron-builder's standard environment variables, so a signed build is a matter of supplying a certificate.

### Test build (self-signed)

```powershell
npm run cert                       # creates build\lil-agents-cert.pfx (password: lilagents)
$env:CSC_LINK = "build/lil-agents-cert.pfx"
$env:CSC_KEY_PASSWORD = "lilagents"
npm run dist
```

This produces a **signed** installer (publisher shown, integrity verified). A self-signed certificate is *not* trusted by SmartScreen on other machines — it's for local verification that signing works.

### Production build (trusted)

Obtain an **OV or EV code-signing certificate** from a CA (DigiCert, Sectigo, etc.). EV certificates clear SmartScreen immediately; OV certificates build reputation over time. Then:

```powershell
$env:CSC_LINK = "C:\path\to\your-cert.pfx"
$env:CSC_KEY_PASSWORD = "<your-password>"
npm run dist
```

electron-builder signs every executable and the installer, timestamps them, and the SmartScreen warning disappears. No code changes required.

---

## How it works

The macOS app is AppKit + `AVPlayerLayer` + `CVDisplayLink`. The Windows port keeps the same architecture, mapped onto Electron:

| macOS (AppKit) | Windows (Electron) |
|----------------|--------------------|
| Borderless transparent `NSWindow` above the Dock | One transparent, always-on-top overlay window spanning the taskbar strip |
| `AVPlayerLayer` transparent HEVC video | `<canvas>` drawing transparent **sprite-sheet** frames |
| `CVDisplayLink` tick loop | `requestAnimationFrame` loop |
| Dock geometry from `com.apple.dock` | Taskbar geometry from Electron's `screen` work-area vs bounds |
| Per-pixel alpha hit-test via `CGWindowListCreateImage` | `setIgnoreMouseEvents(forward)` + canvas alpha sampling |
| `NSStatusItem` menu bar | `Tray` context menu |
| `Process` + pipes for CLIs | `child_process.spawn` + line-buffered parsing |
| `URLSessionWebSocketTask` + CryptoKit (OpenClaw) | `ws` + Node `crypto` (Ed25519) |
| `UserDefaults` | JSON file in `userData` |

### Transparent animation pipeline

The original `.mov` files use HEVC with an alpha channel. Chromium can't play HEVC-alpha, and VP9/WebM alpha proved unreliable, so each video is rendered to a **transparent PNG sprite sheet** with ffmpeg:

```bash
ffmpeg -i walk-bruce-01.mov -vf "scale=225:400,tile=16x16" -frames:v 1 walk-bruce-sheet.png
```

That's 241 frames @ 24 fps laid out in a 16×16 grid (225×400 per frame). The renderer steps through frames on a canvas to reproduce the walk cycle exactly, with the same acceleration/deceleration easing ported from `WalkerCharacter.movementPosition`.

### Click-through hit-testing

The overlay covers the whole bottom strip but must let clicks pass through to the taskbar everywhere except on a character or open popover. The window runs in forwarded click-through mode; on every mouse move the renderer samples the character's rendered pixel alpha (and checks popover bounds) and toggles interactivity accordingly — the same "only the character is clickable" behavior as the macOS pixel hit-test.

---

## Project structure

```
windows-version/
├─ assets/
│  ├─ walk-bruce-sheet.png      # transparent sprite sheets (16×16, 241 frames)
│  ├─ walk-jazz-sheet.png
│  ├─ sounds/                   # completion chimes (mp3/m4a)
│  ├─ icon.png / icon.ico       # app icon
│  └─ tray.png                  # tray icon
├─ src/
│  ├─ main/                     # Electron main process
│  │  ├─ main.js                # windows, tray menu, geometry, IPC
│  │  ├─ preload.js             # context-isolated IPC bridge
│  │  ├─ shellEnv.js            # CLI discovery on Windows PATH
│  │  ├─ settings.js            # UserDefaults-equivalent JSON store
│  │  └─ sessions/              # one module per AI provider
│  └─ renderer/                 # UI (runs in the overlay window)
│     ├─ overlay.html/.js       # controller + tick loop + hit-testing
│     ├─ walker.js              # character animation, physics, popover, bubbles
│     ├─ terminal.js            # themed transcript + input + slash commands
│     ├─ markdown.js            # Markdown → DOM renderer
│     ├─ theme.js               # the 4 theme presets
│     ├─ settings.html/.js      # OpenClaw connection dialog
│     └─ styles.css
├─ build/                       # installer art + signing helpers
│  ├─ gen-art.py                # generates the Peach-themed installer art
│  ├─ installerSidebar.bmp      # welcome/finish artwork
│  ├─ installerHeader.bmp       # inner-page header
│  └─ make-selfsigned-cert.ps1  # test certificate helper
├─ package.json                 # app + electron-builder config
└─ dist/                        # built installers (generated)
```

---

## Installer design

The installer follows the app's **Peach** visual identity: a soft peach gradient, the `lil agents` wordmark in the brand pink (`#D95973`), Bruce and Jazz standing on a taskbar-style ground band with a "hi!" speech bubble, and a matching header on every page. Artwork is generated by `build/gen-art.py` (run `npm run art` to regenerate).

---

## Privacy

lil agents runs entirely on your machine and sends no personal data anywhere. Conversations are handled by the local CLI (or your own OpenClaw gateway) that you choose. No accounts, no analytics.

---

## Credits & Legal

**Original project**
- **lil agents** (macOS) by **Ryan Stephen** — https://github.com/ryanstephen/lil-agents · https://lilagents.xyz
- Copyright © 2026 Ryan Stephen. Licensed under the MIT License.
- The character designs, names (**Bruce** and **Jazz**), walk-cycle animations, sound effects, app icon, the **"lil agents"** name, and the overall concept and visual identity all originate from that project and remain the work of its original author.

**This repository (Windows Edition)**
- A Windows port by **DiaeEddineJamal**, created as a derivative work under the terms of the MIT License.
- New in this port: the Electron application shell, Windows taskbar integration, sprite-sheet animation pipeline, provider session layer, and the Windows installer. The original art and audio assets are reused unmodified (the videos are re-encoded frame-for-frame to sprite sheets purely for Windows playback).
- This is an **unofficial, community-maintained** project. It is **not affiliated with, sponsored by, or endorsed by** Ryan Stephen or the original lil agents project. Any "lil agents" naming is used solely to identify the upstream project this port is derived from (nominative use).

**License**
- Both the original work and this port are distributed under the **MIT License** — see [LICENSE](./LICENSE). The original copyright notice is retained as the license requires.
- Provided **"as is", without warranty of any kind**. You install and run it at your own risk.

**Third-party AI CLIs**
- Claude Code, OpenAI Codex, GitHub Copilot, Google Gemini, OpenCode, and OpenClaw are independent products of their respective owners. This app only launches the CLI you choose; it does not bundle, redistribute, or modify them, and your use of each is governed by that provider's own terms and privacy policy.

**Reporting / takedown**
- If you are the original author and have any concern about this port or its distribution, please open an issue on this repository and it will be addressed promptly.
