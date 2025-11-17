const puppeteer = require('puppeteer');

async function renderPdfBuffer(html) {
  // Launch puppeteer in headless mode. In Docker we might need additional flags.
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return pdfBuffer;
}

module.exports = { renderPdfBuffer };