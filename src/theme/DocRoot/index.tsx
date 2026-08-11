import React, {type ReactNode, useEffect, useState} from "react";
import clsx from "clsx";
import type {PropSidebar} from "@docusaurus/plugin-content-docs";
import {
    DocsSidebarProvider,
    useDocRootMetadata,
    useDocsVersion
} from "@docusaurus/plugin-content-docs/client";
import {HtmlClassNameProvider, ThemeClassNames} from "@docusaurus/theme-common";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import DocRootLayout from "@theme/DocRoot/Layout";
import NotFoundContent from "@theme/NotFound/Content";
import type {Props} from "@theme/DocRoot";

interface StoredSidebar {
    name: string;
    items: PropSidebar;
}

interface RememberedSidebar extends StoredSidebar {
    locale: string;
}

type SharedSidebarSection = "global" | "footer";

const rememberedSidebars = new Map<string, RememberedSidebar>();
const sharedSidebarSectionKey = "obgxSharedSidebarSection";

function sharedSidebarSection(item: PropSidebar[number]): SharedSidebarSection | undefined {
    const section = item.customProps?.[sharedSidebarSectionKey];
    return section === "global" || section === "footer" ? section : undefined;
}

function rememberedDynamicItems(items: PropSidebar): PropSidebar {
    if (items.some(item => sharedSidebarSection(item) !== undefined)) {
        return items.filter(item => sharedSidebarSection(item) === undefined);
    }

    const dynamicStart = items.findIndex(item => item.type !== "link");
    if (dynamicStart < 0) return [];
    return items.slice(dynamicStart, Math.max(dynamicStart, items.length - 2));
}

function refreshRememberedSidebar(
    currentItems: PropSidebar,
    rememberedSidebar: RememberedSidebar
): RememberedSidebar {
    const globalItems = currentItems.filter(item => sharedSidebarSection(item) === "global");
    const footerItems = currentItems.filter(item => sharedSidebarSection(item) === "footer");
    if (globalItems.length === 0 || footerItems.length === 0) return rememberedSidebar;

    return {
        ...rememberedSidebar,
        items: [...globalItems, ...rememberedDynamicItems(rememberedSidebar.items), ...footerItems]
    };
}

function withRenderedModuleExpansion(items: PropSidebar): PropSidebar {
    const normalizedPath = (href: string) => {
        const pathname = new URL(href, window.location.href).pathname;
        return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    };
    const sidebarMenus = Array.from(document.querySelectorAll<HTMLElement>(
        `.${ThemeClassNames.docs.docSidebarMenu}`
    ));
    const sidebarMenu = sidebarMenus.find(menu => menu.getClientRects().length > 0) ?? sidebarMenus[0];
    if (sidebarMenu === undefined) return items;

    const collapsedByHref = new Map<string, boolean>();
    for (const category of sidebarMenu.querySelectorAll<HTMLElement>(
        `:scope > .${ThemeClassNames.docs.docSidebarItemCategory}`
    )) {
        const link = category.querySelector<HTMLAnchorElement>(
            ":scope > .menu__list-item-collapsible > a[href]"
        );
        const href = link?.getAttribute("href");
        if (href !== null && href !== undefined) {
            collapsedByHref.set(
                normalizedPath(href),
                category.classList.contains("menu__list-item--collapsed")
            );
        }
    }

    let changed = false;
    const updatedItems = items.map(item => {
        if (item.type !== "category" || item.href === undefined) return item;
        const collapsed = collapsedByHref.get(normalizedPath(item.href));
        if (collapsed === undefined || collapsed === item.collapsed) return item;
        changed = true;
        return {...item, collapsed};
    });
    return changed ? updatedItems : items;
}

function storageKey(locale: string): string {
    return `obgx:last-documentation-sidebar:${locale}`;
}

function loadRememberedSidebar(locale: string): RememberedSidebar | undefined {
    try {
        const storedSidebar = sessionStorage.getItem(storageKey(locale));
        if (storedSidebar === null) return undefined;
        const sidebar = JSON.parse(storedSidebar) as Partial<StoredSidebar>;
        if (typeof sidebar.name === "string" && Array.isArray(sidebar.items)) {
            return {locale, name: sidebar.name, items: sidebar.items};
        }
        sessionStorage.removeItem(storageKey(locale));
    } catch {
        // Storage can be unavailable in restricted browser contexts.
    }
    return undefined;
}

function saveRememberedSidebar(sidebar: RememberedSidebar): void {
    try {
        sessionStorage.setItem(storageKey(sidebar.locale), JSON.stringify({
            name: sidebar.name,
            items: sidebar.items
        }));
    } catch {
        // The current page's sidebar remains available without persistence.
    }
}

export default function DocRoot(props: Props): ReactNode {
    const currentSidebar = useDocRootMetadata(props);
    const {pluginId} = useDocsVersion();
    const {i18n: {currentLocale}} = useDocusaurusContext();
    const isGlobalPage = pluginId === "edition" && currentSidebar?.sidebarName === "sidebar";
    const [rememberedSidebar, setRememberedSidebar] = useState<RememberedSidebar | undefined>(
        () => rememberedSidebars.get(currentLocale)
    );

    useEffect(() => {
        if (currentSidebar?.sidebarName === undefined || currentSidebar.sidebarItems === undefined) return;
        const {sidebarName, sidebarItems} = currentSidebar;

        if (isGlobalPage) {
            const sidebar = rememberedSidebars.get(currentLocale) ?? loadRememberedSidebar(currentLocale);
            if (sidebar !== undefined) {
                const refreshedSidebar = refreshRememberedSidebar(sidebarItems, sidebar);
                rememberedSidebars.set(currentLocale, refreshedSidebar);
                setRememberedSidebar(refreshedSidebar);
                saveRememberedSidebar(refreshedSidebar);
            }
            return;
        }

        const rememberSidebar = (items: PropSidebar) => {
            const sidebar = {
                locale: currentLocale,
                name: sidebarName,
                items
            };
            rememberedSidebars.set(currentLocale, sidebar);
            setRememberedSidebar(sidebar);
            saveRememberedSidebar(sidebar);
        };
        rememberSidebar(sidebarItems);

        if (pluginId !== "ref") return;
        const rememberRenderedExpansion = () => {
            rememberSidebar(withRenderedModuleExpansion(sidebarItems));
        };
        document.addEventListener("click", rememberRenderedExpansion, true);
        return () => document.removeEventListener("click", rememberRenderedExpansion, true);
    }, [currentLocale, currentSidebar?.sidebarItems, currentSidebar?.sidebarName, isGlobalPage, pluginId]);

    if (currentSidebar === null) return <NotFoundContent />;

    const restoredSidebar = isGlobalPage && rememberedSidebar?.locale === currentLocale
        ? rememberedSidebar
        : undefined;
    return <HtmlClassNameProvider className={clsx(ThemeClassNames.page.docsDocPage)}>
        <DocsSidebarProvider
            name={restoredSidebar?.name ?? currentSidebar.sidebarName}
            items={restoredSidebar?.items ?? currentSidebar.sidebarItems}
        >
            <DocRootLayout>{currentSidebar.docElement}</DocRootLayout>
        </DocsSidebarProvider>
    </HtmlClassNameProvider>;
}