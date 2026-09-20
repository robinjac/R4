import { expect, test, type Page } from '@playwright/test';

async function openProjectStudio(page: Page, document?: string) {
	await page.goto(document ? `studio/?document=${encodeURIComponent(document)}` : 'studio/');
	await expect(page.locator('.project-studio')).toHaveAttribute('data-hydrated', 'true');
}

test('opens a discovered project document in the actual web runtime', async ({ page }) => {
	await openProjectStudio(page);

	await expect(page).toHaveTitle('R4 Studio');
	await expect(page.getByRole('heading', { level: 1, name: 'Field Operations' })).toBeVisible();
	await expect(page.getByText('Actual Svelte web runtime', { exact: true })).toBeVisible();
	await expect(page.locator('.runtime-canvas [data-r4-primitive="Page"]')).toHaveCount(1);
	await expect(page.getByRole('complementary', { name: 'Project documents' })).toContainText('Applications');
	await expect(page.getByRole('link', { name: 'Scratch' })).toHaveAttribute('href', /\/studio\/scratch\/$/);
	await expect(page.getByRole('link', { name: 'Workbench' })).toHaveAttribute('href', /\/$/);
});

test('keeps project, composition, source, semantic, and platform views synchronized', async ({ page }) => {
	await openProjectStudio(page);

	const project = page.getByRole('complementary', { name: 'Project documents' });
	await project.getByRole('searchbox', { name: 'Filter project documents' }).fill('button');
	await project.getByRole('button', { name: /Button.*primitives\/button\.r4\.svelte/ }).click();
	await expect(page).toHaveURL(/document=primitive-button/);
	await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
	await expect(page.locator('.runtime-canvas [data-r4-primitive="Button"]')).toHaveCount(3);

	const buttons = page.getByLabel('R4 composition').locator('li[data-primitive="Button"] button.node-content');
	await expect(buttons).toHaveCount(3);
	await buttons.nth(1).click();
	await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('tab', { name: 'Source', exact: true }).click();
	await expect(page.getByLabel('Selected project source').locator('mark')).toContainText('Secondary action');

	await page.getByRole('tab', { name: 'Semantic IR', exact: true }).click();
	await expect(page.getByLabel('Selected Semantic IR')).toContainText('"primitive": "Button"');
	await expect(page.getByLabel('Selected Semantic IR')).toContainText('"emphasis"');

	await page.getByRole('button', { name: 'iOS', exact: true }).click();
	await expect(page.getByText('Simulated iOS policy', { exact: true })).toBeVisible();
	await expect(page.getByText('Browser approximation / not native execution', { exact: true })).toBeVisible();
	await page.getByRole('tab', { name: 'Platform IR', exact: true }).click();
	await expect(page.getByLabel('Selected Platform IR')).toContainText('UIButton semantics');
});

test('supports direct document links and browser history', async ({ page }) => {
	await openProjectStudio(page, 'settings-profile');
	await expect(page.locator('.document-header').getByRole('heading', { level: 1, name: 'Settings & Profile' })).toBeVisible();

	const project = page.getByRole('complementary', { name: 'Project documents' });
	await project.getByRole('searchbox', { name: 'Filter project documents' }).fill('field operations');
	await project.getByRole('button', { name: /Field Operations/ }).click();
	await expect(page).toHaveURL(/document=field-operations/);
	await expect(page.locator('.document-header').getByRole('heading', { level: 1, name: 'Field Operations' })).toBeVisible();

	await page.goBack();
	await expect(page).toHaveURL(/document=settings-profile/);
	await expect(page.locator('.document-header').getByRole('heading', { level: 1, name: 'Settings & Profile' })).toBeVisible();
});

test('keeps the project environment usable on a mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openProjectStudio(page, 'primitive-view');

	await expect(page.getByRole('heading', { level: 1, name: 'View' })).toBeVisible();
	await expect(page.locator('.runtime-canvas')).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Project inspector' })).toBeVisible();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
});
