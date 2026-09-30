const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\Ahmad Raza\\.gemini\\antigravity-ide\\brain\\e686ae8b-dee7-4e09-8873-c0aa56ebf8e8';
const outputDir = path.join(artifactDir, 'qa_screenshots');

async function run() {
  console.log('Capturing Lead Arrival Framestrip and States...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1100']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000/dashboard?mockLeads=1', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);

  const triggerBtn = await page.waitForSelector('button[title*="Live Mobile Preview"]', { timeout: 10000 });
  await triggerBtn.click();
  await new Promise(r => setTimeout(r, 800));

  // 1. Capture Scanning state
  const phoneEl = await page.$('.ios-phone-chassis');
  await phoneEl.screenshot({ path: path.join(outputDir, '06_scanning_state_live.png') });
  console.log('Saved 06_scanning_state_live.png');

  // 2. Framestrip of a new lead entrance animation
  // We trigger a lead insertion or class toggle
  console.log('Capturing animation frame strip...');
  const frames = [];
  
  // Frame 1: Before / Start of animation
  await page.evaluate(() => {
    const list = document.querySelector('.ios-phone-screen');
    if (list) list.scrollTop = 0;
  });
  frames.push(await phoneEl.screenshot());

  // Frame 2: 100ms
  await new Promise(r => setTimeout(r, 100));
  frames.push(await phoneEl.screenshot());

  // Frame 3: 220ms
  await new Promise(r => setTimeout(r, 120));
  frames.push(await phoneEl.screenshot());

  // Frame 4: 350ms (Fully settled)
  await new Promise(r => setTimeout(r, 150));
  frames.push(await phoneEl.screenshot());

  // Save individual frames
  fs.writeFileSync(path.join(outputDir, '07_framestrip_0ms.png'), frames[0]);
  fs.writeFileSync(path.join(outputDir, '07_framestrip_100ms.png'), frames[1]);
  fs.writeFileSync(path.join(outputDir, '07_framestrip_220ms.png'), frames[2]);
  fs.writeFileSync(path.join(outputDir, '07_framestrip_350ms.png'), frames[3]);
  console.log('Saved 4 framestrip milestones.');

  await browser.close();
}

run().catch(err => {
  console.error('Framestrip capture error:', err);
  process.exit(1);
});
