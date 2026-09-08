import { describe, it, expect } from "vitest";
import {
  blank,
  snapshot,
  diff,
  duplicateWorld,
  stamp,
  imageRefs,
  worldSchema,
  shownName,
  relationDisplayLines,
  relationCurveOffsets,
  referenceParts,
  entitySchema,
  initialState,
} from "../src/model";
import { applyWorldImports, backupSchema, importedCopy } from "../src/db";
const world = () => ({
  content: { world: blank("テスト世界"), entities: [] },
  snapshots: [],
  trashed: false,
});
describe("world history", () => {
  it("uses compact local timestamp", () =>
    expect(stamp(new Date(2026, 8, 6, 11, 31, 8))).toBe("20260906-113108"));
  it("snapshots are immutable copies with unique IDs in the same second", () => {
    const w = world();
    const a = snapshot(w.content, "1.21"),
      b = snapshot(w.content);
    w.content.world.name = "変更";
    expect(a.content.world.name).toBe("テスト世界");
    expect(a.id).not.toBe(b.id);
  });
  it("diff excludes modified timestamps but compares content", () => {
    const w = world();
    const old = structuredClone(w.content);
    w.content.world.updatedAt = new Date(0).toISOString();
    expect(diff(old, w.content)).toHaveLength(0);
    w.content.world.name = "改訂";
    expect(diff(old, w.content)[0]).toMatchObject({
      before: "テスト世界",
      after: "改訂",
      type: "変更",
    });
  });
  it("copy has independent identity", () => {
    const w = world();
    expect(duplicateWorld(w).content.world.id).not.toBe(w.content.world.id);
  });
  it("image references include history", () => {
    const w = world();
    w.content.world.imageIds = ["old"];
    const s = snapshot(w.content);
    w.content.world.imageIds = ["new"];
    expect([...imageRefs([{ ...w, snapshots: [s] }])]).toEqual(["new", "old"]);
  });
  it("rejects malicious URL", () => {
    const w = world();
    w.content.world.url = "javascript:alert(1)";
    expect(worldSchema.safeParse(w).success).toBe(false);
  });
  it("rejects future schema without destructive migration", () =>
    expect(
      backupSchema.safeParse({
        format: "w-pam-backup",
        schemaVersion: 4,
        worlds: [],
        images: [],
        exportedAt: new Date().toISOString(),
      }).success,
    ).toBe(false));
  it("remaps imported copies including history", () => {
    const w = world();
    const copy = importedCopy({ ...w, snapshots: [snapshot(w.content)] });
    expect(copy.snapshots[0].content.world.id).toBe(copy.content.world.id);
    expect(copy.content.world.id).not.toBe(w.content.world.id);
  });
  it("can preserve trash placement when importing a backup as a copy", () => {
    const w = { ...world(), trashed: true };
    expect(importedCopy(w).trashed).toBe(false);
    expect(importedCopy(w, { preserveTrash: true }).trashed).toBe(true);
  });
  it("imports trashed backups into trash when adding them as copies", () => {
    const state = initialState();
    const imported = { ...world(), trashed: true };
    applyWorldImports(state, [imported], "copy");
    expect(state.worlds[0].trashed).toBe(true);
    expect(state.worlds[0].content.world.id).not.toBe(
      imported.content.world.id,
    );
  });
  it("replaces matching IDs and moves the previous world to trash", () => {
    const state = initialState();
    const current = world();
    const imported = structuredClone(current);
    current.content.world.name = "現在版";
    imported.content.world.name = "バックアップ版";
    state.worlds.push(current);
    applyWorldImports(state, [imported], "replace");
    expect(
      state.worlds.find((w) => w.content.world.id === imported.content.world.id)
        ?.content.world.name,
    ).toBe("バックアップ版");
    expect(
      state.worlds.find(
        (w) => w.content.world.id !== imported.content.world.id,
      ),
    ).toMatchObject({
      trashed: true,
      content: { world: { name: "現在版（読み込み前の安全コピー）" } },
    });
  });
  it("loads old records with safe defaults for new display features", () => {
    const old = blank("旧データ") as unknown as Record<string, unknown>;
    delete old.displayName;
    delete old.imagePositions;
    delete old.relatedIds;
    const parsed = worldSchema.parse({
      content: { world: old, entities: [] },
      snapshots: [],
      trashed: false,
    });
    expect(parsed.content.world).toMatchObject({
      name: "旧データ",
      displayName: "",
      imagePositions: {},
      relatedIds: [],
      customFields: [],
      dialogueSamples: "",
    });
    expect(parsed.content).toMatchObject({
      relations: [],
      collections: [],
      events: [],
    });
  });
  it("formats relationship labels as at most two ten-character lines", () => {
    expect(relationDisplayLines("1234567890abcdefghijXYZ")).toEqual([
      "1234567890",
      "abcdefghi…",
    ]);
    expect(relationDisplayLines("親友")).toEqual(["親友"]);
  });
  it("separates reverse and duplicate relationship edges", () => {
    const offsets = relationCurveOffsets([
      { id: "ab", from: "a", to: "b" },
      { id: "ba", from: "b", to: "a" },
      { id: "ab2", from: "a", to: "b" },
    ]);
    expect(offsets.get("ab")).toBe(-96);
    expect(offsets.get("ba")).toBe(0);
    expect(offsets.get("ab2")).toBe(96);
    const reversePair = relationCurveOffsets([
      { id: "forward", from: "a", to: "b" },
      { id: "reverse", from: "b", to: "a" },
    ]);
    expect(reversePair.get("forward")).toBe(-48);
    expect(reversePair.get("reverse")).toBe(48);
  });
  it("prefers a display name and parses safe inline references", () => {
    const r = blank("半藤 智咲");
    r.displayName = "智咲";
    expect(shownName(r)).toBe("智咲");
    expect(referenceParts("[[半藤 智咲|智咲]]と[[別項目]]")).toEqual([
      { raw: "" },
      { raw: "[[半藤 智咲|智咲]]", query: "半藤 智咲", label: "智咲" },
      { raw: "と" },
      { raw: "[[別項目]]", query: "別項目", label: "別項目" },
      { raw: "" },
    ]);
  });
  it("remaps related items when duplicating a world", () => {
    const w = world();
    const a = entitySchema.parse({
      ...blank("A"),
      kind: "character",
      worldId: w.content.world.id,
    });
    const b = entitySchema.parse({
      ...blank("B"),
      kind: "location",
      worldId: w.content.world.id,
      relatedIds: [a.id],
    });
    w.content.entities = [a, b];
    const copy = duplicateWorld(w);
    expect(copy.content.entities[1].relatedIds).toEqual([
      copy.content.entities[0].id,
    ]);
    expect(copy.content.entities[1].relatedIds).not.toContain(a.id);
  });
  it("remaps independent relations, groups, events and hierarchy", () => {
    const w = world();
    const a = entitySchema.parse({
      ...blank("親"),
      kind: "organization",
      worldId: w.content.world.id,
    });
    const b = entitySchema.parse({
      ...blank("子"),
      kind: "organization",
      worldId: w.content.world.id,
      parentId: a.id,
    });
    const now = new Date().toISOString();
    w.content.entities = [a, b];
    Object.assign(w.content, {
      relations: [
        {
          id: crypto.randomUUID(),
          from: a.id,
          to: b.id,
          type: "管轄",
          direction: "directed",
          note: "",
          createdAt: now,
          updatedAt: now,
        },
      ],
      collections: [
        {
          id: crypto.randomUUID(),
          name: "組織群",
          description: "",
          entityIds: [a.id, b.id],
          createdAt: now,
          updatedAt: now,
        },
      ],
      events: [
        {
          id: crypto.randomUUID(),
          title: "設立",
          date: "元年",
          sortKey: "0001",
          description: "",
          entityIds: [a.id],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    const copy = duplicateWorld(w);
    expect(copy.content.entities[1].parentId).toBe(copy.content.entities[0].id);
    expect(copy.content.relations[0]).toMatchObject({
      from: copy.content.entities[0].id,
      to: copy.content.entities[1].id,
    });
    expect(copy.content.collections[0].entityIds).toEqual(
      copy.content.entities.map((entity) => entity.id),
    );
    expect(copy.content.events[0].entityIds).toEqual([
      copy.content.entities[0].id,
    ]);
  });
});
