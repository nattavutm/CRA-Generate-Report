// §11 — optional AI draft of "What changed this cycle".
// Output is returned to the form for human review; it is NEVER injected into the PDF directly.

import type { Env, ReportModel } from './types';

const MODEL = 'claude-sonnet-4-6';

export async function draftWhatChanged(env: Env, model: ReportModel): Promise<string[]> {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');

  const l = model.live;
  const facts = {
    customer: model.config.customerName,
    riskIndex: l.riskIndex,
    riskIndexTrend: model.config.trend?.riskIndex,
    categoryLevels: l.categoryLevels,
    cve: l.cve,
    coverageRate: l.coverageRate,
    staleAccountCount: l.staleAccountCount,
    alertCount: l.alerts.length,
    topAlerts: l.alerts.slice(0, 5).map((a) => ({ name: a.name, severity: a.severity })),
  };

  const prompt = `You are drafting the "What changed this cycle" bullets for a Cyber Risk Advisory report.
Use ONLY the numbers provided. Do not invent figures, trends, or comparisons that are not supported by the data.
If prior-period values are absent, do not assert a direction of change.
Return 3-6 concise, factual bullet points. Respond as a JSON array of strings only.

Data:
${JSON.stringify(facts, null, 2)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '[]';

  // Model may wrap JSON in prose/fences — extract the array defensively.
  const match = text.match(/\[[\s\S]*\]/);
  try {
    const arr = JSON.parse(match ? match[0] : text);
    if (Array.isArray(arr)) return arr.map((x) => String(x));
  } catch {
    /* fall through */
  }
  // Fallback: split lines into bullets.
  return text
    .split('\n')
    .map((s) => s.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);
}
