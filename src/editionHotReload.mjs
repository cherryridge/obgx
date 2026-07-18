import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {generateEditionDocs} from "./generateEditionViews.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docusaurusCli = path.join(projectRoot, "node_modules", "@docusaurus", "core", "bin", "docusaurus.mjs");
const siteConfigPath = path.join(projectRoot, "docusaurus.config.ts");
const sidebarsRoot = path.join(projectRoot, "src", "sidebars");
const sidebarEntryPaths = ["sidebar.edition.ts", "sidebar.ref.ts"]
    .map(fileName => path.join(sidebarsRoot, fileName));
const sourceRoots = ["globals", "editions", "modules"]
    .map(relativePath => path.join(projectRoot, relativePath))
    .filter(sourcePath => fs.existsSync(sourcePath));
const i18nRoot = path.join(projectRoot, "i18n");
if (fs.existsSync(i18nRoot)) sourceRoots.push(i18nRoot);

generateEditionDocs();

let regenerationTimer;
let sidebarReloadTimer;
function scheduleRegeneration(changedPath) {
    if (changedPath.replaceAll(path.sep, "/").includes("docusaurus-plugin-content-docs-edition/current")) return;
    clearTimeout(regenerationTimer);
    regenerationTimer = setTimeout(() => {
        try {
            generateEditionDocs();
        } catch (error) {
            console.error("[OBGX] Edition view regeneration failed.");
            console.error(error);
        }
    }, 100);
}

function scheduleSidebarReload(changedPath) {
    if (sidebarEntryPaths.includes(changedPath)) return;
    clearTimeout(sidebarReloadTimer);
    sidebarReloadTimer = setTimeout(() => {
        const now = new Date();
        fs.utimesSync(siteConfigPath, now, now);
    }, 100);
}

const watchers = sourceRoots.map(sourceRoot => fs.watch(
    sourceRoot,
    {recursive: true},
    (_eventType, fileName) => scheduleRegeneration(path.join(sourceRoot, fileName?.toString() ?? ""))
));
watchers.push(fs.watch(
    sidebarsRoot,
    {recursive: true},
    (_eventType, fileName) => scheduleSidebarReload(path.join(sidebarsRoot, fileName?.toString() ?? ""))
));

const forwardedArguments = process.argv.slice(2);
const hasPort = forwardedArguments.some(argument => argument === "--port" || argument.startsWith("--port="));
const child = spawn(
    process.execPath,
    [docusaurusCli, "start", ...(hasPort ? [] : ["--port", "20241"]), ...forwardedArguments],
    {cwd: projectRoot, stdio: "inherit"}
);

function closeWatchers() {
    clearTimeout(regenerationTimer);
    clearTimeout(sidebarReloadTimer);
    for (const watcher of watchers) watcher.close();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => child.kill(signal));
}

child.once("exit", code => {
    closeWatchers();
    process.exitCode = code ?? 1;
});

child.once("error", error => {
    closeWatchers();
    console.error(error);
    process.exitCode = 1;
});