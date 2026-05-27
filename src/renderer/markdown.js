// Port of TerminalView.renderMarkdown / renderInlineMarkdown.
// Builds DOM nodes (text nodes + styled spans), so user/model content is never
// injected as HTML. Handles fenced code, headings, bullets, inline code, bold,
// links, and bare URLs.

(function () {
  function span(text, style) {
    const s = document.createElement('span');
    s.textContent = text;
    Object.assign(s.style, style);
    return s;
  }

  function renderInline(text, t, frag) {
    const term = t.term;
    let i = 0;
    const n = text.length;
    let plainBuf = '';
    const flush = () => {
      if (plainBuf) {
        frag.appendChild(span(plainBuf, { color: term.textPrimary }));
        plainBuf = '';
      }
    };

    while (i < n) {
      const c = text[i];

      // inline code
      if (c === '`') {
        const close = text.indexOf('`', i + 1);
        if (close > i) {
          flush();
          frag.appendChild(span(text.slice(i + 1, close), {
            fontFamily: "'Cascadia Mono','Consolas',monospace",
            color: term.accent, background: term.inputBg, borderRadius: '3px', padding: '0 2px'
          }));
          i = close + 1; continue;
        }
      }
      // bold **
      if (c === '*' && text[i + 1] === '*') {
        const close = text.indexOf('**', i + 2);
        if (close > i + 1) {
          flush();
          frag.appendChild(span(text.slice(i + 2, close), { color: term.textPrimary, fontWeight: 700 }));
          i = close + 2; continue;
        }
      }
      // [label](url)
      if (c === '[') {
        const closeB = text.indexOf(']', i + 1);
        if (closeB > i && text[closeB + 1] === '(') {
          const closeP = text.indexOf(')', closeB + 2);
          if (closeP > closeB) {
            flush();
            frag.appendChild(makeLink(text.slice(i + 1, closeB), text.slice(closeB + 2, closeP), term));
            i = closeP + 1; continue;
          }
        }
      }
      // bare URL
      if (c === 'h' && (text.startsWith('https://', i) || text.startsWith('http://', i))) {
        let j = i;
        while (j < n && !/\s/.test(text[j]) && text[j] !== ')' && text[j] !== '>') j++;
        const url = text.slice(i, j);
        flush();
        frag.appendChild(makeLink(url, url, term));
        i = j; continue;
      }
      plainBuf += c;
      i++;
    }
    flush();
  }

  function makeLink(label, url, term) {
    const a = document.createElement('a');
    a.textContent = label;
    a.href = '#';
    a.style.color = term.accent;
    a.style.textDecoration = 'underline';
    a.style.cursor = 'pointer';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (/^https?:\/\//.test(url) && window.lilOpenExternal) window.lilOpenExternal(url);
    });
    return a;
  }

  function render(text, t) {
    const frag = document.createDocumentFragment();
    const term = t.term;
    const lines = text.split('\n');
    let inCode = false;
    let codeLines = [];

    const emitCode = () => {
      const pre = document.createElement('div');
      pre.textContent = codeLines.join('\n') + '\n';
      Object.assign(pre.style, {
        fontFamily: "'Cascadia Mono','Consolas',monospace",
        fontSize: (term.fontSize - 1) + 'px',
        color: term.textPrimary, background: term.inputBg,
        whiteSpace: 'pre-wrap', borderRadius: '4px', padding: '4px 6px', margin: '2px 0'
      });
      frag.appendChild(pre);
      codeLines = [];
    };

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const suffix = li < lines.length - 1 ? '\n' : '';
      if (line.startsWith('```')) {
        if (inCode) { emitCode(); inCode = false; }
        else { inCode = true; }
        continue;
      }
      if (inCode) { codeLines.push(line); continue; }

      if (line.startsWith('### ')) {
        frag.appendChild(span(line.slice(4) + suffix, { color: term.accent, fontWeight: 700, fontSize: term.fontSize + 'px' }));
      } else if (line.startsWith('## ')) {
        frag.appendChild(span(line.slice(3) + suffix, { color: term.accent, fontWeight: 700, fontSize: (term.fontSize + 1) + 'px' }));
      } else if (line.startsWith('# ')) {
        frag.appendChild(span(line.slice(2) + suffix, { color: term.accent, fontWeight: 700, fontSize: (term.fontSize + 2) + 'px' }));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        frag.appendChild(span('  • ', { color: term.accent }));
        renderInline(line.slice(2) + suffix, t, frag);
      } else {
        renderInline(line + suffix, t, frag);
      }
    }
    if (inCode && codeLines.length) emitCode();
    return frag;
  }

  window.LilMarkdown = { render };
})();
