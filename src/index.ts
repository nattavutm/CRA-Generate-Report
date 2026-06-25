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
    coverTitle: c.coverTitle,
    coverSubtitle: c.coverSubtitle,
    executiveSummary: c.executiveSummary,
    whatChanged: Array.isArray(c.whatChanged) ? c.whatChanged : [],
    trend: c.trend,
    riskIndexNote: c.riskIndexNote,
    recommendations: Array.isArray(c.recommendations) ? c.recommendations : undefined,
    sessions: Array.isArray(c.sessions) ? c.sessions : [],
    dataSourceNotes: c.dataSourceNotes,
    workbench: c.workbench,
  };
}

// Token precedence: per-request header (entered in the form, used once, never stored)
// → V1_API_TOKEN secret. The token is never logged or echoed into any response.
function clientFor(env: Env, config: ReportConfig, requestToken?: string): V1Client {
  const token = (requestToken ?? '').trim() || env.V1_API_TOKEN;
  if (!token) throw new Error('No Vision One token. Enter it in the form, or set the V1_API_TOKEN secret.');
  return new V1Client(token, config.region || env.V1_REGION || 'sg');
}

// ---------- UI ----------
app.get('/', (c) => c.html(renderForm(Object.keys(REGION_BASE_URLS), c.env.V1_REGION || 'sg')));

// ---------- HTML preview ----------
app.post('/api/preview', async (c) => {
  try {
    const config = validateConfig(await c.req.json());
    const model = await assembleModel(clientFor(c.env, config, c.req.header('X-V1-Token')), config);
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
    const model = await assembleModel(clientFor(c.env, config, c.req.header('X-V1-Token')), config);
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
    const model = await assembleModel(clientFor(c.env, config, c.req.header('X-V1-Token')), config);
    const bullets = await draftWhatChanged(c.env, model);
    return c.json({ bullets });
  } catch (e) {
    return c.text(e instanceof Error ? e.message : 'Draft failed', 400);
  }
});

export default app;
