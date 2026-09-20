import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const fixture = resolve('test-results/studio-workspace/src/App.r4.svelte');

test('discovers, reads, and streams an approved local project without executing it', async ({ page }) => {
	await page.goto('studio/');
	await expect(page.locator('.project-studio')).toHaveAttribute('data-hydrated', 'true');
	await expect(page.getByText('Local service connected', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'App' })).toBeVisible();
	await expect(page.getByText('Analysis-only project source', { exact: true })).toBeVisible();
	await expect(page.getByText('Execution withheld', { exact: true })).toBeVisible();

	await page.getByRole('tab', { name: 'Source', exact: true }).click();
	await expect(page.getByLabel('Selected project source')).toContainText('Initial service source');

	await writeFile(
		fixture,
		`<script lang="ts">\n\timport { Page, Text } from 'r4';\n</script>\n\n<Page title="Service fixture">\n\t<Text>Externally refreshed source</Text>\n</Page>\n`
	);
	await expect(page.getByLabel('Selected project source')).toContainText('Externally refreshed source');
	await expect(page.locator('.document-state')).toHaveAttribute('data-freshness', 'current');
});
