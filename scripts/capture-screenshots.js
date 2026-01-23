const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8081';

const IPHONE_VIEWPORT = { width: 390, height: 844 };
const IPAD_VIEWPORT = { width: 820, height: 1180 };

const SCREENS = [
  { name: 'teams', path: '/', tab: null, wait: 2000 },
  { name: 'matches', path: '/', tab: 'Matches', wait: 1000 },
  { name: 'stats', path: '/', tab: 'Stats', wait: 1000 },
  { name: 'settings', path: '/', tab: 'Settings', wait: 1000 },
];

async function captureScreenshots() {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  console.log('Capturing iPhone screenshots...');
  await captureForDevice(browser, 'iphone', IPHONE_VIEWPORT);
  
  console.log('Capturing iPad screenshots...');
  await captureForDevice(browser, 'ipad', IPAD_VIEWPORT);
  
  await browser.close();
  console.log('Screenshots saved to screenshots/ directory');
}

async function captureForDevice(browser, deviceName, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
  });
  
  const page = await context.newPage();
  
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  for (const screen of SCREENS) {
    if (screen.tab) {
      const tabButton = page.getByRole('button', { name: screen.tab }).or(
        page.getByText(screen.tab, { exact: true })
      );
      try {
        await tabButton.click();
        await page.waitForTimeout(screen.wait);
      } catch (e) {
        console.log(`Could not find tab: ${screen.tab}`);
      }
    }
    
    const filename = `screenshots/${deviceName}/${screen.name}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`  Saved: ${filename}`);
  }
  
  await context.close();
}

captureScreenshots().catch(console.error);
