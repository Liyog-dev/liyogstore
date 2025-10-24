/*
  Modern Advanced Global AI Error Debugger
  - Includes Gemini API for smart suggestions.
  - Drop this file into your project: <script src="/path/to/global-debugger.js"></script>
  - Include the HTML overlay (global-debugger.html) near </body>
*/

(async () => {
  /* ========== Configuration ========== */
  const CONFIG = {
    ENABLE_OVERLAY: true,
    SHOW_CONSOLE_ERRORS: true,
    REMOTE_LOG_ENDPOINT: null, // e.g., 'https://your.api/logs'
    REMOTE_LOG_AUTH: null,     // e.g., 'Bearer ...'
    CONTEXT_LINES: 5,
    MAX_SNIPPET_CHARS: 3200,
    IS_DEV_ONLY: false,
    SEND_DEBOUNCE_MS: 600,
  };

  // --- AI Configuration ---
  // IMPORTANT: Leave apiKey as "" - it will be supplied by the environment.
  const GEMINI_API_KEY = "";
  const GEMINI_API_URL = `https://generativelen.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
  
  // This prompt defines the AI's role and expected output.
  const AI_SYSTEM_PROMPT = `You are an expert web developer and a senior debugging assistant.
Analyze the following JavaScript runtime error details. Provide a clear, step-by-step explanation and a suggested code fix.
You MUST respond in valid JSON format matching this schema:
{
  "type": "object",
  "properties": {
    "explanation": { "type": "string", "description": "A clear, simple explanation of what the error means and what likely caused it." },
    "suggestedFix": { "type": "string", "description": "A code snippet (using markdown \`\`\`javascript) showing the suggested fix. If no specific fix is possible, provide a general approach." }
  },
  "required": ["explanation", "suggestedFix"]
}`;

  // This schema is sent to the API to enforce the JSON output.
  const AI_RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
      "explanation": { "type": "STRING" },
      "suggestedFix": { "type": "STRING" }
    },
    required: ["explanation", "suggestedFix"]
  };

  /* CRITICAL: Grab original fetch before it's wrapped.
    This prevents an infinite loop if our *own* logging or AI calls fail.
  */
  const origFetch = window.fetch;

  /* ========== Tiny helpers ========== */
  function nowISO() { return new Date().toISOString(); }
  function safeStr(v) {
    try { return (typeof v === 'string' ? v : JSON.stringify(v, null, 2)); }
    catch (e) { return String(v); }
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
  const aiContainerEl = el('global-error-ai-container');
  const aiContentEl = el('global-error-ai-content');

  // UI Listeners
  if (btnClose) btnClose.addEventListener('click', () => overlay && (overlay.style.display = 'none'));
  
  // Use execCommand for clipboard access in iFrames
  if (btnCopy) btnCopy.addEventListener('click', () => {
    try {
      const summaryText = summaryEl.textContent || '';
      const fullText = fullEl.textContent || '';
      const aiText = aiContentEl.textContent || '';
      
      const payload = `[Error Summary]\n${summaryText}\n\n[Full Error Details]\n${fullText}\n\n[AI Suggestion]\n${aiText}`;

      const textarea = document.createElement('textarea');
      textarea.value = payload;
      textarea.style.position = 'fixed'; // Prevent scrolling to bottom
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      btnCopy.textContent = 'Copied';
      setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1500);
    } catch (err) {
      console.warn('Copy failed', err);
      btnCopy.textContent = 'Failed';
      setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1500);
    }
  });

  /**
   * Shows the overlay with initial data and AI loading state.
   */
  function showOverlay(shortMsg, fullText, isAiLoading = false) {
    if (CONFIG.IS_DEV_ONLY && !/localhost|127\.0\.0\.1/.test(location.hostname)) {
      return;
    }
    if (!CONFIG.ENABLE_OVERLAY || !overlay) {
      if (CONFIG.SHOW_CONSOLE_ERRORS && !overlay) console.warn('Global Error Overlay not found in DOM.');
      return;
    }
    titleEl.textContent = 'Runtime Error Detected';
    summaryEl.textContent = shortMsg;
    fullEl.textContent = fullText;
    
    if (aiContainerEl) aiContainerEl.style.display = 'block';
    if (aiContentEl) {
      if (isAiLoading) {
        aiContentEl.innerHTML = '<span style="color:#9ca3af;">Analyzing error with AI...</span>';
      }
    }
    
    overlay.style.display = 'block';
    // Automatically open the details
    if(detailsEl) detailsEl.open = true;
  }
  
  /**
   * Updates the overlay with the AI's suggestions after they arrive.
   */
  function updateOverlayWithAi(aiSuggestion) {
    if (!aiContentEl) return;

    if (aiSuggestion) {
      // Format the AI response into clean HTML
      const explanationHtml = aiSuggestion.explanation
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
        
      // A simple markdown parser for code blocks
      const fixHtml = aiSuggestion.suggestedFix
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/```javascript\n?([\s\S]*?)\n?```/g, 
          '<pre style="background:#0f172a; color:#e2e8f0; padding:10px; border-radius:6px; margin-top:8px; font-size:11px; border: 1px solid #1e293b; overflow-x: auto;"><code>$1</code></pre>'
        );

      aiContentEl.innerHTML = `
        <p style="margin:0 0 8px 0;">${explanationHtml}</p>
        ${fixHtml}
      `;
    } else {
      aiContentEl.innerHTML = '<span style="color:#f87171;">AI analysis failed or is unavailable.</span>';
    }
  }

  /**
   * Wrapper for fetch with exponential backoff.
   * Uses origFetch to avoid loop.
   */
  async function retryFetch(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await origFetch(url, options);
        if (response.ok) return response;
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          console.warn(`Global Debugger: AI request failed with ${response.status}. Not retrying.`);
          return null;
        }
      } catch (error) {
        // Network error, will retry
      }
      // Wait with exponential backoff
      await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
    }
    console.warn('Global Debugger: AI request failed after all retries.');
    return null;
  }

  /**
   * Gets smart suggestions from the Gemini API.
   */
  async function getAiSuggestions(diag) {
    try {
      const userQuery = `
Here is the error information:
- Message: ${diag.message}
- File: ${diag.file}:${diag.line}:${diag.column}
- Stack Trace:
${diag.stack}

- Source Code Snippet (if available):
${diag.snippet}

Please analyze this and provide the JSON response.
      `;

      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
          parts: [{ text: AI_SYSTEM_PROMPT }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
          temperature: 0.2,
        }
      };

      const response = await retryFetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response) return null;

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        // The API returns a JSON *string* which we must parse.
        return JSON.parse(text); 
      }
      return null;
    } catch (err) {
      if (CONFIG.SHOW_CONSOLE_ERRORS) console.error('Global Debugger: AI suggestion failed:', err);
      return null;
    }
  }


  /* ========== Parse stack traces ========== */
  function parseStack(stackStr) {
    if (!stackStr) return null;
    const lines = stackStr.split('\n').map(l => l.trim()).filter(Boolean);
    for (let line of lines) {
      const chromeMatch = line.match(/at\s+(.*?)\s+\(?(.+?):(\d+):(\d+)\)?$/);
      if (chromeMatch) {
        return { func: chromeMatch[1], file: chromeMatch[2], line: Number(chromeMatch[3]), column: Number(chromeMatch[4]), stack: stackStr };
      }
      const ffMatch = line.match(/(.*?)@(.+?):(\d+):(\d+)$/);
      if (ffMatch) {
        return { func: ffMatch[1], file: ffMatch[2], line: Number(ffMatch[3]), column: Number(ffMatch[4]), stack: stackStr };
      }
    }
    const urlMatch = stackStr.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
    if (urlMatch) {
      return { file: urlMatch[1], line: Number(urlMatch[2]), column: Number(urlMatch[3]), stack: stackStr };
    }
    return { stack: stackStr };
  }

  /* ========== Fetch source snippet ========== */
  async function fetchSourceSnippet(url, line, column, contextLines = CONFIG.CONTEXT_LINES) {
    if (!url) return null;
    try {
      if (!/^https?:\/\//.test(url) && !/^\//.test(url)) {
        return null; // Not a fetchable URL
      }
      // Use origFetch to avoid loops
      const res = await origFetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      const idx = Math.max(0, line - 1);
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(lines.length - 1, idx + contextLines);
      const snippetLines = lines.slice(start, end + 1);
      const numbered = snippetLines.map((ln, i) => {
        const lnNum = start + i + 1;
        const pointer = (lnNum === line) ? '>> ' : '   ';
        return `${pointer}${lnNum.toString().padStart(4, ' ')} | ${ln}`;
      }).join('\n');
      return (`Source: ${url}\n\n${numbered}`.slice(0, CONFIG.MAX_SNIPPET_CHARS));
    } catch (err) {
      return null;
    }
  }

  /* ========== Suggest simple fixes (Fallback) ========== */
  function suggestFixes(message, parsed) {
    // This is now a fallback in case AI fails, but still good to have.
    const suggestions = [];
    if (!message) return suggestions;
    if (/Cannot read properties of null/i.test(message)) {
      suggestions.push("Fallback: Check for a missing DOM element (getElementById/querySelector).");
    }
    if (/Cannot read properties of undefined/i.test(message)) {
      suggestions.push("Fallback: A variable is undefined. Add a check (e.g., `if (obj && obj.prop)`).");
    }
    if (parsed && parsed.file && parsed.line) {
      suggestions.push(`Fallback: Check ${parsed.file} around line ${parsed.line}.`);
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
      // Use origFetch to avoid loops
      await origFetch(CONFIG.REMOTE_LOG_ENDPOINT, {
        method: 'POST',
        headers: Object.assign({
          'Content-Type': 'application/json'
        }, CONFIG.REMOTE_LOG_AUTH ? { 'Authorization': CONFIG.REMOTE_LOG_AUTH } : {}),
        body: JSON.stringify(payload)
      });
    } catch (err) {
      if (CONFIG.SHOW_CONSOLE_ERRORS) console.warn('Remote log failed:', err);
    }
  }

  /* ========== Build full diagnostic payload ========== */
  async function buildDiagnostic({ message, file, line, column, stack, extra = {} }) {
    const parsed = parseStack(stack || '');
    const snippet = await fetchSourceSnippet(file || parsed?.file, line || parsed?.line || 0, column || parsed?.column || 0);
    const suggestions = suggestFixes(message, parsed); // Fallback suggestions
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
      
      // 1. Build the core diagnostic
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
        `Fallback Suggestions:\n${diag.suggestions.join('\n\n') || '(none)'}`
      ].join('\n\n');

      if (CONFIG.SHOW_CONSOLE_ERRORS) {
        console.groupCollapsed('🚨 Global AI Debugger');
        console.error(short);
        console.log('Full diagnostic object:', diag);
        console.groupEnd();
      }

      // 2. Show the overlay immediately with "AI loading"
      showOverlay(short, full, true);
      
      // 3. Post to remote logging (if configured)
      sendRemoteLog(diag);
      
      // 4. Get AI suggestions (this is the new part)
      const aiSuggestion = await getAiSuggestions(diag);

      // 5. Update the overlay with the AI's response
      updateOverlayWithAi(aiSuggestion);

    } catch (err) {
      // If building diagnostic fails, fallback to simple overlay
      const fallback = `${message || 'Unknown error'}\n${filename || ''}:${lineno || ''}:${colno || ''}\nSee console for more.`;
      showOverlay(fallback, safeStr(err), false); // false = not loading AI
      if (aiContentEl) aiContentEl.innerHTML = '<span style="color:#f87171;">Failed to build diagnostic.</span>';
      if (CONFIG.SHOW_CONSOLE_ERRORS) console.error('Error building diagnostic:', err);
    }
  }

  /* ========== Attach global handlers (Unchanged from your script) ========== */

  // 1) Synchronous runtime errors
  window.addEventListener('error', (ev) => {
    handleErrorEvent({ message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno, errorObj: ev.error, origin: 'window.onerror' });
  });

  // 2) Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const message = reason && reason.message ? reason.message : String(reason);
    const stack = reason && reason.stack ? reason.stack : (new Error()).stack;
    handleErrorEvent({ message: `UnhandledPromiseRejection: ${message}`, filename: null, lineno: null, colno: null, errorObj: { stack }, origin: 'unhandledrejection' });
  });

  // 3) Wrap fetch to capture HTTP errors
  // This is your wrapper, now using 'origFetch' internally
  window.fetch = async function (...args) {
    try {
      const resp = await origFetch.apply(this, args);
      if (!resp.ok) {
        const message = `HTTP ${resp.status} ${resp.statusText} for ${args[0]}`;
        handleErrorEvent({ message, filename: String(args[0]), lineno: null, colno: null, errorObj: { stack: message }, origin: 'fetch' });
      }
      return resp;
    } catch (err) {
      const message = `Fetch failed for ${args[0]}: ${err.message || err}`;
      handleErrorEvent({ message, filename: String(args[0]), lineno: null, colno: null, errorObj: err, origin: 'fetch' });
      throw err;
    }
  };

  // 4) Wrap XMLHttpRequest
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

  // 5) Capture console.error calls
  if (console && console.error) {
    const origConsoleError = console.error.bind(console);
    console.error = function (...args) {
      origConsoleError(...args);
      try {
        const msg = args.map(a => (a && a.message) ? a.message : (typeof a === 'string' ? a : safeStr(a))).join(' ');
        // Avoid noisy/feedback loops from our own tool
        if (msg.includes('Global Debugger') || msg.includes('Error building diagnostic')) return;
        
        handleErrorEvent({ message: `[console.error] ${msg}`, filename: null, lineno: null, colno: null, errorObj: { stack: (new Error()).stack }, origin: 'console.error' });
      } catch (err) {
        origConsoleError('Error in console.error wrapper:', err);
      }
    };
  }

  if (CONFIG.SHOW_CONSOLE_ERRORS) {
    console.info('%c🤖 Global AI Debugger Active', 'color: #67e8f9; font-weight:bold; font-size: 12px;');
  }

  /* ========== Public helper (Unchanged) ========== */
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


