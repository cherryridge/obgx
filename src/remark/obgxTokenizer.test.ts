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
        "    success: bool;",
        "    message: string;",
        "};",
        "registerRecord(record: RecordDesc): RegisterRecordResult;",
        "record.success"
    ].join("\n");

    assert.deepEqual(kindsFor(source, "type"), ["keyword"]);
    assert.deepEqual(kindsFor(source, "RegisterRecordResult"), ["type", "type"]);
    assert.deepEqual(kindsFor(source, "success"), ["property", "property"]);
    assert.deepEqual(kindsFor(source, "bool"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "string"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "registerRecord"), ["function"]);
    assert.deepEqual(kindsFor(source, "record"), ["parameter", "variable"]);
    assert.deepEqual(kindsFor(source, "RecordDesc"), ["type"]);
});

test("classifies fundamental, array, handle, and enum types", () => {
    const source = [
        "i8[4]",
        "CustomType[]",
        "hndl(\"semanticName\")",
        "oldArray: array;",
        "oldVector: vector;",
        "enum TypeName {",
        "    Value1,",
        "    Value2(u64),",
        "    Array(FieldType)",
        "};",
        "functionName()"
    ].join("\n");

    assert.deepEqual(kindsFor(source, "i8"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "hndl"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "\"semanticName\""), ["string"]);
    assert.deepEqual(kindsFor(source, "CustomType"), ["type"]);
    assert.deepEqual(kindsFor(source, "array"), ["type"]);
    assert.deepEqual(kindsFor(source, "vector"), ["type"]);
    assert.deepEqual(kindsFor(source, "4"), ["number"]);
    assert.deepEqual(kindsFor(source, "enum"), ["keyword"]);
    assert.deepEqual(kindsFor(source, "TypeName"), ["type"]);
    assert.deepEqual(kindsFor(source, "Value1"), ["enumMember"]);
    assert.deepEqual(kindsFor(source, "Value2"), ["enumMember"]);
    assert.deepEqual(kindsFor(source, "Array"), ["enumMember"]);
    assert.deepEqual(kindsFor(source, "FieldType"), ["type"]);
    assert.deepEqual(kindsFor(source, "u64"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "functionName"), ["function"]);
    const colors = toCodeHikeTokens(parseObgx("type TypeName {}; value: bool; custom: TypeName[]; handle: hndl(\"record\"); old: array;"));
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "type" && token[1] === "var(--obgx-keyword-color)"), true);
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "bool" && token[1] === "var(--obgx-builtin-type-color)"), true);
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "TypeName" && token[1] === "var(--obgx-type-color)"), true);
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "\"record\"" && token[1] === "var(--obgx-string-literal-color)"), true);
    assert.equal(colors.some(token => Array.isArray(token) && token[0] === "array" && token[1] === "var(--obgx-type-color)"), true);
});

test("classifies identifier types and subject-specific identifiers", () => {
    const source = [
        "type RecordDesc {",
        "    recordId: id;",
        "    fieldId: id;",
        "};",
        "getRecord(recordId: refid): hndl(\"record\");"
    ].join("\n");
    const colors = toCodeHikeTokens(parseObgx(source));

    assert.deepEqual(kindsFor(source, "id"), ["builtinType", "builtinType"]);
    assert.deepEqual(kindsFor(source, "refid"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "recordId"), ["property", "parameter"]);
    assert.deepEqual(kindsFor(source, "fieldId"), ["property"]);
    assert.equal(colors.filter(token => Array.isArray(token) && ["id", "refid"].includes(token[0]) && token[1] === "var(--obgx-builtin-type-color)").length, 3);
});

test("classifies function values and their array return types", () => {
    const source = "callback: (value: InputType[], fixed: i8[4]) => OutputType[];";

    assert.deepEqual(kindsFor(source, "callback"), ["function"]);
    assert.deepEqual(kindsFor(source, "value"), ["parameter"]);
    assert.deepEqual(kindsFor(source, "InputType"), ["type"]);
    assert.deepEqual(kindsFor(source, "i8"), ["builtinType"]);
    assert.deepEqual(kindsFor(source, "OutputType"), ["type"]);
});

test("classifies type and constant-value wildcards", () => {
    const source = [
        "acceptAny(value: any): void;",
        "getLengthOfArray(arr: any[*]): u64;",
        "acceptFixedArray(arr: any[16]): void;",
        "acceptU32Array(arr: u32[*]): void;",
        "getVecLen(vec: any[]): u64;"
    ].join("\n");
    const colors = toCodeHikeTokens(parseObgx(source));

    assert.deepEqual(kindsFor(source, "any"), ["builtinType", "builtinType", "builtinType", "builtinType"]);
    assert.deepEqual(kindsFor(source, "*"), ["punctuation", "punctuation"]);
    assert.equal(colors.filter(token => Array.isArray(token) && token[0] === "any" && token[1] === "var(--obgx-builtin-type-color)").length, 4);
    assert.equal(colors.filter(token => Array.isArray(token) && token[0] === "*" && token[1] === "var(--ch-4)").length, 2);
});

test("classifies void function return types", () => {
    const source = "callback: () => void;\nnotify(): void;";
    const colors = toCodeHikeTokens(parseObgx(source));

    assert.deepEqual(kindsFor(source, "void"), ["builtinType", "builtinType"]);
    assert.equal(colors.filter(token => Array.isArray(token) && token[0] === "void" && token[1] === "var(--obgx-builtin-type-color)").length, 2);
});

test("classifies standalone and parenthesized function types", () => {
    const functionType = "(param1: type1, param2: type2) => returnType";
    const zeroParameterType = "() => zeroReturnType";
    const parenthesizedType = "((value: i32) => bool)[]";

    assert.deepEqual(kindsFor(functionType, "param1"), ["parameter"]);
    assert.deepEqual(kindsFor(functionType, "param2"), ["parameter"]);
    assert.deepEqual(kindsFor(functionType, "type1"), ["type"]);
    assert.deepEqual(kindsFor(functionType, "type2"), ["type"]);
    assert.deepEqual(kindsFor(functionType, "returnType"), ["type"]);
    assert.deepEqual(kindsFor(zeroParameterType, "zeroReturnType"), ["type"]);
    assert.deepEqual(kindsFor(parenthesizedType, "value"), ["parameter"]);
    assert.deepEqual(kindsFor(parenthesizedType, "i32"), ["builtinType"]);
    assert.deepEqual(kindsFor(parenthesizedType, "bool"), ["builtinType"]);
});

test("uses the property color for object and field identifiers", () => {
    const source = "objectName: ObjectType;\nobjectName.fieldName";
    const colors = toCodeHikeTokens(parseObgx(source));

    assert.deepEqual(kindsFor(source, "objectName"), ["variable", "variable"]);
    assert.deepEqual(kindsFor(source, "fieldName"), ["property"]);
    assert.deepEqual(
        colors.filter(token => Array.isArray(token) && ["objectName", "fieldName"].includes(token[0])),
        [
            ["objectName", "var(--obgx-property-color)"],
            ["objectName", "var(--obgx-property-color)"],
            ["fieldName", "var(--obgx-property-color)"]
        ]
    );
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