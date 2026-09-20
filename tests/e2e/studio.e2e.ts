import { expect, test, type Page } from '@playwright/test';

async function openStudio(page: Page) {
	await page.goto('studio/');
	await expect(page.locator('.studio-shell')).toHaveAttribute('data-state', 'ready');
}

test('analyzes editable R4 source into a revision-qualified snapshot', async ({ page }) => {
	await openStudio(page);

	await expect(page).toHaveTitle('R4 Studio');
	await expect(page.getByRole('heading', { level: 1, name: 'Source' })).toBeVisible();
	await expect(page.getByRole('status')).toContainText('Portable subset');
	await expect(page.getByLabel('R4 source')).toHaveValue(/import \{ Button, Page, Stack, Text \} from 'r4';/);
	await expect(page.getByRole('link', { name: 'Workbench' })).toHaveAttribute('href', /\/$/);

	await page.getByRole('tab', { name: 'Semantic IR' }).click();
	await expect(page.getByLabel('Studio Semantic IR')).toContainText('"primitive": "Button"');

	const editedSource = `<script lang="ts">
	import { Input, Page } from 'r4';
	let name = $state('Ada');
</script>

<Page title="Edited draft">
	<Input label="Name" value={name} onchange={(value) => (name = value)} />
</Page>`;
	await page.getByLabel('R4 source').fill(editedSource);
	await page.getByRole('button', { name: /Analyze/ }).click();
	await expect(page.getByLabel('Studio Semantic IR')).toContainText('"primitive": "Input"');
	await expect(page.getByLabel('Studio Semantic IR')).not.toContainText('"primitive": "Button"');
	await expect(page.locator('.analysis-facts strong').nth(2)).toHaveText(/[a-f0-9]{10}/);
});

test('preserves invalid drafts and reports compiler diagnostics', async ({ page }) => {
	await openStudio(page);

	const invalidSource = '<Page title="Broken">';
	await page.getByLabel('R4 source').fill(invalidSource);
	await page.getByRole('button', { name: /Analyze/ }).click();

	await expect(page.getByRole('tab', { name: /Diagnostics/ })).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('.diagnostic-list li[data-severity="error"]')).toBeVisible();
	await expect(page.getByLabel('R4 source')).toHaveValue(invalidSource);
	await expect(page.getByRole('status')).toContainText('error');
});

test('keeps Studio usable on a mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openStudio(page);

	await expect(page.getByLabel('R4 source')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Analysis' })).toBeVisible();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
});
