'use strict';
const { BaseSession } = require('./base');
const { findBinary, homedir } = require('../shellEnv');
const { installInstructions } = require('./providerInfo');
const path = require('path');

let cachedBin = null;

// Codex: one-shot `codex exec --json` per turn. Conversation context is
// rebuilt into the prompt (resume/--last not available). Matches CodexSession.swift.
class CodexSession extends BaseSession {
  start() {
    if (cachedBin) { this.isRunning = true; this.emitReady(); return; }
    const bin = findBinary('codex');
    if (!bin) {
      const msg = 'Codex CLI not found.\n\n' + installInstructions('codex');
      this.emitError(msg); this.push('error', msg); return;
    }
    cachedBin = bin; this.isRunning = true; this.emitReady();
  }

  send(message) {
    if (!this.isRunning || !cachedBin) return;
    this.isBusy = true;
    const prior = this.history.slice();
    this.push('user', message);
    this.lineBuffer = '';
    const prompt = CodexSession.execPrompt(prior, message);

    this.proc = this.launch(cachedBin,
      ['exec', '--json', '--full-auto', '--skip-git-repo-check', prompt],
      {
        extraPaths: [path.join(homedir(), '.npm-global', 'bin')],
        onStdout: (d) => this.bufferLines(d, (l) => this.parseLine(l)),
        onStderr: (d) => this.emitError(d),
        onExit: () => {
          this.proc = null;
          this.flushBuffer((l) => this.parseLine(l));
          if (this.isBusy) { this.isBusy = false; this.emitTurnComplete(); }
        }
      });
  }

  static execPrompt(prior, latest) {
    if (!prior.length) return latest;
    const parts = prior.map((m) => {
      switch (m.role) {
        case 'user': return 'User: ' + m.text;
        case 'assistant': return 'Assistant: ' + m.text;
        case 'toolUse': return 'Tool: ' + m.text;
        case 'toolResult': return 'Tool result: ' + m.text;
        case 'error': return 'Error: ' + m.text;
        default: return m.text;
      }
    });
    return 'Conversation so far (for context; respond only to the follow-up):\n\n' +
      parts.join('\n\n') + '\n\n---\n\nUser (follow-up): ' + latest;
  }

  parseLine(line) {
    let json; try { json = JSON.parse(line); } catch (_) { return; }
    const type = json.type || '';
    switch (type) {
      case 'item.started': {
        const item = json.item || {};
        if (item.type === 'command_execution') {
          const command = item.command || '';
          this.push('toolUse', 'Bash: ' + command);
          this.emitToolUse('Bash', { command });
        }
        break;
      }
      case 'item.completed': {
        const item = json.item || {};
        if (item.type === 'agent_message') {
          const text = item.text || '';
          if (text) { this.push('assistant', text); this.emitText(text); }
        } else if (item.type === 'command_execution') {
          const status = item.status || '';
          const command = item.command || '';
          const isError = status === 'failed';
          const summary = command ? command.slice(0, 80) : status;
          this.push('toolResult', isError ? 'ERROR: ' + summary : summary);
          this.emitToolResult(summary, isError);
        } else if (item.type === 'file_change') {
          const p = item.file || item.path || 'file';
          this.push('toolUse', 'FileChange: ' + p);
          this.emitToolUse('FileChange', { file_path: p });
          this.push('toolResult', p);
          this.emitToolResult(p, false);
        }
        break;
      }
      case 'turn.completed':
        this.isBusy = false; this.emitTurnComplete(); break;
      case 'turn.failed': {
        this.isBusy = false;
        const msg = json.message || 'Turn failed';
        this.emitError(msg); this.push('error', msg); this.emitTurnComplete();
        break;
      }
      case 'error': {
        const msg = json.message || json.error || 'Unknown error';
        this.emitError(msg); this.push('error', msg);
        break;
      }
      default: break;
    }
  }
}

module.exports = { CodexSession };
