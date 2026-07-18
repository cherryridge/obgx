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

        if (isGlobalPage) {
            const sidebar = rememberedSidebars.get(currentLocale) ?? loadRememberedSidebar(currentLocale);
            if (sidebar !== undefined) {
                const refreshedSidebar = refreshRememberedSidebar(currentSidebar.sidebarItems, sidebar);
                rememberedSidebars.set(currentLocale, refreshedSidebar);
                setRememberedSidebar(refreshedSidebar);
                saveRememberedSidebar(refreshedSidebar);
            }
            return;
        }

        const sidebar = {
            locale: currentLocale,
            name: currentSidebar.sidebarName,
            items: currentSidebar.sidebarItems
        };
        rememberedSidebars.set(currentLocale, sidebar);
        setRememberedSidebar(sidebar);
        saveRememberedSidebar(sidebar);
    }, [currentLocale, currentSidebar?.sidebarItems, currentSidebar?.sidebarName, isGlobalPage]);

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