'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// JSON-file-backed key/value store standing in for macOS UserDefaults.
// Holds per-character provider/size, selected theme, sounds toggle, onboarding
// flag, OpenClaw connection settings, and the device keypair.

let cache = null;
let filePath = null;

function file() {
  if (!filePath) filePath = path.join(app.getPath('userData'), 'lil-agents-settings.json');
  return filePath;
}

function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(file(), 'utf8')); }
  catch (_) { cache = {}; }
  return cache;
}

function persist() {
  try { fs.writeFileSync(file(), JSON.stringify(cache, null, 2)); } catch (_) {}
}

function get(key, fallback) {
  const c = load();
  return Object.prototype.hasOwnProperty.call(c, key) ? c[key] : fallback;
}

function set(key, value) {
  load();
  cache[key] = value;
  persist();
}

function remove(key) { load(); delete cache[key]; persist(); }

// OpenClaw config with env-var fallbacks (mirrors OpenClawConfig.load()).
function openClawConfig() {
  const env = process.env;
  let gatewayURL = get('openClawGatewayURL', 'ws://localhost:3001');
  let authToken = get('openClawAuthToken', '');
  const sessionKeyPrefix = get('openClawSessionPrefix', 'lil-agents');
  const agentId = get('openClawAgentId', null);
  if (gatewayURL === 'ws://localhost:3001') {
    gatewayURL = env.OPENCLAW_GATEWAY_URL || env.CLAWDBOT_GATEWAY_URL || gatewayURL;
  }
  if (!authToken) {
    authToken = env.OPENCLAW_GATEWAY_TOKEN || env.CLAWDBOT_GATEWAY_TOKEN || '';
  }
  return { gatewayURL, authToken, sessionKeyPrefix, agentId };
}

function saveOpenClawConfig(c) {
  set('openClawGatewayURL', c.gatewayURL);
  set('openClawAuthToken', c.authToken);
  set('openClawSessionPrefix', c.sessionKeyPrefix);
  if (c.agentId) set('openClawAgentId', c.agentId); else remove('openClawAgentId');
}

module.exports = { get, set, remove, openClawConfig, saveOpenClawConfig };
