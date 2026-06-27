import { expect, it } from "vitest";
import { parseJson } from "../src/utils/flowHelpers";

it("parses valid JSON", () => {
    expect(parseJson('{"a":1}')).toEqual({a:1});
});

it("returns null for invalid JSON", () => {
    expect(parseJson("{")).toBeNull();
});