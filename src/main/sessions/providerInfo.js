'use strict';
// Shared provider metadata (display names, binary names, install help).
// Mirrors AgentProvider in AgentSession.swift, adapted for Windows install paths.

const PROVIDERS = ['claude', 'codex', 'copilot', 'gemini', 'opencode', 'openclaw'];

const DISPLAY = {
  claude: 'Claude', codex: 'Codex', copilot: 'Copilot',
  gemini: 'Gemini', opencode: 'OpenCode', openclaw: 'OpenClaw'
};

const BINARY = {
  claude: 'claude', codex: 'codex', copilot: 'copilot',
  gemini: 'gemini', opencode: 'opencode', openclaw: 'openclaw'
};

const INSTALL = {
  claude: 'To install, run in PowerShell:\n  irm https://claude.ai/install.ps1 | iex\n\nOr: npm install -g @anthropic-ai/claude-code\nOr download from https://claude.ai/download',
  codex: 'To install, run:\n  npm install -g @openai/codex',
  copilot: 'To install, run:\n  npm install -g @github/copilot-cli',
  gemini: 'To install, run:\n  npm install -g @google/gemini-cli\n\nThen authenticate:\n  gemini auth',
  opencode: 'To install, run in PowerShell:\n  irm https://opencode.ai/install.ps1 | iex',
  openclaw: 'OpenClaw is a self-hosted AI gateway.\n\nInstall: npm install -g openclaw\nStart:   openclaw gateway run\n\nDocs: https://docs.openclaw.ai'
};

function displayName(p) { return DISPLAY[p] || p; }
function binaryName(p) { return BINARY[p] || p; }
function installInstructions(p) { return INSTALL[p] || ''; }

// Title styled per theme format (matches TitleFormat in PopoverTheme.swift).
function titleString(provider, format) {
  const name = displayName(provider);
  if (format === 'uppercase') return name.toUpperCase();
  if (format === 'lowercaseTilde') return name.toLowerCase();
  return name; // capitalized
}

module.exports = { PROVIDERS, displayName, binaryName, installInstructions, titleString };
