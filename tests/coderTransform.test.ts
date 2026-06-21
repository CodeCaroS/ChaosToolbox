import assert from "node:assert/strict";
import test from "node:test";
import { transformCoderText } from "../src/modules/coder/transform";

test("coder transforms base64 and json text", () => {
  assert.equal(transformCoderText("hello", "base64", "encode"), "aGVsbG8=");
  assert.equal(transformCoderText("aGVsbG8=", "base64", "decode"), "hello");
  assert.equal(transformCoderText("hello", "json", "encode"), "\"hello\"");
  assert.equal(transformCoderText("{\"ok\":true}", "json", "decode"), "{\n  \"ok\": true\n}");
});
