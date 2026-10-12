import { describe, expect, it } from "vitest";
import { classifyFile } from "./fileKind";

describe("classifyFile", () => {
  it.each([
    [{ name: "cam01.jpg", type: "image/jpeg" }, "image"],
    [{ name: "photo.heic", type: "image/heic" }, "image"],
    [{ name: "cam01.areas.json", type: "application/json" }, "json"],
    [{ name: "CAM01.JSON", type: "" }, "json"],
    [{ name: "data", type: "application/json" }, "json"],
    [{ name: "notes.txt", type: "text/plain" }, "unknown"],
    [{ name: "noext", type: "" }, "unknown"],
  ])("%o を %s に振り分ける", (file, kind) => {
    expect(classifyFile(file)).toBe(kind);
  });
});
