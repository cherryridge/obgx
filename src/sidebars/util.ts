import fs from "node:fs";
import path from "node:path";
import type {SidebarsConfig} from "@docusaurus/plugin-content-docs";

export type SidebarItems = Extract<SidebarsConfig[string], unknown[]>;

const sharedSidebarSectionKey = "obgxSharedSidebarSection";

function sharedSidebarItem<T extends object>(
    item: T,
    section: "global" | "footer"
): T & {customProps: Readonly<Record<string, unknown>>} {
    const customProps = "customProps" in item && typeof item.customProps === "object" && item.customProps !== null
        ? item.customProps
        : {};
    return {...item, customProps: {...customProps, [sharedSidebarSectionKey]: section}};
}

const modulesRoot = path.join(process.cwd(), "modules");
export const divider = {
    type: "html" as const,
    value: "<div style='background-color:var(--ifm-color-emphasis-600);height:1px;margin:.5rem'></div>"
};

function collectDocIds(directory: string): string[] {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectDocIds(entryPath);
        if (!entry.isFile() || !/\.mdx?$/.test(entry.name)) return [];
        return [path.relative(modulesRoot, entryPath).replaceAll(path.sep, "/").replace(/\.mdx?$/, "")];
    });
}

export function sortModules(left: string, right: string): number {
    const
        leftAt = left.lastIndexOf("@"),
        rightAt = right.lastIndexOf("@"),
        leftId = left.slice(0, leftAt),
        rightId = right.slice(0, rightAt);

    if (leftId !== rightId) return leftId < rightId ? -1 : 1;

    const
        leftVersion = BigInt(left.slice(leftAt + 1)),
        rightVersion = BigInt(right.slice(rightAt + 1));
    return leftVersion < rightVersion ? -1 : leftVersion > rightVersion ? 1 : 0;
}

export function createModuleCategory(moduleIdentifier: string, idPrefix = "") {
    const indexId = `${idPrefix}${moduleIdentifier}/index`;
    const moduleDirectory = path.join(modulesRoot, moduleIdentifier);

    return {
        type: "category" as const,
        label: moduleIdentifier,
        link: {type: "doc" as const, id: indexId},
        items: collectDocIds(moduleDirectory)
            .map(id => `${idPrefix}${id}`)
            .filter(id => id !== indexId)
            .sort()
            .map(id => ({type: "doc" as const, id}))
    };
}

export function createSidebarWith(dynamicItems: SidebarItems): SidebarItems {
    const globalItems: SidebarItems = [
        {type: "link", label: "Overview", href: "/overview"},
        {type: "link", label: "Terminology", href: "/terminology"},
        {type: "link", label: "Syntax", href: "/syntax"},
        {type: "link", label: "Contributing", href: "/contributing"}
    ];

    return [
        ...globalItems.map(item => {
            if (typeof item !== "object" || !("type" in item)) {
                throw new Error("Global sidebar items must use the expanded object syntax.");
            }
            return sharedSidebarItem(item, "global");
        }),
        ...dynamicItems,
        sharedSidebarItem(divider, "footer"),
        sharedSidebarItem({
            type: "html" as const,
            value: `<div style="padding-top:1rem;text-align:center;font-size:.9rem;color:var(--ifm-color-emphasis-700);">
                <div>Copyright &copy; ${new Date().getFullYear()} CherryRidge.</div>
                <div><a href="https://github.com/cherryridge/obgx" target="_blank">GitHub</a> · <a href="https://docs.cherrygrove.dev" target="_blank">CherryGrove</a></div>
            </div>`
        }, "footer")
    ];
}