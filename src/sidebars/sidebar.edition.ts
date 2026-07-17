import fs from "node:fs";
import path from "node:path";
import { SidebarsConfig } from "@docusaurus/plugin-content-docs";
import { createSidebarWith, sortModules, createModuleCategory, divider, SidebarItems } from "./util";

const domains = [
    { identifier: "data-model", label: "Data Model" },
    { identifier: "game-model", label: "Game Model" },
    { identifier: "presentation", label: "Presentation" },
    { identifier: "interaction", label: "Interaction" },
    { identifier: "host-services", label: "Host Services" },
    { identifier: "host-integration", label: "Host Integration" },
    { identifier: "diagnostics", label: "Diagnostics" }
] as const;

const editions = fs
    .readdirSync(path.join(process.cwd(), "editions"), {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .filter(entry => fs.existsSync(path.join(process.cwd(), "editions", entry.name, "index.json")))
    .map(entry => readJson<{id: string; modules: string[]}>(`editions/${entry.name}/index.json`));

function createEditionItems(editionIdentifier: string): SidebarItems {
    const edition = editions.find(candidate => candidate.id === editionIdentifier);
    if (edition === undefined) return [];
    const domainItems = domains.flatMap(domain => {
        const moduleItems = edition.modules
            .filter(moduleIdentifier => {
                const category = readJson<{customProps?: {domain?: unknown}}>(`modules/${moduleIdentifier}/_category_.json`);
                return category.customProps?.domain === domain.identifier;
            })
            .sort(sortModules)
            .map(moduleIdentifier => createModuleCategory(moduleIdentifier, `${edition.id}/`));

        return moduleItems.length === 0 ? [] : [{
            type: "category" as const,
            label: domain.label,
            collapsed: false,
            items: moduleItems
        }];
    });
    return [
        divider,
        {type: "doc", id: `${edition.id}/index`, label: edition.id},
        ...domainItems
    ];
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

const editionSidebars = Object.fromEntries(editions.map(edition => edition.id).map(id => [
    `edition-${id}`,
    createSidebarWith(createEditionItems(id))
]));

export default {
    sidebar: createSidebarWith(createEditionItems("")),
    ...editionSidebars
} satisfies SidebarsConfig;