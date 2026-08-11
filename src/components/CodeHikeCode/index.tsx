import {useEffect, useRef, useState} from "react";
import { InnerLine, InnerToken, Pre, AnnotationHandler, HighlightedCode } from "codehike/code";
import Link from "@docusaurus/Link";
import IconCopy from "@theme/Icon/Copy";
import IconSuccess from "@theme/Icon/Success";
import IconWordWrap from "@theme/Icon/WordWrap";
import styles from "./styles.module.css";

type Props = {
    codeblock: HighlightedCode;
};

const focus: AnnotationHandler = {
    name: "focus",
    onlyIfAnnotated: true,
    Line: (props) => <InnerLine merge={props} className={styles.focusLine}/>,
    AnnotatedLine: ({annotation: _, ...props}) => <InnerLine merge={props} className={styles.focusLine} data-focus/>
};

const mark: AnnotationHandler = {
    name: "mark",
    onlyIfAnnotated: true,
    Line: ({annotation, ...props}) => (
        <InnerLine merge={props} className={styles.markLine} data-mark={annotation ? true : undefined}/>
    ),
    Inline: ({children}) => <span className={styles.markInline}>{children}</span>
};

const link: AnnotationHandler = {
    name: "link",
    Inline: ({annotation, children}) => (
        <Link className={styles.link} to={annotation.query}>{children}</Link>
    )
};

const typeName: AnnotationHandler = {
    name: "type",
    AnnotatedToken: (props) => (
        <InnerToken merge={props} style={{...props.style, color: "var(--obgx-type-color)"}}/>
    )
};

const lineNumbers: AnnotationHandler = {
    name: "line-numbers",
    Line: (props) => (
        <div className={styles.numberedLine}>
            <span
                aria-hidden="true"
                className={styles.lineNumber}
                style={{minWidth: `${props.totalLines.toString().length + 1}ch`}}
            >
                {props.lineNumber}
            </span>
            <InnerLine merge={props} className={styles.lineCode}/>
        </div>
    )
};

function getTitle(meta: string) {
    const title = meta.match(/(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/);
    if (title) return title[1] ?? title[2] ?? title[3];

    const firstToken = meta.trim().split(/\s+/, 1)[0];
    if (!firstToken || firstToken === "showLineNumbers" || firstToken.startsWith("{")) return undefined;
    return firstToken;
}

function CopyButton({text}: {text: string}) {
    const [copied, setCopied] = useState(false);
    const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => () => clearTimeout(resetTimer.current), []);

    async function copy() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setCopied(false), 1200);
    }

    return (
        <button
            aria-label={copied ? "Copied" : "Copy code to clipboard"}
            className={styles.copyButton}
            onClick={copy}
            title={copied ? "Copied" : "Copy"}
            type="button"
        >
            {copied ? <IconSuccess/> : <IconCopy/>}
        </button>
    );
}

function WordWrapButton({enabled, onClick}: {enabled: boolean; onClick: () => void}) {
    return (
        <button
            aria-label="Toggle word wrap"
            aria-pressed={enabled}
            className={styles.wordWrapButton}
            onClick={onClick}
            title="Toggle word wrap"
            type="button"
        >
            <IconWordWrap aria-hidden="true"/>
        </button>
    );
}

export default function CodeHikeCode({codeblock}: Props) {
    const title = getTitle(codeblock.meta);
    const handlers = [focus, mark, link, typeName];
    const preRef = useRef<HTMLPreElement>(null);
    const [wordWrap, setWordWrap] = useState(false);
    const [isCodeScrollable, setIsCodeScrollable] = useState(false);

    if (/\bshowLineNumbers\b/.test(codeblock.meta)) handlers.push(lineNumbers);

    useEffect(() => {
        const pre = preRef.current;
        if (!pre) return;

        const updateCodeIsScrollable = () => {
            setIsCodeScrollable(wordWrap || pre.scrollWidth > pre.clientWidth);
        };

        updateCodeIsScrollable();

        const resizeObserver = new ResizeObserver(updateCodeIsScrollable);
        resizeObserver.observe(pre);
        window.addEventListener("resize", updateCodeIsScrollable, {passive: true});

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateCodeIsScrollable);
        };
    }, [codeblock.code, wordWrap]);

    return (
        <div className={styles.container}>
            {title && <div className={styles.title}>{title}</div>}
            {(wordWrap || isCodeScrollable) && (
                <WordWrapButton enabled={wordWrap} onClick={() => setWordWrap((enabled) => !enabled)}/>
            )}
            {codeblock.code.trim() && <CopyButton text={codeblock.code}/>}
            <Pre
                className={`${styles.pre}${wordWrap ? ` ${styles.preWrapped}` : ""}`}
                code={codeblock}
                handlers={handlers}
                ref={preRef}
                style={codeblock.style}
            />
        </div>
    );
}