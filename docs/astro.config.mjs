// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import typegpu from 'unplugin-typegpu/vite';

// Deployed to GitHub Pages project site: https://chicio.github.io/matrix-rain-webgpu/
// https://astro.build/config
export default defineConfig({
	site: 'https://chicio.github.io',
	base: '/matrix-rain-webgpu/',
	integrations: [
		starlight({
			title: 'matrix-rain-webgpu',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/chicio/matrix-rain-webgpu',
				},
			],
			sidebar: [
				// Placeholder — the real IA is configured in Chunk 5.
				{
					label: 'Guides',
					items: [{ label: 'Example Guide', slug: 'guides/example' }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
		}),
		react(),
	],
	vite: {
		// unplugin-typegpu transforms the library's `'use gpu'` shader code (Babel).
		// It must run over the lib source imported by the demo/hero islands.
		// Cast: root (Vite 8/rolldown) and docs (Vite 6/rollup) ship different Plugin
		// types; the plugin is duck-typed at runtime, so the cross-version cast is safe.
		plugins: [/** @type {any} */ (typegpu({}))],
		resolve: {
			// `@lib` → the flattened library root (src/).
			alias: {
				'@lib': fileURLToPath(new URL('../src', import.meta.url)),
			},
		},
		server: {
			// Allow importing library source from outside the docs/ root.
			fs: { allow: ['..'] },
		},
	},
});
