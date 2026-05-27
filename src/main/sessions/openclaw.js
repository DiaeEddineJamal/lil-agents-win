'use strict';
const crypto = require('crypto');
const WebSocket = require('ws');
const settings = require('../settings');
const { installInstructions } = require('./providerInfo');

// ---- Ed25519 device identity (matches OpenClawSession.swift DeviceIdentity) ----
// deviceId = sha256 hex of the raw 32-byte public key. Keypair persisted in settings.

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function rawPublicKey(publicKeyObj) {
  const jwk = publicKeyObj.export({ format: 'jwk' });
  return Buffer.from(jwk.x, 'base64url'); // 32 raw bytes
}

function loadOrCreateIdentity() {
  let pem = settings.get('openClawPrivateKeyPem', null);
  let privateKey;
  if (pem) {
    try { privateKey = crypto.createPrivateKey(pem); } catch (_) { privateKey = null; }
  }
  if (!privateKey) {
    const pair = crypto.generateKeyPairSync('ed25519');
    privateKey = pair.privateKey;
    pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    settings.set('openClawPrivateKeyPem', pem);
  }
  const publicKey = crypto.createPublicKey(privateKey);
  const rawPub = rawPublicKey(publicKey);
  const deviceId = crypto.createHash('sha256').update(rawPub).digest('hex');
  return {
    deviceId,
    publicKeyBase64Url: base64url(rawPub),
    sign: (payload) => base64url(crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey)),
    authPayload(clientId, clientMode, role, scopes, signedAtMs, token, nonce) {
      const version = nonce != null ? 'v2' : 'v1';
      const parts = [version, deviceId, clientId, clientMode, role, scopes.join(','), String(signedAtMs), token];
      if (version === 'v2') parts.push(nonce || '');
      return parts.join('|');
    }
  };
}

// ---- Session ----

class OpenClawSession {
  constructor() {
    this.history = [];
    this.isRunning = false;
    this.isBusy = false;
    this.ws = null;
    this.pendingNonce = null;
    this.nextRequestId = 0;
    this.config = settings.openClawConfig();
    this.device = loadOrCreateIdentity();
    this.sessionKey = `${this.config.sessionKeyPrefix}:${crypto.randomUUID().toLowerCase()}`;
    this.onText = this.onError = this.onToolUse = this.onToolResult = null;
    this.onSessionReady = this.onTurnComplete = this.onProcessExit = null;
  }

  emitText(t) { if (this.onText) this.onText(t); }
  emitError(t) { if (this.onError) this.onError(t); }
  push(role, text) { this.history.push({ role, text }); }
  fail(msg) { this.emitError(msg); this.push('error', msg); }

  start() {
    let url;
    try { url = new URL(this.config.gatewayURL); } catch (_) {
      this.fail('Invalid gateway URL: ' + this.config.gatewayURL + '\n\n' + installInstructions('openclaw'));
      return;
    }
    try {
      this.ws = new WebSocket(url.toString());
    } catch (e) {
      this.fail('Failed to connect: ' + e.message); return;
    }
    this.isRunning = true;
    this.ws.on('message', (data) => this.handleFrame(data.toString()));
    this.ws.on('error', (err) => {
      this.isRunning = false; this.isBusy = false;
      this.emitError('Connection lost: ' + err.message);
      if (this.onProcessExit) this.onProcessExit();
    });
    this.ws.on('close', () => {
      this.isRunning = false; this.isBusy = false;
      if (this.onProcessExit) this.onProcessExit();
    });
  }

  send(message) {
    if (!this.isRunning) return;
    this.isBusy = true;
    this.push('user', message);
    const params = { sessionKey: this.sessionKey, message, idempotencyKey: crypto.randomUUID() };
    if (this.config.agentId) params.agentId = this.config.agentId;
    this.sendRequest('chat.send', params);
  }

  terminate() {
    try { if (this.ws) this.ws.close(1000); } catch (_) {}
    this.isRunning = false; this.isBusy = false;
    if (this.onProcessExit) this.onProcessExit();
  }

  sendRequest(method, params) {
    this.nextRequestId += 1;
    const frame = { type: 'req', id: 'lil-' + this.nextRequestId, method, params };
    try { this.ws.send(JSON.stringify(frame)); }
    catch (e) { this.emitError('Send error: ' + e.message); }
  }

  handleFrame(text) {
    let json; try { json = JSON.parse(text); } catch (_) { return; }
    if (json.type === 'event') this.handleEvent(json);
    else if (json.type === 'res') this.handleResponse(json);
  }

  handleEvent(json) {
    const payload = json.payload || {};
    if (json.event === 'connect.challenge') {
      this.pendingNonce = payload.nonce || null;
      this.sendConnectRequest();
    } else if (json.event === 'chat') {
      this.handleChatEvent(payload);
    }
  }

  handleChatEvent(payload) {
    switch (payload.state) {
      case 'delta': {
        const content = payload.message && payload.message.content;
        if (!Array.isArray(content)) return;
        for (const block of content) {
          if (block.type === 'text' && block.text) this.emitText(block.text);
          else if (block.type === 'tool_use') {
            const name = block.name || 'Tool';
            const input = block.input || {};
            this.push('toolUse', `${name}: ${this.toolSummary(name, input)}`);
            if (this.onToolUse) this.onToolUse(name, input);
          } else if (block.type === 'tool_result') {
            const isError = block.is_error === true;
            const summary = String(block.text || '').slice(0, 80);
            this.push('toolResult', isError ? 'ERROR: ' + summary : summary);
            if (this.onToolResult) this.onToolResult(summary, isError);
          }
        }
        break;
      }
      case 'final': {
        this.isBusy = false;
        const content = payload.message && payload.message.content;
        if (Array.isArray(content)) {
          const text = content.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
          if (text) this.push('assistant', text);
        }
        if (this.onTurnComplete) this.onTurnComplete();
        break;
      }
      case 'error': {
        this.isBusy = false;
        this.fail(payload.errorMessage || 'Chat error');
        if (this.onTurnComplete) this.onTurnComplete();
        break;
      }
      case 'aborted':
        this.isBusy = false;
        if (this.onTurnComplete) this.onTurnComplete();
        break;
      default: break;
    }
  }

  handleResponse(json) {
    const ok = json.ok === true;
    const payload = json.payload || {};
    if (ok && payload.type === 'hello-ok') { if (this.onSessionReady) this.onSessionReady(); return; }
    if (!ok) {
      const error = json.error || {};
      const msg = error.message || 'Unknown error';
      const code = error.code || '';
      if (code === 'auth_required' || code === 'auth_failed') {
        this.emitError('Authentication failed. Set your gateway token in OpenClaw settings or via OPENCLAW_GATEWAY_TOKEN.\n\n' + msg);
      } else {
        this.emitError('Gateway error: ' + msg);
      }
    }
  }

  sendConnectRequest() {
    const role = 'operator';
    const scopes = ['operator.read', 'operator.write'];
    const signedAtMs = Date.now();
    const payload = this.device.authPayload('cli', 'cli', role, scopes, signedAtMs, this.config.authToken, this.pendingNonce);
    const signature = this.device.sign(payload);

    const device = {
      id: this.device.deviceId,
      publicKey: this.device.publicKeyBase64Url,
      signature,
      signedAt: signedAtMs
    };
    if (this.pendingNonce) device.nonce = this.pendingNonce;

    const params = {
      minProtocol: 3, maxProtocol: 3,
      client: { id: 'cli', version: '1.0.0', platform: 'windows', mode: 'cli' },
      role, scopes, device
    };
    if (this.config.authToken) params.auth = { token: this.config.authToken };
    this.sendRequest('connect', params);
  }

  toolSummary(name, input) {
    switch (name) {
      case 'Bash': return input.command || '';
      case 'Read': case 'Edit': case 'Write': return input.file_path || '';
      case 'Glob': case 'Grep': return input.pattern || '';
      default: return input.description || Object.keys(input).sort().slice(0, 3).join(', ');
    }
  }
}

module.exports = { OpenClawSession };
