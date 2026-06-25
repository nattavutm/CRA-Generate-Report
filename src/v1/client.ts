// Trend Vision One v3.0 REST client (cra.md §4, P1).
// Stateless: one instance per request. No caching, no persistence.

const REGION_BASE_URLS: Record<string, string> = {
  us: 'https://api.xdr.trendmicro.com',
  eu: 'https://api.eu.xdr.trendmicro.com',
  sg: 'https://api.sg.xdr.trendmicro.com',
  jp: 'https://api.xdr.trendmicro.co.jp',
  au: 'https://api.au.xdr.trendmicro.com',
  in: 'https://api.in.xdr.trendmicro.com',
  mea: 'https://api.mea.xdr.trendmicro.com',
  uk: 'https://api.uk.xdr.trendmicro.com',
  ca: 'https://api.ca.xdr.trendmicro.com',
  za: 'https://api.za.xdr.trendmicro.com',
};

export interface ListResponse<T> {
  items: T[];
  count?: number;
  totalCount?: number;
  nextLink?: string;
}

export interface GetOptions {
  query?: Record<string, string | number | undefined>;
  filter?: string; // TMV1-Filter header value
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class V1Client {
  readonly baseUrl: string;

  constructor(private token: string, region: string) {
    this.baseUrl = REGION_BASE_URLS[region] ?? REGION_BASE_URLS.sg;
  }

  private buildUrl(path: string, query?: GetOptions['query']): string {
    const url = path.startsWith('http') ? new URL(path) : new URL(path, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  // Single JSON fetch with exponential backoff on 429/5xx (cra.md §4).
  async fetchJson<T>(path: string, opts: GetOptions = {}): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
    if (opts.filter) headers['TMV1-Filter'] = opts.filter;

    const maxRetries = 3;
    const baseDelay = 500;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, { method: 'GET', headers });
      } catch (e) {
        lastErr = e;
        if (attempt === maxRetries) break;
        await sleep(baseDelay * 2 ** attempt);
        continue;
      }

      if (res.ok) return (await res.json()) as T;

      // Retry on rate limit / transient server errors.
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get('Retry-After'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelay * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      const body = await res.text().catch(() => '');
      throw new Error(`V1 ${path} -> HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    throw new Error(`V1 ${path} -> request failed: ${String(lastErr)}`);
  }

  // Follow nextLink up to `cap` pages (cra.md §4: report needs aggregates/top-N, not full dumps).
  async paginate<T>(path: string, opts: GetOptions = {}, cap = 20): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = path;
    let page = 0;
    let firstCall = true;

    while (next && page < cap) {
      // Query + filter apply to the first call only; nextLink already carries paging state.
      const res: ListResponse<T> = await this.fetchJson<ListResponse<T>>(
        next,
        firstCall ? opts : { filter: opts.filter },
      );
      if (Array.isArray(res.items)) items.push(...res.items);
      next = res.nextLink;
      firstCall = false;
      page++;
    }
    return items;
  }
}

export { REGION_BASE_URLS };
