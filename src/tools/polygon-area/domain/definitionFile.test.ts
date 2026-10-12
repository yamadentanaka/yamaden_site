import { describe, expect, it } from "vitest";
import {
  checkCompatibility,
  definitionFileName,
  parse,
  serialize,
} from "./definitionFile";
import type { Area, AreaDefinitionFile, ImageInfo } from "./types";

const image: ImageInfo = { name: "cam01.jpg", width: 1920, height: 1080 };

const validJson = (override: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: 1,
    image: { name: "cam01.jpg", width: 1920, height: 1080 },
    areas: [
      {
        name: "判定エリアA",
        points: [
          [120, 340],
          [860, 320],
          [900, 1000],
        ],
      },
    ],
    ...override,
  });

describe("serialize", () => {
  it("2スペースのインデントと末尾の改行で、決まったキーの順に出力する", () => {
    // Given
    const areas: Area[] = [
      {
        id: "x",
        name: "判定エリアA",
        colorIndex: 3,
        points: [
          [120, 340],
          [860, 320],
          [900, 1000],
        ],
      },
    ];
    // When
    const text = serialize(image, areas);
    // Then
    expect(text).toBe(
      `${JSON.stringify(
        {
          version: 1,
          image: { name: "cam01.jpg", width: 1920, height: 1080 },
          areas: [
            {
              name: "判定エリアA",
              points: [
                [120, 340],
                [860, 320],
                [900, 1000],
              ],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
  });

  it("画像の url やエリアの id・colorIndex は出力しない", () => {
    // Given: EditorState.image のように url を持つ値を渡す
    const withUrl = { ...image, url: "blob:http://localhost/abc" };
    const areas: Area[] = [
      {
        id: "secret-id",
        name: "A",
        colorIndex: 2,
        points: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      },
    ];
    // When
    const text = serialize(withUrl, areas);
    // Then
    expect(text).not.toContain("blob:");
    expect(text).not.toContain("secret-id");
    expect(text).not.toContain("colorIndex");
  });

  it("エリアが0件でも出力できる", () => {
    expect(JSON.parse(serialize(image, []))).toEqual({
      version: 1,
      image,
      areas: [],
    });
  });
});

describe("definitionFileName", () => {
  it.each([
    ["cam01.jpg", "cam01.areas.json"],
    ["a.b.png", "a.b.areas.json"],
    ["noext", "noext.areas.json"],
    [".hidden", ".hidden.areas.json"],
  ])("%s → %s", (name, expected) => {
    expect(definitionFileName(name)).toBe(expected);
  });
});

describe("parse", () => {
  it("正しいJSONを AreaDefinitionFile にする", () => {
    const result = parse(validJson());
    expect(result).toEqual({
      ok: true,
      value: {
        version: 1,
        image,
        areas: [
          {
            name: "判定エリアA",
            points: [
              [120, 340],
              [860, 320],
              [900, 1000],
            ],
          },
        ],
      },
    });
  });

  it("エリア名は前後の空白を除いた値で返し、未知のキーは無視する", () => {
    const result = parse(
      validJson({
        extra: true,
        areas: [
          {
            name: "  入口 ",
            points: [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
            color: "red",
          },
        ],
      }),
    );
    expect(result.ok && result.value.areas[0]?.name).toBe("入口");
  });

  it("エリアが0件でもよい", () => {
    expect(parse(validJson({ areas: [] })).ok).toBe(true);
  });

  it.each<[string, string, unknown]>([
    ["JSONとして解釈できない", "{", { kind: "invalidJson" }],
    ["最上位が配列", "[]", { kind: "invalidField", path: "" }],
    ["最上位が null", "null", { kind: "invalidField", path: "" }],
    [
      "version がない",
      JSON.stringify({ image: {}, areas: [] }),
      { kind: "invalidField", path: "version" },
    ],
    [
      "version が文字列",
      validJson({ version: "1" }),
      { kind: "invalidField", path: "version" },
    ],
    [
      "version が 2",
      validJson({ version: 2 }),
      { kind: "unsupportedVersion", version: 2 },
    ],
    [
      "image がない",
      validJson({ image: undefined }),
      { kind: "invalidField", path: "image" },
    ],
    [
      "image.name が空",
      validJson({ image: { name: "", width: 1, height: 1 } }),
      { kind: "invalidField", path: "image.name" },
    ],
    [
      "image.width が0",
      validJson({ image: { name: "a", width: 0, height: 1 } }),
      { kind: "invalidField", path: "image.width" },
    ],
    [
      "image.height が小数",
      validJson({ image: { name: "a", width: 1, height: 1.5 } }),
      { kind: "invalidField", path: "image.height" },
    ],
    [
      "areas が配列でない",
      validJson({ areas: {} }),
      { kind: "invalidField", path: "areas" },
    ],
    [
      "要素がオブジェクトでない",
      validJson({ areas: [1] }),
      { kind: "invalidField", path: "areas[0]" },
    ],
    [
      "name が文字列でない",
      validJson({ areas: [{ name: 1, points: [] }] }),
      { kind: "invalidField", path: "areas[0].name" },
    ],
    [
      "name が空白だけ",
      validJson({
        areas: [
          {
            name: "  ",
            points: [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
          },
        ],
      }),
      { kind: "invalidField", path: "areas[0].name" },
    ],
    [
      "name が51文字",
      validJson({
        areas: [
          {
            name: "あ".repeat(51),
            points: [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
          },
        ],
      }),
      { kind: "invalidField", path: "areas[0].name" },
    ],
    [
      "points が2点",
      validJson({
        areas: [
          {
            name: "A",
            points: [
              [0, 0],
              [1, 0],
            ],
          },
        ],
      }),
      { kind: "invalidField", path: "areas[0].points" },
    ],
    [
      "points が配列でない",
      validJson({ areas: [{ name: "A", points: "x" }] }),
      { kind: "invalidField", path: "areas[0].points" },
    ],
    [
      "点が整数でない",
      validJson({
        areas: [
          {
            name: "A",
            points: [
              [0, 0],
              [1.5, 0],
              [0, 1],
            ],
          },
        ],
      }),
      { kind: "invalidField", path: "areas[0].points[1]" },
    ],
    [
      "点が3要素",
      validJson({
        areas: [
          {
            name: "A",
            points: [
              [0, 0],
              [1, 0],
              [0, 1, 2],
            ],
          },
        ],
      }),
      { kind: "invalidField", path: "areas[0].points[2]" },
    ],
  ])("%s", (_, text, error) => {
    expect(parse(text)).toEqual({ ok: false, error });
  });

  it("要素ごとに name → points の順に確かめる（前の要素の points が先に見つかる）", () => {
    const text = validJson({
      areas: [
        { name: "A", points: [[0, 0]] },
        {
          name: "",
          points: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
      ],
    });
    expect(parse(text)).toEqual({
      ok: false,
      error: { kind: "invalidField", path: "areas[0].points" },
    });
  });

  it("名前の重複は、全要素の検証の後に判定する", () => {
    // Given: 重複した名前の後に、点の誤りがある
    const text = validJson({
      areas: [
        {
          name: "A",
          points: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
        {
          name: " A ",
          points: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
        { name: "B", points: [[0, 0]] },
      ],
    });
    // Then: 点の誤りが先に見つかる
    expect(parse(text)).toEqual({
      ok: false,
      error: { kind: "invalidField", path: "areas[2].points" },
    });
  });

  it("正規化した名前が重なれば duplicateName", () => {
    const text = validJson({
      areas: [
        {
          name: "A",
          points: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
        {
          name: " A ",
          points: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
      ],
    });
    expect(parse(text)).toEqual({
      ok: false,
      error: { kind: "duplicateName", name: "A" },
    });
  });
});

describe("checkCompatibility", () => {
  const file = (
    points: AreaDefinitionFile["areas"][number]["points"],
    size = { width: 1920, height: 1080 },
  ) =>
    ({
      version: 1,
      image: { name: "other.jpg", ...size },
      areas: [{ name: "A", points }],
    }) as const;

  it("サイズが一致し、全ての点が範囲内なら ok（ファイル名の違いは問わない）", () => {
    expect(
      checkCompatibility(
        file([
          [0, 0],
          [1919, 0],
          [1919, 1079],
        ]),
        image,
      ),
    ).toEqual({ ok: true, value: undefined });
  });

  it("サイズが違えば imageSizeMismatch", () => {
    expect(
      checkCompatibility(
        file(
          [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          { width: 1280, height: 720 },
        ),
        image,
      ),
    ).toEqual({
      ok: false,
      error: {
        kind: "imageSizeMismatch",
        json: { width: 1280, height: 720 },
        image: { width: 1920, height: 1080 },
      },
    });
  });

  it("範囲外の点があれば、最初のものの path を返す", () => {
    expect(
      checkCompatibility(
        file([
          [0, 0],
          [1920, 0],
          [-1, 5],
        ]),
        image,
      ),
    ).toEqual({
      ok: false,
      error: { kind: "pointOutOfRange", path: "areas[0].points[1]" },
    });
  });
});
