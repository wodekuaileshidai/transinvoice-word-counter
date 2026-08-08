/* ============================================================
 * Free Word Counter for Translators
 * Pure front-end. No upload. Everything runs in the browser.
 * ============================================================ */

'use strict';

(function () {
  // ---- DOM references -----------------------------------------------------
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const dropContent = document.getElementById('dropContent');

  const uploadCard = document.getElementById('uploadSection');
  const loadingCard = document.getElementById('loadingCard');
  const resultsCard = document.getElementById('resultsCard');
  const errorCard = document.getElementById('errorCard');
  const errorMsg = document.getElementById('errorMsg');
  const errorRetry = document.getElementById('errorRetry');

  const pasteText = document.getElementById('pasteText');
  const pasteCountBtn = document.getElementById('pasteCountBtn');

  const fileNameEl = document.getElementById('fileName');
  const statWords = document.getElementById('statWords');
  const statChars = document.getElementById('statChars');
  const statCJK = document.getElementById('statCJK');
  const statCharsWithSpace = document.getElementById('statCharsWithSpace');
  const statUnique = document.getElementById('statUnique');
  const statLines = document.getElementById('statLines');
  const statParagraphs = document.getElementById('statParagraphs');
  const breakdownBody = document.getElementById('breakdownBody');
  const docInfoEl = document.getElementById('docInfo');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const toast = document.getElementById('toast');

  // ---- Regexes ------------------------------------------------------------
  // Han (CJK ideographs) characters
  const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2EBEF}]/gu;
  // Full-width / CJK punctuation (counted as characters but not words)
  const CJK_PUNCT_RE = /[\u3000-\u303f\uff00-\uffef\u2018\u2019\u201c\u201d]/gu;
  // Latin words: sequences of letters/digits/apostrophes/hyphens
  const WORD_RE = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
  // A "character" = any non-whitespace character (good cross-language metric)
  const NON_SPACE_RE = /\S/g;

  // Characters considered "letter-like" vs punctuation for breakdown
  const IS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

  // ---- Utility ------------------------------------------------------------
  function $(id) { return document.getElementById(id); }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function resetViews() {
    hide(loadingCard);
    hide(resultsCard);
    hide(errorCard);
    show(uploadCard);
  }

  function humanize(n) {
    return n.toLocaleString('en-US');
  }

  // ---- Counting logic -----------------------------------------------------
  /**
   * Count metrics across a full text. Also returns a segmented breakdown
   * for mixed content (Latin runs vs CJK runs).
   */
  function countMetrics(text) {
    if (!text) text = '';

    // Words (Latin / space-separated)
    const allWords = text.match(WORD_RE) || [];
    const words = allWords.length;

    // Characters without spaces (any non-whitespace char)
    const nonSpaceMatches = text.match(NON_SPACE_RE);
    const charsNoSpace = nonSpaceMatches ? nonSpaceMatches.length : 0;

    // Chinese (Han) characters
    const cjkMatches = text.match(HAN_RE);
    const chineseChars = cjkMatches ? cjkMatches.length : 0;

    // Common translator total: Latin words + Chinese characters.
    const wordEquivalent = words + chineseChars;

    // Characters with spaces (raw length of text).
    const charsWithSpace = text.length;

    // Unique words (distinct lowercase Latin words).
    const uniqueWords = new Set(allWords.map(function (w) { return w.toLowerCase(); })).size;

    // Lines: non-empty lines.
    const lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; }).length || 0;

    // Paragraphs: blocks separated by one or more blank lines.
    const paragraphs = text
      .split(/(?:\r?\n\s*){2,}/)
      .filter(function (p) { return p.trim() !== ''; }).length || 0;

    // ---- Breakdown: split text into Latin runs and CJK runs ---------------
    const segments = [];
    // Remove punctuation noise for breakdown clarity but keep chunks.
    const scanRe = /([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2EBEF}]+)|([A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*)/gu;
    let segScan = {
      latin: 0,
      cjk: 0,
      latinChars: 0,
      cjkChars: 0,
    };
    let m;
    while ((m = scanRe.exec(text)) !== null) {
      if (m[1]) {
        // CJK run
        segScan.cjk += m[1].length;
        segScan.cjkChars += (m[1].match(/\S/g) || []).length;
      } else if (m[2]) {
        // Latin word
        segScan.latin += 1;
        segScan.latinChars += (m[2].match(NON_SPACE_RE) || []).length;
      }
    }
    segments.push({
      kind: 'Latin',
      words: segScan.latin,
      chars: segScan.latinChars,
    });
    segments.push({
      kind: 'CJK (Chinese/Japanese/Korean)',
      words: segScan.cjk, // here we use Han char count as the "word-equivalent"
      chars: segScan.cjkChars,
    });

    return {
      words,
      charsNoSpace,
      chineseChars,
      wordEquivalent,
      charsWithSpace,
      uniqueWords,
      lines,
      paragraphs,
      segments,
      rawLength: text.length,
    };
  }

  // Last-result state for copy / download.
  let lastFileName = '';
  let lastMetrics = null;
  let lastDocText = '';

  function renderResults(filename, metrics, docText, docInfo) {
    lastFileName = filename;
    lastMetrics = metrics;
    lastDocText = docText || '';

    fileNameEl.textContent = filename;
    statWords.textContent = humanize(metrics.words);
    statChars.textContent = humanize(metrics.charsNoSpace);
    statCJK.textContent = humanize(metrics.chineseChars);
    statCharsWithSpace.textContent = humanize(metrics.charsWithSpace);
    statUnique.textContent = humanize(metrics.uniqueWords);
    statLines.textContent = humanize(metrics.lines);
    statParagraphs.textContent = humanize(metrics.paragraphs);

    // Document info line.
    if (docInfo && docInfo.length) {
      docInfoEl.textContent = docInfo.join(' · ');
      docInfoEl.classList.remove('hidden');
    } else {
      docInfoEl.classList.add('hidden');
    }

    // Whether the doc is Chinese/Japanese-only (no Latin words).
    const isCjkOnly = metrics.words === 0 && metrics.chineseChars > 0;

    // Breakdown: show per-language contribution with clear wording.
    let html = '';
    for (const seg of metrics.segments) {
      const label = isCjkOnly && seg.kind.startsWith('Latin') && seg.words === 0
        ? 'Latin (English): '
        : seg.kind;
      const detail =
        seg.chars > 0
          ? `${humanize(seg.words)} words · ${humanize(seg.chars)} characters`
          : '0 characters';
      html +=
        `<div class="bd-row">
           <span class="bd-key">${label}</span>
           <span class="bd-val">${detail}</span>
         </div>`;
    }
    // Add combined translator metric when it differs from plain words.
    if (metrics.wordEquivalent !== metrics.words) {
      html +=
        `<div class="bd-row bd-total">
           <span class="bd-key">Word equivalent</span>
           <span class="bd-val">${humanize(metrics.wordEquivalent)} (Latin words + CJK chars)</span>
         </div>`;
    }
    breakdownBody.innerHTML = html;

    hide(loadingCard);
    hide(errorCard);
    show(resultsCard);
  }

  // ---- Parsers ------------------------------------------------------------
  async function parseFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.docx')) {
      return parseDocx(file);
    }
    if (name.endsWith('.pdf')) {
      return parsePdf(file);
    }
    throw new Error('Unsupported file type. Please upload a .docx or .pdf.');
  }

  async function parseDocx(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('docx parser failed to load (check internet / library CDN).');
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value || '', pages: 0 };
  }

  const LATIN_WORD_BOUNDARY = /[A-Za-z0-9]$/; // previous token ends latin alnum
  const NEXT_LATIN = /^[A-Za-z0-9]/;          // next token starts latin alnum

  /**
   * Assemble PDF text items into readable text WITHOUT mangling count metrics.
   * pdf.js often splits a CJK passage into one item per glyph, or a Latin word
   * into several items. We join items smartly:
   *   - Concatenate CJK runs directly (no spaces between Han characters, else
   *     "中文 中文" would break contiguous-run counting and look wrong).
   *   - Insert a single space between two adjacent Latin word tokens when the
   *     PDF did not already include one (avoids merging "hello"+"world").
   *   - Respect hasEOL to place real line breaks.
   */
  function joinPdfItems(items) {
    let out = '';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || !it.str) {
        if (it && it.hasEOL) out += '\n';
        continue;
      }
      const prev = out;
      if (prev && it.hasEOL) {
        out += '\n';
      } else if (prev && !/[ \t\n]$/.test(prev) && LATIN_WORD_BOUNDARY.test(prev) && NEXT_LATIN.test(it.str)) {
        // "hello" followed by "world" with no space in between → add one
        out += ' ';
      }
      out += it.str;
      if (it.hasEOL) out += '\n';
    }
    return out;
  }

  async function parsePdf(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('pdf parser failed to load (check internet / library CDN).');
    }
    // Configure worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += joinPdfItems(content.items) + '\n';
    }
    return { text: fullText, pages: pdf.numPages };
  }

  // ---- Flow control -------------------------------------------------------
  async function handleFile(file) {
    if (!file) return;

    resetViews();
    hide(uploadCard);
    show(loadingCard);

    try {
      const result = await parseFile(file);
      const text = result.text;
      const metrics = countMetrics(text);

      // Build document info (file name is shown separately in header).
      const bits = [];
      const ext = (file.name.split('.').pop() || '').toUpperCase();
      bits.push('Type: ' + ext);
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      bits.push('Size: ' + (file.size < 1024 * 1024 ? file.size + ' KB' : mb + ' MB'));
      if (result.pages) bits.push('Pages: ' + result.pages);

      renderResults(file.name, metrics, text, bits);
      show(resultsCard);
    } catch (err) {
      console.error(err);
      hide(loadingCard);
      show(errorCard);
      errorMsg.textContent = 'Something went wrong: ' + err.message;
    }
  }

  // ---- Event wiring -------------------------------------------------------
  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target !== browseBtn) fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // ---- Paste text counting ------------------------------------------------
  pasteCountBtn.addEventListener('click', () => {
    const raw = pasteText.value;
    if (!raw.trim()) {
      showToast('Please paste some text first');
      return;
    }
    hide(uploadCard);
    const metrics = countMetrics(raw);
    renderResults('(pasted text)', metrics, raw, []);
    showToast('Counted ✓');
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragging');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files[0]) handleFile(files[0]);
  });

  // Reset
  function reset() {
    fileInput.value = '';
    lastFileName = '';
    lastMetrics = null;
    lastDocText = '';
    resetViews();
  }
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', reset);
  errorRetry.addEventListener('click', reset);

  // ---- Toast helper -------------------------------------------------------
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.add('hidden');
    }, 1800);
  }

  // ---- Build a readable text summary --------------------------------------
  function buildSummary() {
    if (!lastMetrics) return '';
    const m = lastMetrics;
    const lines = [];
    lines.push('Word Count Summary');
    lines.push('File: ' + lastFileName);
    lines.push('-------------------');
    lines.push('Words (Latin):      ' + m.words);
    lines.push('Unique words:       ' + m.uniqueWords);
    lines.push('Characters (no sp): ' + m.charsNoSpace);
    lines.push('Characters (spaces):' + m.charsWithSpace);
    lines.push('Chinese characters: ' + m.chineseChars);
    lines.push('Lines:              ' + m.lines);
    lines.push('Paragraphs:         ' + m.paragraphs);
    lines.push('Word equivalent:    ' + m.wordEquivalent + ' (Latin words + CJK chars)');
    return lines.join('\n');
  }

  // Copy summary to clipboard (with fallback for older browsers).
  copyBtn.addEventListener('click', function () {
    const summary = buildSummary();
    if (!summary) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(summary).then(function () {
        showToast('Copied to clipboard ✓');
      }, function () {
        fallbackCopy(summary);
      });
    } else {
      fallbackCopy(summary);
    }
  });

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Copied to clipboard ✓');
    } catch (e) {
      showToast('Copy failed — use Download instead');
    }
    document.body.removeChild(ta);
  }

  // Download summary as a .txt file.
  downloadBtn.addEventListener('click', function () {
    const summary = buildSummary();
    if (!summary) return;
    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'word-count-summary.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded ✓');
  });

  // Initial state
  resetViews();
})();
