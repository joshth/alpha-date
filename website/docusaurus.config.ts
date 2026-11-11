import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

export default {
  title: 'Gen Alpha Decoder | Date',
  tagline: 'Lexicon safety and quality pipeline docs',
  url: 'http://localhost',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  markdown: {
    format: 'detect',
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'throw' },
  },
  themes: ['@docusaurus/theme-mermaid'],
  staticDirectories: ['static', '../openapi'],
  noIndex: true, // private project under NDA: never index
  plugins: [
    // Swagger UI expects Node globals that webpack 5 no longer polyfills:
    // `xml` imports `stream` (unused in the browser) and the UI calls `Buffer`.
    () => ({
      name: 'swagger-ui-polyfills',
      configureWebpack: (_config, _isServer, { currentBundler }) => ({
        resolve: { fallback: { stream: false } },
        plugins: [new currentBundler.instance.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] })],
      }),
    }),
  ],
  presets: [
    [
      'classic',
      {
        docs: { path: '../docs', routeBasePath: '/', sidebarPath: './sidebars.ts' },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'Gen Alpha Decoder | Date',
      items: [
        { type: 'docSidebar', sidebarId: 'docs', label: 'Docs', position: 'left' },
        { to: '/api', label: 'API reference', position: 'left' },
      ],
    },
  } satisfies Preset.ThemeConfig,
} satisfies Config;
