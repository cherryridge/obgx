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

function insertCompatableHeadings(parent: MarkdownNode): void {
    const {children} = parent;
    if (children === undefined) return;

    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (child?.type === "mdxJsxFlowElement"
            && child.name === "Compatable"
            && !isCompatibilityHeading(children[index - 1])) {
            children.splice(index, 0, createCompatibilityHeading());
            index++;
        }
        if (child !== undefined) insertCompatableHeadings(child);
    }
}

export function remarkCompatableHeading() {
    return (root: MarkdownNode) => insertCompatableHeadings(root);
}