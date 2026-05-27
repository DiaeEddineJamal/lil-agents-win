'use strict';
const { BaseSession } = require('./base');
const { findBinary, homedir } = require('../shellEnv');
const { installInstructions } = require('./providerInfo');
const path = require('path');

let cachedBin = null;

// GitHub Copilot CLI: `copilot -p <msg> [--continue] --output-format json --allow-all`.
// Falls back to plain-text parsing if the build doesn't emit JSON. Matches CopilotSession.swift.
class CopilotSession extends BaseSession {
  constructor() {
    super();
    this.isFirstTurn = true;
    this.useJsonOutput = true;
  }

  start() {
    if (cachedBin) { this.isRunning = true; this.emitReady(); return; }
    const bin = findBinary('copilot');
    if (!bin) {
      const msg = 'Copilot CLI not found.\n\n' + installInstructions('copilot');
      this.emitError(msg); this.push('error', msg); return;
    }
    cachedBin = bin; this.isRunning = true; this.emitReady();
  }

  send(message) {
    if (!this.isRunning || !cachedBin) return;
    this.isBusy = true;
    this.push('user', message);
    this.lineBuffer = '';

    const args = [];
    if (!this.isFirstTurn) args.push('--continue');
    args.push('-p', message);
    if (this.useJsonOutput) args.push('--output-format', 'json');
    else args.push('-s');
    args.push('--allow-all');

    let collectedPlain = '';
    this.proc = this.launch(cachedBin, args, {
      extraPaths: [path.join(homedir(), '.npm-global', 'bin')],
      onStdout: (d) => {
        if (this.useJsonOutput) this.bufferLines(d, (l) => this.parseLine(l));
        else collectedPlain += d;
      },
      onStderr: (d) => this.emitError(d),
      onExit: () => {
        this.proc = null;
        if (this.useJsonOutput) {
          this.flushBuffer((l) => this.parseLine(l));
        } else {
          const text = collectedPlain.trim();
          if (text) { this.push('assistant', text); this.emitText(text); }
        }
        if (this.isBusy) { this.isBusy = false; this.emitTurnComplete(); }
      }
    });
    this.isFirstTurn = false;
  }

  parseLine(line) {
    let json;
    try { json = JSON.parse(line); }
    catch (_) {
      // First-turn non-JSON output → switch to plain-text mode
      if (this.history.length <= 1) {
        this.useJsonOutput = false;
        const text = line.trim();
        if (text) { this.push('assistant', text); this.emitText(text); }
      }
      return;
    }

    if (json.ephemeral === true) {
      if (json.type === 'assistant.message_delta' && json.data && json.data.deltaContent) {
        this.emitText(json.data.deltaContent);
      }
      return;
    }

    const type = json.type || '';
    const data = json.data || {};
    switch (type) {
      case 'assistant.message': {
        const content = data.content || '';
        if (content) this.push('assistant', content);
        break;
      }
      case 'assistant.turn_end':
      case 'result':
        this.isBusy = false; this.emitTurnComplete(); break;
      case 'assistant.tool_call': {
        const toolName = data.name || data.tool || 'Tool';
        const input = data.input || data.arguments || {};
        const command = input.command || '';
        const displayName = command ? 'Bash' : toolName;
        const summary = command || toolName;
        this.push('toolUse', `${displayName}: ${summary}`);
        this.emitToolUse(displayName, input);
        break;
      }
      case 'assistant.tool_result': {
        const output = data.output || data.result || '';
        const isError = data.is_error === true || data.status === 'error';
        const summary = String(output).slice(0, 80);
        this.push('toolResult', isError ? 'ERROR: ' + summary : summary);
        this.emitToolResult(summary, isError);
        break;
      }
      case 'error': {
        const msg = data.message || data.error || 'Unknown error';
        this.emitError(msg); this.push('error', msg);
        break;
      }
      default: break;
    }
  }
}

module.exports = { CopilotSession };
