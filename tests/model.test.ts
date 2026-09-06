import { describe, it, expect } from "vitest";
import {
  blank,
  snapshot,
  diff,
  duplicateWorld,
  stamp,
  imageRefs,
  worldSchema,
} from "../src/model";
import { backupSchema, importedCopy } from "../src/db";
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
        schemaVersion: 2,
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
});
