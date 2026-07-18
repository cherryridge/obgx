import {translate} from "@docusaurus/Translate";
import {useId} from "react";
import Markdown from "react-markdown";
import styles from "./style.module.css";

export const hosts = {
    cherrygrove: {
        name: "CherryGrove"
    }
} as const satisfies Record<string, {readonly name: string}>;

export type HostId = keyof typeof hosts;
export type SupportStatus = "supported" | "partial" | "unsupported" | "unknown";

export interface SupportStatement {
    readonly status: SupportStatus;
    readonly versionAdded?: string;
    readonly versionRemoved?: string;
    readonly notes?: string | readonly string[];
}

export type SupportMap = Partial<Record<HostId, SupportStatement>>;

export interface CompatibilitySubfeature {
    readonly name: string;
    readonly support: SupportMap;
}

export interface CompatableProps {
    readonly element: string;
    readonly support: SupportMap;
    readonly subfeatures?: readonly CompatibilitySubfeature[];
}

interface CompatibilityRow {
    readonly name: string;
    readonly support: SupportMap;
    readonly isElement?: boolean;
}

interface NoteEntry {
    readonly number: number;
    readonly text: string;
}

const hostIds = Object.keys(hosts) as HostId[];
const statusSymbols: Record<SupportStatus, string> = {
    supported: "✓",
    partial: "◐",
    unsupported: "×",
    unknown: "?"
};

function getStatusLabel(status: SupportStatus): string {
    switch (status) {
        case "supported":
            return translate({id: "compatibility.status.supported", message: "Supported"});
        case "partial":
            return translate({id: "compatibility.status.partial", message: "Partial Support"});
        case "unsupported":
            return translate({id: "compatibility.status.unsupported", message: "Not Supported"});
        case "unknown":
            return translate({id: "compatibility.status.unknown", message: "Unknown"});
    }
}

function getVersionLabel(statement: SupportStatement | undefined): string | undefined {
    if (statement?.versionAdded !== undefined && statement.versionRemoved !== undefined) {
        return `${statement.versionAdded} – <${statement.versionRemoved}`;
    }
    if (statement?.versionAdded !== undefined) return `${statement.versionAdded}+`;
    if (statement?.versionRemoved !== undefined) return `< ${statement.versionRemoved}`;
    return undefined;
}

function SupportCell({
    statement,
    noteNumbers,
    noteIdPrefix
}: {
    readonly statement: SupportStatement | undefined;
    readonly noteNumbers: readonly number[];
    readonly noteIdPrefix: string;
}) {
    const declaredStatus = statement?.status ?? "unknown";
    const versionLabel = getVersionLabel(statement);
    const statusLabel = getStatusLabel(declaredStatus);
    const removedLabel = statement?.versionRemoved === undefined ? undefined : translate({
        id: "compatibility.status.removed",
        message: "Removed in version {version}"
    }, {version: statement.versionRemoved});

    return (
        <td className={`${styles.supportCell} ${styles[declaredStatus]}`}>
            <div className={styles.primaryLine}>
                <span className={styles.statusSymbol} aria-hidden="true">
                    {statusSymbols[declaredStatus]}
                </span>
                {versionLabel !== undefined && <span className={styles.version}>{versionLabel}</span>}
            </div>
            <div className={styles.statusLine}>
                <span>{statusLabel}{removedLabel === undefined ? "" : ` · ${removedLabel}`}</span>
                {noteNumbers.map(number => (
                    <sup className={styles.noteReference} key={number}>
                        <a
                            href={`#compat-note-${noteIdPrefix}-${number}`}
                            aria-label={translate({
                                id: "compatibility.note.open",
                                message: "Read compatibility note {number}"
                            }, {number})}
                        >
                            {number}
                        </a>
                    </sup>
                ))}
            </div>
        </td>
    );
}

export default function Compatable({element, support, subfeatures = []}: CompatableProps) {
    const noteIdPrefix = useId().replaceAll(":", "");
    const rows: readonly CompatibilityRow[] = [
        {
            name: element,
            support,
            isElement: true
        },
        ...subfeatures
    ];
    const notes: NoteEntry[] = [];
    const noteNumbersByCell = new Map<string, readonly number[]>();

    rows.forEach((row, rowIndex) => {
        hostIds.forEach(hostId => {
            const rawNotes = row.support[hostId]?.notes;
            const noteTexts = rawNotes === undefined
                ? []
                : typeof rawNotes === "string" ? [rawNotes] : rawNotes;
            if (noteTexts.length === 0) return;

            const noteNumbers = noteTexts.map(text => {
                const number = notes.length + 1;
                notes.push({number, text});
                return number;
            });
            noteNumbersByCell.set(`${rowIndex}:${hostId}`, noteNumbers);
        });
    });

    return (
        <div className={styles.compatibility}>
            <div className={styles.scroller}>
                <table className={styles.table}>
                    <caption className={styles.visuallyHidden}>
                        {translate({id: "compatibility.table.caption", message: "Host compatibility"})}
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col"></th>
                            {hostIds.map(hostId => (
                                <th scope="col" key={hostId}>
                                    {hosts[hostId].name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={`${rowIndex}:${row.name}`}>
                                <th className={styles.rowHeader} scope="row">
                                    {row.isElement
                                        ? <code>{row.name}</code>
                                        : <Markdown skipHtml>{row.name}</Markdown>}
                                </th>
                                {hostIds.map(hostId => (
                                    <SupportCell
                                        key={hostId}
                                        statement={row.support[hostId]}
                                        noteNumbers={noteNumbersByCell.get(`${rowIndex}:${hostId}`) ?? []}
                                        noteIdPrefix={noteIdPrefix}
                                    />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {notes.length > 0 && (
                <section className={styles.notesSection} aria-label={translate({
                    id: "compatibility.notes.label",
                    message: "Compatibility notes"
                })}>
                    <ol className={styles.notes}>
                        {notes.map(note => (
                            <li id={`compat-note-${noteIdPrefix}-${note.number}`} key={note.number}>
                                <div className={styles.noteContent}>
                                    <Markdown skipHtml>{note.text}</Markdown>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>
            )}
        </div>
    );
}