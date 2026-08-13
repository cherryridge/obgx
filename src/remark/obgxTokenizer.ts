import type {Token} from "codehike/code";

export type ObgxTokenKind =
    | "whitespace"
    | "comment"
    | "keyword"
    | "builtinType"
    | "type"
    | "function"
    | "parameter"
    | "property"
    | "enumMember"
    | "variable"
    | "number"
    | "literal"
    | "string"
    | "punctuation"
    | "plain";

export type ObgxToken = {
    value: string;
    kind: ObgxTokenKind;
};

type LexemeKind = "whitespace" | "comment" | "identifier" | "number" | "string" | "punctuation";

type Lexeme = {
    value: string;
    lexicalKind: LexemeKind;
    kind: ObgxTokenKind;
};

type Range = {
    from: number;
    to: number;
};

const KEYWORDS = new Set(["enum", "type"]);
const BUILTIN_TYPES = new Set([
    "any",
    "bool",
    "f32",
    "f64",
    "hndl",
    "i8",
    "i16",
    "i32",
    "i64",
    "string",
    "u8",
    "u16",
    "u32",
    "u64",
    "void"
]);
const LITERALS = new Set(["false", "Infinity", "NaN", "true"]);

const COLORS: Record<Exclude<ObgxTokenKind, "whitespace">, string> = {
    comment: "var(--ch-1)",
    keyword: "var(--obgx-keyword-color)",
    builtinType: "var(--obgx-builtin-type-color)",
    type: "var(--obgx-type-color)",
    function: "var(--ch-5)",
    parameter: "var(--obgx-property-color)",
    property: "var(--obgx-property-color)",
    enumMember: "var(--obgx-enum-member-color)",
    variable: "var(--obgx-property-color)",
    number: "var(--ch-2)",
    literal: "var(--ch-2)",
    string: "var(--obgx-string-literal-color)",
    punctuation: "var(--ch-4)",
    plain: "var(--ch-4)"
};

function isIdentifierStart(character: string) {
    return /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string) {
    return /[A-Za-z0-9_]/.test(character);
}

function scan(code: string): Lexeme[] {
    const lexemes: Lexeme[] = [];
    let index = 0;

    while (index < code.length) {
        const start = index;
        const character = code[index];
        const next = code[index + 1];

        if (/\s/.test(character)) {
            index++;
            while (index < code.length && /\s/.test(code[index])) index++;
            lexemes.push({value: code.slice(start, index), lexicalKind: "whitespace", kind: "whitespace"});
            continue;
        }

        if (character === "/" && next === "/") {
            index += 2;
            while (index < code.length && code[index] !== "\r" && code[index] !== "\n") index++;
            lexemes.push({value: code.slice(start, index), lexicalKind: "comment", kind: "comment"});
            continue;
        }

        if (character === "/" && next === "*") {
            index += 2;
            while (index < code.length && !(code[index] === "*" && code[index + 1] === "/")) index++;
            if (index < code.length) index += 2;
            lexemes.push({value: code.slice(start, index), lexicalKind: "comment", kind: "comment"});
            continue;
        }

        if (character === '"' || character === "'") {
            const quote = character;
            index++;
            while (index < code.length) {
                if (code[index] === "\\") {
                    index += Math.min(2, code.length - index);
                    continue;
                }
                if (code[index++] === quote) break;
            }
            lexemes.push({value: code.slice(start, index), lexicalKind: "string", kind: "string"});
            continue;
        }

        if (isIdentifierStart(character)) {
            index++;
            while (index < code.length && isIdentifierPart(code[index])) index++;
            const value = code.slice(start, index);
            const kind = KEYWORDS.has(value)
                ? "keyword"
                : BUILTIN_TYPES.has(value)
                    ? "builtinType"
                    : LITERALS.has(value)
                        ? "literal"
                        : "plain";
            lexemes.push({value, lexicalKind: "identifier", kind});
            continue;
        }

        if (/\d/.test(character)) {
            index++;
            while (index < code.length && /[0-9A-Fa-f_xX.]/.test(code[index])) index++;
            lexemes.push({value: code.slice(start, index), lexicalKind: "number", kind: "number"});
            continue;
        }

        const operator = ["::", "=>", "->"].find(candidate => code.startsWith(candidate, index));
        index += operator?.length ?? 1;
        lexemes.push({value: code.slice(start, index), lexicalKind: "punctuation", kind: "punctuation"});
    }

    return lexemes;
}

function isTrivia(lexeme: Lexeme) {
    return lexeme.lexicalKind === "whitespace" || lexeme.lexicalKind === "comment";
}

function nextCodeIndex(lexemes: Lexeme[], index: number) {
    for (let cursor = index + 1; cursor < lexemes.length; cursor++) {
        if (!isTrivia(lexemes[cursor])) return cursor;
    }
    return undefined;
}

function previousCodeIndex(lexemes: Lexeme[], index: number) {
    for (let cursor = index - 1; cursor >= 0; cursor--) {
        if (!isTrivia(lexemes[cursor])) return cursor;
    }
    return undefined;
}

function findMatching(lexemes: Lexeme[], openIndex: number, open: string, close: string) {
    let depth = 0;
    for (let index = openIndex; index < lexemes.length; index++) {
        if (isTrivia(lexemes[index])) continue;
        if (lexemes[index].value === open) depth++;
        if (lexemes[index].value === close && --depth === 0) return index;
    }
    return lexemes.length - 1;
}

function findNextValue(lexemes: Lexeme[], index: number, value: string) {
    for (let cursor = index + 1; cursor < lexemes.length; cursor++) {
        if (isTrivia(lexemes[cursor])) continue;
        if (lexemes[cursor].value === value) return cursor;
        if ([";", "}"].includes(lexemes[cursor].value)) return undefined;
    }
    return undefined;
}

function isInside(index: number, ranges: Range[]) {
    return ranges.some(range => index > range.from && index < range.to);
}

function markTypeExpression(lexemes: Lexeme[], startIndex: number | undefined, stopValues: Set<string>): number | undefined {
    if (startIndex === undefined) return undefined;
    let index = startIndex;
    while (index < lexemes.length && isTrivia(lexemes[index])) index++;
    if (index >= lexemes.length || stopValues.has(lexemes[index].value)) return index;

    const typeToken = lexemes[index];
    if (typeToken.lexicalKind !== "identifier") return index;
    typeToken.kind = BUILTIN_TYPES.has(typeToken.value) ? "builtinType" : "type";

    let suffixIndex = nextCodeIndex(lexemes, index);
    if (suffixIndex !== undefined && lexemes[suffixIndex].value === "<") {
        const closeIndex = findMatching(lexemes, suffixIndex, "<", ">");
        let argumentIndex = nextCodeIndex(lexemes, suffixIndex);

        while (argumentIndex !== undefined && argumentIndex < closeIndex) {
            const nextIndex = markTypeExpression(lexemes, argumentIndex, new Set([",", ">"]));
            if (nextIndex === undefined || nextIndex >= closeIndex) break;
            const separatorIndex = lexemes[nextIndex].value === "," ? nextIndex : nextCodeIndex(lexemes, nextIndex);
            if (separatorIndex === undefined || separatorIndex >= closeIndex || lexemes[separatorIndex].value !== ",") break;
            argumentIndex = nextCodeIndex(lexemes, separatorIndex);
        }

        suffixIndex = nextCodeIndex(lexemes, closeIndex);
    }

    while (suffixIndex !== undefined && lexemes[suffixIndex].value === "[") {
        suffixIndex = nextCodeIndex(lexemes, findMatching(lexemes, suffixIndex, "[", "]"));
    }

    return suffixIndex;
}

function classify(lexemes: Lexeme[]) {
    const typeBodies: Range[] = [];
    const enumBodies: Range[] = [];
    const parameterLists: Range[] = [];

    for (let index = 0; index < lexemes.length; index++) {
        const token = lexemes[index];
        if (token.lexicalKind !== "identifier" || !["enum", "type"].includes(token.value)) continue;

        const nameIndex = nextCodeIndex(lexemes, index);
        if (nameIndex === undefined || lexemes[nameIndex].lexicalKind !== "identifier") continue;
        token.kind = "keyword";
        lexemes[nameIndex].kind = "type";

        const openIndex = findNextValue(lexemes, nameIndex, "{");
        if (openIndex === undefined) continue;
        const range = {from: openIndex, to: findMatching(lexemes, openIndex, "{", "}")};
        if (token.value === "enum") enumBodies.push(range);
        else typeBodies.push(range);
    }

    for (let index = 0; index < lexemes.length; index++) {
        if (lexemes[index].value !== "(") continue;
        const closeIndex = findMatching(lexemes, index, "(", ")");
        const arrowIndex = nextCodeIndex(lexemes, closeIndex);
        if (arrowIndex === undefined || lexemes[arrowIndex].value !== "=>") continue;

        parameterLists.push({from: index, to: closeIndex});
        markTypeExpression(lexemes, nextCodeIndex(lexemes, arrowIndex), new Set([";", "}"]));
    }

    for (let index = 0; index < lexemes.length; index++) {
        const token = lexemes[index];
        if (token.lexicalKind !== "identifier") continue;
        if (isInside(index, enumBodies)) continue;
        const nextIndex = nextCodeIndex(lexemes, index);
        if (token.value === "hndl" && nextIndex !== undefined && lexemes[nextIndex].value === "(") {
            continue;
        }
        const colonIndex = nextIndex !== undefined && lexemes[nextIndex].value === ":" ? nextIndex : undefined;
        const openIndex = colonIndex === undefined ? nextIndex : nextCodeIndex(lexemes, colonIndex);
        if (openIndex === undefined || lexemes[openIndex].value !== "(") continue;
        token.kind = "function";
        const closeIndex = findMatching(lexemes, openIndex, "(", ")");
        parameterLists.push({from: openIndex, to: closeIndex});

        const arrowIndex = nextCodeIndex(lexemes, closeIndex);
        if (arrowIndex !== undefined && lexemes[arrowIndex].value === "=>") {
            markTypeExpression(lexemes, nextCodeIndex(lexemes, arrowIndex), new Set([";", "}"]));
        }
    }

    for (const range of enumBodies) {
        let index = nextCodeIndex(lexemes, range.from);
        while (index !== undefined && index < range.to) {
            const token = lexemes[index];
            if (token.lexicalKind === "identifier" && token.kind === "plain") token.kind = "enumMember";

            const payloadOpenIndex = nextCodeIndex(lexemes, index);
            if (token.lexicalKind === "identifier" && payloadOpenIndex !== undefined && lexemes[payloadOpenIndex].value === "(") {
                const payloadCloseIndex = findMatching(lexemes, payloadOpenIndex, "(", ")");
                markTypeExpression(lexemes, nextCodeIndex(lexemes, payloadOpenIndex), new Set([")"]));
                index = nextCodeIndex(lexemes, payloadCloseIndex);
            } else {
                index = nextCodeIndex(lexemes, index);
            }
        }
    }

    for (let index = 0; index < lexemes.length; index++) {
        const token = lexemes[index];
        if (token.value !== ":") continue;
        const nameIndex = previousCodeIndex(lexemes, index);
        if (nameIndex !== undefined && lexemes[nameIndex].lexicalKind === "identifier" && lexemes[nameIndex].kind !== "function") {
            lexemes[nameIndex].kind = isInside(index, parameterLists)
                ? "parameter"
                : isInside(index, typeBodies)
                    ? "property"
                    : "variable";
        }
        markTypeExpression(lexemes, nextCodeIndex(lexemes, index), new Set([",", ")", ";", "}"]));
    }

    for (let index = 0; index < lexemes.length; index++) {
        if (lexemes[index].value === ".") {
            const propertyIndex = nextCodeIndex(lexemes, index);
            if (propertyIndex !== undefined && lexemes[propertyIndex].lexicalKind === "identifier") {
                lexemes[propertyIndex].kind = "property";
            }
        }

        const suffixIndex = nextCodeIndex(lexemes, index);
        if (lexemes[index].lexicalKind === "identifier" && suffixIndex !== undefined && lexemes[suffixIndex].value === "[") {
            markTypeExpression(lexemes, index, new Set([",", ")", ";", "}"]));
        }
    }

    for (let index = 0; index < lexemes.length; index++) {
        const token = lexemes[index];
        if (token.lexicalKind !== "identifier" || token.kind !== "plain") continue;
        const nextIndex = nextCodeIndex(lexemes, index);
        if (nextIndex !== undefined && lexemes[nextIndex].value === ":") continue;
        if (!isInside(index, typeBodies) && !isInside(index, parameterLists) && !isInside(index, enumBodies)) {
            token.kind = "variable";
        }
    }
}

export function parseObgx(code: string): ObgxToken[] {
    const lexemes = scan(code);
    classify(lexemes);
    return lexemes.map(({value, kind}) => ({value, kind}));
}

export function toCodeHikeTokens(tokens: ObgxToken[]): (Token | string)[] {
    const output: (Token | string)[] = [];
    for (const token of tokens) {
        if (token.kind === "whitespace") {
            const previous = output[output.length - 1];
            if (typeof previous === "string") output[output.length - 1] += token.value;
            else output.push(token.value);
        } else {
            output.push([token.value, COLORS[token.kind]]);
        }
    }
    return output;
}

export function tokenizeObgx(code: string) {
    return toCodeHikeTokens(parseObgx(code));
}