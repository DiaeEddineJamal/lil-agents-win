// Renderer-side controller. Port of LilAgentsController: runs the tick loop,
// coordinates the two walkers, manages click-through hit-testing, and dispatches
// session IPC events to the right character's terminal/bubble.

(function () {
  const BRUCE_SHEET = '../../assets/walk-bruce-sheet.png';
  const JAZZ_SHEET = '../../assets/walk-jazz-sheet.png';
  const SOUNDS_DIR = '../../assets/sounds';

  window.lilOpenExternal = (url) => window.lil.openExternal && window.lil.openExternal(url);

  class Controller {
    constructor() {
      this.stage = document.getElementById('stage');
      this.walkers = [];
      this.geom = null;
      this.themeName = 'Peach';
      this.soundsEnabled = true;
      this.soundsDir = SOUNDS_DIR;
      this.availability = {};
      this.sessionHistory = [[], []];
      this.assistantBuf = ['', ''];
      this.onboardingActive = false;
      this.lastInteractive = false;
    }

    now() { return performance.now() / 1000; }

    init(payload) {
      this.themeName = payload.theme || 'Peach';
      this.soundsEnabled = payload.sounds !== false;
      this.availability = payload.availability || {};
      const visible = payload.charVisible || [true, true];

      const bruceImg = new Image();
      const jazzImg = new Image();
      bruceImg.src = BRUCE_SHEET;
      jazzImg.src = JAZZ_SHEET;

      const now = this.now();
      const bruce = new window.LilWalker({
        controller: this, id: 0, name: 'Bruce', sheetImage: bruceImg,
        color: [0.4, 0.72, 0.55], provider: payload.char0Provider || payload.provider,
        accelStart: 3.0, fullSpeedStart: 3.75, decelStart: 8.0, walkStop: 8.5,
        walkAmountRange: [0.4, 0.65], yOffset: -3, flipXOffset: 0,
        size: payload.size, positionProgress: 0.3, pauseEndTime: now + 0.5 + Math.random() * 1.5,
        visible: visible[0]
      });
      const jazz = new window.LilWalker({
        controller: this, id: 1, name: 'Jazz', sheetImage: jazzImg,
        color: [1.0, 0.4, 0.0], provider: payload.char1Provider || payload.provider,
        accelStart: 3.9, fullSpeedStart: 4.5, decelStart: 8.0, walkStop: 8.75,
        walkAmountRange: [0.35, 0.6], yOffset: -7, flipXOffset: -9,
        size: payload.size, positionProgress: 0.7, pauseEndTime: now + 8 + Math.random() * 6,
        visible: visible[1]
      });
      this.walkers = [bruce, jazz];
      bruce.setVisible(visible[0]);
      jazz.setVisible(visible[1]);

      this.wireMenus();
      this.wireSessions();
      this.wireInteraction();

      if (!payload.onboardingDone) this.triggerOnboarding();

      const loop = () => { this.tick(this.now()); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }

    triggerOnboarding() {
      this.onboardingActive = true;
      const bruce = this.walkers[0];
      bruce.isOnboarding = true;
      setTimeout(() => {
        if (!bruce.isOnboarding) return;
        bruce.currentPhrase = 'hi!';
        bruce.showingCompletion = true;
        bruce.completionBubbleExpiry = this.now() + 600;
        bruce.showBubble('hi!', true);
        bruce.playCompletionSound();
      }, 2000);
    }

    completeOnboarding() {
      this.onboardingActive = false;
      this.walkers.forEach((w) => { w.isOnboarding = false; });
      window.lil.onboardingDone();
    }

    tick(now) {
      if (!this.geom) return;
      const active = this.walkers.filter((w) => w.isManuallyVisible);
      const anyWalking = active.some((w) => w.isWalking);
      for (const w of active) {
        if (w.isIdleForPopover) continue;
        if (w.isPaused && now >= w.pauseEndTime && anyWalking) {
          w.pauseEndTime = now + 5 + Math.random() * 5;
        }
      }
      for (const w of active) w.update(now);
    }

    // ---- Sessions ----
    createSession(walker) {
      this.sessionHistory[walker.id] = [];
      this.assistantBuf[walker.id] = '';
      walker.session = true;
      window.lil.sessionCreate(walker.id, walker.provider);
    }
    terminateSession(walker) {
      walker.session = false;
      window.lil.sessionTerminate(walker.id);
    }
    setCharProvider(id, p) { window.lil.setCharProvider(id, p); }

    sendMessage(walker, msg) {
      this.sessionHistory[walker.id].push({ role: 'user', text: msg });
      this.assistantBuf[walker.id] = '';
      walker.setBusy(true);
      window.lil.sessionSend(walker.id, msg);
    }

    wireSessions() {
      const W = (id) => this.walkers[id];
      window.lil.onSessionText(({ charId, text }) => {
        this.assistantBuf[charId] += text;
        const t = W(charId).terminal; if (t) t.appendStreamingText(text);
      });
      window.lil.onSessionTurnComplete(({ charId }) => {
        const w = W(charId);
        if (w.terminal) w.terminal.endStreaming();
        const buf = this.assistantBuf[charId];
        if (buf) this.sessionHistory[charId].push({ role: 'assistant', text: buf });
        this.assistantBuf[charId] = '';
        w.setBusy(false);
        w.playCompletionSound();
        w.showCompletionBubble();
      });
      window.lil.onSessionError(({ charId, text }) => {
        const w = W(charId);
        if (w.terminal) w.terminal.appendError(text);
        this.sessionHistory[charId].push({ role: 'error', text });
      });
      window.lil.onSessionToolUse(({ charId, toolName, summary }) => {
        const w = W(charId);
        if (w.terminal) w.terminal.appendToolUse(toolName, summary);
        this.sessionHistory[charId].push({ role: 'toolUse', text: toolName + ': ' + summary });
      });
      window.lil.onSessionToolResult(({ charId, summary, isError }) => {
        const w = W(charId);
        if (w.terminal) w.terminal.appendToolResult(summary, isError);
        this.sessionHistory[charId].push({ role: 'toolResult', text: isError ? 'ERROR: ' + summary : summary });
      });
      window.lil.onSessionProcessExit(({ charId }) => {
        const w = W(charId);
        if (w.terminal) { w.terminal.endStreaming(); w.terminal.appendError((window.LilTheme.PROVIDER_NAMES[w.provider] || w.provider) + ' session ended.'); }
        w.setBusy(false);
      });
    }

    // ---- Menus from tray ----
    wireMenus() {
      window.lil.onMenuToggleChar(({ index, visible }) => { this.walkers[index].setVisible(visible); });
      window.lil.onMenuSetProvider((p) => {
        this.walkers.forEach((w) => {
          if (w.provider === p) return;
          w.provider = p;
          this.terminateSession(w);
          if (w.popoverEl) { w.popoverEl.remove(); w.popoverEl = null; w.terminal = null; }
          w.bubble.style.display = 'none';
          w.isIdleForPopover = false;
        });
      });
      window.lil.onMenuSetSize((s) => { this.walkers.forEach((w) => w.setSize(s)); });
      window.lil.onMenuSetTheme((name) => {
        this.themeName = name;
        this.walkers.forEach((w) => {
          const wasOpen = w.isIdleForPopover;
          if (w.popoverEl) { w.popoverEl.remove(); w.popoverEl = null; w.terminal = null; }
          if (wasOpen) {
            w.createPopover();
            w.applyTheme();
            const hist = this.sessionHistory[w.id];
            if (w.terminal && hist && hist.length) w.terminal.replayHistory(hist);
            w.popoverEl.style.display = 'flex';
            w.updatePopoverPosition();
            w.terminal.focusInput();
          }
        });
      });
      window.lil.onMenuToggleSounds((on) => { this.soundsEnabled = on; });
      window.lil.onOpenClawUpdated((avail) => { this.availability = avail; });
    }

    focusForInput() { window.lil.popoverFocus(); }

    anyPopoverOpen() { return this.walkers.some((w) => w.isIdleForPopover); }
    closeAllPopovers() { this.walkers.forEach((w) => { if (w.isIdleForPopover) w.closePopover(); }); }

    // ---- Click-through hit-testing ----
    wireInteraction() {
      window.lil.onGeometry((g) => { this.geom = g; });

      const recompute = (x, y) => {
        const menu = document.querySelector('.provider-menu');
        let interactive = false;
        if (menu) {
          const r = menu.getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) interactive = true;
        }
        if (!interactive) {
          for (const w of this.walkers) {
            if (w.hitTestPopover(x, y) || w.hitTestChar(x, y)) { interactive = true; break; }
          }
        }
        if (interactive !== this.lastInteractive) {
          this.lastInteractive = interactive;
          window.lil.setInteractive(interactive);
        }
      };

      document.addEventListener('mousemove', (e) => recompute(e.clientX, e.clientY));
      document.addEventListener('mouseleave', () => {
        if (this.lastInteractive) { this.lastInteractive = false; window.lil.setInteractive(false); }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.anyPopoverOpen()) this.closeAllPopovers();
      });

      // Clicking outside any popover/char while one is open closes it.
      window.addEventListener('blur', () => { if (this.anyPopoverOpen()) this.closeAllPopovers(); });
    }
  }

  const controller = new Controller();
  window.lil.onInit((payload) => controller.init(payload));
})();
