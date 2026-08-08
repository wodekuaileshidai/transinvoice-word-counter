// Remove redundant top-level dev scripts.
import fs from 'node:fs';

const base = 'C:/Users/Administrator/AppData/Roaming/openocta/workspace/transinvoice-word-counter/';
const targets = ['test-count.js', 'check-cdn.js'];
for (const f of targets) {
  const p = base + f;
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('removed', f);
  } else {
    console.log('not found', f);
  }
}
