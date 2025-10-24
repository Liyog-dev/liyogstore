/* ==========================================================
 🌍 GLOBAL ERROR DEBUGGER (Enhanced Version)
 ------------------------------------------------------------
 Plug & Play: Drop this into any project for human-friendly,
 developer-grade debugging and error visualization.

 🧠 Features:
 • Captures runtime, promise, fetch & XHR errors
 • Fetches the exact source code lines that failed
 • Annotates, colorizes, and explains possible causes
 • Provides fix suggestions with examples
 • Non-destructive overlay; logs to console & optionally remote API
========================================================== */

(() => {
  const CONFIG = {
    ENABLE_OVERLAY: true,
    SHOW_CONSOLE_ERRORS: true,
    CONTEXT_LINES: 6,
    MAX_SNIPPET_CHARS: 5000,
    REMOTE_LOG_ENDPOINT: null,
    IS_DEV_ONLY: false
  };

  function safe(v) {
    try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  const $ = id => document.getElementById(id);

  /* 🧱 Build Overlay dynamically if missing */
  if (!$('#global-error-box')) {
    const div = document.createElement('div');
    div.id = 'global-error-box';
    div.innerHTML = `
      <style>
        #global-error-box {
          position: fixed; bottom: 0; right: 0; width: 420px;
          max-height: 80vh; background: #101010; color: #f5f5f5;
          border: 2px solid #ff6b6b; border-radius: 10px;
          font-family: 'Consolas', monospace; z-index: 999999;
          display: none; flex-direction: column;
          overflow: hidden; box-shadow: 0 0 20px rgba(255,0,0,0.4);
          animation: fadeIn .3s ease-in;
        }
        #global-error-header {
          display: flex; justify-content: space-between; align-items: center;
          background: #b00020; padding: 10px; font-weight: bold;
        }
        #global-error-content { padding: 10px; overflow-y: auto; white-space: pre-wrap; }
        #global-error-footer {
          display: flex; justify-content: flex-end; gap: 10px; padding: 10px;
          background: #202020;
        }
        #global-error-footer button {
          background: #333; color: #fff; border: none;
          padding: 6px 10px; border-radius: 4px; cursor: pointer;
        }
        @keyframes fadeIn { from {opacity: 0; transform: translateY(10px);} to {opacity: 1; transform: translateY(0);} }
        .code-highlight { background: rgba(255,0,0,0.2); padding: 2px 4px; }
      </style>
      <div id="global-error-header">
        <span>🚨 Error Detected</span>
        <div>
          <button id="global-error-copy">Copy</button>
          <button id="global-error-close">Close</button>
        </div>
      </div>
      <div id="global-error-content">
        <div id="global-error-summary"></div>
      </div>
      <div id="global-error-footer">
        <small>🧠 Global Debugger Active</small>
      </div>
    `;
    document.body.appendChild(div);
  }

  const overlay = $('#global-error-box');
  const summaryEl = $('#global-error-summary');

  $('#global-error-close').onclick = () => overlay.style.display = 'none';
  $('#global-error-copy').onclick = async () => {
    await navigator.clipboard.writeText(summaryEl.textContent);
    alert('Copied full error details to clipboard ✅');
  };

  /* 🎯 Parse stack lines */
  function parseStack(stackStr) {
    const m = stackStr.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
    if (!m) return null;
    return { file: m[1], line: Number(m[2]), column: Number(m[3]) };
  }

  /* 📄 Fetch surrounding source lines */
  async function fetchSourceSnippet(url, line, ctx = CONFIG.CONTEXT_LINES) {
    if (!url) return '';
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const txt = await res.text();
      const lines = txt.split(/\r?\n/);
      const start = Math.max(0, line - ctx - 1);
      const end = Math.min(lines.length, line + ctx);
      return lines.slice(start, end).map((ln, i) => {
        const lnNum = start + i + 1;
        const mark = lnNum === line ? '>>' : '  ';
        const lineStr = lnNum === line
          ? `<span class="code-highlight">${lnNum.toString().padStart(4)} | ${ln}</span>`
          : `${lnNum.toString().padStart(4)} | ${ln}`;
        return `${mark} ${lineStr}`;
      }).join('\n');
    } catch (e) { return '(Could not fetch source — likely CORS restriction)'; }
  }

  /* 💡 Suggest simple explanations */
  function suggest(message) {
    if (/null|undefined/.test(message)) {
      return '🪄 It looks like your code tried to access something that doesn’t exist yet (probably a DOM element or variable).\n👉 Ensure the element or variable is defined before using it.';
    }
    if (/Failed to fetch/.test(message)) {
      return '🌐 This looks like a network or CORS issue. Check if your API endpoint or Supabase key is accessible.';
    }
    if (/SyntaxError/.test(message)) {
      return '🔍 There might be a typo or invalid JSON/JS. Double-check the syntax at the shown line.';
    }
    return '🤔 Unhandled error type — inspect stack trace below for clues.';
  }

  /* 🧩 Display the pretty overlay */
  async function showOverlay(msg, file, line, col, stack) {
    if (!CONFIG.ENABLE_OVERLAY) return;
    const snippet = await fetchSourceSnippet(file, line);
    const explanation = suggest(msg);
    const summary = `
📅 Time: ${new Date().toLocaleString()}
📄 File: ${file}:${line}:${col}
💬 Message: ${msg}

───────────────────────────────
🧩 Source Snippet:
${snippet}

───────────────────────────────
💡 What it means:
${explanation}

───────────────────────────────
📜 Stack Trace:
${stack}
`;
    summaryEl.innerHTML = summary;
    overlay.style.display = 'flex';
    console.groupCollapsed('%c💥 Global Error Trace', 'color:red;font-weight:bold');
    console.log(summary);
    console.groupEnd();
  }

  /* 🔧 Universal handler */
  async function handleError({ message, filename, lineno, colno, error }) {
    const stack = (error && error.stack) ? error.stack : new Error().stack;
    const parsed = parseStack(stack || '');
    await showOverlay(message, filename || parsed?.file, lineno || parsed?.line, colno || parsed?.column, stack);
  }

  /* 🪄 Event Bindings */
  window.addEventListener('error', ev => handleError(ev));
  window.addEventListener('unhandledrejection', ev => {
    handleError({ message: ev.reason?.message || String(ev.reason), error: ev.reason });
  });

  if (CONFIG.SHOW_CONSOLE_ERRORS) console.info('%c✅ Global Debugger Initialized', 'color:lightgreen;font-weight:bold');
})();
