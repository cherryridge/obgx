import fs from "node:fs";
import path from "node:path";
import type {SidebarsConfig} from "@docusaurus/plugin-content-docs";
import {createSidebarWith, sortModules, createModuleCategory, divider, SidebarItems} from "./util";

const modulesRoot = path.join(process.cwd(), "modules");

function createRefItems(): SidebarItems {
    return [
        divider,
        ...fs.readdirSync(modulesRoot, {withFileTypes: true})
            .filter(entry => entry.isDirectory())
            .filter(entry => fs.existsSync(path.join(modulesRoot, entry.name, "_category_.json")))
            .map(entry => entry.name)
            .sort(sortModules)
            .map(moduleIdentifier => createModuleCategory(moduleIdentifier))
    ]
}

export default {
    sidebar: createSidebarWith(createRefItems())
} satisfies SidebarsConfig;