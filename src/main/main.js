'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell } = require('electron');
const path = require('path');
const settings = require('./settings');
const { createSession, detectAvailability, firstAvailable } = require('./sessions');
const { PROVIDERS, displayName } = require('./sessions/providerInfo');
const { saveOpenClawConfig, openClawConfig } = require('./settings');

const OVERLAY_ABOVE = 540; // px of overlay above the ground line (room for char + bubble + popover)
const THEMES = ['Peach', 'Midnight', 'Cloud', 'Moss'];
const SIZES = ['Large', 'Medium', 'Small'];
const ASSET = (f) => path.join(__dirname, '..', '..', 'assets', f);

let overlayWin = null;
let tray = null;
let settingsWin = null;
let availability = {};
let geomTimer = null;
const sessions = {}; // charId -> session instance

// single instance
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (overlayWin) overlayWin.focus(); });

// ---------- Geometry ----------

function chosenDisplay() {
  const idx = settings.get('pinnedDisplayIndex', -1);
  const all = screen.getAllDisplays();
  if (idx >= 0 && idx < all.length) return all[idx];
  return screen.getPrimaryDisplay();
}

function computeGeometry() {
  const d = chosenDisplay();
  const b = d.bounds, w = d.workArea;
  // ground line (where character feet rest), in screen coords
  const taskbarAtBottom = (w.y <= b.y) && (w.y + w.height < b.y + b.height);
  const groundScreenY = taskbarAtBottom ? (w.y + w.height) : (b.y + b.height);

  const overlayTop = Math.round(groundScreenY - OVERLAY_ABOVE);
  const overlayBottom = b.y + b.height;
  const height = overlayBottom - overlayTop;
  return {
    x: b.x, y: overlayTop, width: b.width, height,
    ground: OVERLAY_ABOVE,
    walkX: Math.round(b.width * 0.06),
    walkWidth: Math.round(b.width * 0.88)
  };
}

let lastGeomKey = '';
function applyGeometry() {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  const g = computeGeometry();
  const key = [g.x, g.y, g.width, g.height, g.ground, g.walkX, g.walkWidth].join(',');
  if (key === lastGeomKey) return;
  lastGeomKey = key;
  overlayWin.setBounds({ x: g.x, y: g.y, width: g.width, height: g.height });
  overlayWin.webContents.send('geometry', g);
}

// ---------- Window ----------

function createOverlay() {
  const g = computeGeometry();
  overlayWin = new BrowserWindow({
    x: g.x, y: g.y, width: g.width, height: g.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: true,
    fullscreenable: false,
    acceptFirstMouse: true,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // Local-only app (strict CSP, no remote content). Needed so the alpha
      // hit-test can read pixels from canvases drawn from file:// sprite sheets
      // without Chromium tainting them.
      webSecurity: false
    }
  });

  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));

  overlayWin.webContents.on('render-process-gone', (_e, d) => console.error('[lil-agents] render process gone:', JSON.stringify(d)));

  overlayWin.webContents.on('did-finish-load', () => {
    overlayWin.webContents.send('init', initPayload());
    applyGeometry();
  });

  overlayWin.showInactive();
}

function initPayload() {
  availability = detectAvailability();
  const onboardingDone = settings.get('onboardingDone', false);
  let provider = settings.get('selectedProvider', null);
  if (!provider) {
    provider = onboardingDone ? 'claude' : firstAvailable(availability);
    settings.set('selectedProvider', provider);
  }
  return {
    provider,
    char0Provider: settings.get('char0Provider', provider),
    char1Provider: settings.get('char1Provider', provider),
    size: settings.get('selectedSize', 'Large'),
    theme: settings.get('selectedThemeName', 'Peach'),
    sounds: settings.get('soundsEnabled', true),
    charVisible: settings.get('charVisible', [true, true]),
    availability,
    onboardingDone,
    assets: {
      bruceSheet: ASSET('walk-bruce-sheet.png').replace(/\\/g, '/'),
      jazzSheet: ASSET('walk-jazz-sheet.png').replace(/\\/g, '/'),
      soundsDir: ASSET('sounds').replace(/\\/g, '/')
    }
  };
}

// ---------- Tray ----------

function buildTray() {
  const img = nativeImage.createFromPath(ASSET('tray.png'));
  tray = new Tray(img.isEmpty() ? nativeImage.createFromPath(ASSET('icon.png')) : img);
  tray.setToolTip('lil agents');
  refreshTrayMenu();
}

function refreshTrayMenu() {
  availability = detectAvailability();
  const charVisible = settings.get('charVisible', [true, true]);
  const provider = settings.get('selectedProvider', 'claude');
  const size = settings.get('selectedSize', 'Large');
  const theme = settings.get('selectedThemeName', 'Peach');
  const sounds = settings.get('soundsEnabled', true);
  const pinned = settings.get('pinnedDisplayIndex', -1);
  const displays = screen.getAllDisplays();

  const template = [
    { label: 'Bruce', type: 'checkbox', checked: charVisible[0], click: (mi) => toggleChar(0, mi.checked) },
    { label: 'Jazz', type: 'checkbox', checked: charVisible[1], click: (mi) => toggleChar(1, mi.checked) },
    { type: 'separator' },
    { label: 'Sounds', type: 'checkbox', checked: sounds, click: (mi) => { settings.set('soundsEnabled', mi.checked); send('menu:toggleSounds', mi.checked); } },
    {
      label: 'Provider',
      submenu: PROVIDERS.map((p) => ({
        label: displayName(p),
        type: 'radio',
        checked: p === provider,
        enabled: !!availability[p],
        click: () => setProvider(p)
      })).concat([
        { type: 'separator' },
        { label: 'Advanced Settings…', click: openOpenClawSettings }
      ])
    },
    {
      label: 'Size',
      submenu: SIZES.map((s) => ({
        label: s, type: 'radio', checked: s === size,
        click: () => { settings.set('selectedSize', s); send('menu:setSize', s); }
      }))
    },
    {
      label: 'Style',
      submenu: THEMES.map((t) => ({
        label: t, type: 'radio', checked: t === theme,
        click: () => { settings.set('selectedThemeName', t); send('menu:setTheme', t); }
      }))
    },
    {
      label: 'Display',
      submenu: [{
        label: 'Auto (Primary)', type: 'radio', checked: pinned === -1,
        click: () => { settings.set('pinnedDisplayIndex', -1); applyGeometry(); refreshTrayMenu(); }
      }].concat(displays.map((dsp, i) => ({
        label: dsp.label || ('Display ' + (i + 1)),
        type: 'radio', checked: pinned === i,
        click: () => { settings.set('pinnedDisplayIndex', i); applyGeometry(); refreshTrayMenu(); }
      })))
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function send(channel, payload) {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send(channel, payload);
}

function toggleChar(index, visible) {
  const cv = settings.get('charVisible', [true, true]).slice();
  cv[index] = visible;
  settings.set('charVisible', cv);
  send('menu:toggleChar', { index, visible });
}

function setProvider(p) {
  settings.set('selectedProvider', p);
  settings.set('char0Provider', p);
  settings.set('char1Provider', p);
  send('menu:setProvider', p);
  refreshTrayMenu();
}

// ---------- OpenClaw settings window ----------

function openOpenClawSettings() {
  if (settingsWin) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 460, height: 360, resizable: false, minimizable: false, maximizable: false,
    title: 'OpenClaw Connection', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  settingsWin.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  settingsWin.webContents.on('did-finish-load', () => {
    settingsWin.webContents.send('openclaw-config', openClawConfig());
  });
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ---------- Session management ----------

function wireSession(charId, session) {
  session.onText = (t) => send('session:text', { charId, text: t });
  session.onTurnComplete = () => send('session:turnComplete', { charId });
  session.onError = (t) => send('session:error', { charId, text: t });
  session.onToolUse = (toolName, input) => send('session:toolUse', { charId, toolName, summary: formatToolInput(input) });
  session.onToolResult = (summary, isError) => send('session:toolResult', { charId, summary, isError });
  session.onProcessExit = () => send('session:processExit', { charId });
  session.onSessionReady = () => {};
}

function formatToolInput(input) {
  if (!input || typeof input !== 'object') return '';
  if (input.command) return input.command;
  if (input.file_path) return input.file_path;
  if (input.pattern) return input.pattern;
  return Object.keys(input).sort().slice(0, 3).join(', ');
}

ipcMain.on('session:create', (_e, { charId, provider }) => {
  if (sessions[charId]) { try { sessions[charId].terminate(); } catch (_) {} }
  const s = createSession(provider);
  sessions[charId] = s;
  wireSession(charId, s);
  s.start();
});

ipcMain.on('session:send', (_e, { charId, message }) => {
  const s = sessions[charId];
  if (s) s.send(message);
});

ipcMain.on('session:terminate', (_e, { charId }) => {
  const s = sessions[charId];
  if (s) { try { s.terminate(); } catch (_) {} delete sessions[charId]; }
});

ipcMain.handle('session:isBusy', (_e, { charId }) => {
  const s = sessions[charId];
  return s ? !!s.isBusy : false;
});

// Renderer drives click-through: enable mouse only over interactive regions.
ipcMain.on('set-interactive', (_e, interactive) => {
  if (!overlayWin) return;
  if (interactive) overlayWin.setIgnoreMouseEvents(false);
  else overlayWin.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on('popover-focus', () => { if (overlayWin) overlayWin.focus(); });

ipcMain.on('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});

ipcMain.on('onboarding-done', () => {
  settings.set('onboardingDone', true);
});

ipcMain.on('set-char-provider', (_e, { charId, provider }) => {
  settings.set('char' + charId + 'Provider', provider);
});

// OpenClaw settings save
ipcMain.on('openclaw-save', (_e, config) => {
  saveOpenClawConfig(config);
  if (settingsWin) settingsWin.close();
  refreshTrayMenu();
  send('openclaw-updated', detectAvailability());
});
ipcMain.on('openclaw-cancel', () => { if (settingsWin) settingsWin.close(); });

// ---------- App lifecycle ----------

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('xyz.lilagents.app');
  createOverlay();
  buildTray();

  screen.on('display-metrics-changed', applyGeometry);
  screen.on('display-added', () => { applyGeometry(); refreshTrayMenu(); });
  screen.on('display-removed', () => { applyGeometry(); refreshTrayMenu(); });
  geomTimer = setInterval(applyGeometry, 1500);
});

app.on('window-all-closed', (e) => { e.preventDefault(); }); // tray app stays alive

app.on('before-quit', () => {
  if (geomTimer) clearInterval(geomTimer);
  Object.values(sessions).forEach((s) => { try { s.terminate(); } catch (_) {} });
});
