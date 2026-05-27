'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const listeners = {};
function on(channel, cb) {
  if (!listeners[channel]) {
    listeners[channel] = [];
    ipcRenderer.on(channel, (_e, payload) => { listeners[channel].forEach((f) => f(payload)); });
  }
  listeners[channel].push(cb);
}

contextBridge.exposeInMainWorld('lil', {
  // renderer -> main
  setInteractive: (b) => ipcRenderer.send('set-interactive', b),
  popoverFocus: () => ipcRenderer.send('popover-focus'),
  onboardingDone: () => ipcRenderer.send('onboarding-done'),
  sessionCreate: (charId, provider) => ipcRenderer.send('session:create', { charId, provider }),
  sessionSend: (charId, message) => ipcRenderer.send('session:send', { charId, message }),
  sessionTerminate: (charId) => ipcRenderer.send('session:terminate', { charId }),
  setCharProvider: (charId, provider) => ipcRenderer.send('set-char-provider', { charId, provider }),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // openclaw settings window
  openclawSave: (cfg) => ipcRenderer.send('openclaw-save', cfg),
  openclawCancel: () => ipcRenderer.send('openclaw-cancel'),

  // main -> renderer
  onInit: (cb) => on('init', cb),
  onGeometry: (cb) => on('geometry', cb),
  onMenuToggleChar: (cb) => on('menu:toggleChar', cb),
  onMenuSetProvider: (cb) => on('menu:setProvider', cb),
  onMenuSetSize: (cb) => on('menu:setSize', cb),
  onMenuSetTheme: (cb) => on('menu:setTheme', cb),
  onMenuToggleSounds: (cb) => on('menu:toggleSounds', cb),
  onOpenClawUpdated: (cb) => on('openclaw-updated', cb),
  onOpenClawConfig: (cb) => on('openclaw-config', cb),

  onSessionText: (cb) => on('session:text', cb),
  onSessionTurnComplete: (cb) => on('session:turnComplete', cb),
  onSessionError: (cb) => on('session:error', cb),
  onSessionToolUse: (cb) => on('session:toolUse', cb),
  onSessionToolResult: (cb) => on('session:toolResult', cb),
  onSessionProcessExit: (cb) => on('session:processExit', cb)
});
