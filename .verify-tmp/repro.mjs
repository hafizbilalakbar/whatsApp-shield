import fs from 'node:fs';
import path from 'node:path';
import * as EXP from '../src/utils/exportUtils.js';

async function main() {
  const raw = JSON.parse(fs.readFileSync('E:/WhatsApp/backend/campaign_history.json', 'utf-8'));
  const arr = Array.isArray(raw) ? raw : raw.campaigns;
  const us = arr.find((c) => c.id === '3757b2fb-e90f-494c-8bce-0d6bf6e9e207');
  const out = 'C:/Users/user/AppData/Local/Temp/opencode/pdf-verify/out';
  fs.mkdirSync(out, { recursive: true });
  process.chdir(out);
  for (const [label, sub] of [['Registered', 'us-reg'], ['Not Registered', 'us-not'], ['All Results', 'us-all']]) {
    fs.mkdirSync(path.join(out, sub), { recursive: true });
    const d = path.join(out, sub);
    process.chdir(d);
    fs.readdirSync(d).forEach((f) => f.endsWith('.pdf') && fs.unlinkSync(path.join(d, f)));
    await EXP.exportFilteredPDF(us.results, us, { name: 'T' }, label);
    const f = fs.readdirSync(d).find((x) => x.toLowerCase().endsWith('.pdf'));
    if (f) fs.renameSync(path.join(d, f), path.join(d, 'report.pdf'));
    console.log('done', sub);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });