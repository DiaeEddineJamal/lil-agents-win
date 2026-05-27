// Port of TerminalView.swift — themed transcript + input with Markdown,
// slash commands (/clear /copy /help), streaming, tool-use/result lines.

(function () {
  class Terminal {
    constructor(container, { theme, provider, onSend, onClear }) {
      this.theme = theme;
      this.provider = provider;
      this.onSend = onSend;
      this.onClear = onClear;
      this.currentAssistantText = '';
      this.lastAssistantText = '';
      this.isStreaming = false;
      this.showingSessionMessage = false;

      this.root = document.createElement('div');
      this.root.className = 'term-root';

      this.transcript = document.createElement('div');
      this.transcript.className = 'term-transcript';

      this.input = document.createElement('input');
      this.input.type = 'text';
      this.input.className = 'term-input';
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
      });

      this.root.appendChild(this.transcript);
      this.root.appendChild(this.input);
      container.appendChild(this.root);

      this.applyTheme(theme);
    }

    applyTheme(theme) {
      this.theme = theme;
      const t = theme.term;
      this.transcript.style.fontFamily = t.fontFamily;
      this.transcript.style.fontSize = t.fontSize + 'px';
      this.transcript.style.color = t.textPrimary;
      this.input.style.fontFamily = t.fontFamily;
      this.input.style.fontSize = t.fontSize + 'px';
      this.input.style.color = t.textPrimary;
      this.input.style.background = t.inputBg;
      this.input.style.borderRadius = t.inputRadius + 'px';
      this.input.style.caretColor = t.accent;
      this.updatePlaceholder();
    }

    setProvider(p) { this.provider = p; this.updatePlaceholder(); }
    updatePlaceholder() {
      const name = window.LilTheme.PROVIDER_NAMES[this.provider] || this.provider;
      this.input.placeholder = 'Ask ' + name + '...';
    }

    line(text, style) {
      const span = document.createElement('span');
      span.textContent = text;
      Object.assign(span.style, style);
      this.transcript.appendChild(span);
      return span;
    }

    ensureNewline() {
      const last = this.transcript.lastChild;
      if (this.transcript.childNodes.length && last && !(last.textContent || '').endsWith('\n')) {
        this.transcript.appendChild(document.createTextNode('\n'));
      }
    }

    scrollToBottom() { this.transcript.scrollTop = this.transcript.scrollHeight; }

    submit() {
      const text = this.input.value.trim();
      if (!text) return;
      this.input.value = '';
      if (this.handleSlash(text)) return;
      if (this.showingSessionMessage) { this.transcript.textContent = ''; this.showingSessionMessage = false; }
      this.appendUser(text);
      this.isStreaming = true;
      this.currentAssistantText = '';
      if (this.onSend) this.onSend(text);
    }

    handleSlash(text) {
      if (!text.startsWith('/')) return false;
      const cmd = text.toLowerCase().trim();
      const t = this.theme.term;
      if (cmd === '/clear') {
        this.resetState();
        if (this.onClear) this.onClear();
        return true;
      }
      if (cmd === '/copy') {
        const toCopy = this.lastAssistantText || 'nothing to copy yet';
        if (navigator.clipboard) navigator.clipboard.writeText(toCopy);
        this.line('  ✓ copied to clipboard\n', { color: t.success });
        this.scrollToBottom();
        return true;
      }
      if (cmd === '/help') {
        this.line('  lil agents — slash commands\n', { color: t.accent, fontWeight: 700 });
        this.line('  /clear  ', { color: t.textPrimary, fontWeight: 700 });
        this.line('clear chat history\n', { color: t.textDim });
        this.line('  /copy   ', { color: t.textPrimary, fontWeight: 700 });
        this.line('copy last response\n', { color: t.textDim });
        this.line('  /help   ', { color: t.textPrimary, fontWeight: 700 });
        this.line('show this message\n', { color: t.textDim });
        this.scrollToBottom();
        return true;
      }
      this.line('  unknown command: ' + text + ' (try /help)\n', { color: t.error });
      this.scrollToBottom();
      return true;
    }

    appendUser(text) {
      const t = this.theme.term;
      this.ensureNewline();
      this.line('> ', { color: t.accent, fontWeight: 700 });
      this.line(text + '\n', { color: t.textPrimary, fontWeight: 700 });
      this.scrollToBottom();
    }

    appendStreamingText(text) {
      let cleaned = text;
      if (!this.currentAssistantText) cleaned = cleaned.replace(/^\n+/, '');
      this.currentAssistantText += cleaned;
      if (cleaned) {
        this.transcript.appendChild(window.LilMarkdown.render(cleaned, this.theme));
        this.scrollToBottom();
      }
    }

    endStreaming() {
      if (this.isStreaming) {
        this.isStreaming = false;
        if (this.currentAssistantText) this.lastAssistantText = this.currentAssistantText;
        this.currentAssistantText = '';
      }
    }

    appendError(text) {
      this.line(text + '\n', { color: this.theme.term.error });
      this.scrollToBottom();
    }

    appendToolUse(toolName, summary) {
      const t = this.theme.term;
      this.endStreaming();
      this.line('  ' + toolName.toUpperCase() + ' ', { color: t.accent, fontWeight: 700 });
      this.line(summary + '\n', { color: t.textDim });
      this.scrollToBottom();
    }

    appendToolResult(summary, isError) {
      const t = this.theme.term;
      const color = isError ? t.error : t.success;
      this.line(isError ? '  FAIL ' : '  DONE ', { color, fontWeight: 700 });
      this.line((summary || '') + '\n', { color: t.textDim });
      this.scrollToBottom();
    }

    replayHistory(messages) {
      const t = this.theme.term;
      this.transcript.textContent = '';
      for (const m of messages) {
        switch (m.role) {
          case 'user': this.appendUser(m.text); break;
          case 'assistant': this.transcript.appendChild(window.LilMarkdown.render(m.text + '\n', this.theme)); break;
          case 'error': this.appendError(m.text); break;
          case 'toolUse': this.line('  ' + m.text + '\n', { color: t.accent }); break;
          case 'toolResult': {
            const isErr = m.text.startsWith('ERROR:');
            this.line('  ' + m.text + '\n', { color: isErr ? t.error : t.success });
            break;
          }
        }
      }
      this.scrollToBottom();
    }

    resetState() {
      this.isStreaming = false;
      this.currentAssistantText = '';
      this.lastAssistantText = '';
      this.showingSessionMessage = false;
      this.transcript.textContent = '';
    }

    showSessionMessage() {
      this.transcript.textContent = '';
      this.line('  ✦ new session\n', { color: this.theme.term.accent });
      this.showingSessionMessage = true;
    }

    copyLast() { this.handleSlash('/copy'); }
    focusInput() { this.input.focus(); }
  }

  window.LilTerminal = Terminal;
})();
