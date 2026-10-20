import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Workflow C — role-based demo entry.
 *
 * The landing page offers three demo buttons (Owner / Accountant / Viewer).
 * Each creates an isolated clone whose user carries that role, so server-side
 * `requireRole` behaves exactly as in production. This proves the buttons do
 * not merely relabel the UI: a Viewer is refused the audit trail while an Owner
 * is allowed it.
 */
test('workflow C — three role demos enforce role-specific access', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('demo-owner')).toBeVisible();
  await expect(page.getByTestId('demo-accountant')).toBeVisible();
  await expect(page.getByTestId('demo-viewer')).toBeVisible();

  // Viewer: can reach the dashboard, but the audit trail is refused server-side.
  await page.getByTestId('demo-viewer').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByText(/Illustrative demo data/i)).toBeVisible();
  const viewerAudit = await page.request.get(`${API_URL}/api/audit`);
  expect(viewerAudit.status()).toBe(403);

  // Fresh clone: Owner can read the audit trail.
  await page.goto('/');
  await page.getByTestId('demo-owner').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  const ownerAudit = await page.request.get(`${API_URL}/api/audit`);
  expect(ownerAudit.status()).toBe(200);

  // Logout must land on /login (not the marketing home page), and the protected
  // area must then bounce back to /login.
  await page.getByRole('button', { name: /log ?out/i }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
});
