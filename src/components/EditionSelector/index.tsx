import clsx from "clsx";
import editionData from "@site/.generated/editionData";
import {useLocation} from "@docusaurus/router";
import {translate} from "@docusaurus/Translate";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {useEffect, useState} from "react";
import DropdownNavbarItem from "@theme/NavbarItem/DropdownNavbarItem";
import type {Props as DropdownNavbarItemProps} from "@theme/NavbarItem/DropdownNavbarItem";
import type {LinkLikeNavbarItemProps} from "@theme/NavbarItem";
import styles from "./styles.module.css";

type SelectorProps = Pick<DropdownNavbarItemProps, "mobile" | "position" | "onClick">;

interface ParsedRoute {
    view: "global" | "edition" | "reference";
    edition?: string;
    module?: string;
    elementPath?: string;
}

type RememberedRoute = Omit<ParsedRoute, "view"> & {
    view: "edition" | "reference";
};

interface EditionRouteData {
    readonly defaultEdition: string;
    readonly editions: ReadonlyArray<{
        readonly id: string;
        readonly status: "draft" | "released" | "deprecated";
        readonly releaseDate?: string;
        readonly modules: readonly string[];
    }>;
    readonly modules: readonly string[];
}

const rememberedRouteKey = "obgx:last-documentation-route";

function isRememberedRoute(value: unknown, data: EditionRouteData): value is RememberedRoute {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    const moduleIdentifier = candidate.module;
    const elementPath = candidate.elementPath;

    if (candidate.view !== "edition" && candidate.view !== "reference") return false;
    if (moduleIdentifier !== undefined &&
        (typeof moduleIdentifier !== "string" || !data.modules.includes(moduleIdentifier))) return false;
    if (elementPath !== undefined &&
        (typeof elementPath !== "string" || moduleIdentifier === undefined)) return false;

    if (candidate.view === "reference") return candidate.edition === undefined;
    if (typeof candidate.edition !== "string") return false;
    const edition = data.editions.find(item => item.id === candidate.edition);
    return edition !== undefined &&
        (moduleIdentifier === undefined || edition.modules.includes(moduleIdentifier as string));
}

function loadRememberedRoute(data: EditionRouteData): RememberedRoute | undefined {
    try {
        const storedRoute = sessionStorage.getItem(rememberedRouteKey);
        if (storedRoute === null) return undefined;
        const route: unknown = JSON.parse(storedRoute);
        if (isRememberedRoute(route, data)) return route;
        sessionStorage.removeItem(rememberedRouteKey);
    } catch {
        // Storage can be unavailable in restricted browser contexts.
    }
    return undefined;
}

function saveRememberedRoute(route: RememberedRoute): void {
    try {
        sessionStorage.setItem(rememberedRouteKey, JSON.stringify(route));
    } catch {
        // Navigation still works without persisted state.
    }
}

function parseRoute(pathname: string, baseUrl: string, data: EditionRouteData): ParsedRoute {
    const localPath = pathname.startsWith(baseUrl) ? pathname.slice(baseUrl.length) : pathname.replace(/^\//, "");
    const segments = localPath.split("/").filter(Boolean).map(decodeURIComponent);
    const isReference = segments[0] === "ref";
    const edition = data.editions.find(candidate => candidate.id === segments[0]);
    const moduleIndex = isReference || edition ? 1 : -1;
    const moduleIdentifier = moduleIndex >= 0 && data.modules.includes(segments[moduleIndex])
        ? segments[moduleIndex]
        : undefined;

    return {
        view: isReference ? "reference" : edition ? "edition" : "global",
        edition: edition?.id,
        module: moduleIdentifier,
        elementPath: moduleIdentifier ? segments.slice(moduleIndex + 1).map(encodeURIComponent).join("/") : undefined
    };
}

function resolveTarget(route: ParsedRoute, target: "reference" | string, data: EditionRouteData): string {
    const suffix = route.elementPath ? `/${route.elementPath}` : "";

    if (target === "reference") {
        return route.module ? `/ref/${route.module}${suffix}` : "/ref";
    }

    const edition = data.editions.find(candidate => candidate.id === target);
    if (!edition) {
        throw new Error(`Unknown OBGX Edition: ${target}`);
    }

    return route.module && edition.modules.includes(route.module)
        ? `/${edition.id}/${route.module}${suffix}`
        : `/${edition.id}`;
}

export default function EditionSelector({mobile, position, onClick}: SelectorProps) {
    const data: EditionRouteData = editionData;
    const {siteConfig} = useDocusaurusContext();
    const {pathname} = useLocation();
    const route = parseRoute(pathname, siteConfig.baseUrl, data);
    const [rememberedRoute, setRememberedRoute] = useState<RememberedRoute>();

    useEffect(() => {
        if (route.view === "global") {
            setRememberedRoute(currentRoute => currentRoute && isRememberedRoute(currentRoute, data)
                ? currentRoute
                : loadRememberedRoute(data));
            return;
        }

        const nextRoute: RememberedRoute = {
            view: route.view,
            edition: route.edition,
            module: route.module,
            elementPath: route.elementPath
        };
        setRememberedRoute(nextRoute);
        saveRememberedRoute(nextRoute);
    }, [data, route.view, route.edition, route.module, route.elementPath]);

    const effectiveRoute = route.view === "global" ? rememberedRoute ?? route : route;
    const defaultEdition = data.editions.find(edition => edition.id === data.defaultEdition);
    const selectedEdition = data.editions.find(edition => edition.id === effectiveRoute.edition) ?? defaultEdition;
    const currentLabel = effectiveRoute.view === "reference" ? translate({
        id: "editionSelector.allModules.label",
        message: "All Modules"
    }) : selectedEdition?.id ?? data.defaultEdition;
    const items: LinkLikeNavbarItemProps[] = [
        ...data.editions.map(edition => ({
            label: edition.id,
            to: resolveTarget(effectiveRoute, edition.id, data),
            className: clsx(effectiveRoute.view === "edition" &&
                effectiveRoute.edition === edition.id && styles.activeItem)
        })),
        {
            type: "html",
            value: "<div style='margin:.4rem .2rem;border-top:solid 1px var(--ifm-toc-border-color)'/>"
        },
        {
            label: translate({id: "editionSelector.allModules.label", message: "All Modules"}),
            to: resolveTarget(effectiveRoute, "reference", data),
            className: clsx(effectiveRoute.view === "reference" && styles.activeItem)
        }
    ];

    return <DropdownNavbarItem
        mobile={mobile}
        position={position}
        onClick={onClick}
        label={currentLabel}
        items={items}
        className={styles.trigger}
    />;
}