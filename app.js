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

  const fileNameEl = document.getElementById('fileName');
  const statWords = document.getElementById('statWords');
  const statChars = document.getElementById('statChars');
  const statCJK = document.getElementById('statCJK');
  const breakdownBody = document.getElementById('breakdownBody');

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
      segments,
      rawLength: text.length,
    };
  }

  function renderResults(filename, metrics) {
    fileNameEl.textContent = filename;
    statWords.textContent = humanize(metrics.words);
    statChars.textContent = humanize(metrics.charsNoSpace);
    statCJK.textContent = humanize(metrics.chineseChars);

    // Breakdown
    let html = '';
    for (const seg of metrics.segments) {
      html +=
        `<div class="bd-row">
           <span class="bd-key">${seg.kind}</span>
           <span class="bd-val">${humanize(seg.words)} words · ${humanize(seg.chars)} chars</span>
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
    return result.value || '';
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
      let pageText = '';
      for (const item of content.items) {
        if (item.str) pageText += item.str + ' ';
      }
      fullText += pageText + '\n';
    }
    return fullText;
  }

  // ---- Flow control -------------------------------------------------------
  async function handleFile(file) {
    if (!file) return;

    resetViews();
    hide(uploadCard);
    show(loadingCard);

    try {
      const text = await parseFile(file);
      const metrics = countMetrics(text);
      renderResults(file.name, metrics);
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
    resetViews();
  }
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', reset);
  errorRetry.addEventListener('click', reset);

  // Initial state
  resetViews();
})();
