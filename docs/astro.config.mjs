// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import typegpu from 'unplugin-typegpu/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeExternalLinks from 'rehype-external-links';

// Deployed to GitHub Pages project site: https://chicio.github.io/matrix-rain-webgpu/
// https://astro.build/config
export default defineConfig({
	site: 'https://chicio.github.io',
	base: '/matrix-rain-webgpu/',
	markdown: {
		remarkPlugins: [remarkMath],
		// External (http) links open in a new tab — covers the GitHub source links
		// in the docs. Internal/relative links are untouched.
		rehypePlugins: [rehypeKatex, [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]],
	},
	integrations: [
		starlight({
			title: 'matrix-rain-webgpu',
			customCss: ['./src/styles/custom.css'],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/chicio/matrix-rain-webgpu',
				},
			],
			sidebar: [
				// Persistent jump to the live demo — first thing in the sidebar on every page.
				// Opens in a new tab (it's a standalone full-screen page, not a docs route).
				{
					label: 'Playground',
					link: '/playground/',
					badge: { text: 'live', variant: 'success' },
					attrs: { target: '_blank', rel: 'noopener' },
				},
				{ label: 'Overview', items: [{ autogenerate: { directory: 'overview' } }] },
				{ label: 'Usage', items: [{ autogenerate: { directory: 'usage' } }] },
				{ label: 'Architecture', items: [{ autogenerate: { directory: 'architecture' } }] },
				{ label: 'How it works', items: [{ autogenerate: { directory: 'how-it-works' } }] },
				{ label: 'Reference', items: [{ slug: 'glossary' }] },
			],
		}),
		react(),
	],
	vite: {
		// unplugin-typegpu transforms the library's `'use gpu'` shader code (Babel).
		// Cast: root (Vite 8/rolldown) and docs (Vite 6/rollup) ship different Plugin
		// types; the plugin is duck-typed at runtime, so the cross-version cast is safe.
		plugins: [/** @type {any} */ (typegpu({}))],
		resolve: {
			// `@lib` → the flattened library root (src/).
			alias: {
				'@lib': fileURLToPath(new URL('../src', import.meta.url)),
			},
			// The lib source (../src) is in the ROOT package, so its bare imports would
			// otherwise resolve to root/node_modules — a SECOND copy of typegpu/react
			// from the one the docs island uses. Two TypeGPU instances break the
			// 'use gpu' registry; two Reacts break the hooks dispatcher. Dedupe forces
			// a single copy of each (docs/node_modules).
			dedupe: ['typegpu', '@typegpu/noise', '@typegpu/react', 'react', 'react-dom'],
		},
		server: {
			// Allow importing library source from outside the docs/ root.
			fs: { allow: ['..'] },
		},
	},
});
