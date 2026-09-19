import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
	source: {
		entry: {
			main: './src/generated.tsx'
		}
	},
	output: {
		sourceMap: {
			js: 'source-map',
			css: true
		}
	},
	plugins: [
		pluginReactLynx({
			engineVersion: '3.9',
			enableAccessibilityElement: true,
			enableCSSInheritance: true
		})
	]
});
