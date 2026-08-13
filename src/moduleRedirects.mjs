const moduleIdentifierPattern = /^[a-z](?:[a-z0-9-]*[a-z0-9])?@[1-9][0-9]*$/;

export function parseModuleIdentifier(identifier) {
    if (typeof identifier !== "string" || !moduleIdentifierPattern.test(identifier)) {
        throw new Error(`[OBGX] Invalid Module identifier: ${identifier}.`);
    }

    const separatorIndex = identifier.lastIndexOf("@");
    return {
        identifier,
        name: identifier.slice(0, separatorIndex),
        version: BigInt(identifier.slice(separatorIndex + 1))
    };
}

export function buildModuleRedirects(moduleIdentifiers, editions) {
    const latestModules = new Map();
    for (const moduleIdentifier of moduleIdentifiers) {
        const module = parseModuleIdentifier(moduleIdentifier);
        const latest = latestModules.get(module.name);
        if (latest === undefined || module.version > latest.version) latestModules.set(module.name, module);
    }

    const redirects = [...latestModules.values()]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(module => ({
            from: `/ref/${module.name}`,
            to: `/ref/${module.identifier}`
        }));

    for (const edition of [...editions].sort((left, right) => left.id.localeCompare(right.id))) {
        const boundModules = new Map();
        for (const moduleIdentifier of edition.modules) {
            const module = parseModuleIdentifier(moduleIdentifier);
            const existing = boundModules.get(module.name);
            if (existing !== undefined) {
                throw new Error(
                    `[OBGX] Edition ${edition.id} binds Module ${module.name} more than once: ` +
                    `${existing.identifier}, ${module.identifier}.`
                );
            }
            boundModules.set(module.name, module);
        }

        redirects.push(...[...boundModules.values()]
            .sort((left, right) => left.name.localeCompare(right.name))
            .map(module => ({
                from: `/${edition.id}/${module.name}`,
                to: `/${edition.id}/${module.identifier}`
            }))
        );
    }

    return redirects;
}

export function resolveModuleRedirect(pathname, baseUrl, redirects) {
    const localizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    if (!pathname.startsWith(localizedBaseUrl)) return undefined;

    const relativePath = pathname.slice(localizedBaseUrl.length).replace(/\/+$/, "");
    const localPath = `/${relativePath}`;
    const redirect = redirects.find(candidate =>
        candidate.from === localPath || localPath.startsWith(`${candidate.from}/`)
    );
    if (redirect === undefined) return undefined;

    const baseUrlPrefix = localizedBaseUrl === "/" ? "" : localizedBaseUrl.slice(0, -1);
    const nestedPath = localPath.slice(redirect.from.length);
    return `${baseUrlPrefix}${redirect.to}${nestedPath}`;
}