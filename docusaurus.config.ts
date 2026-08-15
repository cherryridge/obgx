import {themes as prismThemes} from "prism-react-renderer";
import type {MDXOptions} from "@docusaurus/mdx-loader";
import type {Config} from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import type {CodeHikeConfig} from "codehike/mdx";
import { remarkCodeHike, recmaCodeHike } from "codehike/mdx";
import {loadModuleRedirects} from "./src/generateEditionViews.mjs";
import {remarkCompatTableHeading} from "./src/remark/remarkCompatTableHeading";
import {remarkObgxCode} from "./src/remark/remarkObgxCode";

type MarkdownNode = {
    type: string;
    lang?: string | null;
    children?: MarkdownNode[];
};

function remarkDefaultCodeLanguage() {
    return (root: MarkdownNode) => {
        const nodes = [root];
        for (const node of nodes) {
            if (node.type === "code" && !node.lang) node.lang = "text";
            if (node.children) nodes.push(...node.children);
        }
    };
}

const codeHikeTheme = "github-from-css";

const codeHikeConfig: CodeHikeConfig = {
    components: {code: "CodeHikeCode"},
    ignoreCode: ({lang}) => lang === "mermaid",
    syntaxHighlighting: {theme: codeHikeTheme}
};

const codeHikeMdxOptions: Pick<
    MDXOptions,
    "beforeDefaultRemarkPlugins" | "remarkPlugins" | "recmaPlugins"
> = {
    beforeDefaultRemarkPlugins: [remarkCompatTableHeading],
    remarkPlugins: [
        remarkDefaultCodeLanguage,
        [remarkObgxCode, {component: "CodeHikeCode", theme: codeHikeTheme}],
        [remarkCodeHike, codeHikeConfig]
    ],
    recmaPlugins: [[recmaCodeHike, codeHikeConfig]]
};

const moduleDocsExclude = [
    "**/_!(index).{md,mdx}",
    "**/_*/**",
    "**/*.test.{js,jsx,ts,tsx}",
    "**/__tests__/**"
];

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
                ...codeHikeMdxOptions,
                routeBasePath: "/blog",
                showReadingTime: true
            },
            theme: { customCss: "./src/custom.css" }
        } satisfies Preset.Options
    ]],

    plugins: [
        [
            "@docusaurus/plugin-client-redirects", {
                redirects: loadModuleRedirects()
            }
        ],
        [
            "@docusaurus/plugin-content-docs", {
                ...codeHikeMdxOptions,
                id: "edition",
                path: ".generated/edition",
                exclude: moduleDocsExclude,
                routeBasePath: "/",
                sidebarPath: "./src/sidebars/sidebar.edition.ts"
            }
        ],
        [
            "@docusaurus/plugin-content-docs", {
                ...codeHikeMdxOptions,
                id: "ref",
                path: "modules",
                exclude: moduleDocsExclude,
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
                    position: "left",
                    label: "Blog",
                    to: "blog"
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
                            to: "contributing#translate-documentation"
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