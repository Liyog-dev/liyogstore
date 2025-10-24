/*
  NEXT-GEN SELF-CONTAINED DEBUGGER v1.0
  - Single JS file. Injects UI + styles automatically.
  - No external AI keys. Smart heuristics built-in.
  - Usage: include <script src="..."></script> before end of </body> (or inline).
  - Safe-guards to avoid infinite loops and self-logging.
*/

(function () {
  // ---------- Singleton guard ----------
  if (window.__NEXTGEN_DEBUGGER_LOADED__) {
    console.info('NextGen Debugger already loaded.');
    return;
  }
  window.__NEXTGEN_DEBUGGER_LOADED__ = true;

  // ---------- Constants & config ----------
  const SIGNATURE = '[NextGen-Debugger]';
  const CONFIG = {
    maxEntries: 400,               // keep memory bounded
    debounceRemoteMs: 800,         // min gap between remote sends
    enabled: true,
    uiKeyboardToggle: '`',         // toggle key (backtick) optionally with ctrl
    attachToBottom: true,
    shrinkToBadge: true,           // show runtime badge separate from main panel
    badgePosition: { bottom: 12, right: 12 },
    themeAccent: '#67e8f9',        // neon accent
    themeDanger: '#fb7185',
    autoOpenOnError: true,
    fetchSnippetContext: 5,
    snippetMaxChars: 3200,
  };

  // ---------- Internal state ----------
  const state = {
    entries: [],
    counts: { error: 0, warn: 0, info: 0, fetch: 0 },
    lastRemoteAt: 0,
    isPanelOpen: false,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
  };

  // ---------- Preserve originals ----------
  const origConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  const origFetch = window.fetch.bind(window);
  const origXHR = window.XMLHttpRequest;

  // ---------- Utility helpers ----------
  function now() { return new Date().toISOString(); }
  function safeString(x) {
    try { return typeof x === 'string' ? x : JSON.stringify(x, null, 2); }
    catch (e) { return String(x); }
  }
  function el(sel) { return document.querySelector(sel); }
  function create(tag, attrs = {}, html = '') {
    const d = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'style') Object.assign(d.style, attrs[k]);
      else if (k.startsWith('data-')) d.setAttribute(k, attrs[k]);
      else d[k] = attrs[k];
    }
    if (html) d.innerHTML = html;
    return d;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------- Safe self-log (does not re-enter handlers) ----------
  function selfLog(...args) {
    try { origConsole.log(SIGNATURE, ...args); } catch (e) {}
  }

  // ---------- Create UI & styles ----------
  function injectStyles() {
    if (document.getElementById('ng-debugger-styles')) return;
    const s = create('style', { id: 'ng-debugger-styles' });
    s.textContent = `
/* NEXT-GEN Debugger Styles (injected) */
.ngdb-root { position: fixed; ${CONFIG.attachToBottom ? 'bottom: 0; left: 0; right: 0;' : 'top: 0; left: 0;'} z-index: 2147483647; display:flex; justify-content:center; pointer-events:none; }
.ngdb-panel {
  pointer-events:auto;
  width: min(980px, calc(100% - 28px));
  margin: 12px auto;
  background: linear-gradient(180deg, rgba(7,10,20,0.88), rgba(6,8,14,0.95));
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(2,6,23,0.8), inset 0 1px 0 rgba(255,255,255,0.02);
  color: #e6eef8;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  overflow: hidden;
  border: 1px solid rgba(100,200,255,0.06);
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.ngdb-header {
  display:flex;
  align-items:center;
  gap:12px;
  padding:10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  cursor: grab;
  user-select: none;
}
.ngdb-title { font-weight:700; font-size:14px; color: ${CONFIG.themeAccent}; letter-spacing:0.2px; }
.ngdb-controls { margin-left:auto; display:flex; gap:8px; align-items:center; }

.ngdb-btn {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.03);
  padding:6px 8px;
  border-radius:8px;
  color: #cfefff;
  font-weight:600;
  font-size:12px;
  cursor:pointer;
}
.ngdb-btn:hover { transform: translateY(-1px); }

.ngdb-body { display:flex; gap:12px; padding:12px; align-items:stretch; }
.ngdb-left { flex: 1 1 60%; overflow:auto; max-height: calc(60vh - 120px); }
.ngdb-right { width: 340px; min-width: 220px; max-height: calc(60vh - 120px); overflow:auto; background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.00)); border-radius:8px; padding:8px; border:1px solid rgba(255,255,255,0.02); }

.ngdb-entry {
  border-radius:8px;
  padding:8px;
  margin-bottom:8px;
  font-size:13px;
  line-height:1.35;
  border: 1px solid rgba(255,255,255,0.02);
  background: linear-gradient(180deg, rgba(255,255,255,0.006), rgba(255,255,255,0.002));
  cursor: pointer;
}
.ngdb-entry:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.3); transform: translateY(-2px); }
.ngdb-entry .meta { font-size:11px; color:#9fb6c9; margin-bottom:6px; }
.ngdb-entry .message { color:#e6eef8; font-weight:600; }
.ngdb-entry.error { border-left: 4px solid ${CONFIG.themeDanger}; }
.ngdb-entry.warn { border-left: 4px solid #f59e0b; }
.ngdb-entry.info { border-left: 4px solid ${CONFIG.themeAccent}; }

.ngdb-snippet { margin-top:8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; font-size:12px; background: rgba(2,6,23,0.6); padding:8px; border-radius:6px; color:#dbeafe; overflow:auto; max-height:220px; white-space:pre; border:1px solid rgba(255,255,255,0.02); }

.ngdb-right h4 { margin:6px 0; color:#cde9ff; font-size:13px; }
.ngdb-controls .count { font-size:12px; color:#cfeffb; padding:4px 8px; border-radius:6px; background: rgba(10,14,22,0.5); border:1px solid rgba(255,255,255,0.02); }

.ngdb-footer { display:flex; gap:8px; align-items:center; padding:10px 12px; border-top:1px solid rgba(255,255,255,0.02); }
.ngdb-search { flex:1; padding:8px 10px; border-radius:8px; background: rgba(255,255,255,0.02); border: none; color:#e6eef8; outline:none; font-size:13px; }

.ngdb-badge {
  position: fixed;
  z-index: 2147483650;
  pointer-events: auto;
  background: linear-gradient(180deg, rgba(10,14,20,0.95), rgba(8,10,16,0.98));
  border-radius: 12px;
  padding: 8px 10px;
  box-shadow: 0 8px 30px rgba(2,6,23,0.7);
  border: 1px solid rgba(255,255,255,0.03);
  color: #dbeafe;
  font-weight:700;
  font-size:12px;
  display:flex;
  gap:8px;
  align-items:center;
}
.ngdb-badge .dot { width:10px; height:10px; border-radius:6px; background: ${CONFIG.themeAccent}; box-shadow: 0 0 8px ${CONFIG.themeAccent}; }
.ngdb-hidden { display:none !important; }
`;
    document.head.appendChild(s);
  }

  function createUI() {
    if (document.getElementById('ngdb-root')) return;

    // Root container
    const root = create('div', { id: 'ngdb-root', className: 'ngdb-root' });
    root.style.pointerEvents = 'none';

    // Panel
    const panel = create('div', { id: 'ngdb-panel', className: 'ngdb-panel', role: 'dialog', 'aria-label': 'Debug Console' });

    // Header
    const header = create('div', { className: 'ngdb-header', id: 'ngdb-header' });
    header.innerHTML = `
      <div class="ngdb-title">⚡ NEXT-GEN Debugger</div>
      <div class="ngdb-controls">
        <div class="count" id="ngdb-counts">E:0 W:0 I:0 F:0</div>
        <button class="ngdb-btn" id="ngdb-clear">Clear</button>
        <button class="ngdb-btn" id="ngdb-copy">Copy All</button>
        <button class="ngdb-btn" id="ngdb-close">Close</button>
      </div>
    `;
    panel.appendChild(header);

    // Body
    const body = create('div', { className: 'ngdb-body' });
    const left = create('div', { className: 'ngdb-left', id: 'ngdb-left' });
    const right = create('div', { className: 'ngdb-right', id: 'ngdb-right' });

    // Right panel: details and suggestions
    right.innerHTML = `
      <h4>Selected</h4>
      <div id="ngdb-selected" style="font-size:13px; color:#9fb6c9; min-height:40px;">No entry selected</div>
      <h4>Smart Suggestions</h4>
      <div id="ngdb-suggestions" style="font-size:13px; color:#cfefff; min-height:60px;">No suggestions</div>
      <h4>Full Stack / Extra</h4>
      <div id="ngdb-fullstack" style="font-size:12px; color:#9fb6c9; min-height:60px; white-space:pre-wrap;"></div>
    `;

    // Footer: search & controls
    const footer = create('div', { className: 'ngdb-footer' });
    const search = create('input', { className: 'ngdb-search', id: 'ngdb-search', placeholder: 'Search logs (press Enter)' });
    footer.appendChild(search);

    body.appendChild(left);
    body.appendChild(right);
    panel.appendChild(body);
    panel.appendChild(footer);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Badge (compact runtime board)
    const badge = create('div', { id: 'ngdb-badge', className: 'ngdb-badge' });
    badge.style.bottom = `${CONFIG.badgePosition.bottom}px`;
    badge.style.right = `${CONFIG.badgePosition.right}px`;
    badge.innerHTML = `<div class="dot" id="ngdb-badge-dot"></div><div id="ngdb-badge-text">Debug</div>`;
    document.body.appendChild(badge);

    // Set up interactions
    const leftEl = document.getElementById('ngdb-left');
    const selectedEl = document.getElementById('ngdb-selected');
    const suggestionsEl = document.getElementById('ngdb-suggestions');
    const fullStackEl = document.getElementById('ngdb-fullstack');
    const countsEl = document.getElementById('ngdb-counts');

    function updateCounts() {
      countsEl.textContent = `E:${state.counts.error} W:${state.counts.warn} I:${state.counts.info} F:${state.counts.fetch}`;
      const badgeText = `${state.counts.error}⚠︎ ${state.counts.fetch}⤓`;
      document.getElementById('ngdb-badge-text').textContent = badgeText;
    }

    function clearEntries() {
      state.entries = [];
      state.counts = { error: 0, warn: 0, info: 0, fetch: 0 };
      leftEl.innerHTML = '';
      selectedEl.textContent = 'No entry selected';
      suggestionsEl.textContent = 'No suggestions';
      fullStackEl.textContent = '';
      updateCounts();
    }

    document.getElementById('ngdb-clear').addEventListener('click', clearEntries);
    document.getElementById('ngdb-close').addEventListener('click', togglePanel);
    document.getElementById('ngdb-copy').addEventListener('click', copyAll);

    // Badge toggles panel
    badge.addEventListener('click', () => openPanel(true));

    // Search handler
    search.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const q = ev.target.value.trim().toLowerCase();
        filterEntries(q);
      }
    });

    // Dragging
    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', dragging);
    document.addEventListener('mouseup', endDrag);

    // Clicking entries
    leftEl.addEventListener('click', (ev) => {
      const item = ev.target.closest('.ngdb-entry');
      if (!item) return;
      const idx = Number(item.getAttribute('data-idx'));
      selectEntry(idx);
    });

    // expose updateCounts
    return { root, panel, leftEl, updateCounts, openPanel, closePanel: closePanelInternal, togglePanel };
    
    // local helper definitions
    function selectEntry(i) {
      const entry = state.entries[i];
      if (!entry) return;
      // highlight
      Array.from(leftEl.children).forEach(ch => ch.classList.remove('selected'));
      const node = leftEl.querySelector(`.ngdb-entry[data-idx="${i}"]`);
      if (node) node.classList.add('selected');

      selectedEl.innerHTML = `<div style="font-weight:700;color:${entry.type==='error'?CONFIG.themeDanger:CONFIG.themeAccent}">${escapeHtml(entry.message)}</div>
        <div style="font-size:12px;color:#9fb6c9;margin-top:6px;">${escapeHtml(entry.meta)}</div>`;

      // suggestions
      suggestionsEl.innerHTML = `<div style="font-size:13px;color:#dbeafe">${escapeHtml(entry.suggestion || '(no suggestion)')}</div>`;

      // full stack
      fullStackEl.textContent = entry.stack || '(no stack)';
    }

    function filterEntries(q) {
      if (!q) {
        // show all
        renderEntries();
        return;
      }
      const matches = state.entries.map((e, idx) => ({ e, idx })).filter(x => {
        const hay = (x.e.message + ' ' + (x.e.meta || '') + ' ' + (x.e.stack || '')).toLowerCase();
        return hay.includes(q);
      });
      leftEl.innerHTML = '';
      matches.forEach(item => {
        leftEl.appendChild(renderEntry(item.e, item.idx));
      });
    }

    function renderEntries() {
      leftEl.innerHTML = '';
      for (let i = 0; i < state.entries.length; i++) {
        leftEl.appendChild(renderEntry(state.entries[i], i));
      }
    }

    function renderEntry(entry, idx) {
      const div = create('div', { className: 'ngdb-entry ' + (entry.type || 'info'), 'data-idx': idx });
      div.innerHTML = `<div class="meta">${escapeHtml(entry.time)} • ${escapeHtml(entry.source)}</div>
        <div class="message">${escapeHtml(truncate(entry.message, 260))}</div>
        ${entry.snippet ? `<div class="ngdb-snippet">${escapeHtml(truncate(entry.snippet, 1000))}</div>` : ''}`;
      return div;
    }

    function openPanel(focusBadge) {
      // show panel
      root.style.pointerEvents = 'auto';
      panel.style.transform = '';
      panel.style.display = 'flex';
      state.isPanelOpen = true;
      document.getElementById('ngdb-root').classList.remove('ngdb-hidden');
      document.getElementById('ngdb-panel').style.maxHeight = '60vh';
      updateCounts();
      if (focusBadge) {
        // nothing
      }
    }

    function closePanelInternal() {
      panel.style.display = 'none';
      document.getElementById('ngdb-root').classList.add('ngdb-hidden');
      state.isPanelOpen = false;
    }

    function togglePanel() {
      if (state.isPanelOpen) closePanelInternal();
      else openPanel();
    }

    function copyAll() {
      try {
        const all = state.entries.map(e => `[${e.type.toUpperCase()}] ${e.time}\n${e.message}\n${e.meta}\n\n${e.stack || ''}\n\n`).join('\n\n');
        copyTextToClipboard(all);
        flash('Copied');
      } catch (err) {
        flash('Copy failed');
      }
    }

    function flash(msg) {
      const btn = document.getElementById('ngdb-copy');
      const orig = btn.textContent;
      btn.textContent = msg;
      setTimeout(() => btn.textContent = orig, 1200);
    }

    // Drag helpers
    function startDrag(ev) {
      state.isDragging = true;
      header.style.cursor = 'grabbing';
      state.dragOffset.x = ev.clientX;
      state.dragOffset.y = ev.clientY;
    }
    function dragging(ev) {
      if (!state.isDragging) return;
      // limit movement by translating panel slightly for UX (not absolute positioning to avoid overlay issues)
      const dx = ev.clientX - state.dragOffset.x;
      const dy = ev.clientY - state.dragOffset.y;
      state.dragOffset.x = ev.clientX;
      state.dragOffset.y = ev.clientY;
      // apply small transform for natural feel
      panel.style.transform = `translate(${clamp(dx, -120, 120)}px, ${clamp(dy, -60, 60)}px)`;
      // reset transform after short timeout
      clearTimeout(panel.resetTransformTimer);
      panel.resetTransformTimer = setTimeout(() => { panel.style.transform = ''; }, 320);
    }
    function endDrag() { state.isDragging = false; header.style.cursor = 'grab'; }

    // helper utility inside UI scope
    function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function truncate(s, n) { if (!s) return ''; return s.length>n? s.slice(0,n-1)+'…' : s; }
  }

  // ---------- Smart suggestion heuristics ----------
  function makeSuggestion(message, parsed) {
    if (!message) return null;
    const m = message;
    if (/Cannot read properties of null|Cannot read property '.*' of null/i.test(m)) {
      return "Check that the DOM element exists before accessing its properties. Example:\n\n```javascript\nconst el = document.getElementById('x');\nif (el) { /* use el */ }\n```\n";
    }
    if (/Cannot read properties of undefined|Cannot read property '.*' of undefined/i.test(m)) {
      return "A variable is undefined. Add guards or default values:\n\n```javascript\nconst val = obj?.prop ?? defaultValue;\n```\n";
    }
    if (/is not a function/i.test(m)) {
      return "You're calling a value as function which is not callable. Verify type or bind correct function:\n\n```javascript\nif (typeof maybeFn === 'function') maybeFn();\n```\n";
    }
    if (/Failed to fetch/i.test(m) || /NetworkError/i.test(m)) {
      return "Network request failed. Check CORS, network connectivity, and endpoint correctness. Example retry pattern:\n\n```javascript\n// simple retry\nasync function tryFetch(url){\n  for(let i=0;i<3;i++){\n    try { return await fetch(url); } catch(e){ await new Promise(r=>setTimeout(r, 200 * Math.pow(2,i))); }\n  }\n}\n```\n";
    }
    if (/Unexpected token/i.test(m)) {
      return "Syntax error in JSON or JS. Check file/response for invalid characters, trailing commas or improper quotes.\n";
    }
    // fallback
    if (parsed && parsed.file && parsed.line) {
      return `Check ${parsed.file} around line ${parsed.line}. If source not available (CORS), open devtools and inspect network / map files.`;
    }
    return null;
  }

  // ---------- Stack parsing ----------
  function parseStack(stackStr) {
    if (!stackStr) return null;
    const lines = stackStr.split(/\n/).map(l => l.trim()).filter(Boolean);
    for (let line of lines) {
      // Chrome format: at func (file:line:col)
      const chrome = line.match(/at\s+(.*?)\s+\(?(.+?):(\d+):(\d+)\)?$/);
      if (chrome) return { func: chrome[1], file: chrome[2], line: Number(chrome[3]), column: Number(chrome[4]), stack: stackStr };
      // Firefox format: func@file:line:col
      const ff = line.match(/(.*?)@(.+?):(\d+):(\d+)$/);
      if (ff) return { func: ff[1], file: ff[2], line: Number(ff[3]), column: Number(ff[4]), stack: stackStr };
    }
    const urlMatch = stackStr.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
    if (urlMatch) return { file: urlMatch[1], line: Number(urlMatch[2]), column: Number(urlMatch[3]), stack: stackStr };
    return { stack: stackStr };
  }

  // ---------- Try fetching source snippet (CORS-safe) ----------
  async function fetchSourceSnippet(file, line, context = CONFIG.fetchSnippetContext) {
    if (!file || !/^https?:\/\//.test(file)) return null;
    try {
      const res = await origFetch(file, { cache: 'no-store' });
      if (!res.ok) return null;
      const txt = await res.text();
      const lines = txt.split(/\r?\n/);
      const idx = Math.max(0, (line || 1) - 1);
      const start = Math.max(0, idx - context);
      const end = Math.min(lines.length - 1, idx + context);
      const snippet = lines.slice(start, end + 1).map((ln, i) => {
        const num = start + i + 1;
        const marker = (num === line) ? '>>' : '  ';
        return `${marker} ${String(num).padStart(4)} | ${ln}`;
      }).join('\n');
      return snippet.slice(0, CONFIG.snippetMaxChars);
    } catch (err) {
      return null; // likely CORS or network
    }
  }

  // ---------- Add entry to UI & state ----------
  async function pushEntry({ type = 'info', message = '', meta = '', source = '', stack = '', origin = '', timestamp = now() }) {
    try {
      if (!CONFIG.enabled) return;
      const parsed = parseStack(stack || '');
      const snippet = await fetchSourceSnippet(parsed?.file || source, parsed?.line || null).catch(() => null);
      const suggestion = makeSuggestion(message, parsed);

      const entry = { type, message, meta, source, stack, time: timestamp, snippet, suggestion };
      // safety: avoid logging our own internal messages
      const combined = (message + ' ' + meta + ' ' + (stack || '')).toLowerCase();
      if (combined.includes(SIGNATURE.toLowerCase())) return;

      state.entries.unshift(entry);
      state.entries = state.entries.slice(0, CONFIG.maxEntries);

      // update counts
      if (type === 'error') state.counts.error++;
      if (type === 'warn') state.counts.warn++;
      if (type === 'info') state.counts.info++;
      if (type === 'fetch') state.counts.fetch++;

      // push into UI
      // lazy create UI
      if (!document.getElementById('ngdb-root')) {
        injectStyles();
        createUI();
      }
      const left = document.getElementById('ngdb-left');
      if (left) {
        const node = document.createElement('div');
        node.className = `ngdb-entry ${type}`;
        node.setAttribute('data-idx', 0); // we'll re-render below
        node.innerHTML = `<div class="meta">${timestamp} • ${escapeHtml(origin || source || 'client')}</div>
          <div class="message">${escapeHtml(truncateText(message, 260))}</div>
          ${snippet ? `<div class="ngdb-snippet">${escapeHtml(truncateText(snippet, 1000))}</div>` : ''}`;
        left.insertBefore(node, left.firstChild);
        // reindex nodes
        Array.from(left.children).forEach((ch, idx) => ch.setAttribute('data-idx', idx));
      }

      // update counts on header & badge
      const countsEl = document.getElementById('ngdb-counts');
      if (countsEl) countsEl.textContent = `E:${state.counts.error} W:${state.counts.warn} I:${state.counts.info} F:${state.counts.fetch}`;
      const badgeText = document.getElementById('ngdb-badge-text');
      if (badgeText) badgeText.textContent = `${state.counts.error}⚠︎ ${state.counts.fetch}⤓`;

      // optionally open panel on errors
      if (type === 'error' && CONFIG.autoOpenOnError) {
        const root = document.getElementById('ngdb-root');
        if (root) root.classList.remove('ngdb-hidden');
        const panel = document.getElementById('ngdb-panel');
        if (panel) panel.style.display = 'flex';
      }

      // optional remote send (debounced)
      sendRemote({ entry }).catch(() => {});
    } catch (err) {
      // swallow to avoid loop
      try { origConsole.error(SIGNATURE, 'pushEntry failed', err); } catch (e) {}
    }
  }

  // ---------- Helpers ----------
  function truncateText(s, n) { if (!s) return ''; return s.length>n ? s.slice(0,n-1)+'…' : s; }
  function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function copyTextToClipboard(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // ---------- Remote logging hook (no-op until endpoint set) ----------
  let REMOTE = { url: null, auth: null };
  async function sendRemote({ entry } = {}) {
    if (!REMOTE.url) return;
    const nowTs = Date.now();
    if (nowTs - state.lastRemoteAt < CONFIG.debounceRemoteMs) return;
    state.lastRemoteAt = nowTs;
    try {
      await origFetch(REMOTE.url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, REMOTE.auth ? { Authorization: REMOTE.auth } : {}),
        body: JSON.stringify({ timestamp: now(), entry })
      });
    } catch (e) {
      // ignore
    }
  }

  // ---------- Console wrappers (safeguarded) ----------
  (function wrapConsole() {
    try {
      ['log','warn','error'].forEach(level => {
        const orig = origConsole[level];
        console[level] = function (...args) {
          try {
            // build message
            const msg = args.map(a => (a && a.stack) ? a.stack : (typeof a === 'string' ? a : safeString(a))).join(' ');
            // avoid logging our own messages
            if (String(msg || '').includes(SIGNATURE)) return orig(...args);
            // push entry (non-blocking)
            pushEntry({ type: level === 'warn' ? 'warn' : (level === 'error' ? 'error' : 'info'),
                        message: String(msg), meta: '', source: 'console', stack: (args[0] && args[0].stack) || '', origin: 'console' }).catch(() => {});
          } catch (e) {}
          try { orig.apply(console, args); } catch (e) {}
        };
      });
    } catch (e) { origConsole.error(SIGNATURE, 'wrapConsole failed', e); }
  })();

  // ---------- window.onerror and unhandledrejection ----------
  window.addEventListener('error', function (ev) {
    try {
      // ev: { message, filename, lineno, colno, error }
      const msg = ev && ev.message ? ev.message : 'Uncaught error';
      const stack = ev && ev.error && ev.error.stack ? ev.error.stack : (new Error()).stack;
      pushEntry({
        type: 'error',
        message: msg,
        meta: `${ev.filename || ''}:${ev.lineno||''}:${ev.colno||''}`,
        source: ev.filename || '',
        stack,
        origin: 'window.onerror',
      }).catch(() => {});
    } catch (e) {}
  });

  window.addEventListener('unhandledrejection', function (ev) {
    try {
      const reason = ev && ev.reason ? (ev.reason.message || safeString(ev.reason)) : 'Unhandled rejection';
      const stack = ev && ev.reason && ev.reason.stack ? ev.reason.stack : (new Error()).stack;
      pushEntry({
        type: 'error',
        message: `UnhandledPromiseRejection: ${reason}`,
        meta: '',
        source: '',
        stack,
        origin: 'unhandledrejection'
      }).catch(() => {});
    } catch (e) {}
  });

  // ---------- fetch wrapper (uses origFetch to avoid recursion) ----------
  (function wrapFetch() {
    try {
      window.fetch = async function (...args) {
        try {
          const resp = await origFetch.apply(this, args);
          if (!resp.ok) {
            const msg = `HTTP ${resp.status} ${resp.statusText} for ${String(args[0])}`;
            pushEntry({
              type: 'fetch',
              message: msg,
              meta: '',
              source: String(args[0]),
              stack: msg,
              origin: 'fetch'
            }).catch(() => {});
          }
          return resp;
        } catch (err) {
          const msg = `Fetch failed for ${String(args[0])}: ${err && err.message ? err.message : safeString(err)}`;
          pushEntry({
            type: 'fetch',
            message: msg,
            meta: '',
            source: String(args[0]),
            stack: err && err.stack ? err.stack : (new Error()).stack,
            origin: 'fetch'
          }).catch(() => {});
          throw err;
        }
      };
    } catch (e) { origConsole.error(SIGNATURE, 'wrapFetch failed', e); }
  })();

  // ---------- XMLHttpRequest wrapper ----------
  (function wrapXHR() {
    try {
      if (!origXHR) return;
      function PatchedXHR() {
        const xhr = new origXHR();
        // intercept errors and statuses
        xhr.addEventListener('error', function () {
          try {
            pushEntry({
              type: 'fetch',
              message: `XHR error to ${xhr.responseURL || '(unknown)'}`,
              meta: '',
              source: xhr.responseURL || '',
              stack: 'XHR error',
              origin: 'xhr'
            }).catch(()=>{});
          } catch (e) {}
        });
        xhr.addEventListener('load', function () {
          try {
            if (xhr.status >= 400) {
              pushEntry({
                type: 'fetch',
                message: `XHR ${xhr.status} ${xhr.statusText} to ${xhr.responseURL}`,
                meta: '',
                source: xhr.responseURL || '',
                stack: 'XHR status error',
                origin: 'xhr'
              }).catch(()=>{});
            }
          } catch (e) {}
        });
        return xhr;
      }
      // copy prototype so instanceof checks pass
      PatchedXHR.prototype = origXHR.prototype;
      window.XMLHttpRequest = PatchedXHR;
    } catch (e) { origConsole.error(SIGNATURE, 'wrapXHR failed', e); }
  })();

  // ---------- Expose API for remote endpoint and toggles ----------
  window.__NEXTGEN_DEBUGGER = {
    setRemoteEndpoint: (url, auth) => { REMOTE.url = url; REMOTE.auth = auth || null; selfLog('set remote', url); },
    enable: (v=true) => { CONFIG.enabled = !!v; },
    open: () => {
      const root = document.getElementById('ngdb-root');
      if (root) root.classList.remove('ngdb-hidden');
      const panel = document.getElementById('ngdb-panel');
      if (panel) panel.style.display = 'flex';
      state.isPanelOpen = true;
    },
    close: () => {
      const panel = document.getElementById('ngdb-panel');
      if (panel) panel && (panel.style.display = 'none');
      state.isPanelOpen = false;
    },
    clear: () => {
      const left = document.getElementById('ngdb-left');
      if (left) left.innerHTML = '';
      state.entries = [];
      state.counts = { error:0, warn:0, info:0, fetch:0 };
      const countsEl = document.getElementById('ngdb-counts'); if (countsEl) countsEl.textContent = 'E:0 W:0 I:0 F:0';
    }
  };

  // ---------- Keyboard toggle ----------
  document.addEventListener('keydown', function (ev) {
    const keyOk = ev.key === CONFIG.uiKeyboardToggle && (ev.ctrlKey || ev.metaKey || true); // allow simple toggle with backtick
    if (!keyOk) return;
    const panel = document.getElementById('ngdb-panel');
    if (!panel) {
      injectStyles();
      createUI();
    } else {
      if (panel.style.display === 'none' || panel.style.display === '') {
        window.__NEXTGEN_DEBUGGER.open();
      } else {
        window.__NEXTGEN_DEBUGGER.close();
      }
    }
  });

  // ---------- Initialize styles & minimal UI immediately ----------
  try {
    injectStyles();
    createUI();
    // hide panel by default to avoid shaking UI; rely on badge
    const panel = document.getElementById('ngdb-panel');
    if (panel) panel.style.display = 'none';
  } catch (err) {
    try { origConsole.error(SIGNATURE, 'init failed', err); } catch (e) {}
  }

  // ---------- Small friendly message ----------
  try { origConsole.info('%c' + SIGNATURE + ' initialized', 'color:' + CONFIG.themeAccent + '; font-weight:700;'); } catch (e) {}

})();
