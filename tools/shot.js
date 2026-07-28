/**
 * Chuga Chocho — render an SVG or HTML file to PNG.
 *
 * Art bugs (a tree sliced by the track, a rod in the wrong place) are invisible in
 * source and obvious in a picture. This is the review loop: author → render → look
 * → adjust. Use it after every art change.
 *
 * Usage:
 *   node tools/shot.js <input> [output.png] [width] [height]
 *
 * Examples:
 *   node tools/shot.js play/assets/scenes/colorado.svg
 *   node tools/shot.js play/assets/trains/diesel.svg out.png 900 400
 *   node tools/shot.js train-gallery.html gallery.png 1400 1000
 *
 * Set CHROMIUM_PATH to use a system Chromium instead of Playwright's download.
 */
const path = require('path');
const { chromium } = require('playwright');

const [input, output, w, h] = process.argv.slice(2);
if (!input) {
  console.error('usage: node tools/shot.js <input> [output.png] [width] [height]');
  process.exit(1);
}

const abs = path.resolve(input);
const out = output || abs.replace(/\.(svg|html?)$/i, '') + '.png';
const width = parseInt(w, 10) || 1280;
const height = parseInt(h, 10) || 720;

(async () => {
  const opts = {};
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(opts);
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,          // crisp enough to judge fine detail
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file://' + abs);
  await page.waitForTimeout(400);   // let any animation settle
  await page.screenshot({ path: out });
  await browser.close();

  console.log('wrote ' + out + ' (' + width + '×' + height + ')');
  if (errors.length) console.error('page errors:\n  ' + errors.join('\n  '));
})().catch(e => { console.error(e.message); process.exit(1); });
