import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const globalsRoot = path.join(projectRoot, "globals");
const editionsRoot = path.join(projectRoot, "editions");
const modulesRoot = path.join(projectRoot, "modules");
const generatedRoot = path.join(projectRoot, ".generated", "edition");
const stagedRoot = path.join(projectRoot, ".generated", "edition.next");
const generatedDataPath = path.join(projectRoot, ".generated", "editionData.ts");
const moduleIdentifierPattern = /^[a-z](?:[a-z0-9-]*[a-z0-9])?@[1-9][0-9]*$/;

function compareModuleIdentifiers(left, right) {
    const leftAt = left.lastIndexOf("@");
    const rightAt = right.lastIndexOf("@");
    const leftId = left.slice(0, leftAt);
    const rightId = right.slice(0, rightAt);
    if (leftId !== rightId) return leftId < rightId ? -1 : 1;
    const leftVersion = BigInt(left.slice(leftAt + 1));
    const rightVersion = BigInt(right.slice(rightAt + 1));
    return leftVersion < rightVersion ? -1 : leftVersion > rightVersion ? 1 : 0;
}

function compareEditionIds(left, right) {
    const leftParts = left.replace(/-draft$/, "").split(".").map(Number);
    const rightParts = right.replace(/-draft$/, "").split(".").map(Number);
    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
        const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
        if (difference !== 0) return difference;
    }
    return left < right ? -1 : left > right ? 1 : 0;
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function loadEditions() {
    const modules = new Map();
    const editions = fs.readdirSync(editionsRoot, {withFileTypes: true})
        .filter(entry => entry.isDirectory())
        .filter(entry => fs.existsSync(path.join(editionsRoot, entry.name, "index.json")))
        .map(entry => {
            const manifestPath = `editions/${entry.name}/index.json`;
            const manifest = readJson(manifestPath);
            if (manifest.id !== entry.name || typeof manifest.id !== "string" || !Array.isArray(manifest.modules)) {
                throw new Error(`[OBGX] Invalid manifest: ${manifestPath}.`);
            }

            const sourceDirectory = path.join(editionsRoot, entry.name);
            const landingFileName = ["index.mdx", "index.md"]
                .find(fileName => fs.existsSync(path.join(sourceDirectory, fileName)));
            if (landingFileName === undefined) {
                throw new Error(`[OBGX] Edition ${manifest.id} must have an index.md or index.mdx.`);
            }

            for (const moduleIdentifier of manifest.modules) {
                if (!moduleIdentifierPattern.test(moduleIdentifier)) {
                    throw new Error(`[OBGX] Invalid Module identifier: ${moduleIdentifier}.`);
                }
                if (modules.has(moduleIdentifier)) continue;

                const moduleSourceDirectory = path.join(modulesRoot, moduleIdentifier);
                const category = readJson(`modules/${moduleIdentifier}/_category_.json`);
                if (typeof category.customProps?.domain !== "string") {
                    throw new Error(`[OBGX] ${moduleIdentifier}/_category_.json must define customProps.domain.`);
                }
                if (!fs.existsSync(path.join(moduleSourceDirectory, "index.mdx")) && !fs.existsSync(path.join(moduleSourceDirectory, "index.md"))) {
                    throw new Error(`[OBGX] ${moduleIdentifier} must have an index.md or index.mdx.`);
                }

                modules.set(moduleIdentifier, {sourceDirectory: moduleSourceDirectory});
            }

            return {...manifest, sourceDirectory, landingFileName};
        });

    const drafts = editions.filter(edition => edition.status === "draft");
    const released = editions.filter(edition => edition.status === "released");
    if (editions.some(edition => !["draft", "released", "deprecated"].includes(edition.status))) {
        throw new Error("[OBGX] An Edition has an unknown status.");
    }
    if (drafts.length > 1) {
        throw new Error("[OBGX] At most one Edition may have draft status.");
    }
    if (released.some(edition => !isReleaseDate(edition.releaseDate))) {
        throw new Error("[OBGX] Every released Edition must have a valid releaseDate.");
    }

    const defaultEdition = released.length > 0
        ? [...released].sort((left, right) => right.releaseDate.localeCompare(left.releaseDate))[0].id
        : drafts[0]?.id;
    if (defaultEdition === undefined) {
        throw new Error("[OBGX] Define a released Edition or one draft Edition.");
    }

    return {defaultEdition, editions, modules};
}

function isReleaseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function copyGlobalDocs(targetRoot) {
    fs.mkdirSync(targetRoot, {recursive: true});
    for (const entry of fs.readdirSync(globalsRoot, {withFileTypes: true})) {
        if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
            fs.copyFileSync(path.join(globalsRoot, entry.name), path.join(targetRoot, entry.name));
        }
    }
}

function projectDefaultDocs(editions, modules) {
    fs.rmSync(stagedRoot, {recursive: true, force: true});
    copyGlobalDocs(stagedRoot);

    for (const edition of editions) {
        const editionRoot = path.join(stagedRoot, edition.id);
        fs.mkdirSync(editionRoot, {recursive: true});
        fs.copyFileSync(
            path.join(edition.sourceDirectory, edition.landingFileName),
            path.join(editionRoot, edition.landingFileName)
        );

        for (const moduleIdentifier of edition.modules) {
            fs.cpSync(
                modules.get(moduleIdentifier).sourceDirectory,
                path.join(editionRoot, moduleIdentifier),
                {recursive: true}
            );
        }
    }

    synchronizeGeneratedRoot();
}

function synchronizeGeneratedRoot() {
    fs.mkdirSync(generatedRoot, {recursive: true});
    const stagedFiles = collectFiles(stagedRoot);
    const generatedFiles = new Set(collectFiles(generatedRoot));

    for (const relativePath of stagedFiles) {
        const sourcePath = path.join(stagedRoot, relativePath);
        const targetPath = path.join(generatedRoot, relativePath);
        generatedFiles.delete(relativePath);
        if (fs.existsSync(targetPath) && fs.readFileSync(sourcePath).equals(fs.readFileSync(targetPath))) continue;
        fs.mkdirSync(path.dirname(targetPath), {recursive: true});
        fs.copyFileSync(sourcePath, targetPath);
    }

    for (const relativePath of generatedFiles) {
        fs.rmSync(path.join(generatedRoot, relativePath), {force: true});
    }
    removeEmptyDirectories(generatedRoot);
    fs.rmSync(stagedRoot, {recursive: true, force: true});
}

function collectFiles(root) {
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            return collectFiles(entryPath).map(relativePath => path.join(entry.name, relativePath));
        }
        return entry.isFile() ? [entry.name] : [];
    });
}

function removeEmptyDirectories(root) {
    for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
        if (!entry.isDirectory()) continue;
        const entryPath = path.join(root, entry.name);
        removeEmptyDirectories(entryPath);
        if (fs.readdirSync(entryPath).length === 0) fs.rmdirSync(entryPath);
    }
}

function projectTranslations(editions, modules) {
    const i18nRoot = path.join(projectRoot, "i18n");
    if (!fs.existsSync(i18nRoot)) return;

    for (const locale of fs.readdirSync(i18nRoot, {withFileTypes: true}).filter(entry => entry.isDirectory())) {
        const localeRoot = path.join(i18nRoot, locale.name);
        const globalSourceRoot = path.join(localeRoot, "docusaurus-plugin-content-docs-global", "current");
        const moduleSourceRoot = path.join(localeRoot, "docusaurus-plugin-content-docs-ref", "current");
        const targetRoot = path.join(localeRoot, "docusaurus-plugin-content-docs-edition", "current");
        fs.rmSync(targetRoot, {recursive: true, force: true});
        copyGlobalDocs(targetRoot);
        if (fs.existsSync(globalSourceRoot)) fs.cpSync(globalSourceRoot, targetRoot, {recursive: true});

        for (const edition of editions) {
            const editionRoot = path.join(targetRoot, edition.id);
            fs.mkdirSync(editionRoot, {recursive: true});
            fs.copyFileSync(
                path.join(edition.sourceDirectory, edition.landingFileName),
                path.join(editionRoot, edition.landingFileName)
            );

            for (const moduleIdentifier of edition.modules) {
                const translatedModule = path.join(moduleSourceRoot, moduleIdentifier);
                const sourceDirectory = fs.existsSync(translatedModule)
                    ? translatedModule
                    : modules.get(moduleIdentifier).sourceDirectory;
                fs.cpSync(sourceDirectory, path.join(editionRoot, moduleIdentifier), {recursive: true});
            }
        }
    }
}

function writeEditionData(defaultEdition, editions) {
    const data = {
        defaultEdition,
        editions: editions
            .map(edition => ({
                id: edition.id,
                status: edition.status,
                ...(typeof edition.releaseDate === "string" ? {releaseDate: edition.releaseDate} : {}),
                modules: edition.modules
            }))
            .sort((left, right) => compareEditionIds(right.id, left.id)),
        modules: fs.readdirSync(modulesRoot, {withFileTypes: true})
            .filter(entry => entry.isDirectory())
            .filter(entry => fs.existsSync(path.join(modulesRoot, entry.name, "_category_.json")))
            .map(entry => entry.name)
            .sort(compareModuleIdentifiers)
    };
    const source = `const editionData = ${JSON.stringify(data, null, 4)} as const;\n\nexport default editionData;`
        .replaceAll("\n", "\r\n");
    fs.mkdirSync(path.dirname(generatedDataPath), {recursive: true});
    if (!fs.existsSync(generatedDataPath) || fs.readFileSync(generatedDataPath, "utf8") !== source) {
        fs.writeFileSync(generatedDataPath, source, "utf8");
    }
}

export function generateEditionDocs() {
    const {defaultEdition, editions, modules} = loadEditions();
    projectDefaultDocs(editions, modules);
    projectTranslations(editions, modules);
    writeEditionData(defaultEdition, editions);
    console.log(`Generated ${editions.length} Edition view${editions.length === 1 ? "" : "s"}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    generateEditionDocs();
}