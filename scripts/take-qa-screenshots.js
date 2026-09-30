import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const possibleChromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.CHROME_PATH || ''
];

const executablePath = possibleChromePaths.find(p => p && fs.existsSync(p));
console.log('Found browser executable:', executablePath);

if (!executablePath) {
  console.error('No Chrome/Edge executable found on system.');
  process.exit(1);
}

const outDir = 'C:\\Users\\Ahmad Raza\\.gemini\\antigravity-ide\\brain\\e686ae8b-dee7-4e09-8873-c0aa56ebf8e8\\qa_screenshots';
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

  console.log('Navigating to http://localhost:3000/?mockLeads=1 ...');
  await page.goto('http://localhost:3000/?mockLeads=1', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  // Open the Live Mobile Preview panel if not open
  const triggerBtn = await page.$('button[title*="Live Mobile Preview"], button[aria-label*="Live Mobile Preview"]');
  if (triggerBtn) {
    console.log('Opening mobile mockup panel...');
    await triggerBtn.click();
    await new Promise(r => setTimeout(r, 1500));
  }

  // 1. Single-State Campaign (Florida) with Date line, Title, Subtitle, Summary Card
  console.log('1. Capturing: 01_single_state_campaign.png');
  const btn1 = await page.$('button[title*="Single State Campaign"]');
  if (btn1) await btn1.click();
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(outDir, '01_single_state_campaign.png') });

  // 2. Photos Filter ON
  console.log('2. Capturing: 02_photos_filter_on.png');
  const photosBtn = await page.$('button[title*="Show only leads with decoded profile photos"]');
  if (photosBtn) await photosBtn.click();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '02_photos_filter_on.png') });

  // Switch back to All
  const allBtn = await page.$('button[title*="Show all discovered leads"]');
  if (allBtn) await allBtn.click();
  await new Promise(r => setTimeout(r, 800));

  // 3. Manual Clear to iOS Home Screen
  console.log('3. Capturing: 04_home_screen_dark.png');
  const clearBtn = await page.$('button[title*="Clear phone screen"]');
  if (clearBtn) await clearBtn.click();
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(outDir, '04_home_screen_dark.png') });

  // 4. iOS Home Screen in Light Theme
  console.log('4. Capturing: 05_home_screen_light.png');
  const paletteBtn = await page.$('button[title*="Appearance & Theme Settings"]');
  if (paletteBtn) {
    await paletteBtn.click();
    await new Promise(r => setTimeout(r, 600));
    // Click Light Theme button
    const lightBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Light (#F2F2F7)'));
    });
    if (lightBtn && lightBtn.click) {
      await lightBtn.click();
      await new Promise(r => setTimeout(r, 600));
    }
    // Close appearance drawer
    const doneBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.trim() === 'Done');
    });
    if (doneBtn && doneBtn.click) await doneBtn.click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(outDir, '05_home_screen_light.png') });
  }

  // Switch back to Dark Theme
  if (paletteBtn) {
    await paletteBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const darkBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Dark (OLED #000)'));
    });
    if (darkBtn && darkBtn.click) await darkBtn.click();
    const doneBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.trim() === 'Done');
    });
    if (doneBtn && doneBtn.click) await doneBtn.click();
    await new Promise(r => setTimeout(r, 800));
  }

  // 5. App Launch from Home Screen
  console.log('5. Capturing App Launch Transition Frame...');
  const restoreBtn = await page.$('button[title*="Show last scan results"]');
  if (restoreBtn) await restoreBtn.click();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '06_app_restored.png') });

  // 6. Audience Setup (/shield) with Country, Region, and Generation
  console.log('6. Capturing Audience Setup: 07_audience_setup_region_mode.png');
  // Click on Audience Setup step or Range Gen tab
  const rangeGenTab = await page.evaluateHandle(() => {
    const triggers = Array.from(document.querySelectorAll('button, [role="tab"]'));
    return triggers.find(t => t.textContent.includes('Range Gen'));
  });
  if (rangeGenTab && rangeGenTab.click) {
    await rangeGenTab.click();
    await new Promise(r => setTimeout(r, 800));
    // Click Region-Wise mode button
    const regionWiseBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Region-Wise'));
    });
    if (regionWiseBtn && regionWiseBtn.click) {
      await regionWiseBtn.click();
      await new Promise(r => setTimeout(r, 1200));
    }
    await page.screenshot({ path: path.join(outDir, '07_audience_setup_region_mode.png') });
  }

  await browser.close();
  console.log('--- ALL QA SCREENSHOTS CAPTURED SUCCESSFULLY ---');
}

run().catch(e => {
  console.error('Screenshot script failed:', e);
  process.exit(1);
});
