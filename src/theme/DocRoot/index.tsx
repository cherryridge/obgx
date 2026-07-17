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

const rememberedSidebars = new Map<string, RememberedSidebar>();

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
                rememberedSidebars.set(currentLocale, sidebar);
                setRememberedSidebar(sidebar);
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