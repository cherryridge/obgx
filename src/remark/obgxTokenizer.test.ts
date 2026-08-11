import assert from "assert/strict";
import {readFileSync} from "fs";
import {parseObgx, toCodeHikeTokens} from "./obgxTokenizer";
import {highlightObgx} from "./remarkObgxCode";

function kindsFor(source: string, value: string) {
    return parseObgx(source).filter(token => token.value === value).map(token => token.kind);
}

function codeFromTokens(tokens: ReturnType<typeof toCodeHikeTokens>) {
    return tokens.map(token => typeof token === "string" ? token : token[0]).join("");
}

function test(name: string, callback: () => void) {
    callback();
    console.log(`ok - ${name}`);
}

async function asyncTest(name: string, callback: () => Promise<void>) {
    await callback();
    console.log(`ok - ${name}`);
}

test("classifies OBGX declarations using their syntax context", () => {
    const source = [
        "type RegisterRecordResult {",
        "    success: boolean;",
        "    message: string;",
        "};",
        "registerRecord(record: RecordDesc): RegisterRecordResult;",
        "record.success"
    ].join("\n");

    assert.deepEqual(kindsFor(source, "type"), ["keyword"]);
    assert.deepEqual(kindsFor(source, "RegisterRecordResult"), ["type", "type"]);
    assert.deepEqual(kindsFor(source, "success"), ["property", "property"]);
    assert.deepEqual(kindsFor(source, "boolean"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "string"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "registerRecord"), ["function"]);
    assert.deepEqual(kindsFor(source, "record"), ["parameter", "variable"]);
    assert.deepEqual(kindsFor(source, "RecordDesc"), ["type"]);
});

test("classifies fundamental, array, handle, and enum types", () => {
    const source = [
        "i8[4]",
        "CustomType[]",
        "hndl(semanticName)",
        "oldArray: array;",
        "oldVector: vector;",
        "enum TypeName {",
        "    Value1,",
        "    Value2",
        "};"
    ].join("\n");

    assert.deepEqual(kindsFor(source, "i8"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "hndl"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "semanticName"), ["handleName"]);
    assert.deepEqual(kindsFor(source, "CustomType"), ["type"]);
    assert.deepEqual(kindsFor(source, "array"), ["type"]);
    assert.deepEqual(kindsFor(source, "vector"), ["type"]);
    assert.deepEqual(kindsFor(source, "4"), ["number"]);
    assert.deepEqual(kindsFor(source, "enum"), ["keyword"]);
    assert.deepEqual(kindsFor(source, "TypeName"), ["type"]);
    assert.deepEqual(kindsFor(source, "Value1"), ["enumMember"]);
    assert.deepEqual(kindsFor(source, "Value2"), ["enumMember"]);
    const colors = toCodeHikeTokens(parseObgx("type TypeName {}; value: boolean; custom: TypeName[]; handle: hndl(record); old: array;"));
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "type" && token[1] === "var(--obgx-keyword-color)"), true);
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "boolean" && token[1] === "var(--obgx-builtin-type-color)"), true);
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "TypeName" && token[1] === "var(--obgx-type-color)"), true);
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "record" && token[1] === "var(--obgx-handle-name-color, var(--ch-8))"), true);
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "array" && token[1] === "var(--obgx-type-color)"), true);
});

test("classifies function values and their array return types", () => {
    const source = "callback: (value: InputType[], fixed: i8[4]) => OutputType[];";

    assert.deepEqual(kindsFor(source, "callback"), ["function"]);
    assert.deepEqual(kindsFor(source, "value"), ["parameter"]);
    assert.deepEqual(kindsFor(source, "InputType"), ["type"]);
    assert.deepEqual(kindsFor(source, "i8"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "OutputType"), ["type"]);
});

test("preserves whitespace, comments, and incomplete input exactly", () => {
    const source = "// Line comment\r\n/* block\r\ncomment */\r\ntype Broken { field: i8[";
    const parsed = parseObgx(source);

    assert.equal(codeFromTokens(toCodeHikeTokens(parsed)), source);
    assert.deepEqual(parsed.filter(token => token.kind === "comment").map(token => token.value), [
        "// Line comment",
        "/* block\r\ncomment */"
    ]);
    assert.deepEqual(kindsFor(source, "Broken"), ["type"]);
    assert.deepEqual(kindsFor(source, "field"), ["property"]);
    assert.deepEqual(kindsFor(source, "i8"), ["builtinType"]);
});

test("round-trips every canonical OBGX example", () => {
    const syntax = readFileSync("globals/syntax.mdx", "utf8");
    const examples = [...syntax.matchAll(/```obgx\r?\n([\s\S]*?)\r?\n```/g)].map(match => match[1]);

    assert.ok(examples.length > 0);
    for (const example of examples) {
        assert.equal(codeFromTokens(toCodeHikeTokens(parseObgx(example))), example);
    }
});

void asyncTest("keeps Code Hike link annotations while replacing its syntax tokens", async () => {
    const value = [
        "// !link[/RecordDesc/] RecordDesc",
        "// !link[/RegisterRecordResult/] RegisterRecordResult",
        "registerRecord(record: RecordDesc): RegisterRecordResult"
    ].join("\n");
    const highlighted = await highlightObgx({value, lang: "obgx", meta: ""}, "github-from-css");

    assert.equal(highlighted.lang, "obgx");
    assert.equal(highlighted.code, "registerRecord(record: RecordDesc): RegisterRecordResult");
    assert.deepEqual(highlighted.annotations, [
        {name: "link", query: "RecordDesc", lineNumber: 1, fromColumn: 24, toColumn: 33},
        {name: "link", query: "RegisterRecordResult", lineNumber: 1, fromColumn: 37, toColumn: 56}
    ]);
    assert.equal(codeFromTokens(highlighted.tokens), highlighted.code);
    assert.equal(highlighted.tokens.some(token => Array.isArray(token) && token[0] === "RecordDesc" && token[1] === "var(--obgx-type-color)"), true);
    assert.equal(highlighted.tokens.some(token => Array.isArray(token) && token[0] === "RegisterRecordResult" && token[1] === "var(--obgx-type-color)"), true);
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});