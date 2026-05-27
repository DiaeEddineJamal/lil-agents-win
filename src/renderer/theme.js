// Port of PopoverTheme.swift — 4 presets expressed with CSS color strings and
// Windows font stacks. Peach recolors per-character (matches withCharacterColor).

const MONO = "'Cascadia Mono','Consolas',monospace";
const ROUNDED = "'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif";
const RETRO = "'Lucida Console','Consolas',monospace";

function rgba(r, g, b, a = 1) {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}

const THEMES = {
  Peach: {
    name: 'Peach',
    popover: { bg: rgba(1, 0.97, 0.92, 0.97), border: rgba(0.95, 0.55, 0.65, 0.8), borderWidth: 2.5, radius: 24 },
    titleBar: { bg: rgba(0.98, 0.93, 0.88), text: rgba(0.85, 0.35, 0.45), fontFamily: ROUNDED, fontWeight: 800, fontSize: 12, format: 'lowercaseTilde' },
    separator: rgba(0.95, 0.55, 0.65, 0.25),
    term: { fontFamily: ROUNDED, fontSize: 13, textPrimary: rgba(0.2, 0.18, 0.22), textDim: rgba(0.5, 0.47, 0.52), accent: rgba(0.85, 0.35, 0.45), error: rgba(0.9, 0.3, 0.2), success: rgba(0.3, 0.72, 0.5), inputBg: rgba(1, 0.98, 0.95), inputRadius: 14 },
    bubble: { bg: rgba(1, 0.95, 0.90, 0.95), border: rgba(0.95, 0.55, 0.65, 0.6), text: rgba(0.55, 0.5, 0.52), complBorder: rgba(0.3, 0.75, 0.5, 0.7), complText: rgba(0.2, 0.6, 0.4), fontFamily: ROUNDED, fontSize: 12, radius: 14 }
  },
  Midnight: {
    name: 'Midnight',
    popover: { bg: rgba(0.07, 0.07, 0.07, 0.96), border: rgba(1, 0.4, 0, 0.7), borderWidth: 1.5, radius: 12 },
    titleBar: { bg: rgba(0.1, 0.1, 0.1), text: rgba(1, 0.4, 0), fontFamily: MONO, fontWeight: 700, fontSize: 10, format: 'uppercase' },
    separator: rgba(1, 0.4, 0, 0.3),
    term: { fontFamily: MONO, fontSize: 11.5, textPrimary: rgba(1, 1, 1), textDim: rgba(0.6, 0.6, 0.6), accent: rgba(1, 0.4, 0), error: rgba(1, 0.3, 0.2), success: rgba(0.4, 0.65, 0.4), inputBg: rgba(0.12, 0.12, 0.12), inputRadius: 4 },
    bubble: { bg: rgba(0.1, 0.1, 0.1, 0.92), border: rgba(1, 0.4, 0, 0.6), text: rgba(0.7, 0.7, 0.7), complBorder: rgba(0.3, 0.8, 0.3, 0.7), complText: rgba(0.3, 0.85, 0.3), fontFamily: MONO, fontSize: 10, radius: 12 }
  },
  Cloud: {
    name: 'Cloud',
    popover: { bg: rgba(0.94, 0.95, 0.96, 0.98), border: rgba(0.78, 0.80, 0.84, 0.6), borderWidth: 1, radius: 16 },
    titleBar: { bg: rgba(0.88, 0.90, 0.93), text: rgba(0.3, 0.3, 0.35), fontFamily: ROUNDED, fontWeight: 600, fontSize: 12, format: 'lowercaseTilde' },
    separator: rgba(0.8, 0.82, 0.85, 0.4),
    term: { fontFamily: ROUNDED, fontSize: 13, textPrimary: rgba(0.15, 0.15, 0.2), textDim: rgba(0.5, 0.5, 0.55), accent: rgba(0, 0.47, 0.84), error: rgba(0.85, 0.2, 0.15), success: rgba(0.2, 0.65, 0.3), inputBg: rgba(1, 1, 1), inputRadius: 8 },
    bubble: { bg: rgba(0.94, 0.95, 0.97, 0.95), border: rgba(0, 0.47, 0.84, 0.4), text: rgba(0.45, 0.47, 0.52), complBorder: rgba(0.2, 0.7, 0.3, 0.6), complText: rgba(0.15, 0.55, 0.2), fontFamily: ROUNDED, fontSize: 12, radius: 12 }
  },
  Moss: {
    name: 'Moss',
    popover: { bg: rgba(0.82, 0.84, 0.78, 0.98), border: rgba(0.55, 0.58, 0.50, 0.8), borderWidth: 2, radius: 10 },
    titleBar: { bg: rgba(0.72, 0.75, 0.68), text: rgba(0.15, 0.17, 0.12), fontFamily: RETRO, fontWeight: 700, fontSize: 11, format: 'capitalized' },
    separator: rgba(0.55, 0.58, 0.50, 0.5),
    term: { fontFamily: RETRO, fontSize: 12, textPrimary: rgba(0.1, 0.12, 0.08), textDim: rgba(0.35, 0.38, 0.30), accent: rgba(0.2, 0.22, 0.15), error: rgba(0.6, 0.15, 0.1), success: rgba(0.15, 0.4, 0.15), inputBg: rgba(0.88, 0.90, 0.84), inputRadius: 3 },
    bubble: { bg: rgba(0.82, 0.84, 0.78, 0.95), border: rgba(0.55, 0.58, 0.50, 0.7), text: rgba(0.4, 0.42, 0.38), complBorder: rgba(0.2, 0.5, 0.2, 0.7), complText: rgba(0.15, 0.4, 0.15), fontFamily: RETRO, fontSize: 11, radius: 8 }
  }
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Peach recolors accent/border/titlebar/bubble from the character's color (0..1 rgb).
function themeForCharacter(themeName, charColor) {
  const base = THEMES[themeName] || THEMES.Peach;
  if (base.name !== 'Peach' || !charColor) return base;
  const [r, g, b] = charColor;
  const color = rgba(r, g, b);
  const border = rgba(r, g, b, 0.6);
  const t = JSON.parse(JSON.stringify(base));
  t.popover.border = border;
  t.titleBar.text = color;
  t.titleBar.bg = rgba(clamp01(r * 0.3 + 0.7), clamp01(g * 0.3 + 0.7), clamp01(b * 0.3 + 0.7));
  t.separator = rgba(clamp01(r + 0.4), clamp01(g + 0.4), clamp01(b + 0.4), 0.25);
  t.term.accent = color;
  t.bubble.border = border;
  t.bubble.bg = rgba(clamp01(r * 0.15 + 0.85), clamp01(g * 0.15 + 0.85), clamp01(b * 0.15 + 0.85), 0.95);
  // keep font stacks (JSON clone preserved them)
  return t;
}

function titleString(displayName, format) {
  if (format === 'uppercase') return displayName.toUpperCase();
  if (format === 'lowercaseTilde') return displayName.toLowerCase();
  return displayName;
}

const PROVIDER_NAMES = { claude: 'Claude', codex: 'Codex', copilot: 'Copilot', gemini: 'Gemini', opencode: 'OpenCode', openclaw: 'OpenClaw' };

window.LilTheme = { THEMES, themeForCharacter, titleString, PROVIDER_NAMES, rgba };
