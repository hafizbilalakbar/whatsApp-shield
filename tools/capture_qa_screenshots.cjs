const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\Ahmad Raza\\.gemini\\antigravity-ide\\brain\\e686ae8b-dee7-4e09-8873-c0aa56ebf8e8';
const outputDir = path.join(artifactDir, 'qa_screenshots');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function run() {
  console.log('Launching browser for Phase 1+2 QA screenshots...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1100']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 2 });

  console.log('Navigating to http://localhost:3000/dashboard?mockLeads=1 ...');
  await page.goto('http://localhost:3000/dashboard?mockLeads=1', { waitUntil: 'domcontentloaded', timeout: 15000 });

  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));

  console.log('Opening mobile mockup panel...');
  const triggerBtn = await page.waitForSelector('button[title*="Live Mobile Preview"], button[aria-label*="Live Mobile Preview"]', { timeout: 10000 });
  await triggerBtn.click();
  await new Promise(r => setTimeout(r, 600));

  const panelSelector = '.ios-phone-chassis';
  await page.waitForSelector(panelSelector, { timeout: 10000 });

  // 1. Desktop Dark 20+ leads
  console.log('1. Capturing Desktop Panel (Dark, 20+ leads)...');
  const allLeadsBtn = await page.$('button[title*="20+ leads fixture"]');
  if (allLeadsBtn) await allLeadsBtn.click();
  await new Promise(r => setTimeout(r, 400));
  const phoneEl1 = await page.$(panelSelector);
  await phoneEl1.screenshot({ path: path.join(outputDir, '01_desktop_dark_20leads.png') });
  console.log('Saved 01_desktop_dark_20leads.png');

  // 2. Desktop Dark 1 lead
  console.log('2. Capturing 1 Lead fixture...');
  const singleLeadBtn = await page.$('button[title*="1 lead fixture"]');
  if (singleLeadBtn) {
    await singleLeadBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const phoneEl2 = await page.$(panelSelector);
    await phoneEl2.screenshot({ path: path.join(outputDir, '02_laptop_dark_1lead.png') });
    console.log('Saved 02_laptop_dark_1lead.png');
  }

  // Switch back to 20+ leads
  if (allLeadsBtn) await allLeadsBtn.click();
  await new Promise(r => setTimeout(r, 300));

  // 3. Open Appearance drawer and switch to Light Theme
  console.log('3. Switching to Light Theme via Drawer...');
  const paletteBtn = await page.$('button[title*="Appearance"]');
  if (paletteBtn) {
    await paletteBtn.click();
    await new Promise(r => setTimeout(r, 400));
    
    // Screenshot appearance drawer
    const mockupPanel = await page.$('div[style*="min(480px"]');
    if (mockupPanel) {
      await mockupPanel.screenshot({ path: path.join(outputDir, '05_appearance_customizer.png') });
      console.log('Saved 05_appearance_customizer.png');
    }

    // Click Light Theme button
    const lightThemeBtn = await page.waitForSelector('button:has-text("Light"), button:has-text("#F2F2F7")', { timeout: 3000 }).catch(() => null);
    if (lightThemeBtn) {
      await lightThemeBtn.click();
    } else {
      // Direct click
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const light = btns.find(b => b.textContent.includes('Light'));
        if (light) light.click();
      });
    }
    await new Promise(r => setTimeout(r, 400));

    // Close drawer
    const doneBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const done = btns.find(b => b.textContent.trim() === 'Done');
      if (done) done.click();
    });
    await new Promise(r => setTimeout(r, 400));
  }

  // Screenshot Light Theme
  console.log('Capturing Light Theme 20+ leads...');
  const phoneEl3 = await page.$(panelSelector);
  await phoneEl3.screenshot({ path: path.join(outputDir, '03_light_theme_20leads.png') });
  console.log('Saved 03_light_theme_20leads.png');

  // 4. Small viewport size
  console.log('4. Capturing Compact panel size...');
  await page.setViewport({ width: 900, height: 680, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 500));
  const phoneEl4 = await page.$(panelSelector);
  await phoneEl4.screenshot({ path: path.join(outputDir, '04_compact_laptop_size.png') });
  console.log('Saved 04_compact_laptop_size.png');

  await browser.close();
  console.log('Finished capturing all QA screenshots successfully.');
}

run().catch(err => {
  console.error('QA capture error:', err);
  process.exit(1);
});
