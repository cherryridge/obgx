import {themes as prismThemes} from "prism-react-renderer";
import type {Config} from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config :Config = {
    title: "OBGX Docs",
    favicon: "img/logo.png",

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

    themes: ["@docusaurus/theme-mermaid"],

    presets: [[
        "classic", {
            docs: false,
            blog: {
                routeBasePath: "/blog",
                showReadingTime: true
            },
            theme: { customCss: "./src/custom.css" }
        } satisfies Preset.Options
    ]],

    plugins: [
        [
            "@docusaurus/plugin-content-docs", {
                id: "edition",
                path: ".generated/edition",
                routeBasePath: "/",
                sidebarPath: "./src/sidebars/sidebar.edition.ts"
            }
        ],
        [
            "@docusaurus/plugin-content-docs", {
                id: "ref",
                path: "modules",
                routeBasePath: "ref",
                sidebarPath: "./src/sidebars/sidebar.ref.ts"
            }
        ]
    ],

    themeConfig: {
        colorMode: {
            defaultMode: "light",
            disableSwitch: false
        },
        navbar: {
            logo: {
                alt: "OBGX Logo",
                src: "img/logo.png",
                style: {
                    WebkitUserDrag: "none"
                }
            },
            items: [
                {
                    position: "left",
                    label: "Overview",
                    to: "overview"
                },
                {
                    position: "left",
                    label: "Reference",
                    to: "ref"
                },
                {
                    type: "custom-obgxEditionSelector",
                    position: "right"
                },
                {
                    type: "localeDropdown",
                    position: "right",
                    dropdownItemsAfter: [
                        {
                            type: "html",
                            value: "<div style='margin:.4rem .2rem;border-top:solid 1px var(--ifm-toc-border-color)'/>"
                        },
                        {
                            label: "Help Us Translate!",
                            to: "contributing#translate"
                        }
                    ]
                }
            ]
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;