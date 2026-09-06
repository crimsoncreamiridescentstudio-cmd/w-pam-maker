import { it, expect, vi, afterEach } from "vitest";
import { renderPages } from "../src/export";
import { blank, entitySchema } from "../src/model";
afterEach(() => vi.unstubAllGlobals());
function mockCanvas() {
  const drawn: { text: string; y: number }[] = [];
  const context = {
    font: "",
    fillStyle: "",
    scale() {},
    fillRect() {},
    fillText(text: string, _x: number, y: number) {
      drawn.push({ text, y });
    },
    measureText(text: string) {
      return { width: [...text].length * 19 };
    },
  };
  vi.stubGlobal("document", {
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve([]) },
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
  return drawn;
}
it("paginates long Japanese text without silently truncating and excludes author notes", async () => {
  const drawn = mockCanvas();
  const r = blank("冊子");
  r.description = "魔法と科学の世界\n".repeat(80) + "最後の文章";
  r.memo = "秘密の作者メモ";
  const pages = await renderPages(
    { world: r, entities: [] },
    { kinds: [], logo: true, separate: true, width: 794 },
  );
  expect(pages.length).toBeGreaterThan(1);
  expect(drawn.some((d) => d.text.includes("最後の文章"))).toBe(true);
  expect(drawn.some((d) => d.text.includes("秘密の作者メモ"))).toBe(false);
  expect(drawn.every((d) => d.y <= 1090)).toBe(true);
});
it("filters entity sections and logo", async () => {
  const drawn = mockCanvas();
  const r = blank("世界");
  const e = entitySchema.parse({
    ...blank("見えない人物"),
    worldId: r.id,
    kind: "character",
  });
  await renderPages(
    { world: r, entities: [e] },
    { kinds: ["lore"], logo: false, separate: true, width: 794 },
  );
  expect(drawn.some((d) => d.text.includes(e.name))).toBe(false);
  expect(drawn.some((d) => d.text === "W-Pam")).toBe(false);
});
it("stops oversized exports with explicit error", async () => {
  mockCanvas();
  const r = blank("世界");
  r.description = "長文\n".repeat(2000);
  await expect(
    renderPages(
      { world: r, entities: [] },
      { kinds: [], logo: true, separate: false, width: 794 },
    ),
  ).rejects.toThrow("24ページ");
});
