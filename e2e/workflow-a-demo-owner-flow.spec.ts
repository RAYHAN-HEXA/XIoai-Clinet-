import { expect, test } from '@playwright/test';

/**
 * Workflow A — the Ms. Li demo: dashboard → true profit → drivers →
 * simulator (day-12 stress) → financing → brief → approvals → audit.
 *
 * Prereqs: seeded database + the two dev servers (see playwright.config.ts).
 */

async function startDemo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('demo-owner').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  // the demo is an isolated clone — never the canonical business
  await expect(page.getByText(/Illustrative demo data/i)).toBeVisible();
}

async function setSlider(page: import('@playwright/test').Page, id: string, value: number): Promise<void> {
  await page.locator(id).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    // React tracks the value on the element; use the prototype setter so React
    // observes the change, then fire the event React listens to.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('workflow A — demo owner: profit, drivers, simulator day-12, financing, brief, approvals, audit', async ({
  page
}) => {
  await startDemo(page);

  // ── dashboard ────────────────────────────────────────────────────────────
  await expect(page.getByRole('heading', { name: /Real profit/ })).toBeVisible();
  await expect(page.getByText('Data sources').first()).toBeVisible();

  // ── true profit + cost ladder ────────────────────────────────────────────
  await page.goto('/profit');
  await expect(page.getByRole('heading', { name: 'True Profit' })).toBeVisible();
  await expect(page.getByText('Cost breakdown').first()).toBeVisible();
  await expect(page.getByText(/orders included/i)).toBeVisible();

  // ── drivers reconcile ────────────────────────────────────────────────────
  await page.goto('/drivers');
  await expect(page.getByRole('heading', { name: 'Why Profit Changed' })).toBeVisible();
  await expect(page.getByText(/identical metrics and methodology/i)).toBeVisible();

  // ── simulator: base has no shortage, stress lands on day 12 ──────────────
  await page.goto('/simulator');
  await expect(page.getByRole('heading', { name: 'Survival Simulator' })).toBeVisible();
  await expect(page.getByText('No shortage within 30 days')).toBeVisible();

  await setSlider(page, '#sc-sales', -20);
  await setSlider(page, '#sc-supplier', 10);
  await setSlider(page, '#sc-delay', 5);
  await expect(page.locator('[data-testid="scenario-badge"]')).toBeVisible();
  // The stressed curve breaches cash on the day the ¥48,800 invoice is due.
  // Derive that day from the obligation list (the seeded dataset pins it ~12
  // days out; deriving it keeps the assertion correct across a UTC day boundary).
  const bigInvoiceRow = page.locator('li', { hasText: '¥48,800' }).first();
  await expect(bigInvoiceRow).toBeVisible();
  const dueMatch = await bigInvoiceRow.getByText(/^D\d+$/).innerText();
  const dueDay = Number(dueMatch.replace('D', ''));
  await expect(page.getByText(`Projected cash shortage on day ${dueDay}`)).toBeVisible({ timeout: 20_000 });

  // ── financing: qualitative only ──────────────────────────────────────────
  await page.goto('/financing');
  await expect(page.getByRole('heading', { name: 'Financing' })).toBeVisible();
  await expect(page.getByText(/no rates, amounts or approval chances/i)).toBeVisible();

  // ── daily brief ──────────────────────────────────────────────────────────
  await page.goto('/brief');
  await expect(page.getByRole('heading', { name: 'Daily Brief' })).toBeVisible();
  await expect(page.getByText(/deterministic engine, no estimates/i)).toBeVisible();

  // ── approvals: decision is recorded, nothing is executed ─────────────────
  await page.goto('/approvals');
  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();
  await expect(page.getByText(/XiaoCai never pays or messages anyone on its own/i)).toBeVisible();

  const approveButtons = page.getByRole('button', { name: 'Approve' });
  if ((await approveButtons.count()) > 0) {
    await approveButtons.first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Record this approval/i).first()).toBeVisible();
    await dialog.getByRole('button', { name: /^Approve$/i }).click();
    await expect(page.getByText('Decision recorded')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Next steps for you')).toBeVisible();
  }

  // ── audit: appended rows + verifiable hash chain ─────────────────────────
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  await expect(page.getByText(/Hash chain verified \(\d+ records\)/i)).toBeVisible({ timeout: 20_000 });
});
