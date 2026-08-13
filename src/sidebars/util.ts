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
const docIdCollator = new Intl.Collator("en", {caseFirst: "upper"});
export const divider = {
    type: "html" as const,
    value: "<div style='background-color:var(--ifm-color-emphasis-500);height:1px;margin:.5rem'></div>"
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
    const sourceLandingId = `${moduleIdentifier}/_index`;
    const landingId = `${idPrefix}${sourceLandingId}`;
    const moduleDirectory = path.join(modulesRoot, moduleIdentifier);

    return {
        type: "category" as const,
        label: moduleIdentifier,
        link: {type: "doc" as const, id: landingId},
        items: collectDocIds(moduleDirectory)
            .filter(id => id !== sourceLandingId)
            .map(id => `${idPrefix}${id}`)
            .sort(docIdCollator.compare)
            .map(id => ({type: "doc" as const, id}))
    };
}

export function createSidebarWith(dynamicItems: SidebarItems, resolveGlobalDocs = false): SidebarItems {
    const globalDocs = [
        {id: "overview", label: "Overview"},
        {id: "terminology", label: "Terminology"},
        {id: "syntax", label: "Syntax"},
        {id: "type", label: "Type System"},
        {id: "execution", label: "Execution"},
        {id: "best-practices", label: "Best Practices"},
        {id: "contributing", label: "Contributing"},
    ] as const;
    const globalItems: SidebarItems = globalDocs.map(({id, label}) => resolveGlobalDocs
        ? {type: "ref" as const, id, label}
        : {type: "link" as const, label, href: `/${id}`}
    );

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