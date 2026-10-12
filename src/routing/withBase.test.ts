import { describe, expect, it } from "vitest";
import { withBase } from "./withBase";

describe("withBase", () => {
  it("相対パスに BASE_URL を前に付ける", () => {
    // Given: Vitest の BASE_URL は "/"
    // When / Then
    expect(withBase("tools/")).toBe(`${import.meta.env.BASE_URL}tools/`);
  });

  it("空文字ならトップページの URL を返す", () => {
    expect(withBase("")).toBe(import.meta.env.BASE_URL);
  });

  it("先頭が / のパスを渡すと例外を投げる", () => {
    expect(() => withBase("/tools/")).toThrow();
  });
});
