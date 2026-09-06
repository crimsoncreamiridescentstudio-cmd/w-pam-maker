import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { filterTips, TipsContent, tips } from "../src/tips";

describe("Tips", () => {
  it("covers every Tips category", () => {
    expect(new Set(tips.map((tip) => tip.category))).toEqual(
      new Set(["start", "dimension", "connect", "protect", "export"]),
    );
  });

  it("searches titles, explanations, and alternate keywords", () => {
    expect(filterTips("バックアップ").map((tip) => tip.id)).toContain("json-backup");
    expect(filterTips("限定キャラ").map((tip) => tip.id)).toContain("dimension-visibility");
    expect(filterTips("相関図", "connect").every((tip) => tip.category === "connect")).toBe(true);
  });

  it("renders the search and the safety guidance", () => {
    const html = renderToStaticMarkup(<TipsContent />);
    expect(html).toContain("Tipsを検索");
    expect(html).toContain("W-Pamだけを唯一の保管場所にせず");
    expect(html).toContain(`${tips.length}件のTips`);
  });
});
