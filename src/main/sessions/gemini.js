'use strict';
const { BaseSession } = require('./base');
const { findBinary, homedir } = require('../shellEnv');
const { installInstructions } = require('./providerInfo');
const path = require('path');

let cachedBin = null;

// Gemini CLI: `gemini --yolo -p <msg>`, `--resume latest` for follow-ups.
// Tolerates JSONL or plain-text output. Matches GeminiSession.swift.
class GeminiSession extends BaseSession {
  constructor() {
    super();
    this.isFirstTurn = true;
    this.currentResponseText = '';
    this.didReceiveJsonLine = false;
  }

  start() {
    if (cachedBin) { this.isRunning = true; this.emitReady(); return; }
    const bin = findBinary('gemini');
    if (!bin) {
      const msg = 'Gemini CLI not found.\n\n' + installInstructions('gemini');
      this.emitError(msg); this.push('error', msg); return;
    }
    cachedBin = bin; this.isRunning = true; this.emitReady();
  }

  send(message) {
    if (!this.isRunning || !cachedBin) return;
    this.isBusy = true;
    this.currentResponseText = '';
    this.didReceiveJsonLine = false;
    this.push('user', message);
    this.lineBuffer = '';

    const args = this.isFirstTurn
      ? ['--yolo', '-p', message]
      : ['--yolo', '--resume', 'latest', '-p', message];

    let collected = '';
    this.proc = this.launch(cachedBin, args, {
      extraPaths: [path.join(homedir(), '.npm-global', 'bin'), path.join(homedir(), '.local', 'bin')],
      onStdout: (d) => { collected += d; this.processOutput(d); },
      onStderr: (d) => {
        const trimmed = d.trim();
        const noise = /^[✓→◆⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(trimmed) || trimmed === '';
        const keytar = d.includes('Keychain initialization encountered an error');
        if (!noise && !keytar) this.emitError(d);
      },
      onExit: () => {
        this.proc = null;
        this.flushBuffer((l) => this.parseLine(l));
        const text = collected.trim();
        if (text && this.isBusy) {
          const alreadyStreamed = this.history.length && this.history[this.history.length - 1].role === 'assistant';
          if (!alreadyStreamed && !this.currentResponseText) {
            this.push('assistant', text); this.emitText(text);
          }
        }
        if (this.currentResponseText && (!this.history.length || this.history[this.history.length - 1].role !== 'assistant')) {
          this.push('assistant', this.currentResponseText);
        }
        if (this.isBusy) { this.isBusy = false; this.emitTurnComplete(); }
      }
    });
    this.isFirstTurn = false;
  }

  processOutput(text) { this.bufferLines(text, (l) => this.parseLine(l)); }

  parseLine(line) {
    let json = null;
    try { json = JSON.parse(line); } catch (_) {}
    if (json && typeof json === 'object') { this.didReceiveJsonLine = true; this.handleJsonEvent(json); return; }
    if (!this.didReceiveJsonLine) {
      const t = line + '\n';
      this.currentResponseText += t;
      this.emitText(t);
    }
  }

  handleJsonEvent(json) {
    const type = json.type || json.event || '';
    const data = json.data || json;
    switch (type) {
      case 'content': case 'text': case 'delta': case 'message': {
        const text = data.text || data.content || json.text || '';
        if (text) {
          if (json.role === 'assistant' && typeof json.content === 'string') {
            const isDelta = json.delta === true;
            if (isDelta) { this.currentResponseText += json.content; this.emitText(json.content); }
            else if (!this.currentResponseText) { this.currentResponseText = json.content; this.emitText(json.content); }
          } else { this.emitText(text); }
        }
        break;
      }
      case 'tool_call': case 'function_call': case 'tool_use': {
        const toolName = data.name || json.tool_name || 'Tool';
        if (toolName === 'activate_skill') return;
        const input = data.input || data.arguments || json.parameters || {};
        this.push('toolUse', `${toolName}: ${this.toolSummary(toolName, input)}`);
        this.emitToolUse(toolName, input);
        break;
      }
      case 'tool_result': case 'function_result': {
        const output = data.output || data.result || json.output || '';
        const isError = data.is_error === true || json.status === 'error';
        const summary = String(output).slice(0, 80);
        this.push('toolResult', isError ? 'ERROR: ' + summary : summary);
        this.emitToolResult(summary, isError);
        break;
      }
      case 'done': case 'end': case 'complete': case 'turn_end': case 'result': {
        if (this.isBusy) {
          this.isBusy = false;
          const result = json.result || data.text;
          if (result) this.push('assistant', result);
          else if (this.currentResponseText) this.push('assistant', this.currentResponseText);
          this.emitTurnComplete();
        }
        break;
      }
      case 'error': {
        const msg = data.message || data.error || 'Unknown Gemini error';
        this.emitError(msg); this.push('error', msg);
        break;
      }
      default: {
        const text = json.text || json.content || '';
        if (text) { this.currentResponseText += text; this.emitText(text); }
      }
    }
  }

  toolSummary(toolName, params) {
    switch (toolName) {
      case 'run_shell_command': return params.command || '';
      case 'read_file': return params.file_path || '';
      case 'replace': case 'write_file': return params.file_path || '';
      case 'glob': return params.pattern || '';
      case 'grep_search': return params.pattern || '';
      default: return Object.keys(params).sort().slice(0, 3).join(', ');
    }
  }
}

module.exports = { GeminiSession };
