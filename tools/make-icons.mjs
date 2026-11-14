// Renders icons/icon.svg to the PNG sizes iOS and the web manifest need.
// Usage: npm run icons   (needs the dev dependency "playwright" and Chrome or Edge)

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const icons = new URL('../icons/', import.meta.url);
const svg = await readFile(new URL('icon.svg', icons), 'utf8');

const SIZES = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };

const launch = async () => {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // try the next browser
    }
  }
  throw new Error('Kein Chromium-Browser gefunden.');
};

const browser = await launch();
try {
  for (const [name, size] of Object.entries(SIZES)) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: fileURLToPath(new URL(name, icons)), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(`icons/${name} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
