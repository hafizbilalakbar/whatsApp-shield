import fs from 'node:fs';
import path from 'node:path';
import * as EXP from '../src/utils/exportUtils.js';

async function main() {
  const raw = JSON.parse(fs.readFileSync('E:/WhatsApp/backend/campaign_history.json', 'utf-8'));
  const arr = Array.isArray(raw) ? raw : raw.campaigns;
  const out = 'C:/Users/user/AppData/Local/Temp/opencode/pdf-verify/out';
  fs.mkdirSync(out, { recursive: true });

  const broken = arr.find((c) => c.id === '509a5626-24f7-4cd8-96a4-6cfc73ac4080');
  {
    fs.mkdirSync(path.join(out, 'broken'), { recursive: true });
    const d = path.join(out, 'broken');
    process.chdir(d);
    fs.readdirSync(d).forEach((f) => f.endsWith('.pdf') && fs.unlinkSync(path.join(d, f)));
    await EXP.exportFilteredPDF(broken.results, broken, { name: 'T' }, 'All Results');
    const f = fs.readdirSync(d).find((x) => x.toLowerCase().endsWith('.pdf'));
    if (f) fs.renameSync(path.join(d, f), path.join(d, 'report.pdf'));
    console.log('done broken');
  }

  const synthetic = [];
  for (let k = 0; k < 8; k += 1) {
    synthetic.push({ number: `97150${100000 + k}`, formatted: `+97150${100000 + k}`, cleanNumber: `97150${100000 + k}`, exists: true, isValidFormat: true, detectedCountry: 'AE', displayName: null });
  }
  for (let k = 0; k < 60; k += 1) {
    synthetic.push({ number: `1914420${4000 + k}`, formatted: `+1914420${4000 + k}`, cleanNumber: `1914420${4000 + k}`, exists: false, isValidFormat: true, detectedCountry: 'US', displayName: null });
  }
  {
    fs.mkdirSync(path.join(out, 'multi'), { recursive: true });
    const d = path.join(out, 'multi');
    process.chdir(d);
    fs.readdirSync(d).forEach((f) => f.endsWith('.pdf') && fs.unlinkSync(path.join(d, f)));
    const camp = { id: 'multi', timestamp: new Date().toISOString(), countryCode: 'AE', shieldMode: true, results: synthetic };
    await EXP.exportFilteredPDF(synthetic, camp, { name: 'T' }, 'All Results');
    const f = fs.readdirSync(d).find((x) => x.toLowerCase().endsWith('.pdf'));
    if (f) fs.renameSync(path.join(d, f), path.join(d, 'report.pdf'));
    console.log('done multi');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });