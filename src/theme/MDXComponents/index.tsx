import CodeHikeCode from "@site/src/components/CodeHikeCode";
import CompatTable from "@site/src/components/CompatTable";
import HoverNote from "@site/src/components/HoverNote";

import MDXComponents from "@theme-original/MDXComponents";

const providedComponents = {
    CodeHikeCode,
    CompatTable,
    HoverNote
};

declare global {
    type MDXProvidedComponents = typeof providedComponents;
}

export default {
    ...MDXComponents,
    ...providedComponents
};