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
const editionIdentifierPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*))?(-draft)?$/;

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

function parseEditionIdentifier(identifier) {
    const match = editionIdentifierPattern.exec(identifier);
    if (match === null) {
        throw new Error(
            `[OBGX] Invalid Edition identifier: ${identifier}. ` +
            "Expected <yy>.<m>[.<r>][-draft] with no leading zeroes."
        );
    }

    return {
        numbers: [BigInt(match[1]), BigInt(match[2]), match[3] === undefined ? 0n : BigInt(match[3])],
        draft: match[4] !== undefined
    };
}

export function compareEditionIds(left, right) {
    const leftEdition = parseEditionIdentifier(left);
    const rightEdition = parseEditionIdentifier(right);
    for (let index = 0; index < leftEdition.numbers.length; index += 1) {
        if (leftEdition.numbers[index] > rightEdition.numbers[index]) return -1;
        if (leftEdition.numbers[index] < rightEdition.numbers[index]) return 1;
    }
    return Number(leftEdition.draft) - Number(rightEdition.draft);
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function markdownLink(label, href) {
    const escapedLabel = label.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
    const escapedHref = href.replaceAll(">", "%3E").replaceAll(" ", "%20");
    return `[${escapedLabel}](<${escapedHref}>)`;
}

function resolveAnnouncementHref(announcement) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(announcement)
        ? announcement
        : `/blog/${announcement}`;
}

function createEditionLandingPage(edition, modules) {
    const announcement = edition.announcement === undefined
        ? "None"
        : markdownLink(edition.announcement, resolveAnnouncementHref(edition.announcement));
    const moduleItems = edition.modules.length === 0
        ? ["_No modules._"]
        : edition.modules.map(moduleIdentifier => {
            const module = modules.get(moduleIdentifier);
            return `- [\`${moduleIdentifier}\`](<./${moduleIdentifier}/${module.landingFileName}>)`;
        });

    return [
        `# ${edition.id}`,
        "",
        `- **ID:** \`${edition.id}\``,
        `- **Status:** \`${edition.status}\``,
        `- **Announcement:** ${announcement}`,
        "",
        "<details>",
        "<summary>Modules</summary>",
        "",
        ...moduleItems,
        "",
        "</details>"
    ].join("\r\n");
}

function writeEditionLandingPage(targetRoot, edition, modules) {
    fs.writeFileSync(
        path.join(targetRoot, "index.mdx"),
        createEditionLandingPage(edition, modules),
        "utf8"
    );
}

function findLandingFileName(directory) {
    return ["index.mdx", "index.md"]
        .find(fileName => fs.existsSync(path.join(directory, fileName)));
}

function loadEditions() {
    const modules = new Map();
    const editions = fs.readdirSync(editionsRoot, {withFileTypes: true})
        .filter(entry => entry.isFile() && entry.name !== "schema.json" && entry.name.endsWith(".json"))
        .map(entry => {
            const editionIdentifier = entry.name.slice(0, -".json".length);
            const manifestPath = `editions/${entry.name}`;
            const manifest = readJson(manifestPath);
            if (manifest.id !== editionIdentifier || typeof manifest.id !== "string" || !Array.isArray(manifest.modules)) {
                throw new Error(`[OBGX] Invalid manifest: ${manifestPath}.`);
            }
            parseEditionIdentifier(manifest.id);
            if (manifest.announcement !== undefined &&
                (typeof manifest.announcement !== "string" || manifest.announcement.length === 0)) {
                throw new Error(`[OBGX] Edition ${manifest.id} has an invalid announcement.`);
            }

            for (const moduleIdentifier of manifest.modules) {
                if (!moduleIdentifierPattern.test(moduleIdentifier)) {
                    throw new Error(`[OBGX] Invalid Module identifier: ${moduleIdentifier}.`);
                }
                if (modules.has(moduleIdentifier)) continue;

                const moduleSourceDirectory = path.join(modulesRoot, moduleIdentifier);
                const category = readJson(`modules/${moduleIdentifier}/_category_.json`);
                const landingFileName = findLandingFileName(moduleSourceDirectory);
                if (typeof category.customProps?.domain !== "string") {
                    throw new Error(`[OBGX] ${moduleIdentifier}/_category_.json must define customProps.domain.`);
                }
                if (landingFileName === undefined) {
                    throw new Error(`[OBGX] ${moduleIdentifier} must have an index.md or index.mdx.`);
                }

                modules.set(moduleIdentifier, {sourceDirectory: moduleSourceDirectory, landingFileName});
            }

            return manifest;
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
        writeEditionLandingPage(editionRoot, edition, modules);

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
            const localizedModules = new Map();

            for (const moduleIdentifier of edition.modules) {
                const translatedModule = path.join(moduleSourceRoot, moduleIdentifier);
                const sourceDirectory = fs.existsSync(translatedModule)
                    ? translatedModule
                    : modules.get(moduleIdentifier).sourceDirectory;
                const landingFileName = findLandingFileName(sourceDirectory);
                if (landingFileName === undefined) {
                    throw new Error(`[OBGX] ${sourceDirectory} must have an index.md or index.mdx.`);
                }
                localizedModules.set(moduleIdentifier, {sourceDirectory, landingFileName});
                fs.cpSync(sourceDirectory, path.join(editionRoot, moduleIdentifier), {recursive: true});
            }
            writeEditionLandingPage(editionRoot, edition, localizedModules);
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
            .sort((left, right) => compareEditionIds(left.id, right.id)),
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