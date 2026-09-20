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

test('server-renders DOM-transparent runtime identity', async ({ request }) => {
	const response = await request.get('studio/');
	const html = await response.text();

	expect(response.ok()).toBe(true);
	expect(html).toContain('Actual Svelte web runtime');
	expect(html).toContain('data-r4-studio-artifact=');
	expect(html).not.toContain('r4-studio-runtime-node');
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

test('maps repeated runtime instances to one source node and focuses the clicked instance', async ({ page }) => {
	await openProjectStudio(page, 'adaptive-grid');

	const views = page.locator('.runtime-canvas [data-r4-primitive="View"][data-r4-studio-node]');
	await expect(views).toHaveCount(3);
	const nodeIds = await views.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.r4StudioNode));
	const instanceIds = await views.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.r4StudioInstance));
	expect(new Set(nodeIds).size).toBe(1);
	expect(new Set(instanceIds).size).toBe(3);

	await views.nth(1).dispatchEvent('click');
	await expect(page.locator('.runtime-selection')).toContainText('View 3instances3targets / canvas');
	await expect(page.locator('.runtime-canvas [data-r4-studio-selected="true"][data-r4-primitive="View"]')).toHaveCount(3);
	await expect(page.locator('.runtime-canvas [data-r4-studio-focused="true"][data-r4-primitive="View"]')).toHaveCount(1);
	await expect(views.nth(1)).toHaveAttribute('data-r4-studio-focused', 'true');
	await expect(page.getByLabel('R4 composition').locator('li[data-primitive="View"].selected')).toHaveCount(1);
});

test('separates Canvas selection from application interaction and supports keyboard selection', async ({ page }) => {
	await openProjectStudio(page, 'counter-reactivity');

	const increment = page.locator('.runtime-canvas').getByRole('button', { name: 'Increment count' });
	const count = page.locator('.runtime-canvas [data-r4-primitive="Text"][data-role="heading"]').first();
	await expect(count).toHaveText('0');
	await increment.click({ position: { x: 2, y: 2 } });
	await expect(count).toHaveText('0');
	await expect(increment).toHaveAttribute('data-r4-studio-focused', 'true');

	await page.getByRole('button', { name: 'Interact', exact: true }).click();
	await increment.click();
	await expect(count).toHaveText('1');

	await page.getByRole('button', { name: 'Select', exact: true }).click();
	await increment.focus();
	await increment.press('Enter');
	await expect(count).toHaveText('1');
	await expect(increment).toHaveAttribute('data-r4-studio-focused', 'true');
});

test('keeps imported compositions opaque and preserves direct-child primitive DOM', async ({ page }) => {
	await openProjectStudio(page, 'field-operations');
	await page.getByRole('button', { name: 'Interact', exact: true }).click();
	await page.locator('.runtime-canvas').getByRole('button', { name: 'Projects', exact: true }).click();
	await page.getByRole('button', { name: 'Select', exact: true }).click();

	const importedHeading = page.locator('.runtime-canvas').getByText('Active projects', { exact: true });
	await importedHeading.click();
	await expect(page.getByLabel('R4 composition').locator('li[data-node-kind="component"].selected')).toContainText('ProjectCollection');
	await expect(page.locator('.runtime-selection')).toContainText('ProjectCollection 1instances1targets / canvas');

	await openProjectStudio(page, 'primitive-list');
	await expect(page.locator('.runtime-canvas [data-r4-primitive="List"] > [data-r4-primitive="ListItem"]')).toHaveCount(3);
	await expect(page.locator('.runtime-canvas .r4-studio-runtime-node')).toHaveCount(0);
});

test('tracks a portaled Sheet through mounted and unmounted states', async ({ page }) => {
	await openProjectStudio(page, 'primitive-sheet');

	const overlay = page.locator('.runtime-overlays .embedded-overlay');
	await expect(overlay).toBeVisible();
	await overlay.click({ position: { x: 2, y: 2 } });
	await expect(page.getByLabel('R4 composition').locator('li[data-primitive="Sheet"].selected')).toHaveCount(1);
	await expect(page.locator('.runtime-selection')).toContainText('Sheet 1instances2targets / canvas');

	await page.getByRole('button', { name: 'Interact', exact: true }).click();
	await page.locator('.runtime-overlays').getByRole('button', { name: 'Close' }).click();
	await expect(overlay).toHaveCount(0);
	await expect(page.locator('.runtime-selection')).toContainText('Sheet 0instances0targets / canvas');
});
