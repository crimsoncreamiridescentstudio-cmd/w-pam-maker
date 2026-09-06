import { it, expect, vi, afterEach } from "vitest";
import { orderEntities, renderPages } from "../src/export";
import { blank, entitySchema, contentSchema, recordOverrideSchema, relationOverrideSchema } from "../src/model";
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
it("orders export entities by kind, registration, name, or a manual list", () => {
  const world = blank("世界");
  const location = entitySchema.parse({ ...blank("う・王都10"), kind: "location", worldId: world.id });
  const characterB = entitySchema.parse({ ...blank("い・勇者2"), kind: "character", worldId: world.id });
  const characterA = entitySchema.parse({ ...blank("あ・勇者1"), kind: "character", worldId: world.id });
  const entities = [location, characterB, characterA];

  expect(orderEntities(entities, "registration").map((entity) => entity.id)).toEqual([location.id, characterB.id, characterA.id]);
  expect(orderEntities(entities, "kind").map((entity) => entity.id)).toEqual([characterB.id, characterA.id, location.id]);
  expect(orderEntities(entities, "name").map((entity) => entity.id)).toEqual([characterA.id, characterB.id, location.id]);
  expect(orderEntities(entities, "manual", [characterA.id, location.id, characterB.id]).map((entity) => entity.id)).toEqual([characterA.id, location.id, characterB.id]);
});
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
it("exports display names, formal names, relations and reference labels", async () => {
  const drawn = mockCanvas();
  const world = blank("正式世界名");
  world.displayName = "通称世界";
  world.catchphrase = "[[半藤 智咲|智咲]]の世界";
  const character = entitySchema.parse({
    ...blank("半藤 智咲"),
    displayName: "智咲",
    worldId: world.id,
    kind: "character",
  });
  world.relatedIds = [character.id];
  await renderPages(
    { world, entities: [character] },
    { kinds: ["character"], logo: true, separate: true, width: 794 },
  );
  const text = drawn.map((item) => item.text);
  expect(text).toContain("通称世界");
  expect(text).toContain("正式世界名");
  expect(text).toContain("智咲の世界");
  expect(text).toContain("智咲");
  expect(text.some((value) => value.includes("[["))).toBe(false);
});


it("exports resolved Dimension content without hidden entities or relations", async () => {
  const { resolveContent } = await import("../src/dimensions");
  const drawn = mockCanvas();
  const world = blank("世界");
  const a = entitySchema.parse({ ...blank("主人公"), kind: "character", worldId: world.id, summary: "基本の概要" });
  const b = entitySchema.parse({ ...blank("非掲載の研究所"), kind: "location", worldId: world.id });
  const conditions = [{ axisId: "line", optionId: "back" }];
  a.overrides = [recordOverrideSchema.parse({id:"a",conditions,patch:{summary:"差分の概要"}})];
  b.overrides = [recordOverrideSchema.parse({id:"b",conditions,patch:{visible:false}})];
  const content = contentSchema.parse({world,entities:[a,b],relations:[{id:"r",from:a.id,to:b.id,type:"秘密の関係",direction:"mutual",note:"",createdAt:world.createdAt,updatedAt:world.updatedAt}]});
  await renderPages(resolveContent(content,{line:"back"}),{kinds:["character","location"],logo:false,separate:true,width:794});
  const text = drawn.map(x => x.text).join("\n");
  expect(text).toContain("差分の概要");
  expect(text).not.toContain("基本の概要"); expect(text).not.toContain("非掲載の研究所"); expect(text).not.toContain("秘密の関係");
});
