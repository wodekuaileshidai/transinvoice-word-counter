// End-to-end validation: parse real docx/pdf files, then run countMetrics
import fs from 'node:fs';
import mammoth from 'mammoth';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
// Use the bundled worker via createRequire so Node can load it for fake-worker
// fallback when GlobalWorkerOptions.workerSrc is not set.
// (We do NOT set workerSrc here; Node + pdfjs will use the "fake worker".)

const dir = 'C:/Users/Administrator/AppData/Roaming/openocta/workspace/transinvoice-word-counter/validate/';
const cd = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// --- countMetrics (mirror of app.js) ---
const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2EBEF}]/gu;
const WORD_RE = /[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g;
const NON_SPACE_RE = /\S/g;
function countMetrics(text) {
  if (!text) text = '';
  const words = (text.match(WORD_RE) || []).length;
  const charsNoSpace = (text.match(NON_SPACE_RE) || []).length;
  const chineseChars = (text.match(HAN_RE) || []).length;
  const scanRe = /([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2EBEF}]+)|([A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*)/gu;
  let seg = { latin: 0, cjk: 0, latinChars: 0, cjkChars: 0 };
  let m;
  while ((m = scanRe.exec(text)) !== null) {
    if (m[1]) { seg.cjk += m[1].length; seg.cjkChars += (m[1].match(/\S/g)||[]).length; }
    else if (m[2]) { seg.latin += 1; seg.latinChars += (m[2].match(/\S/g)||[]).length; }
  }
  return { words, charsNoSpace, chineseChars, seg };
}

const p = (f) => cd + f;

// --- 1. English docx ---
const engBuf = fs.readFileSync(p('sample-english.docx'));
const eng = await mammoth.extractRawText({ buffer: engBuf });
console.log('=== ENGLISH DOCX ===');
console.log('raw>', eng.value.slice(0, 60) + '...');
const em = countMetrics(eng.value);
console.log('words=', em.words, 'charsNoSpace=', em.charsNoSpace, 'cjk=', em.chineseChars, 'latinBreakdown=', em.seg.latin);

// --- 2. Chinese docx ---
const cjkBuf = fs.readFileSync(p('sample-chinese.docx'));
const cjk = await mammoth.extractRawText({ buffer: cjkBuf });
console.log('\n=== CHINESE DOCX ===');
console.log('raw>', cjk.value.slice(0, 40) + '...');
const cm = countMetrics(cjk.value);
console.log('words=', cm.words, 'charsNoSpace=', cm.charsNoSpace, 'cjk=', cm.chineseChars);

// --- 3. Mixed PDF ---
const pdfData = new Uint8Array(fs.readFileSync(p('sample-mixed.pdf')));
const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
let pdfText = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  for (const item of content.items) if (item.str) pdfText += item.str + ' ';
  pdfText += '\n';
}
console.log('\n=== MIXED PDF (numPages=' + pdf.numPages + ') ===');
console.log('raw>', pdfText.replace(/\n/g, ' / '));
const pm = countMetrics(pdfText);
console.log('words=', pm.words, 'charsNoSpace=', pm.charsNoSpace, 'cjk=', pm.chineseChars);
console.log('breakdown latin(words/chars)=', pm.seg.latin + '/' + pm.seg.latinChars, 'cjk(chars)=', pm.seg.cjk + '/' + pm.seg.cjkChars);
