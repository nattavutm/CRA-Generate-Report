// CRA Report Generator — Cloudflare Worker entry (Hono router).
// Stateless: each request is one live Vision One pull → assemble → render. No DB (cra.md §2).

import { Hono } from 'hono';
import type { Env, ReportConfig } from './types';
import { V1Client, REGION_BASE_URLS } from './v1/client';
import { assembleModel } from './assemble';
import { renderReport } from './report/template';
import { renderPdf } from './pdf';
import { renderForm } from './ui';
import { draftWhatChanged } from './ai';

const app = new Hono<{ Bindings: Env }>();

function validateConfig(body: unknown): ReportConfig {
  const c = body as Partial<ReportConfig>;
  if (!c || typeof c !== 'object') throw new Error('Invalid request body');
  if (!c.customerName) throw new Error('customerName is required');
  if (!c.engagement?.cycleLabel) throw new Error('engagement.cycleLabel is required');
  return {
    customerName: String(c.customerName),
    region: c.region && REGION_BASE_URLS[c.region] ? c.region : 'sg',
    engagement: { docId: c.engagement?.docId ?? '', cycleLabel: c.engagement.cycleLabel },
    sessions: Array.isArray(c.sessions) ? c.sessions : [],
    priorRiskIndex: c.priorRiskIndex,
    priorCategory: c.priorCategory,
    executiveSummary: c.executiveSummary ?? '',
    whatChanged: Array.isArray(c.whatChanged) ? c.whatChanged : [],
    dataSourceNotes: c.dataSourceNotes,
    recommendationsOverride: c.recommendationsOverride,
    workbench: c.workbench,
  };
}

function clientFor(env: Env, config: ReportConfig): V1Client {
  if (!env.V1_API_TOKEN) throw new Error('V1_API_TOKEN is not configured');
  return new V1Client(env.V1_API_TOKEN, config.region || env.V1_REGION || 'sg');
}

// ---------- UI ----------
app.get('/', (c) => c.html(renderForm(Object.keys(REGION_BASE_URLS), c.env.V1_REGION || 'sg')));

// ---------- HTML preview ----------
app.post('/api/preview', async (c) => {
  try {
    const config = validateConfig(await c.req.json());
    const model = await assembleModel(clientFor(c.env, config), config);
    return c.html(renderReport(model));
  } catch (e) {
    return c.text(e instanceof Error ? e.message : 'Unknown error', 400);
  }
});

// ---------- PDF ----------
app.post('/api/report', async (c) => {
  let config: ReportConfig;
  try {
    config = validateConfig(await c.req.json());
  } catch (e) {
    return c.text(e instanceof Error ? e.message : 'Bad request', 400);
  }
  try {
    const model = await assembleModel(clientFor(c.env, config), config);
    const html = renderReport(model);
    const pdf = await renderPdf(c.env, html);

    // Optional R2 cache of the rendered artifact (§9) — not historical data storage.
    if (c.env.REPORTS) {
      const key = `${config.customerName.replace(/[^a-z0-9]+/gi, '_')}/${model.generatedAt}.pdf`;
      c.executionCtx.waitUntil(c.env.REPORTS.put(key, pdf, { httpMetadata: { contentType: 'application/pdf' } }));
    }

    const filename = `${config.customerName.replace(/[^a-z0-9]+/gi, '-')}-cra-report.pdf`;
    return new Response(pdf, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return c.text(`Report generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 500);
  }
});

// ---------- AI draft (§11) ----------
app.post('/api/draft', async (c) => {
  try {
    const config = validateConfig(await c.req.json());
    const model = await assembleModel(clientFor(c.env, config), config);
    const bullets = await draftWhatChanged(c.env, model);
    return c.json({ bullets });
  } catch (e) {
    return c.text(e instanceof Error ? e.message : 'Draft failed', 400);
  }
});

export default app;
