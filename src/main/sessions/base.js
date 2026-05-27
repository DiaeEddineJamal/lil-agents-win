'use strict';
const { spawn } = require('child_process');
const { spawnArgsFor, processEnvironment, homedir } = require('../shellEnv');

// Base for CLI-process-backed sessions. Mirrors AgentSession.swift: holds the
// message history, exposes lifecycle callbacks, and provides line-buffered
// stdout parsing helpers. WebSocket-based OpenClaw subclasses differently.
class BaseSession {
  constructor() {
    this.history = [];
    this.isRunning = false;
    this.isBusy = false;
    this.proc = null;
    this.lineBuffer = '';
    // callbacks (assigned by controller)
    this.onText = null;
    this.onError = null;
    this.onToolUse = null;        // (toolName, inputObj)
    this.onToolResult = null;     // (summary, isError)
    this.onSessionReady = null;
    this.onTurnComplete = null;
    this.onProcessExit = null;
  }

  emitText(t) { if (this.onText) this.onText(t); }
  emitError(t) { if (this.onError) this.onError(t); }
  emitToolUse(n, i) { if (this.onToolUse) this.onToolUse(n, i); }
  emitToolResult(s, e) { if (this.onToolResult) this.onToolResult(s, e); }
  emitReady() { if (this.onSessionReady) this.onSessionReady(); }
  emitTurnComplete() { if (this.onTurnComplete) this.onTurnComplete(); }
  emitProcessExit() { if (this.onProcessExit) this.onProcessExit(); }

  push(role, text) { this.history.push({ role, text }); }

  cwd() { return homedir(); }

  // Spawn a CLI. bin = { path, isCmd } from findBinary. Returns the child proc.
  launch(bin, args, { extraPaths = [], onStdout, onStderr, onExit } = {}) {
    const { command, args: spawnArgs, options } = spawnArgsFor(bin, args);
    const proc = spawn(command, spawnArgs, Object.assign({
      cwd: this.cwd(),
      env: processEnvironment(extraPaths),
      windowsHide: true
    }, options));

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (d) => { if (onStdout) onStdout(d); });
    proc.stderr.on('data', (d) => { if (onStderr) onStderr(d); });
    proc.on('error', (err) => { this.emitError('Failed to launch: ' + err.message); });
    proc.on('close', (code) => { if (onExit) onExit(code); });
    return proc;
  }

  // Feed a chunk of stdout, invoke handler per complete line.
  bufferLines(chunk, handler) {
    this.lineBuffer += chunk;
    let idx;
    while ((idx = this.lineBuffer.indexOf('\n')) >= 0) {
      const line = this.lineBuffer.slice(0, idx);
      this.lineBuffer = this.lineBuffer.slice(idx + 1);
      if (line.trim().length) handler(line);
    }
  }

  flushBuffer(handler) {
    if (this.lineBuffer.trim().length) handler(this.lineBuffer);
    this.lineBuffer = '';
  }

  terminate() {
    if (this.proc) {
      try { this.proc.stdout.removeAllListeners(); } catch (_) {}
      try { this.proc.stderr.removeAllListeners(); } catch (_) {}
      try { this.proc.kill(); } catch (_) {}
    }
    this.proc = null;
    this.isRunning = false;
    this.isBusy = false;
  }
}

module.exports = { BaseSession };
