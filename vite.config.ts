import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { r4CompilerPlugin } from './tools/r4-vite.js';

export default defineConfig({
	plugins: [r4CompilerPlugin(), sveltekit()],
	server: {
		port: 3000
	}
});
