'use strict';
const { BaseSession } = require('./base');
const { findBinary } = require('../shellEnv');
const { installInstructions } = require('./providerInfo');

let cachedBin = null;

// OpenCode: `opencode run <msg> --format json`. Matches OpenCodeSession.swift.
class OpenCodeSession extends BaseSession {
  constructor() { super(); this.currentResponseText = ''; }

  start() {
    if (cachedBin) { this.isRunning = true; this.emitReady(); return; }
    const bin = findBinary('opencode');
    if (!bin) {
      const msg = 'OpenCode CLI not found.\n\n' + installInstructions('opencode');
      this.emitError(msg); this.push('error', msg); return;
    }
    cachedBin = bin; this.isRunning = true; this.emitReady();
  }

  send(message) {
    if (!this.isRunning || !cachedBin) return;
    this.isBusy = true;
    this.currentResponseText = '';
    this.push('user', message);
    this.lineBuffer = '';

    this.proc = this.launch(cachedBin, ['run', message, '--format', 'json'], {
      onStdout: (d) => this.bufferLines(d, (l) => this.parseLine(l)),
      onStderr: (d) => this.emitError(d),
      onExit: () => {
        this.proc = null;
        this.flushBuffer((l) => this.parseLine(l));
        if (this.currentResponseText) this.push('assistant', this.currentResponseText);
        if (this.isBusy) { this.isBusy = false; this.emitTurnComplete(); }
      }
    });
  }

  parseLine(line) {
    let json; try { json = JSON.parse(line); } catch (_) { return; }
    const type = json.type || '';
    switch (type) {
      case 'text': {
        const part = json.part || {};
        if (part.text) { this.currentResponseText += part.text; this.emitText(part.text); }
        break;
      }
      case 'step_start': this.isBusy = true; break;
      case 'step_finish': break;
      case 'result': this.isBusy = false; this.emitTurnComplete(); break;
      case 'assistant.tool_call': {
        const part = json.part || {};
        const toolName = part.name || 'Tool';
        const input = part.arguments || {};
        this.push('toolUse', toolName);
        this.emitToolUse(toolName, input);
        break;
      }
      case 'assistant.tool_result': {
        const part = json.part || {};
        const output = part.result || '';
        const isError = part.status === 'error';
        const summary = String(output).slice(0, 80);
        this.push('toolResult', isError ? 'ERROR: ' + summary : summary);
        this.emitToolResult(summary, isError);
        break;
      }
      default: break;
    }
  }
}

module.exports = { OpenCodeSession };
