import {themes as prismThemes} from "prism-react-renderer";
import type {Config} from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config :Config = {
    title: "OBGX Documentation",
    tagline: "Documentation for the Open Block Game Extension Interface.",
    favicon: "img/favicon.ico",

    future: {
        v4: {
            fasterByDefault: false
        }
    },

    url: "https://obgx.org",
    baseUrl: "/",

    trailingSlash: false,

    onBrokenLinks: "throw",

    i18n: {
        defaultLocale: "en",
        locales: ["en", "zh-hans"]
    },

    markdown: {
        mermaid: true,
        hooks: {
            onBrokenMarkdownLinks: "warn"
        }
    },

    presets: [[
        "classic", {
            docs: {
                routeBasePath: "/",
                sidebarPath: "./sidebars.ts"
            },
            blog: {
                routeBasePath: "/blog",
                showReadingTime: true
            },
            theme: { customCss: "./src/custom.css" }
        } satisfies Preset.Options
    ]],

    themeConfig: {
        image: "img/docusaurus-social-card.jpg",
        colorMode: {
            defaultMode: "light",
            disableSwitch: false
        },
        navbar: {},
        footer: {
            style: "dark",
            links: [],
            copyright: `
                <div style="padding-top:1rem">
                    <div>Copyright © ${new Date().getFullYear()} CherryRidge.</div>
                </div>
            `,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;