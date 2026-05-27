// Port of WalkerCharacter.swift — sprite animation, walk physics, thinking
// bubbles, completion sounds, and the click-to-open terminal popover.

(function () {
  const SHEET = { cols: 16, frameW: 225, frameH: 400, frameCount: 241, fps: 24 };
  const VIDEO_DURATION = 10.0;

  const SIZE_HEIGHT = { Large: 200, Medium: 150, Small: 100 };

  const THINKING = [
    'hmm...', 'thinking...', 'one sec...', 'ok hold on', 'let me check', 'working on it',
    'almost...', 'bear with me', 'on it!', 'gimme a sec', 'brb', 'processing...',
    'hang tight', 'just a moment', 'figuring it out', 'crunching...', 'reading...',
    'looking...', 'cooking...', 'vibing...', 'digging in', 'connecting dots',
    'give me a sec', "don't rush me", 'calculating...', 'assembling…'
  ];
  const COMPLETION = ['done!', 'all set!', 'ready!', 'here you go', 'got it!', 'finished!', 'ta-da!', 'voila!', 'boom!', 'there ya go!', 'check it out!'];

  let lastSoundIndex = -1;

  class Walker {
    constructor(opts) {
      this.controller = opts.controller;
      this.id = opts.id;                 // 0 or 1
      this.name = opts.name;             // "Bruce" / "Jazz"
      this.sheet = opts.sheetImage;
      this.color = opts.color;           // [r,g,b] 0..1
      this.provider = opts.provider;

      // walk tuning
      this.accelStart = opts.accelStart;
      this.fullSpeedStart = opts.fullSpeedStart;
      this.decelStart = opts.decelStart;
      this.walkStop = opts.walkStop;
      this.walkAmountRange = opts.walkAmountRange;
      this.yOffset = opts.yOffset;
      this.flipXOffset = opts.flipXOffset;

      this.size = opts.size;
      this.displayHeight = SIZE_HEIGHT[this.size] || 200;

      // state
      this.positionProgress = opts.positionProgress;
      this.isWalking = false;
      this.isPaused = true;
      this.pauseEndTime = opts.pauseEndTime;
      this.goingRight = true;
      this.walkStartTime = 0;
      this.walkStartPixel = 0;
      this.walkEndPixel = 0;
      this.currentTravelDistance = 500;

      this.isManuallyVisible = opts.visible !== false;

      // popover / session
      this.isIdleForPopover = false;
      this.busy = false;
      this.isOnboarding = false;

      // bubble
      this.currentPhrase = '';
      this.lastPhraseUpdate = 0;
      this.completionBubbleExpiry = 0;
      this.showingCompletion = false;

      this.buildDOM();
      this.drawFrame(0);
    }

    get displayWidth() { return this.displayHeight * (SHEET.frameW / SHEET.frameH); }

    buildDOM() {
      const stage = this.controller.stage;
      const dpr = window.devicePixelRatio || 1;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'char';
      this.canvas.width = Math.round(this.displayWidth * dpr);
      this.canvas.height = Math.round(this.displayHeight * dpr);
      this.canvas.style.width = this.displayWidth + 'px';
      this.canvas.style.height = this.displayHeight + 'px';
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.ctx.imageSmoothingQuality = 'high';
      this.canvas.addEventListener('mousedown', (e) => { e.preventDefault(); this.handleClick(); });
      stage.appendChild(this.canvas);

      this.bubble = document.createElement('div');
      this.bubble.className = 'bubble';
      this.bubbleLabel = document.createElement('span');
      this.bubble.appendChild(this.bubbleLabel);
      this.bubble.style.display = 'none';
      stage.appendChild(this.bubble);
    }

    setSize(size) {
      this.size = size;
      this.displayHeight = SIZE_HEIGHT[size] || 200;
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(this.displayWidth * dpr);
      this.canvas.height = Math.round(this.displayHeight * dpr);
      this.canvas.style.width = this.displayWidth + 'px';
      this.canvas.style.height = this.displayHeight + 'px';
      this.drawFrame(this.lastFrame || 0);
    }

    setVisible(v) {
      this.isManuallyVisible = v;
      this.canvas.style.display = v ? 'block' : 'none';
      if (!v) {
        this.bubble.style.display = 'none';
        if (this.isIdleForPopover) this.closePopover();
      }
    }

    // ---- Sprite drawing ----
    // Draw the standing frame once the sheet has loaded (idle characters don't
    // redraw every tick). Re-armed on each walk so the pose refreshes after.
    drawIdleOnce() {
      if (!this._idleDrawn && this.sheet && this.sheet.complete && this.sheet.naturalWidth) {
        this.drawFrame(0);
        this._idleDrawn = true;
      }
    }

    drawFrame(index) {
      this.lastFrame = index;
      const sx = (index % SHEET.cols) * SHEET.frameW;
      const sy = Math.floor(index / SHEET.cols) * SHEET.frameH;
      const cw = this.canvas.width, ch = this.canvas.height;
      this.ctx.clearRect(0, 0, cw, ch);
      if (this.sheet && this.sheet.complete) {
        this.ctx.drawImage(this.sheet, sx, sy, SHEET.frameW, SHEET.frameH, 0, 0, cw, ch);
      }
    }

    // ---- Walk physics (movementPosition) ----
    movementPosition(videoTime) {
      const dIn = this.fullSpeedStart - this.accelStart;
      const dLin = this.decelStart - this.fullSpeedStart;
      const dOut = this.walkStop - this.decelStart;
      const v = 1.0 / (dIn / 2.0 + dLin + dOut / 2.0);
      if (videoTime <= this.accelStart) return 0;
      if (videoTime <= this.fullSpeedStart) {
        const t = videoTime - this.accelStart;
        return v * t * t / (2.0 * dIn);
      }
      if (videoTime <= this.decelStart) {
        const easeIn = v * dIn / 2.0;
        const t = videoTime - this.fullSpeedStart;
        return easeIn + v * t;
      }
      if (videoTime <= this.walkStop) {
        const easeIn = v * dIn / 2.0;
        const lin = v * dLin;
        const t = videoTime - this.decelStart;
        return easeIn + lin + v * (t - t * t / (2.0 * dOut));
      }
      return 1.0;
    }

    startWalk() {
      this.isPaused = false;
      this.isWalking = true;
      this._idleDrawn = false;
      this.walkStartTime = this.controller.now();

      if (this.positionProgress > 0.85) this.goingRight = false;
      else if (this.positionProgress < 0.15) this.goingRight = true;
      else this.goingRight = Math.random() < 0.5;

      const walkStartPos = this.positionProgress;
      const referenceWidth = 500.0;
      const range = this.walkAmountRange;
      const walkPixels = (range[0] + Math.random() * (range[1] - range[0])) * referenceWidth;
      const walkAmount = this.currentTravelDistance > 0 ? walkPixels / this.currentTravelDistance : 0.3;
      let walkEndPos = this.goingRight ? Math.min(walkStartPos + walkAmount, 1) : Math.max(walkStartPos - walkAmount, 0);

      const minSep = 0.12;
      for (const sib of this.controller.walkers) {
        if (sib === this) continue;
        const sibPos = sib.positionProgress;
        if (Math.abs(walkEndPos - sibPos) < minSep) {
          if (this.goingRight) walkEndPos = Math.max(walkStartPos, sibPos - minSep);
          else walkEndPos = Math.min(walkStartPos, sibPos + minSep);
        }
      }

      this.walkStartPixel = walkStartPos * this.currentTravelDistance;
      this.walkEndPixel = walkEndPos * this.currentTravelDistance;
      this.updateFlip();
    }

    enterPause() {
      this.isWalking = false;
      this.isPaused = true;
      this.drawFrame(0);
      this.pauseEndTime = this.controller.now() + (5.0 + Math.random() * 7.0);
    }

    updateFlip() {
      this.canvas.style.transform = this.goingRight ? 'none' : 'scaleX(-1)';
    }

    get flipCompensation() { return this.goingRight ? 0 : this.flipXOffset; }

    // ---- Per-frame update ----
    update(now) {
      const g = this.controller.geom;
      if (!g) return;
      this.currentTravelDistance = Math.max(g.walkWidth - this.displayWidth, 0);

      if (this.isIdleForPopover) {
        this.drawIdleOnce();
        this.positionElement();
        this.updatePopoverPosition();
        this.updateBubble(now);
        return;
      }

      if (this.isPaused) {
        if (now >= this.pauseEndTime) { this.startWalk(); }
        else { this.drawIdleOnce(); this.positionElement(); this.updateBubble(now); return; }
      }

      if (this.isWalking) {
        const elapsed = now - this.walkStartTime;
        const videoTime = Math.min(elapsed, VIDEO_DURATION);
        const td = this.currentTravelDistance;
        const walkNorm = elapsed >= VIDEO_DURATION ? 1 : this.movementPosition(videoTime);
        const currentPixel = this.walkStartPixel + (this.walkEndPixel - this.walkStartPixel) * walkNorm;
        if (td > 0) this.positionProgress = Math.min(Math.max(currentPixel / td, 0), 1);

        // sprite frame
        const frame = Math.min(Math.floor(elapsed * SHEET.fps), SHEET.frameCount - 1);
        this.drawFrame(frame);

        if (elapsed >= VIDEO_DURATION) { this.enterPause(); this.positionElement(); this.updateBubble(now); return; }
        this.positionElement();
      }
      this.updateBubble(now);
    }

    positionElement() {
      const g = this.controller.geom;
      const td = this.currentTravelDistance;
      const left = g.walkX + td * this.positionProgress + this.flipCompensation;
      const bottomPadding = this.displayHeight * 0.15;
      // feet rest just below the ground line (sinking into a bottom taskbar);
      // clamp so they never fall past the overlay bottom (e.g. no taskbar present).
      const bottom = Math.min(g.ground + bottomPadding - this.yOffset, g.height);
      const top = bottom - this.displayHeight;
      this.canvas.style.left = left + 'px';
      this.canvas.style.top = top + 'px';
      this.canvas.style.zIndex = String(10 + Math.round(this.positionProgress * 10));
      this._left = left; this._top = top;
    }

    centerX() { return (this._left || 0) + this.displayWidth / 2; }

    // ---- Click / popover ----
    handleClick() {
      if (this.isOnboarding) { this.openOnboarding(); return; }
      if (this.isIdleForPopover) this.closePopover();
      else this.openPopover();
    }

    openPopover() {
      // close siblings
      for (const sib of this.controller.walkers) {
        if (sib !== this && sib.isIdleForPopover) sib.closePopover();
      }
      this.isIdleForPopover = true;
      this.isWalking = false;
      this.isPaused = true;
      this.drawFrame(0);
      this.showingCompletion = false;
      this.bubble.style.display = 'none';

      if (!this.session) {
        this.controller.createSession(this);
      }
      if (!this.popoverEl) this.createPopover();
      this.applyTheme();

      const hist = this.controller.sessionHistory[this.id];
      if (this.terminal && hist && hist.length) this.terminal.replayHistory(hist);

      this.popoverEl.style.display = 'flex';
      this.updatePopoverPosition();
      this.controller.focusForInput();
      if (this.terminal) this.terminal.focusInput();
    }

    openOnboarding() {
      this.showingCompletion = false;
      this.bubble.style.display = 'none';
      this.isIdleForPopover = true;
      this.isWalking = false;
      this.isPaused = true;
      this.drawFrame(0);
      if (!this.popoverEl) this.createPopover();
      this.applyTheme();
      this.terminal.input.disabled = true;
      this.terminal.transcript.textContent = '';
      const welcome =
        "hey! we're bruce and jazz — your lil dock agents.\n\n" +
        "click either of us to open an AI chat. we'll walk around while you work and let you know when your agent is thinking.\n\n" +
        "check the tray icon (bottom right) for themes, sounds, and more options.\n\n" +
        "click anywhere outside to dismiss, then click us again to start chatting.";
      this.terminal.transcript.appendChild(window.LilMarkdown.render(welcome, this.theme));
      this.popoverEl.style.display = 'flex';
      this.updatePopoverPosition();
    }

    closeOnboarding() {
      if (this.popoverEl) { this.popoverEl.remove(); this.popoverEl = null; this.terminal = null; }
      this.isIdleForPopover = false;
      this.isOnboarding = false;
      this.isPaused = true;
      this.pauseEndTime = this.controller.now() + (1 + Math.random() * 2);
      this.controller.completeOnboarding();
    }

    closePopover() {
      if (!this.isIdleForPopover) return;
      if (this.isOnboarding) { this.closeOnboarding(); return; }
      if (this.popoverEl) this.popoverEl.style.display = 'none';
      this.isIdleForPopover = false;

      if (this.showingCompletion) {
        this.completionBubbleExpiry = this.controller.now() + 3.0;
        this.showBubble(this.currentPhrase, true);
      } else if (this.busy) {
        this.currentPhrase = '';
        this.lastPhraseUpdate = 0;
        this.updateThinkingPhrase();
        this.showBubble(this.currentPhrase, false);
      }
      this.pauseEndTime = this.controller.now() + (2 + Math.random() * 3);
    }

    get theme() {
      return window.LilTheme.themeForCharacter(this.controller.themeName, this.color);
    }

    createPopover() {
      const t = this.theme;
      const el = document.createElement('div');
      el.className = 'popover';
      el.style.width = '420px';
      el.style.height = '310px';

      const title = document.createElement('div');
      title.className = 'popover-title';

      const name = document.createElement('div');
      name.className = 'popover-title-text';
      name.addEventListener('click', () => this.showProviderMenu());

      const chevron = document.createElement('div');
      chevron.className = 'popover-chevron';
      chevron.textContent = '▾';
      chevron.addEventListener('click', () => this.showProviderMenu());

      const spacer = document.createElement('div');
      spacer.style.flex = '1';

      const refresh = document.createElement('div');
      refresh.className = 'popover-btn';
      refresh.textContent = '⟳';
      refresh.title = 'Refresh';
      refresh.addEventListener('click', () => { if (!this.isOnboarding) this.resetSession(); });

      const copy = document.createElement('div');
      copy.className = 'popover-btn';
      copy.textContent = '⧉';
      copy.title = 'Copy last response';
      copy.addEventListener('click', () => { if (this.terminal) this.terminal.copyLast(); });

      title.appendChild(name);
      title.appendChild(chevron);
      title.appendChild(spacer);
      title.appendChild(refresh);
      title.appendChild(copy);
      el.appendChild(title);

      const body = document.createElement('div');
      body.className = 'popover-body';
      el.appendChild(body);

      this.controller.stage.appendChild(el);
      this.popoverEl = el;
      this.titleEl = title;
      this.titleTextEl = name;
      this.terminal = new window.LilTerminal(body, {
        theme: t, provider: this.provider,
        onSend: (msg) => this.controller.sendMessage(this, msg),
        onClear: () => this.resetSession()
      });
    }

    applyTheme() {
      if (!this.popoverEl) return;
      const t = this.theme;
      this.popoverEl.style.background = t.popover.bg;
      this.popoverEl.style.border = t.popover.borderWidth + 'px solid ' + t.popover.border;
      this.popoverEl.style.borderRadius = t.popover.radius + 'px';
      this.titleEl.style.background = t.titleBar.bg;
      this.titleEl.style.borderBottom = '1px solid ' + t.separator;
      this.titleTextEl.style.color = t.titleBar.text;
      this.titleTextEl.style.fontFamily = t.titleBar.fontFamily;
      this.titleTextEl.style.fontWeight = t.titleBar.fontWeight;
      this.titleTextEl.style.fontSize = t.titleBar.fontSize + 'px';
      this.titleTextEl.textContent = window.LilTheme.titleString(
        window.LilTheme.PROVIDER_NAMES[this.provider] || this.provider, t.titleBar.format);
      // tint title buttons
      this.popoverEl.querySelectorAll('.popover-chevron,.popover-btn').forEach((b) => {
        b.style.color = t.titleBar.text;
      });
      if (this.terminal) { this.terminal.applyTheme(t); this.terminal.setProvider(this.provider); }
    }

    showProviderMenu() {
      const existing = document.querySelector('.provider-menu');
      if (existing) { existing.remove(); return; }
      const menu = document.createElement('div');
      menu.className = 'provider-menu';
      const avail = this.controller.availability;
      for (const p of Object.keys(window.LilTheme.PROVIDER_NAMES)) {
        const item = document.createElement('div');
        item.className = 'provider-menu-item';
        item.textContent = (p === this.provider ? '✓ ' : '   ') + window.LilTheme.PROVIDER_NAMES[p];
        if (!avail[p]) { item.classList.add('disabled'); }
        else item.addEventListener('click', () => {
          menu.remove();
          if (p !== this.provider) this.switchProvider(p);
        });
        menu.appendChild(item);
      }
      const rect = this.titleEl.getBoundingClientRect();
      menu.style.left = rect.left + 8 + 'px';
      menu.style.top = rect.bottom + 'px';
      this.controller.stage.appendChild(menu);
      const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close, true); } };
      setTimeout(() => document.addEventListener('mousedown', close, true), 0);
    }

    switchProvider(p) {
      this.provider = p;
      this.controller.setCharProvider(this.id, p);
      this.controller.terminateSession(this);
      if (this.popoverEl) { this.popoverEl.remove(); this.popoverEl = null; this.terminal = null; }
      this.bubble.style.display = 'none';
      this.isIdleForPopover = false;
      this.openPopover();
    }

    resetSession() {
      this.controller.terminateSession(this);
      this.currentPhrase = '';
      this.showingCompletion = false;
      this.completionBubbleExpiry = 0;
      this.bubble.style.display = 'none';
      if (this.terminal) { this.terminal.resetState(); this.terminal.showSessionMessage(); }
      this.controller.createSession(this);
    }

    updatePopoverPosition() {
      if (!this.popoverEl || !this.isIdleForPopover) return;
      const g = this.controller.geom;
      const pw = this.popoverEl.offsetWidth || 420;
      const ph = this.popoverEl.offsetHeight || 310;
      let x = this.centerX() - pw / 2;
      x = Math.max(4, Math.min(x, g.width - pw - 4));
      let y = (this._top || 0) - ph + 15; // just above the character head
      y = Math.max(4, y);
      this.popoverEl.style.left = x + 'px';
      this.popoverEl.style.top = y + 'px';
    }

    hitTestPopover(x, y) {
      if (!this.popoverEl || this.popoverEl.style.display === 'none') return false;
      const r = this.popoverEl.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    // alpha hit-test against the rendered sprite
    hitTestChar(x, y) {
      if (this.canvas.style.display === 'none') return false;
      const r = this.canvas.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
      const cx = Math.floor((x - r.left) * (this.canvas.width / r.width));
      const cy = Math.floor((y - r.top) * (this.canvas.height / r.height));
      try {
        const d = this.ctx.getImageData(cx, cy, 1, 1).data;
        return d[3] > 30;
      } catch (_) { return true; }
    }

    // ---- Thinking bubble ----
    setBusy(b) { this.busy = b; }

    updateThinkingPhrase() {
      const now = this.controller.now();
      if (!this.currentPhrase || now - this.lastPhraseUpdate > (3 + Math.random() * 2)) {
        let next = THINKING[Math.floor(Math.random() * THINKING.length)];
        while (next === this.currentPhrase && THINKING.length > 1) next = THINKING[Math.floor(Math.random() * THINKING.length)];
        this.currentPhrase = next;
        this.lastPhraseUpdate = now;
      }
    }

    showCompletionBubble() {
      this.currentPhrase = COMPLETION[Math.floor(Math.random() * COMPLETION.length)];
      this.showingCompletion = true;
      this.completionBubbleExpiry = this.controller.now() + 3.0;
      this.lastPhraseUpdate = 0;
      if (!this.isIdleForPopover) this.showBubble(this.currentPhrase, true);
    }

    updateBubble(now) {
      if (this.showingCompletion) {
        if (now >= this.completionBubbleExpiry) { this.showingCompletion = false; this.bubble.style.display = 'none'; return; }
        if (this.isIdleForPopover) { this.completionBubbleExpiry += 1 / 60; this.bubble.style.display = 'none'; }
        else this.showBubble(this.currentPhrase, true);
        return;
      }
      if (this.busy && !this.isIdleForPopover) {
        this.updateThinkingPhrase();
        this.showBubble(this.currentPhrase, false);
      } else {
        this.bubble.style.display = 'none';
      }
    }

    showBubble(text, isCompletion) {
      const t = this.theme.bubble;
      this.bubbleLabel.textContent = text;
      this.bubble.style.background = t.bg;
      this.bubble.style.borderColor = isCompletion ? t.complBorder : t.border;
      this.bubble.style.color = isCompletion ? t.complText : t.text;
      this.bubble.style.fontFamily = t.fontFamily;
      this.bubble.style.fontSize = t.fontSize + 'px';
      this.bubble.style.borderRadius = t.radius + 'px';
      this.bubble.style.display = 'flex';
      // position centered above head
      const bw = this.bubble.offsetWidth;
      const cx = this.centerX();
      this.bubble.style.left = (cx - bw / 2) + 'px';
      this.bubble.style.top = ((this._top || 0) + this.displayHeight * 0.06 - this.bubble.offsetHeight) + 'px';
    }

    playCompletionSound() {
      if (!this.controller.soundsEnabled) return;
      const files = ['ping-aa.mp3', 'ping-bb.mp3', 'ping-cc.mp3', 'ping-dd.mp3', 'ping-ee.mp3', 'ping-ff.mp3', 'ping-gg.mp3', 'ping-hh.mp3', 'ping-jj.m4a'];
      let idx;
      do { idx = Math.floor(Math.random() * files.length); } while (idx === lastSoundIndex && files.length > 1);
      lastSoundIndex = idx;
      try {
        const a = new Audio(this.controller.soundsDir + '/' + files[idx]);
        a.volume = 0.6;
        a.play().catch(() => {});
      } catch (_) {}
    }
  }

  Walker.VIDEO_DURATION = VIDEO_DURATION;
  window.LilWalker = Walker;
})();
