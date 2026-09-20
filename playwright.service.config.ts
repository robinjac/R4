import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const origin = 'http://127.0.0.1:4174';

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: 'project-service.e2e.ts',
	fullyParallel: false,
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `${origin}/`,
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'bun tests/setup-studio-workspace.ts && bunx vite dev --host 127.0.0.1 --port 4174',
		env: { ...process.env, R4_STUDIO_WORKSPACE_ROOT: resolve('test-results/studio-workspace') },
		url: `${origin}/studio/`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
