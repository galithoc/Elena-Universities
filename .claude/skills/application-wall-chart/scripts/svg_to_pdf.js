#!/usr/bin/env node
/**
 * Render a wall-chart SVG to a single-page PDF at its true trim size.
 *
 *   node svg_to_pdf.js chart.svg 36x24 chart.pdf
 *
 * Print shops accept the SVG, but a PDF is what most of them ask for and it is
 * the only format the person ordering can actually proof on their own screen.
 * The page box is set in inches, not pixels, so the sheet measures what it says.
 */
const fs = require('fs');
const path = require('path');

function load() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright',
                   '/usr/lib/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* try the next one */ }
  }
  console.error('playwright not found:  npm i -g playwright');
  process.exit(1);
}

(async () => {
  const [svgPath, size = '36x24', out] = process.argv.slice(2);
  if (!svgPath || !out) {
    console.error('usage: svg_to_pdf.js <chart.svg> <WxH inches> <out.pdf>');
    process.exit(1);
  }
  const [w, h] = size.toLowerCase().split('x').map(Number);
  const svg = fs.readFileSync(svgPath, 'utf8');

  if (!/@font-face/.test(svg)) {
    // Worth a shout: the PDF will look fine here and print as Times there.
    console.error('  ! this SVG embeds no fonts — run fetch_fonts.py and rebuild');
  }

  const { chromium } = load();
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    if (/execut|download|browserType.launch/i.test(e.message)) {
      console.error('playwright is installed but its chromium is not:\n' +
        '  npx playwright install chromium\n' +
        'If your environment ships a browser already, point at it instead:\n' +
        '  PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers node svg_to_pdf.js ...');
      process.exit(1);
    }
    throw e;
  }
  const ctx = await browser.newContext();

  // Block the network outright. If anything in the sheet still needs fetching,
  // this is where it must fail — not silently at the print shop.
  const reached = [];
  await ctx.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('about:')) {
      return r.continue();
    }
    reached.push(u);
    return r.abort();
  });

  const page = await ctx.newPage();
  await page.setContent(
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    `@page{size:${w}in ${h}in;margin:0}` +
    'html,body{margin:0;padding:0;background:#fff}' +
    `svg{display:block;width:${w}in;height:${h}in}` +
    '</style></head><body>' + svg + '</body></html>',
    { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  await page.pdf({
    path: out, width: w + 'in', height: h + 'in', printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }, pageRanges: '1',
  });
  await browser.close();

  if (reached.length) {
    console.error('  ! the sheet tried to reach the network — it is not self-contained:');
    [...new Set(reached)].slice(0, 5).forEach(u => console.error('    ' + u));
    process.exit(2);
  }
  console.log(`${path.basename(out)}  ${w}x${h}in  ` +
              `${(fs.statSync(out).size / 1048576).toFixed(1)}MB  (rendered offline)`);
})();
