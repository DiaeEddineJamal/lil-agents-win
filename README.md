<div align="center">

# lil agents — Windows Edition

### Tiny AI companions that live on your Windows taskbar.

**Bruce** and **Jazz** stroll along your taskbar while you work. Click one to open a beautiful, themed AI chat — powered by the coding CLI you already use. They walk, they think, they vibe, and they let you know the moment your agent is done.

[![Latest release](https://img.shields.io/github/v/release/DiaeEddineJamal/lil-agents-win?color=ff6fa3&label=download&style=for-the-badge)](https://github.com/DiaeEddineJamal/lil-agents-win/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/DiaeEddineJamal/lil-agents-win/total?color=ff6fa3&style=for-the-badge)](https://github.com/DiaeEddineJamal/lil-agents-win/releases)
[![Platform](https://img.shields.io/badge/Windows-10%20%7C%2011-0a7bdc?style=for-the-badge&logo=windows)](#download)
[![Arch](https://img.shields.io/badge/x64%20%7C%20ARM64-blueviolet?style=for-the-badge)](#download)
[![License](https://img.shields.io/badge/license-MIT-2ea44f?style=for-the-badge)](./LICENSE)

### [Download for Windows »](https://github.com/DiaeEddineJamal/lil-agents-win/releases/latest)

</div>

---

## Why you'll love it

Your AI coding assistant shouldn't be buried in a terminal tab. **lil agents — Windows Edition** turns it into a couple of charming characters that live right on your desktop:

- **Always there, never in the way** — Bruce and Jazz walk along the top of your taskbar with smooth, hand-tuned animation, and clicks pass straight through to your taskbar everywhere except on the characters themselves.
- **One click to chat** — tap a character to open a gorgeous popover terminal with live streaming, Markdown, tool-call summaries, and handy slash commands (`/clear`, `/copy`, `/help`).
- **Use the AI you already pay for** — Claude Code, OpenAI Codex, GitHub Copilot, Google Gemini, OpenCode, or a self-hosted OpenClaw gateway. Switch any time from the title bar or tray.
- **Made to feel like yours** — four hand-crafted themes (Peach, Midnight, Cloud, Moss), three character sizes, optional completion sounds, and multi-monitor support.
- **Quietly delightful** — playful "thinking" bubbles while your agent works, and a friendly chime when it's finished.
- **Private by design** — everything runs locally. No account, no telemetry, no chat data leaves your machine.

> This **Windows Edition** is a from-scratch, native-feeling rebuild on Electron that faithfully preserves the original characters, animations, sounds, and themes — re-engineered for the Windows taskbar. It is a community port of the macOS original by Ryan Stephen (see [Credits & Legal](#credits--legal)).

---

## Download

Grab the latest installer — no account, no setup wizard headaches, installs in seconds (per-user, no admin required).

| | Installer | Best for |
|---|-----------|----------|
| **Recommended** | [**lil-agents-1.2.2-setup.exe**](https://github.com/DiaeEddineJamal/lil-agents-win/releases/download/v1.2.2/lil-agents-1.2.2-setup.exe) | **Any Windows PC** — auto-installs the right build (x64 + ARM64) |
| | [lil-agents-1.2.2-x64-setup.exe](https://github.com/DiaeEddineJamal/lil-agents-win/releases/download/v1.2.2/lil-agents-1.2.2-x64-setup.exe) | Intel / AMD machines |
| | [lil-agents-1.2.2-arm64-setup.exe](https://github.com/DiaeEddineJamal/lil-agents-win/releases/download/v1.2.2/lil-agents-1.2.2-arm64-setup.exe) | Windows on ARM (Snapdragon, etc.) |

See all versions on the [**Releases**](https://github.com/DiaeEddineJamal/lil-agents-win/releases) page.

> **First launch:** Windows SmartScreen may show *"Windows protected your PC"* because the app isn't yet signed with a commercial certificate. Click **More info → Run anyway** — it's safe, open-source, and you can read every line here. (A CA-signed build is on the roadmap.)

### After installing

Bruce and Jazz appear on your taskbar. Click one to start chatting. Right-click the **tray icon** for characters, provider, theme, size, sounds, and display options.

To chat, you'll need at least one supported AI CLI on your machine:

| Provider | Install (PowerShell) |
|----------|----------------------|
| Claude Code | `irm https://claude.ai/install.ps1 \| iex` &nbsp;·&nbsp; or `npm i -g @anthropic-ai/claude-code` |
| OpenAI Codex | `npm i -g @openai/codex` |
| GitHub Copilot | `npm i -g @github/copilot-cli` |
| Google Gemini | `npm i -g @google/gemini-cli` |
| OpenCode | `irm https://opencode.ai/install.ps1 \| iex` |
| OpenClaw | Self-hosted gateway — configure in *tray → Provider → Advanced Settings…* |

The app finds CLIs on your `PATH` (plus common npm/scoop/winget locations) and shows friendly install hints in-app if one is missing.

---

## Features at a glance

| | |
|---|---|
| **Characters** | Bruce & Jazz, original art and walk-cycle animation, 3 sizes |
| **Chat** | Themed terminal popover · streaming · Markdown · tool-use/result lines · slash commands |
| **Providers** | Claude · Codex · Copilot · Gemini · OpenCode · OpenClaw |
| **Themes** | Peach · Midnight · Cloud · Moss |
| **Extras** | Thinking bubbles · completion sounds · tray menu · multi-monitor · first-run onboarding |
| **Privacy** | 100% local · no account · no telemetry |
| **Requirements** | Windows 10/11 (x64 or ARM64) |

---

## For developers

Built with **Electron** + vanilla JS — no heavy framework, no build step for the app itself.

### Run from source

```powershell
git clone https://github.com/DiaeEddineJamal/lil-agents-win.git
cd lil-agents-win
npm install
npm start
```

### Build the installers

```powershell
npm run dist          # both architectures (x64 + arm64)
npm run dist:x64      # x64 only
npm run dist:arm64    # arm64 only
```

Output lands in `dist/`. Building ARM64 from an x64 machine works out of the box — the app is pure JavaScript, so electron-builder simply downloads the per-arch Electron runtime.

### Code signing

Signing is wired through electron-builder's standard environment variables, so a signed build just needs a certificate.

```powershell
# Test build (self-signed — verifies signing works locally)
npm run cert
$env:CSC_LINK = "build/lil-agents-cert.pfx"; $env:CSC_KEY_PASSWORD = "lilagents"
npm run dist

# Production build (trusted) — use an OV/EV cert from a CA (DigiCert, Sectigo, …)
$env:CSC_LINK = "C:\path\to\your-cert.pfx"; $env:CSC_KEY_PASSWORD = "<password>"
npm run dist
```

EV certificates clear SmartScreen immediately; OV certificates build reputation over time. No code changes required.

### How it works

The macOS original is AppKit + `AVPlayerLayer` + `CVDisplayLink`. This port keeps the same architecture, mapped onto Electron:

| macOS (AppKit) | Windows (Electron) |
|----------------|--------------------|
| Transparent `NSWindow` above the Dock | One transparent, always-on-top overlay spanning the taskbar strip |
| `AVPlayerLayer` transparent HEVC video | `<canvas>` drawing transparent **sprite-sheet** frames |
| `CVDisplayLink` tick loop | `requestAnimationFrame` loop |
| Dock geometry from `com.apple.dock` | Taskbar geometry from Electron's `screen` work-area vs bounds |
| Per-pixel alpha hit-test (`CGWindowListCreateImage`) | `setIgnoreMouseEvents(forward)` + canvas alpha sampling |
| `NSStatusItem` menu bar | `Tray` context menu |
| `Process` + pipes for CLIs | `child_process.spawn` + line-buffered parsing |
| `URLSessionWebSocketTask` + CryptoKit (OpenClaw) | `ws` + Node `crypto` (Ed25519) |
| `UserDefaults` | JSON file in `userData` |

**Transparent animation pipeline.** The original `.mov` files are HEVC with an alpha channel, which Chromium can't play (and WebM/VP9 alpha proved unreliable). Each video is therefore rendered to a transparent PNG sprite sheet with ffmpeg:

```bash
ffmpeg -i walk-bruce-01.mov -vf "scale=225:400,tile=16x16" -frames:v 1 walk-bruce-sheet.png
```

That's 241 frames @ 24 fps in a 16×16 grid (225×400 each). The renderer steps through them on a canvas, reproducing the walk cycle with the same acceleration/deceleration easing ported from `WalkerCharacter.movementPosition`.

**Click-through hit-testing.** The overlay covers the whole bottom strip but lets clicks reach the taskbar everywhere except on a character or open popover — the renderer samples the character's rendered pixel alpha on each mouse move and toggles window interactivity, matching the macOS pixel hit-test.

### Project structure

```
lil-agents-win/
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
│     ├─ overlay.html / .js     # controller + tick loop + hit-testing
│     ├─ walker.js              # character animation, physics, popover, bubbles
│     ├─ terminal.js            # themed transcript + input + slash commands
│     ├─ markdown.js            # Markdown → DOM renderer
│     ├─ theme.js               # the 4 theme presets
│     ├─ settings.html / .js    # OpenClaw connection dialog
│     └─ styles.css
├─ build/                       # installer art + signing helpers
│  ├─ gen-art.py                # generates the Peach-themed installer art
│  ├─ installer.nsh             # NSIS customizations (per-user install)
│  ├─ installerSidebar.bmp      # welcome/finish artwork
│  ├─ installerHeader.bmp       # inner-page header
│  └─ make-selfsigned-cert.ps1  # test certificate helper
├─ package.json                 # app + electron-builder config
└─ dist/                        # built installers (generated)
```

The installer follows the app's **Peach** identity: a soft peach gradient, the `lil agents` wordmark in brand pink (`#D95973`), Bruce and Jazz on a taskbar-style ground band with a "hi!" bubble, and a matching header on every page. Run `npm run art` to regenerate it.

---

## Credits & Legal

This Windows Edition stands on the shoulders of a wonderful original. Please support and star the upstream project.

**Original project**
- **lil agents** (macOS) by **Ryan Stephen** — <https://github.com/ryanstephen/lil-agents> · <https://lilagents.xyz>
- Copyright © 2026 Ryan Stephen. Licensed under the MIT License.
- The characters, their names (**Bruce** and **Jazz**), the walk-cycle animations, sound effects, app icon, the **"lil agents"** name, and the overall concept and visual identity all originate from that project and remain the work of its original author.

**This repository (Windows Edition)**
- A Windows port by **[DiaeEddineJamal](https://github.com/DiaeEddineJamal)**, created as a derivative work under the MIT License.
- New here: the Electron application shell, Windows taskbar integration, the sprite-sheet animation pipeline, the provider session layer, and the Windows installer. Original art and audio are reused unmodified (videos are re-encoded frame-for-frame to sprite sheets solely for Windows playback).
- This is an **unofficial, community-maintained** project. It is **not affiliated with, sponsored by, or endorsed by** Ryan Stephen or the original lil agents project. The "lil agents" name is used only to identify the upstream project this port derives from (nominative use).

**License**
- Both the original work and this port are distributed under the **MIT License** — see [LICENSE](./LICENSE). The original copyright notice is retained as the license requires.
- Provided **"as is", without warranty of any kind**. You install and run it at your own risk.

**Third-party AI CLIs**
- Claude Code, OpenAI Codex, GitHub Copilot, Google Gemini, OpenCode, and OpenClaw are independent products of their respective owners. This app only launches the CLI you choose — it does not bundle, redistribute, or modify them, and your use of each is governed by that provider's own terms and privacy policy.

**Reporting / takedown**
- If you are the original author and have any concern about this port or its distribution, please [open an issue](https://github.com/DiaeEddineJamal/lil-agents-win/issues) and it will be addressed promptly.

<div align="center">

Made with care for the Windows community · Original by [Ryan Stephen](https://github.com/ryanstephen/lil-agents)

</div>
