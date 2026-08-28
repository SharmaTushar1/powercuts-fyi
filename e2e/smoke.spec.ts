import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://example.supabase.co/**', (route) => {
    void route.abort();
  });
});

test('home page renders the live feed chrome', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /powercuts/i })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: /power cuts reported in the last 10 minutes/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Skip to reports' })).toHaveAttribute(
    'href',
    '#feed',
  );
});

test('report page is reachable without an account', async ({ page }) => {
  await page.goto('/report');
  await expect(page.getByText("Where's the cut?")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post it' })).toBeDisabled();
});

test('unknown permalinks stay deep-linkable', async ({ page }) => {
  await page.goto('/r/pc-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  await expect(page.getByText('REPORT NOT FOUND')).toBeVisible();
});
