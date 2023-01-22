// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'DriftDB',
  tagline: 'A tiny real-time backend for web apps.',
  url: 'https://driftdb.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.png',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // editUrl:
          //   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        // blog: {
        //   showReadingTime: true,
        //   editUrl:
        //     'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        // },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'DriftDB',
        logo: {
          alt: 'DriftDB Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'react',
            position: 'left',
            label: 'React Interface',
          },
          {
            type: 'doc',
            docId: 'data-model',
            position: 'left',
            label: 'Data Model',
          },
          {
            type: 'doc',
            docId: 'api',
            position: 'left',
            label: 'WebSocket API',
          },
          {
            href: 'https://github.com/drifting-in-space/driftdb',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'React Quickstart',
                to: '/docs/react',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/N5sEpsuhh9',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/drifting_corp',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/drifting-in-space/driftdb',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Drifting in Space Corp. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
