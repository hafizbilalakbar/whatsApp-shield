import { exportFilteredPDF } from '../../src/utils/exportUtils.js';

window.__booted = 1;
window.__fetchCount = 0;
window.__lastFetch = '';

const usRecords = [];
for (let k = 0; k < 119; k += 1) {
  const num = `1914420${(4000 + k)}`;
  usRecords.push({ number: num, formatted: `+${num}`, cleanNumber: num, exists: true, isValidFormat: true, detectedCountry: 'US', displayName: null });
}

async function run() {
  try {
    window.__phase = 'generating';
    const camp = { id: 'browser-us', timestamp: new Date().toISOString(), countryCode: '1', shieldMode: true, results: usRecords };
    await exportFilteredPDF(usRecords, camp, { name: 'T' }, 'Registered');
    window.__phase = 'done';
    if (!window.__saveCalled) document.getElementById('out').textContent = 'no-save-called';
  } catch (e) {
    window.__phase = 'error';
    window.__runError = e && e.message ? e.message : String(e);
    document.getElementById('out').textContent = 'ERROR:' + window.__runError;
  }
}
run();