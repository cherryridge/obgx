import React, {type ReactNode} from "react";
import clsx from "clsx";
import {ThemeClassNames} from "@docusaurus/theme-common";
import {useDoc} from "@docusaurus/plugin-content-docs/client";
import Heading from "@theme/Heading";
import MDXContent from "@theme/MDXContent";
import type {Props} from "@theme/DocItem/Content";

function getDocumentName(source: string, fallback: string): string {
    const normalizedSource = source.replaceAll("\\", "/");
    const fileName = normalizedSource.slice(normalizedSource.lastIndexOf("/") + 1);
    return fileName.replace(/\.mdx?$/i, "") || fallback;
}

function getTypeLabel(type: string): string {
    const normalizedType = type.trim();
    return normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
}

function useSyntheticTitle(): ReactNode | null {
    const {metadata, frontMatter, contentTitle} = useDoc();
    const {type: documentType} = frontMatter as typeof frontMatter & {readonly type?: unknown};
    if (frontMatter.hide_title || contentTitle !== undefined) return null;

    if (typeof documentType !== "string" || documentType.trim().length === 0) {
        return metadata.title;
    }

    return <>{getTypeLabel(documentType)} <code>{getDocumentName(metadata.source, metadata.title)}</code></>;
}

export default function DocItemContent({children}: Props): ReactNode {
    const syntheticTitle = useSyntheticTitle();
    return (
        <div className={clsx(ThemeClassNames.docs.docMarkdown, "markdown")}>
            {syntheticTitle && (
                <header>
                    <Heading as="h1">{syntheticTitle}</Heading>
                </header>
            )}
            <MDXContent>{children}</MDXContent>
        </div>
    );
}