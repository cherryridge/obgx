import assert from "node:assert/strict";
import test from "node:test";
import {buildModuleRedirects, resolveModuleRedirect} from "./moduleRedirects.mjs";

test("builds latest reference and Edition-bound redirects", () => {
    const redirects = buildModuleRedirects(
        ["types@2", "record@1", "types@10"],
        [{id: "26.8-draft", modules: ["types@2", "record@1"]}]
    );

    assert.deepEqual(redirects, [
        {from: "/ref/record", to: "/ref/record@1"},
        {from: "/ref/types", to: "/ref/types@10"},
        {from: "/26.8-draft/record", to: "/26.8-draft/record@1"},
        {from: "/26.8-draft/types", to: "/26.8-draft/types@2"}
    ]);
});

test("rejects duplicate Module bindings in one Edition", () => {
    assert.throws(
        () => buildModuleRedirects(
            ["types@1", "types@2"],
            [{id: "26.8-draft", modules: ["types@1", "types@2"]}]
        ),
        /Edition 26\.8-draft binds Module types more than once/
    );
});

test("resolves module roots and nested paths while ignoring versioned paths", () => {
    const redirects = [{from: "/ref/types", to: "/ref/types@1"}];

    assert.equal(resolveModuleRedirect("/ref/types", "/", redirects), "/ref/types@1");
    assert.equal(resolveModuleRedirect("/zh-hans/ref/types/", "/zh-hans/", redirects), "/zh-hans/ref/types@1");
    assert.equal(resolveModuleRedirect("/ref/types/Type", "/", redirects), "/ref/types@1/Type");
    assert.equal(
        resolveModuleRedirect("/zh-hans/ref/types/category/Type/", "/zh-hans/", redirects),
        "/zh-hans/ref/types@1/category/Type"
    );
    assert.equal(resolveModuleRedirect("/ref/types@1", "/", redirects), undefined);
    assert.equal(resolveModuleRedirect("/ref/types@1/Type", "/", redirects), undefined);
    assert.equal(resolveModuleRedirect("/ref/types-extra/Type", "/", redirects), undefined);
});

test("leaves nested path existence checks to the target route", () => {
    const redirects = [{from: "/ref/types", to: "/ref/types@2"}];

    assert.equal(
        resolveModuleRedirect("/ref/types/MissingElement", "/", redirects),
        "/ref/types@2/MissingElement"
    );
});