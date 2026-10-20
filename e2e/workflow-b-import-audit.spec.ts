import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * Workflow B — data management: register a fresh business → download nothing,
 * upload an orders CSV → preview (row-level validation) → confirm import →
 * import history → audit trail shows the IMPORT with a verified hash chain.
 *
 * The HTTP-layer equivalent (preview with row errors, dedupe, audit write,
 * CSV export, integrity) is covered by
 * `apps/api/tests/integration/imports-audit.test.ts`.
 */

const ORDERS_CSV = [
  'channel,externalId,orderedAt,grossAmount,platformFee,commission,deliveryCost,refundAmount,status,productSku,settlementDate,settledAmount',
  'douyin,e2e-10001,2026-10-01,299.00,14.95,59.80,12.00,0,COMPLETED,,2026-10-08,212.25',
  'taobao,e2e-10002,2026-10-02,499.00,24.95,99.80,12.00,0,COMPLETED,,2026-10-09,362.25'
].join('\n');

test('workflow B — register, import orders CSV, verify history and audit chain', async ({ page }) => {
  const email = `e2e-${randomBytes(6).toString('hex')}@example.com`;

  await page.goto('/register');
  await page.locator('#name').fill('E2E Owner');
  await page.locator('#businessName').fill('E2E Store');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('Passw0rd123');
  await page.locator('#confirmPassword').fill('Passw0rd123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

  // ── import wizard ────────────────────────────────────────────────────────
  await page.goto('/sources');
  await expect(page.getByRole('heading', { name: 'Data Sources & Imports' })).toBeVisible();

  await page.locator('#import-kind').selectOption('orders');
  await page.locator('#import-file').setInputFiles({
    name: 'e2e-orders.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(ORDERS_CSV, 'utf8')
  });
  await page.getByRole('button', { name: 'Preview' }).click();

  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Valid rows')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.getByText(/Import complete: 2 added/i)).toBeVisible({ timeout: 30_000 });

  // ── import history ───────────────────────────────────────────────────────
  await expect(page.getByRole('heading', { name: 'Import history' })).toBeVisible();
  await expect(page.getByText('e2e-orders.csv').first()).toBeVisible();

  // ── audit trail: the import is recorded and the chain verifies ───────────
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'IMPORT' }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Hash chain verified \(\d+ records\)/i)).toBeVisible({ timeout: 20_000 });
});
