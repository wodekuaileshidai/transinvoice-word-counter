// Verify the CDN URLs used by index.html are reachable.
import https from 'node:https';

const urls = [
  'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
];

let pending = urls.length;
urls.forEach((u) => {
  const t = Date.now();
  https
    .get(u, { timeout: 10000 }, (r) => {
      console.log(u, '->', r.statusCode, (Date.now() - t) + 'ms');
      r.resume();
      if (--pending === 0) process.exit(0);
    })
    .on('error', (e) => {
      console.log(u, 'ERR', e.message);
      if (--pending === 0) process.exit(1);
    });
});
