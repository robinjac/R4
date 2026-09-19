import { defineConfig, devices } from '@playwright/test';

const basePath = process.env.BASE_PATH ?? '';
const origin = 'http://127.0.0.1:4173';

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `${origin}${basePath}/`,
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'bun run preview -- --host 127.0.0.1',
		url: `${origin}${basePath}/`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
