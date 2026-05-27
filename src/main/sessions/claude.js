'use strict';
const { BaseSession } = require('./base');
const { findBinary } = require('../shellEnv');
const { installInstructions } = require('./providerInfo');

let cachedBin = null;

// Claude: persistent process speaking NDJSON over stdin/stdout
// (`--output-format stream-json --input-format stream-json`). Same protocol
// the macOS ClaudeSession.swift uses.
class ClaudeSession extends BaseSession {
  constructor() {
    super();
    this.currentResponseText = '';
    this.pending = [];
  }

  start() {
    const bin = cachedBin || findBinary('claude');
    if (!bin) {
      const msg = 'Claude CLI not found.\n\n' + installInstructions('claude');
      this.emitError(msg); this.push('error', msg);
      return;
    }
    cachedBin = bin;

    this.proc = this.launch(bin, [
      '-p',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions'
    ], {
      onStdout: (d) => this.bufferLines(d, (l) => this.parseLine(l)),
      onStderr: (d) => this.emitError(d),
      onExit: () => { this.isRunning = false; this.isBusy = false; this.emitProcessExit(); }
    });

    this.isRunning = true;
    const pending = this.pending; this.pending = [];
    pending.forEach((m) => this.writeMessage(m));
  }

  send(message) {
    if (!this.isRunning || !this.proc) { this.pending.push(message); return; }
    this.writeMessage(message);
  }

  writeMessage(message) {
    this.isBusy = true;
    this.currentResponseText = '';
    this.push('user', message);
    const payload = { type: 'user', message: { role: 'user', content: message } };
    try { this.proc.stdin.write(JSON.stringify(payload) + '\n'); } catch (_) {}
  }

  parseLine(line) {
    let json; try { json = JSON.parse(line); } catch (_) { return; }
    const type = json.type || '';
    switch (type) {
      case 'system':
        if (json.subtype === 'init') this.emitReady();
        break;
      case 'assistant': {
        const content = json.message && json.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              this.currentResponseText += block.text;
              this.emitText(block.text);
            } else if (block.type === 'tool_use') {
              const toolName = block.name || 'Tool';
              const input = block.input || {};
              this.push('toolUse', `${toolName}: ${this.toolSummary(toolName, input)}`);
              this.emitToolUse(toolName, input);
            }
          }
        }
        break;
      }
      case 'user': {
        const content = json.message && json.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result') {
              const isError = block.is_error === true;
              let summary = '';
              const r = json.tool_use_result;
              if (r && typeof r === 'object' && r.type === 'text' && r.file && r.file.filePath) {
                summary = `${r.file.filePath} (${r.file.totalLines || 0} lines)`;
              } else if (typeof r === 'string') {
                summary = r.slice(0, 80);
              }
              if (!summary && typeof block.content === 'string') summary = block.content.slice(0, 80);
              this.push('toolResult', isError ? `ERROR: ${summary}` : summary);
              this.emitToolResult(summary, isError);
            }
          }
        }
        break;
      }
      case 'result': {
        this.isBusy = false;
        let finalText = '';
        if (typeof json.result === 'string' && json.result) finalText = json.result;
        else if (this.currentResponseText) finalText = this.currentResponseText;
        if (finalText) this.push('assistant', finalText);
        this.currentResponseText = '';
        this.emitTurnComplete();
        break;
      }
      default: break;
    }
  }

  toolSummary(toolName, input) {
    switch (toolName) {
      case 'Bash': return input.command || '';
      case 'Read': case 'Edit': case 'Write': return input.file_path || '';
      case 'Glob': case 'Grep': return input.pattern || '';
      default:
        if (input.description) return input.description;
        return Object.keys(input).sort().slice(0, 3).join(', ');
    }
  }

  terminate() {
    try { if (this.proc && this.proc.stdin) this.proc.stdin.end(); } catch (_) {}
    super.terminate();
    this.pending = [];
  }
}

module.exports = { ClaudeSession };
