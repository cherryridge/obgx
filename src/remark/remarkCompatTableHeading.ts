type MarkdownNode = {
    type: string;
    name?: string | null;
    depth?: number;
    value?: string;
    children?: MarkdownNode[];
};

const headingText = "Compatibility";

function isCompatibilityHeading(node: MarkdownNode | undefined): boolean {
    return node?.type === "heading"
        && node.depth === 2
        && node.children?.length === 1
        && node.children[0]?.type === "text"
        && node.children[0].value === headingText;
}

function createCompatibilityHeading(): MarkdownNode {
    return {
        type: "heading",
        depth: 2,
        children: [{type: "text", value: headingText}]
    };
}

function insertCompatTableHeadings(parent: MarkdownNode): void {
    const {children} = parent;
    if (children === undefined) return;

    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (child?.type === "mdxJsxFlowElement"
            && child.name === "CompatTable"
            && !isCompatibilityHeading(children[index - 1])) {
            children.splice(index, 0, createCompatibilityHeading());
            index++;
        }
        if (child !== undefined) insertCompatTableHeadings(child);
    }
}

export function remarkCompatTableHeading() {
    return (root: MarkdownNode) => insertCompatTableHeadings(root);
}