'use strict';
const { ClaudeSession } = require('./claude');
const { CodexSession } = require('./codex');
const { CopilotSession } = require('./copilot');
const { GeminiSession } = require('./gemini');
const { OpenCodeSession } = require('./opencode');
const { OpenClawSession } = require('./openclaw');
const { PROVIDERS, binaryName } = require('./providerInfo');
const { findBinary } = require('../shellEnv');
const settings = require('../settings');

function createSession(provider) {
  switch (provider) {
    case 'claude': return new ClaudeSession();
    case 'codex': return new CodexSession();
    case 'copilot': return new CopilotSession();
    case 'gemini': return new GeminiSession();
    case 'opencode': return new OpenCodeSession();
    case 'openclaw': return new OpenClawSession();
    default: return new ClaudeSession();
  }
}

// Which providers are usable right now. CLI providers = binary on PATH;
// OpenClaw = an auth token is configured.
function detectAvailability() {
  const result = {};
  for (const p of PROVIDERS) {
    if (p === 'openclaw') {
      result[p] = !!settings.openClawConfig().authToken;
    } else {
      result[p] = !!findBinary(binaryName(p));
    }
  }
  return result;
}

function firstAvailable(availability) {
  for (const p of PROVIDERS) if (availability[p]) return p;
  return 'claude';
}

module.exports = { createSession, detectAvailability, firstAvailable };
