/**
 * Live smoke test: logs in as the seeded demo owner and exercises every
 * documented endpoint, checking status codes and basic payload shape.
 * Usage: npx tsx scripts/smoke.ts [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:4010';

const jar: Record<string, string | undefined> = {};

function cookieHeader(): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function req(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; json: unknown; text: string }> {
  const headers: Record<string, string> = { cookie: cookieHeader() };
  if (jar["xc_csrf"]) headers['x-csrf-token'] = jar["xc_csrf"];
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (name === 'xc_session') jar["xc_session"] = value;
    if (name === 'xc_csrf') jar["xc_csrf"] = value;
  }
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* csv or html */
  }
  return { status: res.status, json, text };
}

/** multipart/form-data upload for import endpoints */
async function upload(
  path: string,
  filename: string,
  csv: string,
  extraFields: Record<string, string> = {}
): Promise<{ status: number; json: unknown; text: string }> {
  const boundary = `----xc${Math.random().toString(16).slice(2)}`;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(extraFields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
    );
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n`
  );
  parts.push(`--${boundary}--\r\n`);
  const headers: Record<string, string> = {
    cookie: cookieHeader(),
    'content-type': `multipart/form-data; boundary=${boundary}`
  };
  if (jar["xc_csrf"]) headers['x-csrf-token'] = jar["xc_csrf"];
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: parts.join('') });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* csv */
  }
  return { status: res.status, json, text };
}

const results: Array<[string, number, string]> = [];

function check(name: string, status: number, ok: boolean, detail = ''): void {
  results.push([name, status, ok ? 'OK' : `FAIL ${detail}`]);
}

async function main(): Promise<void> {
  {
    const r = await req('GET', '/health');
    check('GET /health', r.status, r.status === 200 && (r.json as { db?: boolean })?.db === true);
  }

  // wrong password → generic 401
  {
    const r = await req('POST', '/api/auth/login', { email: 'msli@demo.xiaocai.ai', password: 'wrong' });
    check('login wrong password => 401', r.status, r.status === 401);
  }

  {
    const r = await req('POST', '/api/auth/login', { email: 'msli@demo.xiaocai.ai', password: 'Demo1234!' });
    check('POST /api/auth/login', r.status, r.status === 200 && !!jar["xc_session"] && !!jar["xc_csrf"], JSON.stringify(r.json).slice(0, 160));
  }

  {
    const r = await req('GET', '/api/auth/me');
    check('GET /api/auth/me', r.status, r.status === 200 && (r.json as { user?: { role?: string } })?.user?.role === 'OWNER');
  }

  {
    const r = await req('GET', '/api/dashboard/summary');
    check('GET /api/dashboard/summary', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 200));
  }

  for (const p of ['/api/profit/summary', '/api/profit/by-product', '/api/profit/by-campaign', '/api/profit/by-channel']) {
    const r = await req('GET', p);
    check(`GET ${p}`, r.status, r.status === 200, JSON.stringify(r.json).slice(0, 160));
  }
  {
    const r = await req('GET', '/api/profit/drivers?period=30d&compare=prev');
    check('GET /api/profit/drivers', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 200));
  }

  for (const p of ['/api/cash/forecast', '/api/cash/alerts', '/api/cash/scenarios']) {
    const r = await req('GET', p);
    check(`GET ${p}`, r.status, r.status === 200, JSON.stringify(r.json).slice(0, 160));
  }
  {
    const r = await req('POST', '/api/cash/scenario', {
      name: 'Smoke -20%',
      params: { salesChangePct: -20, supplierCostChangePct: 0, settlementDelayDays: 0, adSpendChangePct: 0 }
    });
    check('POST /api/cash/scenario', r.status, r.status === 201, JSON.stringify(r.json).slice(0, 200));
  }
  {
    const r = await req('POST', '/api/cash/preview', {
      params: { salesChangePct: 20, supplierCostChangePct: 10, settlementDelayDays: 5, adSpendChangePct: -10 }
    });
    check('POST /api/cash/preview', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 160));
  }

  for (const p of ['/api/financing/options', '/api/brief/daily', '/api/recommendations', '/api/evidence/revenue?level=2']) {
    const r = await req('GET', p);
    check(`GET ${p}`, r.status, r.status === 200, JSON.stringify(r.json).slice(0, 160));
  }

  let approvalId: string | undefined;
  {
    const r = await req('GET', '/api/approvals');
    const list = (r.json as { approvals?: Array<{ id: string; status: string }> })?.approvals ?? [];
    check('GET /api/approvals', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 160));
    approvalId = list.find((a) => a.status === 'PENDING')?.id;
    if (!approvalId) {
      const created = await req('POST', '/api/recommendations', {
        type: 'EXTEND_SUPPLIER_TERMS',
        title: 'Smoke test recommendation',
        evidence: [{ label: 'Projected shortage', value: 'Day 12' }],
        impact: { cash: 'closes gap' },
        action: { steps: ['call supplier'] }
      });
      approvalId = (created.json as { approval?: { id: string } })?.approval?.id;
    }
  }
  if (approvalId) {
    const d = await req('POST', `/api/approvals/${approvalId}/decision`, { decision: 'APPROVED', note: 'smoke-test approval' });
    check('POST /api/approvals/:id/decision', d.status, d.status === 200, JSON.stringify(d.json).slice(0, 200));
    const again = await req('POST', `/api/approvals/${approvalId}/decision`, { decision: 'REJECTED' });
    check('duplicate decision => 409', again.status, again.status === 409, `got ${again.status}`);
  }

  {
    const r = await req('GET', '/api/audit?page=1&pageSize=5');
    check('GET /api/audit', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 140));
  }
  {
    const r = await req('GET', '/api/audit/integrity');
    check('GET /api/audit/integrity', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 140));
  }
  {
    const r = await req('GET', '/api/audit/export.csv');
    check('GET /api/audit/export.csv', r.status, r.status === 200 && r.text.includes('action'), r.text.slice(0, 120));
  }

  let sourceId: string | undefined;
  {
    const r = await req('GET', '/api/sources');
    const list = (r.json as { sources?: Array<{ id: string; status: string }> })?.sources ?? [];
    check('GET /api/sources', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 140));
    sourceId = list.find((s) => s.status === 'GRANTED')?.id;
  }
  if (sourceId) {
    const rev = await req('POST', `/api/sources/${sourceId}/status`, { status: 'REVOKED' });
    check('POST /api/sources/:id/status REVOKED', rev.status, rev.status === 200, JSON.stringify(rev.json).slice(0, 140));
    const back = await req('POST', `/api/sources/${sourceId}/status`, { status: 'GRANTED' });
    check('POST /api/sources/:id/status GRANT back', back.status, back.status === 200);
  }

  {
    const r = await req('GET', '/api/imports/templates/orders');
    check('GET /api/imports/templates/orders', r.status, r.status === 200, r.text.slice(0, 80));
  }
  {
    const csv =
      'externalId,channel,orderedAt,grossAmount,platformFee,commission,deliveryCost,refundAmount,status\n' +
      'SMOKE-1,douyin,2026-10-10,10000,500,0,300,0,SETTLED\n' +
      'SMOKE-1,douyin,2026-10-10,10000,500,0,300,0,SETTLED\n' +
      'BAD-ROW,douyin,not-a-date,xx,0,0,0,0,SETTLED\n';
    const r = await upload('/api/imports/orders/preview', 'smoke.csv', csv);
    check('POST /api/imports/orders/preview', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 300));
  }
  {
    const csv = 'externalId,channel,orderedAt,grossAmount,platformFee,commission,deliveryCost,refundAmount,status\nSMOKE-2,douyin,2026-10-11,20000,800,0,400,0,SETTLED\n';
    const mapping = JSON.stringify({
      externalId: 'externalId',
      channel: 'channel',
      orderedAt: 'orderedAt',
      grossAmount: 'grossAmount',
      platformFee: 'platformFee',
      commission: 'commission',
      deliveryCost: 'deliveryCost',
      refundAmount: 'refundAmount',
      status: 'status'
    });
    const r = await upload('/api/imports/orders', 'smoke.csv', csv, { mapping });
    check('POST /api/imports/orders (confirm)', r.status, r.status === 201 || r.status === 200, JSON.stringify(r.json).slice(0, 260));
  }
  {
    const r = await req('GET', '/api/imports');
    check('GET /api/imports (history)', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 160));
  }

  {
    const r = await req('POST', '/api/assistant/ask', { question: 'Why did my profit drop?' });
    check('POST /api/assistant/ask', r.status, r.status === 200, JSON.stringify(r.json).slice(0, 200));
  }

  // CSRF: mutation without header => 403
  {
    const saved = jar["xc_csrf"];
    jar["xc_csrf"] = undefined;
    const r = await req('POST', `/api/sources/${sourceId ?? 'x'}/status`, { status: 'REVOKED' });
    check('CSRF missing => 403', r.status, r.status === 403, `got ${r.status}`);
    jar["xc_csrf"] = saved;
  }

  {
    const r = await req('POST', '/api/auth/logout', {});
    check('POST /api/auth/logout', r.status, r.status === 200 || r.status === 204);
  }
  {
    const r = await req('GET', '/api/auth/me');
    check('me after logout => 401', r.status, r.status === 401, `got ${r.status}`);
  }

  const failed = results.filter(([, , s]) => s.startsWith('FAIL'));
  for (const [name, status, s] of results) {
    console.log(`${s === 'OK' ? '✓' : '✗'} ${name} [${status}] ${s === 'OK' ? '' : s}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
