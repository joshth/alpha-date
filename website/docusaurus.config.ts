import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

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
  themes: [
    '@docusaurus/theme-mermaid',
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        // Local search: the index is built into the site, so nothing leaves the machine.
        // Hosted search needs a public site, and these docs are private (NDA).
        hashed: true,
        docsRouteBasePath: '/',
        // The site sends noindex to crawlers (private docs); search must still index them.
        forceIgnoreNoIndex: true,
        indexBlog: false,
      },
    ],
  ],
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
        docs: {
          path: '../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          // LaTeX maths in the docs ($...$ and $$...$$); styles come from katex in custom.css.
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    mermaid: { options: { flowchart: { htmlLabels: false } } },
    navbar: {
      title: 'Gen Alpha Decoder | Date',
      items: [
        { type: 'docSidebar', sidebarId: 'docs', label: 'Docs', position: 'left' },
        { to: '/api', label: 'API reference', position: 'left' },
      ],
    },
  } satisfies Preset.ThemeConfig,
} satisfies Config;
