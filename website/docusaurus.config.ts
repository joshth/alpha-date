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
  noIndex: true, // private project under NDA: never index
  plugins: [
    // swagger-ui-react pulls in `xml`, which imports node's `stream`; unused in the browser.
    () => ({
      name: 'stream-fallback',
      configureWebpack: () => ({ resolve: { fallback: { stream: false } } }),
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
      ],
    },
  } satisfies Preset.ThemeConfig,
} satisfies Config;
