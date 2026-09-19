import { expect, test, type Page } from '@playwright/test';

async function openWorkbench(page: Page) {
	await page.goto('./');
	await expect(page.locator('.workbench-shell')).toHaveAttribute('data-hydrated', 'true');
}

test('renders one document landmark and keeps experiment metadata isolated', async ({ page }) => {
	await openWorkbench(page);

	await expect(page).toHaveTitle('R4 Workbench');
	await expect(page.locator('main')).toHaveCount(1);
	await expect(page.locator('section[data-r4-primitive="Page"]')).toHaveCount(1);
	await expect(page.getByRole('heading', { level: 1, name: 'Targeted reactivity' })).toBeVisible();
});

test('runs the counter through Svelte state and derived state', async ({ page }) => {
	await openWorkbench(page);

	const values = page.locator('.experiment-canvas [data-r4-primitive="Text"][data-role="heading"]');
	await expect(values).toHaveText(['0', '0']);
	await page.getByRole('button', { name: 'Increment count' }).click();
	await expect(values).toHaveText(['1', '2']);
});

test('switches platform and inspector state accessibly', async ({ page }) => {
	await openWorkbench(page);

	const ios = page.getByRole('button', { name: 'iOS', exact: true });
	await expect(ios).toHaveAttribute('aria-pressed', 'false');
	await ios.click();
	await expect(ios).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.preview-field')).toHaveAttribute('data-platform', 'ios');
	await expect(page.getByText('Simulated iOS policy', { exact: true })).toBeVisible();

	const output = page.locator('.inspector-tabs').getByRole('button', { name: 'Output', exact: true });
	await output.click();
	await expect(output).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByText('Lynx backend experiment', { exact: true })).toBeVisible();
});

test('shows deliberate portability diagnostics without changing document metadata', async ({ page }) => {
	await openWorkbench(page);

	await page.getByRole('button', { name: /Interactive View/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Interactive View' })).toBeVisible();
	await expect(page).toHaveTitle('R4 Workbench');

	await page.locator('.inspector-tabs').getByRole('button', { name: 'Diagnostics', exact: true }).click();
	await expect(page.getByText('r4/interactive-view', { exact: true })).toBeVisible();
	await expect(page.getByText('r4/lynx-interactive-view-unsupported', { exact: true })).toBeVisible();
});

test('keeps the Workbench within a mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openWorkbench(page);

	await expect(page.locator('.workbench-header')).toBeVisible();
	await expect(page.locator('.experiment-canvas')).toBeVisible();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
});
