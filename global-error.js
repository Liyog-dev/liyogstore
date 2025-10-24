/* global-error.js
  Modern Advanced Global Error Debugger
  - Drop this file into your project and include it as:
    <script src="/path/to/global-error.js"></script>
  - Also include the HTML overlay snippet (global-error-overlay.html) near </body>
  - Optional: configure REMOTE_LOG_ENDPOINT to receive POST logs (no secret keys here)
*/

/* ========== Configuration ========== */
(() => {
  const CONFIG = {
    ENABLE_OVERLAY: true,          // show the bottom-right overlay (toggle off in production)
    SHOW_CONSOLE_ERRORS: true,     // still log to console
    REMOTE_LOG_ENDPOINT: null,     // 'https://your.api/logs' or null (optional)
    REMOTE_LOG_AUTH: null,         // 'Bearer ...' (optional; safe to use behind server)
    CONTEXT_LINES: 5,              // lines of source context to fetch & show
    MAX_SNIPPET_CHARS: 3200,       // cap snippet length
    IS_DEV_ONLY: false,            // if true, only active on localhost or dev hostnames
    SEND_DEBOUNCE_MS: 600,         // throttle remote sends per error
  };

  // If you want to auto-enable only on local dev uncomment:
  // CONFIG.IS_DEV_ONLY = !['your-production-domain.com'].includes(location.hostname);

  /* ========== Tiny helpers ========== */
  function nowISO() { return new Date().toISOString(); }
  function safeStr(v) {
    try { return (typeof v === 'string' ? v : JSON.stringify(v, null, 2)); } catch (e){ return String(v); }
  }
  function el(id) { return document.getElementById(id); }

  /* ========== Overlay UI ========== */
  const overlay = el('global-error-box');
  const titleEl = el('global-error-title');
  const summaryEl = el('global-error-summary');
  const fullEl = el('global-error-full');
  const detailsEl = el('global-error-details');
  const btnClose = el('global-error-close');
  const btnCopy = el('global-error-copy');

  if (btnClose) btnClose.addEventListener('click', () => overlay && (overlay.style.display = 'none'));
  if (btnCopy) btnCopy.addEventListener('click', async () => {
    try {
      const payload = (fullEl && fullEl.textContent) ? fullEl.textContent : summaryEl.textContent;
      await navigator.clipboard.writeText(payload || 'No error details');
      btnCopy.textContent = 'Copied';
      setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1500);
    } catch (err) { console.warn('Copy failed', err); }
  });

  function showOverlay(shortMsg, fullText) {
    if (CONFIG.IS_DEV_ONLY && !/localhost|127\.0\.0\.1/.test(location.hostname)) {
      // if dev-only, don't display in production
      return;
    }
    if (!CONFIG.ENABLE_OVERLAY) return;
    if (!overlay) {
      if (CONFIG.SHOW_CONSOLE_ERRORS) console.warn('Global Error Overlay not found in DOM.');
      return;
    }
    titleEl.textContent = 'Runtime error detected';
    summaryEl.textContent = shortMsg;
    fullEl.textContent = fullText;
    overlay.style.display = 'block';
  }

  /* ========== Parse stack traces for Chrome, Firefox, Safari ========== */
  // returns {file, line, column, func, stack}
  function parseStack(stackStr) {
    if (!stackStr) return null;
    const lines = stackStr.split('\n').map(l => l.trim()).filter(Boolean);
    // Try Chrome/Edge style: "    at func (https://.../file.js:10:20)"
    for (let line of lines) {
      const chromeMatch = line.match(/at\s+(.*?)\s+\(?(.+?):(\d+):(\d+)\)?$/);
      if (chromeMatch) {
        return { func: chromeMatch[1], file: chromeMatch[2], line: Number(chromeMatch[3]), column: Number(chromeMatch[4]), stack: stackStr };
      }
      // Firefox: "func@https://.../file.js:10:20"
      const ffMatch = line.match(/(.*?)@(.+?):(\d+):(\d+)$/);
      if (ffMatch) {
        return { func: ffMatch[1], file: ffMatch[2], line: Number(ffMatch[3]), column: Number(ffMatch[4]), stack: stackStr };
      }
      // Safari sometimes same as ff
    }
    // fallback: pick first URL-like chunk
    const urlMatch = stackStr.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
    if (urlMatch) {
      return { file: urlMatch[1], line: Number(urlMatch[2]), column: Number(urlMatch[3]), stack: stackStr };
    }
    return { stack: stackStr };
  }

  /* ========== Fetch source snippet around line (if CORS allows) ========== */
  async function fetchSourceSnippet(url, line, column, contextLines = CONFIG.CONTEXT_LINES) {
    if (!url) return null;
    try {
      // If url is a data:blob: or inline script, can't fetch; attempt only http(s)
      if (!/^https?:\/\//.test(url) && !/^\//.test(url)) {
        return null;
      }
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      const idx = Math.max(0, line - 1);
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(lines.length - 1, idx + contextLines);
      const snippetLines = lines.slice(start, end + 1);
      // add line numbers
      const numbered = snippetLines.map((ln, i) => {
        const lnNum = start + i + 1;
        const pointer = (lnNum === line) ? '>> ' : '   ';
        return `${pointer}${lnNum.toString().padStart(4,' ')} | ${ln}`;
      }).join('\n');
      return (`Source: ${url}\n\n${numbered}`.slice(0, CONFIG.MAX_SNIPPET_CHARS));
    } catch (err) {
      // CORS or network issue — return null to indicate inability to fetch source
      return null;
    }
  }

  /* ========== Suggest simple fixes based on message patterns ========== */
  function suggestFixes(message, parsed) {
    const suggestions = [];
    if (!message) return suggestions;
    if (/Cannot read properties of null|reading '.*' of null/i.test(message)) {
      suggestions.push(
        "This usually means code is calling `element.style` or similar on a missing DOM node. " +
        "Check the element query (getElementById/querySelector) and ensure the element exists before accessing properties. Example:\n\n" +
        "const el = document.getElementById('my-id');\nif (el) { el.style.display = 'none'; }\n"
      );
    }
    if (/Cannot read properties of undefined|reading '.*' of undefined/i.test(message)) {
      suggestions.push(
        "A value is undefined where your code expects an object. Add guards before property access, e.g.\n\n" +
        "if (obj && obj.prop) { ... }\n"
      );
    }
    if (/Failed to fetch|NetworkError|TypeError: Failed to fetch/i.test(message)) {
      suggestions.push("Network request failed. Check network connectivity, CORS headers on the API, and whether the endpoint URL is correct.");
    }
    if (/Unexpected token|SyntaxError/i.test(message)) {
      suggestions.push("Syntax error in a script — check the file and ensure valid JS/JSON. Look at the exact line/column shown above.");
    }
    if (parsed && parsed.file && parsed.line) {
      suggestions.push(`Check ${parsed.file} around line ${parsed.line}. See the source snippet (if available) above.`);
    }
    return suggestions;
  }

  /* ========== Throttle remote logging ========= */
  let lastSentAt = 0;
  async function sendRemoteLog(payload) {
    if (!CONFIG.REMOTE_LOG_ENDPOINT) return;
    const now = Date.now();
    if (now - lastSentAt < CONFIG.SEND_DEBOUNCE_MS) return;
    lastSentAt = now;
    try {
      await fetch(CONFIG.REMOTE_LOG_ENDPOINT, {
        method: 'POST',
        headers: Object.assign({
          'Content-Type': 'application/json'
        }, CONFIG.REMOTE_LOG_AUTH ? { 'Authorization': CONFIG.REMOTE_LOG_AUTH } : {}),
        body: JSON.stringify(payload)
      });
    } catch (err) {
      // send failure — swallow (overlay will still show local info)
      if (CONFIG.SHOW_CONSOLE_ERRORS) console.warn('Remote log failed:', err);
    }
  }

  /* ========== Build full diagnostic payload from error event ========== */
  async function buildDiagnostic({message, file, line, column, stack, extra = {}}) {
    const parsed = parseStack(stack || '');
    const snippet = await fetchSourceSnippet(file || parsed?.file, line || parsed?.line || 0, column || parsed?.column || 0);
    const suggestions = suggestFixes(message, parsed);
    const payload = {
      timestamp: nowISO(),
      message: message || (stack ? stack.split('\n')[0] : 'Unknown'),
      file: file || parsed?.file || '',
      line: line || parsed?.line || null,
      column: column || parsed?.column || null,
      stack: stack || '',
      snippet: snippet || '(source unavailable due to CORS or not retrieved)',
      userAgent: navigator.userAgent,
      url: location.href,
      suggestions,
      extra
    };
    return payload;
  }

  /* ========== Normalized display wrapper ========= */
  async function handleErrorEvent({ message, filename, lineno, colno, errorObj, origin = 'window.onerror' }) {
    try {
      const stack = (errorObj && errorObj.stack) ? errorObj.stack : (new Error()).stack;
      const diag = await buildDiagnostic({ message, file: filename, line: lineno, column: colno, stack, extra: { origin } });
      const short = `${diag.message}\n${diag.file ? `${diag.file}:${diag.line || '?'}:${diag.column || '?'}` : ''}`;
      const full = [
        `Time: ${diag.timestamp}`,
        `Message: ${diag.message}`,
        `File: ${diag.file}:${diag.line || ''}:${diag.column || ''}`,
        ``,
        `Stack:\n${diag.stack}`,
        ``,
        `Source snippet (if available):\n${diag.snippet}`,
        ``,
        `Suggestions:\n${diag.suggestions.join('\n\n') || '(no suggestions available)'}`
      ].join('\n\n');

      if (CONFIG.SHOW_CONSOLE_ERRORS) {
        console.groupCollapsed('🚨 Global Error Diagnostics');
        console.error(short);
        console.log('Full diagnostic object:', diag);
        console.groupEnd();
      }

      showOverlay(short, full);
      // Post to remote logging endpoint (if configured)
      sendRemoteLog(diag);
    } catch (err) {
      // If building diagnostic fails, fallback to simple overlay
      const fallback = `${message || 'Unknown error'}\n${filename || ''}:${lineno || ''}:${colno || ''}\nSee console for more.`;
      showOverlay(fallback, safeStr(err));
      if (CONFIG.SHOW_CONSOLE_ERRORS) console.error('Error building diagnostic:', err);
    }
  }

  /* ========== Attach global handlers ========== */

  // 1) Synchronous runtime errors
  window.addEventListener('error', (ev) => {
    // ev: {message, filename, lineno, colno, error}
    handleErrorEvent({ message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno, errorObj: ev.error, origin: 'window.onerror' });
  });

  // 2) Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const message = reason && reason.message ? reason.message : String(reason);
    const stack = reason && reason.stack ? reason.stack : (new Error()).stack;
    handleErrorEvent({ message: `UnhandledPromiseRejection: ${message}`, filename: null, lineno: null, colno: null, errorObj: { stack }, origin: 'unhandledrejection' });
  });

  // 3) Wrap fetch to capture HTTP errors & network failures
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const resp = await origFetch.apply(this, args);
      if (!resp.ok) {
        const text = await resp.clone().text().catch(() => '(unable to read body)');
        const message = `HTTP ${resp.status} ${resp.statusText} for ${args[0]}`;
        handleErrorEvent({ message, filename: String(args[0]), lineno: null, colno: null, errorObj: { stack: message }, origin: 'fetch' });
      }
      return resp;
    } catch (err) {
      const message = `Fetch failed for ${args[0]}: ${err.message || err}`;
      handleErrorEvent({ message, filename: String(args[0]), lineno: null, colno: null, errorObj: err, origin: 'fetch' });
      throw err; // rethrow so app logic can handle as usual
    }
  };

  // 4) Wrap XMLHttpRequest (optional)
  try {
    const OrigXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      const xhr = new OrigXHR();
      xhr.addEventListener('error', function () {
        handleErrorEvent({ message: `XHR error to ${xhr.responseURL}`, filename: xhr.responseURL, lineno: null, colno: null, errorObj: { stack: 'XHR error' }, origin: 'xhr' });
      });
      xhr.addEventListener('load', function () {
        if (xhr.status >= 400) {
          handleErrorEvent({ message: `XHR ${xhr.status} ${xhr.statusText} to ${xhr.responseURL}`, filename: xhr.responseURL, lineno: null, colno: null, errorObj: { stack: 'XHR error status' }, origin: 'xhr' });
        }
      });
      return xhr;
    }
    PatchedXHR.prototype = OrigXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;
  } catch (err) {
    if (CONFIG.SHOW_CONSOLE_ERRORS) console.warn('XHR wrap failed:', err);
  }

  // 5) Capture console.error calls and present summary
  if (console && console.error) {
    const origConsoleError = console.error.bind(console);
    console.error = function (...args) {
      origConsoleError(...args);
      try {
        // Short message for UI overlay, include first arg
        const msg = args.map(a => (a && a.message) ? a.message : (typeof a === 'string' ? a : safeStr(a))).join(' ');
        handleErrorEvent({ message: `[console.error] ${msg}`, filename: null, lineno: null, colno: null, errorObj: { stack: (new Error()).stack }, origin: 'console.error' });
      } catch (err) {
        // swallow - do not infinite loop
        origConsoleError('Error in console.error wrapper:', err);
      }
    };
  }

  // Helpful note to console
  if (CONFIG.SHOW_CONSOLE_ERRORS) {
    console.info('%cGlobal Error Debugger active', 'color: lightgreen; font-weight:bold');
  }

  /* ========== Public helper (optional) ========== */
  window.__GlobalErrorDebugger = {
    showOverlay,
    buildDiagnostic,
    handleErrorEvent,
    setRemoteEndpoint: (url, auth) => {
      CONFIG.REMOTE_LOG_ENDPOINT = url;
      CONFIG.REMOTE_LOG_AUTH = auth;
    },
    setDevOnly: (v) => { CONFIG.IS_DEV_ONLY = !!v; },
    setEnabled: (v) => { CONFIG.ENABLE_OVERLAY = !!v; }
  };

})();
