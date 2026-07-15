import {themes as prismThemes} from "prism-react-renderer";
import type {Config} from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config :Config = {
    title: "OBGX Docs",
    tagline: "Documentation for the Open Block Game Extension Interface.",
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
                    label: "Data Model",
                    to: "domain/data-model"
                },
                {
                    position: "left",
                    label: "Game Model",
                    to: "domain/game-model"
                },
                {
                    position: "left",
                    label: "Presentation",
                    to: "domain/presentation"
                },
                {
                    position: "left",
                    label: "Interaction",
                    to: "domain/interaction"
                },
                {
                    position: "left",
                    label: "Host Services",
                    to: "domain/host-services"
                },
                {
                    position: "left",
                    label: "Host Integration",
                    to: "domain/host-integration"
                },
                {
                    position: "left",
                    label: "Diagnostics",
                    to: "domain/diagnostics"
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