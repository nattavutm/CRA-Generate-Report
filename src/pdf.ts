// P5 — HTML -> PDF via Cloudflare Browser Rendering (cra.md §8).

import puppeteer from '@cloudflare/puppeteer';
import type { Env } from './types';

export async function renderPdf(env: Env, html: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
