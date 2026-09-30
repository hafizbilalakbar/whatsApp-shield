import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = 'C:\\Users\\Ahmad Raza\\.gemini\\antigravity-ide\\brain\\e686ae8b-dee7-4e09-8873-c0aa56ebf8e8\\qa_screenshots\\summary_card_tests';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000/?mockLeads=1', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  // Open mobile preview panel
  const triggerBtn = await page.$('button[title*="Live Mobile Preview"], button[aria-label*="Live Mobile Preview"]');
  if (triggerBtn) {
    await triggerBtn.click();
    await new Promise(r => setTimeout(r, 1200));
  }

  // 1. Scanning State (2 leads, 1%)
  console.log('Capturing: card_01_scanning_2leads.png');
  const btn1 = await page.$('button[title*="Single State Campaign"]');
  if (btn1) await btn1.click();
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, 'card_01_scanning_2leads.png') });

  // 2. Multi-Country / Completed State (20+ leads)
  console.log('Capturing: card_02_completed_dark.png');
  const btn20 = await page.$('button[title*="Multi-Country Campaign"]');
  if (btn20) await btn20.click();
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, 'card_02_completed_dark.png') });

  // 3. Light Theme
  console.log('Capturing: card_03_completed_light.png');
  const paletteBtn = await page.$('button[title*="Appearance & Theme Settings"]');
  if (paletteBtn) {
    await paletteBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const lightBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Light (#F2F2F7)'));
    });
    if (lightBtn && lightBtn.click) await lightBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const doneBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.trim() === 'Done');
    });
    if (doneBtn && doneBtn.click) await doneBtn.click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(outDir, 'card_03_completed_light.png') });

    // Restore dark
    await paletteBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const darkBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Dark (OLED #000)'));
    });
    if (darkBtn && darkBtn.click) await darkBtn.click();
    const doneBtn2 = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.trim() === 'Done');
    });
    if (doneBtn2 && doneBtn2.click) await doneBtn2.click();
    await new Promise(r => setTimeout(r, 800));
  }

  // 4. Panel Sizes: Laptop, Desktop, Compact
  console.log('Capturing: card_04_desktop_scale.png');
  await page.screenshot({ path: path.join(outDir, 'card_04_desktop_scale.png') });

  await browser.close();
  console.log('--- ALL SUMMARY CARD SCREENSHOTS CAPTURED ---');
}

run().catch(console.error);
