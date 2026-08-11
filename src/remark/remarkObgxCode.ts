import {highlight} from "codehike/code";
import type {HighlightedCode, RawCode} from "codehike/code";
import {tokenizeObgx} from "./obgxTokenizer";

type HighlightTheme = Parameters<typeof highlight>[1];

type MarkdownNode = {
    type: string;
    value?: string;
    lang?: string | null;
    meta?: string | null;
    name?: string;
    attributes?: unknown[];
    children?: MarkdownNode[];
    [key: string]: unknown;
};

type RemarkObgxCodeOptions = {
    component: string;
    theme: HighlightTheme;
};

type EstreeNode = {
    type: string;
    [key: string]: unknown;
};

function serialize(value: unknown): EstreeNode {
    if (value === undefined) return {type: "Identifier", name: "undefined"};
    if (value === null || ["boolean", "number", "string"].includes(typeof value)) {
        return {type: "Literal", value, raw: JSON.stringify(value)};
    }
    if (Array.isArray(value)) {
        return {type: "ArrayExpression", elements: value.map(serialize)};
    }
    if (typeof value === "object") {
        return {
            type: "ObjectExpression",
            properties: Object.entries(value).map(([key, entry]) => ({
                type: "Property",
                method: false,
                shorthand: false,
                computed: false,
                key: {type: "Literal", value: key, raw: JSON.stringify(key)},
                kind: "init",
                value: serialize(entry)
            }))
        };
    }
    throw new TypeError(`Cannot serialize ${typeof value} in an OBGX code block`);
}

function getObjectAttribute(value: object) {
    return {
        type: "mdxJsxAttributeValueExpression",
        value: "",
        data: {
            estree: {
                type: "Program",
                body: [{type: "ExpressionStatement", expression: serialize(value)}],
                sourceType: "module",
                comments: []
            }
        }
    };
}

function collectObgxCodeBlocks(root: MarkdownNode) {
    const codeBlocks: MarkdownNode[] = [];
    const nodes = [root];
    for (const node of nodes) {
        if (node.type === "code" && node.lang === "obgx") codeBlocks.push(node);
        if (node.children) nodes.push(...node.children);
    }
    return codeBlocks;
}

export async function highlightObgx(codeblock: RawCode, theme: HighlightTheme): Promise<HighlightedCode> {
    const base = await highlight({...codeblock, lang: "typescript"}, theme);
    return {
        ...base,
        value: codeblock.value,
        lang: "obgx",
        tokens: tokenizeObgx(base.code)
    };
}

export function remarkObgxCode({component, theme}: RemarkObgxCodeOptions) {
    return async (root: MarkdownNode) => {
        const codeBlocks = collectObgxCodeBlocks(root);
        await Promise.all(codeBlocks.map(async node => {
            const codeblock = await highlightObgx({
                value: node.value ?? "",
                lang: "obgx",
                meta: node.meta ?? ""
            }, theme);

            Object.assign(node, {
                type: "mdxJsxFlowElement",
                name: component,
                attributes: [{
                    type: "mdxJsxAttribute",
                    name: "codeblock",
                    value: getObjectAttribute(codeblock)
                }],
                children: []
            });
            delete node.value;
            delete node.lang;
            delete node.meta;
        }));
    };
}