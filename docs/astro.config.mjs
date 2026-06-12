// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
	],
});
