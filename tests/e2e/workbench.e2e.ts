import { expect, test, type Page } from '@playwright/test';

async function openWorkbench(page: Page, entry?: string) {
	await page.goto(entry ? `./?entry=${encodeURIComponent(entry)}` : './');
	await expect(page.locator('.workbench-shell')).toHaveAttribute('data-hydrated', 'true');
}

test('renders one document landmark and keeps experiment metadata isolated', async ({ page }) => {
	await openWorkbench(page);

	await expect(page).toHaveTitle('R4 Workbench');
	await expect(page.locator('main')).toHaveCount(1);
	await expect(page.locator('section[data-r4-primitive="Page"]')).toHaveCount(1);
	await expect(page.getByRole('heading', { level: 1, name: 'View' })).toBeVisible();
	const primitiveIndex = page.getByRole('complementary', { name: 'R4 primitives' });
	await expect(primitiveIndex.getByText('Primitive index', { exact: true })).toBeVisible();
	await expect(primitiveIndex.getByRole('button')).toHaveCount(33);
	await primitiveIndex.getByRole('button', { name: /Button action/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
	await expect(page.locator('.experiment-canvas [data-r4-primitive="Button"]')).toHaveCount(3);
	await expect(page.locator('.experiment-canvas [data-r4-primitive="Input"]')).toHaveCount(0);
	await expect(page.getByLabel('R4 composition').locator('[data-primitive="Button"]')).toHaveCount(3);
	await expect(page.getByLabel('R4 composition').locator('[data-primitive="Input"]')).toHaveCount(0);
	await page.locator('.inspector-tabs').getByRole('button', { name: 'Source', exact: true }).click();
	await expect(page.getByLabel('Highlighted experiment source')).toContainText('Button primitive');
	await expect(page.getByLabel('Highlighted experiment source')).not.toContainText('<Select');
	await expect(primitiveIndex.getByText('Applications', { exact: true })).toHaveCount(0);
});

test('runs the counter through Svelte state and derived state', async ({ page }) => {
	await openWorkbench(page, 'counter-reactivity');

	const values = page.locator('.experiment-canvas [data-r4-primitive="Text"][data-role="heading"]');
	await expect(values).toHaveText(['0', '0']);
	await page.getByRole('button', { name: 'Increment count' }).click();
	await expect(values).toHaveText(['1', '2']);
});

test('visualizes the composition hierarchy and reactive dependencies', async ({ page }) => {
	await openWorkbench(page, 'counter-reactivity');

	const compositionTab = page.locator('.inspector-tabs').getByRole('button', { name: 'Composition', exact: true });
	await compositionTab.click();
	await expect(compositionTab).toHaveAttribute('aria-pressed', 'true');

	const composition = page.getByLabel('R4 composition');
	const tree = composition.getByRole('list', { name: 'Semantic composition tree' });
	await expect(tree.locator('[data-primitive="Page"]')).toBeVisible();
	await expect(tree.locator('[data-primitive="Button"]')).toContainText('writes count');
	await expect(tree.locator('[data-primitive="Text"]')).toHaveCount(8);

	const countBinding = composition.locator('.binding-card[data-binding="count"]');
	await expect(countBinding).toContainText('written by');
	await expect(countBinding).toContainText('Button');
	await expect(countBinding).toContainText('recompute doubled');
	await expect(countBinding).toContainText('text Text content');
});

test('runs the Settings and Profile reference application', async ({ page }) => {
	await openWorkbench(page, 'settings-profile');
	const canvas = page.locator('.experiment-canvas');
	const displayName = canvas.getByLabel('Display name');
	const publicProfile = canvas.getByRole('switch', { name: 'Public profile' });
	await expect(displayName).toHaveValue('Ada Lovelace');
	await expect(publicProfile).toBeChecked();

	await displayName.fill('Grace Hopper');
	await publicProfile.click();
	await expect(canvas.getByRole('heading', { name: 'Grace Hopper' })).toBeVisible();
	await expect(canvas.getByText(/Private profile \/ Updates disabled/)).toBeVisible();

	await canvas.getByRole('button', { name: 'Save profile' }).click();
	await expect(canvas.getByText('All changes saved.', { exact: true })).toBeVisible();
});

test('runs the directly linked Field Operations composition', async ({ page }) => {
	await openWorkbench(page, 'field-operations');
	await page.getByRole('button', { name: 'iOS', exact: true }).click();

	const canvas = page.locator('.experiment-canvas');
	const previewCanvas = page.locator('.preview-canvas-frame');
	await expect(canvas.getByRole('heading', { name: 'Good morning, Robin' })).toBeVisible();
	await canvas.getByRole('button', { name: 'Register work' }).click();
	const report = previewCanvas.getByRole('dialog', { name: 'Register work' });
	await expect(report).toBeVisible();
	const previewBounds = await previewCanvas.boundingBox();
	const reportBounds = await report.boundingBox();
	if (!previewBounds || !reportBounds) throw new Error('Embedded sheet bounds are unavailable');
	expect(reportBounds.x).toBeGreaterThanOrEqual(previewBounds.x);
	expect(reportBounds.y).toBeGreaterThanOrEqual(previewBounds.y);
	expect(reportBounds.x + reportBounds.width).toBeLessThanOrEqual(previewBounds.x + previewBounds.width);
	expect(reportBounds.y + reportBounds.height).toBeLessThanOrEqual(previewBounds.y + previewBounds.height);
	expect(Math.abs(reportBounds.x - previewBounds.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(reportBounds.width - previewBounds.width)).toBeLessThanOrEqual(1);
	await expect(report.getByLabel('Hours')).toHaveValue('7.5');
	await report.getByLabel('Hours').fill('8');
	await report.getByRole('button', { name: 'Save report' }).click();
	await expect(report).toBeHidden();

	await canvas.getByRole('button', { name: 'Projects', exact: true }).click();
	await expect(canvas.getByRole('heading', { name: 'Active projects' })).toBeVisible();
	const harborProject = canvas.getByRole('button', { name: /Harbor office fit-out/ });
	await harborProject.click();
	await expect(harborProject).toHaveAttribute('aria-pressed', 'true');

	await canvas.getByRole('button', { name: 'Assistant', exact: true }).click();
	await expect(canvas.getByRole('heading', { name: 'Ask about Oak Street' })).toBeVisible();
	await canvas.getByLabel('Message').fill('Draft a reminder for the project manager.');
	await canvas.getByRole('button', { name: 'Send message' }).click();
	await expect(canvas.getByText('Draft a reminder for the project manager.', { exact: true })).toBeVisible();

	await page.locator('.inspector-tabs').getByRole('button', { name: 'Composition', exact: true }).click();
	await expect(page.getByLabel('R4 composition').locator('[data-primitive="Feed"]')).toHaveCount(2);
	await expect(page.getByLabel('R4 composition').locator('[data-node-kind="component"]')).toContainText('ProjectCollection');
});

test('switches platform and inspector state accessibly', async ({ page }) => {
	await openWorkbench(page, 'counter-reactivity');

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

test('renders language-aware source, JSON, and TSX highlighting', async ({ page }) => {
	await openWorkbench(page, 'counter-reactivity');

	await page.locator('.inspector-tabs').getByRole('button', { name: 'Source', exact: true }).click();
	const source = page.getByLabel('Highlighted experiment source').locator('pre');
	await expect(source).toBeVisible();
	await expect(source).toContainText('let count = $state(0);');
	expect(await source.locator('span[style]').count()).toBeGreaterThan(5);

	await page.locator('.inspector-tabs').getByRole('button', { name: 'Semantic IR', exact: true }).click();
	const semantic = page.getByLabel('Highlighted Semantic IR').locator('pre');
	await expect(semantic).toContainText('"schema": "r4.semantic"');
	expect(await semantic.locator('span[style]').count()).toBeGreaterThan(5);

	await page.getByRole('button', { name: 'iOS', exact: true }).click();
	await page.locator('.inspector-tabs').getByRole('button', { name: 'Output', exact: true }).click();
	const output = page.getByLabel('Highlighted Lynx TSX output').locator('pre');
	await expect(output).toContainText("import { root, useState } from '@lynx-js/react';");
	expect(await output.locator('span[style]').count()).toBeGreaterThan(5);
});

test('resizes desktop and stacked Workbench panes', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openWorkbench(page);

	const navigationSeparator = page.getByRole('separator', { name: 'Resize research navigation' });
	const inspectorSeparator = page.getByRole('separator', { name: 'Resize compiler inspector' });
	await navigationSeparator.press('ArrowRight');
	await expect(navigationSeparator).toHaveAttribute('aria-valuenow', '246');
	const separatorBounds = await navigationSeparator.boundingBox();
	if (!separatorBounds) throw new Error('Navigation separator is not visible');
	await page.mouse.move(separatorBounds.x + separatorBounds.width / 2, separatorBounds.y + 40);
	await page.mouse.down();
	await page.mouse.move(separatorBounds.x + separatorBounds.width / 2 + 32, separatorBounds.y + 40);
	await page.mouse.up();
	await expect(navigationSeparator).toHaveAttribute('aria-valuenow', '278');
	await navigationSeparator.dblclick();
	await expect(navigationSeparator).toHaveAttribute('aria-valuenow', '230');
	await inspectorSeparator.press('ArrowLeft');
	await expect(inspectorSeparator).toHaveAttribute('aria-valuenow', '446');
	await inspectorSeparator.dblclick();
	await expect(inspectorSeparator).toHaveAttribute('aria-valuenow', '430');

	await page.setViewportSize({ width: 1000, height: 900 });
	await expect(inspectorSeparator).toHaveAttribute('aria-orientation', 'horizontal');
	await inspectorSeparator.press('ArrowUp');
	await expect(inspectorSeparator).toHaveAttribute('aria-valuenow', '536');
});

test('shows deliberate portability diagnostics without changing document metadata', async ({ page }) => {
	await openWorkbench(page, 'interactive-view-diagnostic');
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
	await expect(page.getByRole('separator', { name: 'Resize compiler inspector' })).toBeHidden();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
});
