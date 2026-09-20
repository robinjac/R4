import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { r4StudioProjectPlugin } from './tools/r4-studio-vite.js';
import { r4CompilerPlugin } from './tools/r4-vite.js';

export default defineConfig({
	plugins: [r4CompilerPlugin(), r4StudioProjectPlugin(), sveltekit()],
	server: {
		port: 3000
	}
});
