'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolves CLI binaries on Windows the way ShellEnvironment.swift does on macOS:
// search PATH first, then well-known fallback locations. Windows-installed CLIs
// frequently ship as `.cmd` / `.bat` shims (npm) or `.exe`, so we probe each.

const EXE_EXTS = ['.cmd', '.exe', '.bat', '.ps1', ''];

function homedir() {
  return os.homedir();
}

function fallbackDirsFor() {
  const home = homedir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return [
    path.join(appData, 'npm'), // npm global shims
    path.join(home, '.local', 'bin'),
    path.join(home, '.local', 'share', 'claude', 'bin'),
    path.join(home, '.claude', 'local', 'bin'),
    path.join(localAppData, 'Programs'),
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links'),
    path.join(home, 'AppData', 'Local', 'Yarn', 'bin'),
    path.join(home, 'scoop', 'shims'),
    'C:\\Program Files\\nodejs'
  ];
}

// Returns { path, isCmd } or null. isCmd flags shim scripts that must be run via cmd.exe.
function findBinary(name) {
  const pathEnv = process.env.PATH || process.env.Path || '';
  const dirs = pathEnv.split(path.delimiter).filter(Boolean).concat(fallbackDirsFor());

  for (const dir of dirs) {
    for (const ext of EXE_EXTS) {
      const candidate = path.join(dir, name + ext);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          const lower = candidate.toLowerCase();
          const isCmd = lower.endsWith('.cmd') || lower.endsWith('.bat') || lower.endsWith('.ps1');
          return { path: candidate, isCmd };
        }
      } catch (_) { /* ignore */ }
    }
  }
  return null;
}

// Build the spawn target. On Windows, `.cmd`/`.bat` shims can't be exec'd
// directly by CreateProcess, so route them through cmd.exe with an argv array
// (shell:false) — this avoids building a parsed shell string and the injection
// risk that comes with it.
function spawnArgsFor(bin, args) {
  if (bin.isCmd) {
    const comspec = process.env.ComSpec || 'cmd.exe';
    return { command: comspec, args: ['/d', '/s', '/c', bin.path, ...args], options: { windowsVerbatimArguments: false } };
  }
  return { command: bin.path, args, options: {} };
}

// Process environment for spawned CLIs. Mirrors the macOS app: ensure useful
// PATH entries are present and strip Claude Code's nested-session markers so
// spawned CLIs don't refuse to start.
function processEnvironment(extraPaths = []) {
  const env = Object.assign({}, process.env);
  const essential = fallbackDirsFor().concat(extraPaths);
  const current = env.PATH || env.Path || '';
  const have = new Set(current.split(path.delimiter).map((d) => d.toLowerCase()));
  const missing = essential.filter((d) => d && !have.has(d.toLowerCase()));
  if (missing.length) {
    env.PATH = missing.concat(current ? [current] : []).join(path.delimiter);
  }
  env.TERM = 'dumb';
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

module.exports = { findBinary, spawnArgsFor, processEnvironment, homedir };
