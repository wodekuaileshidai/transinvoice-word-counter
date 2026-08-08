// Generate test documents: English docx, Chinese docx, mixed PDF
import fs from 'node:fs';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';

const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// ---- English DOCX ----
const englishText = (
  'This is a translation word counter test document. ' +
  'It contains several paragraphs of English text to check that the ' +
  'word counting works correctly and matches what you would see in Word. ' +
  'Translation professionals need accurate word counts to price their work.'
);
const engDoc = new Document({
  sections: [{
    children: englishText.split('. ').map(s => new Paragraph({ children: [new TextRun(s + '.')] }))
  }]
});
const engBuf = await Packer.toBuffer(engDoc);
fs.writeFileSync(dir + '/sample-english.docx', engBuf);

// ---- Chinese DOCX ----
const chineseText = (
  '这是一段用于测试中文字数统计的文字。翻译人员经常需要统计中文的字符数量，' +
  '以便准确评估工作量并报价。中文字符计数通常以汉字数量为准。'
);
const cjkDoc = new Document({
  sections: [{
    children: [new Paragraph({ children: [new TextRun(chineseText)] })]
  }]
});
const cjkBuf = await Packer.toBuffer(cjkDoc);
fs.writeFileSync(dir + '/sample-chinese.docx', cjkBuf);

// ---- Mixed PDF ----
const mixedText = [
  'The project plan was approved today, and the team is excited to begin.',
  '翻译人员需要同时处理中英文混合的文档。',
  'We estimate about three hundred pages of content for the first quarter.',
  '这个版本仅包含基本的字数统计功能。'
];
const pdf = new PDFDocument({ size: 'A4', bufferPages: true });
pdf.registerFont('SimHei', 'C:/Windows/Fonts/simhei.ttf');
pdf.pipe(fs.createWriteStream(dir + '/sample-mixed.pdf'));
for (const line of mixedText) {
  pdf.font('SimHei').text(line);
  pdf.moveDown();
}
pdf.end();

console.log('Generated files in', dir);
