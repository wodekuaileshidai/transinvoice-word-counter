// Generate random multi-language test documents (docx + pdf).
import fs from 'node:fs';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';

const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const englishWords = ['hello', 'translation', 'invoice', 'client', 'contract', 'service', 'project', 'deadline', 'quality', 'review', 'language', 'budget', 'final', 'draft', 'team', 'schedule', 'revision', 'approval', 'payment', 'delivery'];
const cjkSentences = [
  '翻译人员需要准确统计字数以便正确报价。',
  '这个项目包含中英文混合的文档内容。',
  '请在周五之前提交最终版本的翻译。',
  '数据安全非常重要，一切处理都在浏览器本地完成。',
  '客户希望在月底之前完成所有修改。',
  '翻译记忆库能显著提高效率并降低成本。',
];
const otherTexts = [
  'Guten Morgen, wie geht es Ihnen?',
  'Hola, ¿cómo estás hoy?',
  'Bonjour, comment allez-vous ?',
  'こんにちは、お元気ですか。',
  '안녕하세요, 오늘 기분이 어떠세요?',
  'Ciao, come stai oggi?',
];

function randomEnglish(numSentences) {
  const sents = [];
  for (let i = 0; i < numSentences; i++) {
    let n = 4 + Math.floor(Math.random() * 6);
    let words = [];
    for (let j = 0; j < n; j++) words.push(rand(englishWords));
    sents.push(words.join(' ') + '.');
  }
  return sents.join(' ');
}

function randomMixed() {
  const parts = [];
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.45) parts.push(randomEnglish(2 + Math.floor(Math.random()*3)));
    else if (r < 0.8) parts.push(rand(cjkSentences));
    else parts.push(rand(otherTexts));
  }
  return parts.join('\n');
}

// --- 1. English .docx ---
const eng = randomEnglish(5);
await makeDocx('random-english.docx', eng);
console.log('random-english.docx written. words~', eng.split(/\s+/).filter(Boolean).length);

// --- 2. Mixed (CJK) .docx ---
const mixed = randomMixed();
await makeDocx('random-mixed.docx', mixed);
console.log('random-mixed.docx written.');

// --- 3. Mixed .pdf ---
const mixedPdf = randomMixed();
await makePdf('random-mixed.pdf', mixedPdf);
console.log('random-mixed.pdf written.');

async function makeDocx(name, text) {
  const doc = new Document({
    sections: [{
      children: text.split('\n').map(line =>
        new Paragraph({ children: [new TextRun(line)] })
      )
    }]
  });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(dir + name, buf);
}

async function makePdf(name, text) {
  const pdf = new PDFDocument();
  pdf.pipe(fs.createWriteStream(dir + name));
  for (const line of text.split('\n')) {
    pdf.text(line);
    pdf.moveDown();
  }
  pdf.end();
  return new Promise(r => setTimeout(r, 300));
}
