import { it, expect } from "vitest";
import { readState, mutate, asset, backup, parseBackup } from "../src/db";
import { blank, snapshot } from "../src/model";
import { importedCopy } from "../src/db";
it("atomic save persists content and blobs; stale writers fail without overwriting", async () => {
  const initial = await readState();
  const r = blank("保存テスト");
  r.imageIds = ["test-asset"];
  const blob = new Blob(["fake"], { type: "image/webp" });
  const saved = await mutate(
    initial.revision,
    (s) =>
      s.worlds.push({
        content: { world: r, entities: [] },
        snapshots: [],
        trashed: false,
      }),
    [{ id: "test-asset", blob, thumbnail: blob }],
  );
  expect((await readState()).worlds[0].content.world.name).toBe("保存テスト");
  expect((await asset("test-asset"))!.blob.size).toBe(4);
  await expect(
    mutate(initial.revision, (s) => {
      s.worlds = [];
    }),
  ).rejects.toThrow("別の画面");
  expect((await readState()).revision).toBe(saved.revision);
  const restored = await mutate(saved.revision, (s) => {
    const w = s.worlds[0];
    const target = snapshot(w.content);
    w.content.world.name = "新";
    w.snapshots.push(snapshot(w.content, "", "復元前"));
    w.content = target.content;
  });
  expect(restored.worlds[0].snapshots[0].content.world.name).toBe("新");
  expect(restored.worlds[0].content.world.name).toBe("保存テスト");
});
it("malformed imports leave live database untouched", async () => {
  const before = await readState();
  await expect(parseBackup(new File(["{}"], "bad.json"))).rejects.toThrow();
  expect(await readState()).toEqual(before);
});
it("missing referenced image stops export", async () => {
  const r = blank();
  r.imageIds = ["missing"];
  await expect(
    backup([
      { content: { world: r, entities: [] }, snapshots: [], trashed: false },
    ]),
  ).rejects.toThrow("画像");
});
it("complete text/history backup round trip preserves versions and memos", async () => {
  const w = {
    content: { world: blank("往復テスト"), entities: [] },
    snapshots: [],
    trashed: false,
  };
  w.content.world.memo = "非公開メモ";
  const full = { ...w, snapshots: [snapshot(w.content, "1.21", "初稿")] };
  const out = await backup([full]);
  const parsed = await parseBackup(
    new File([JSON.stringify(out)], "backup.json"),
  );
  expect(parsed.worlds).toEqual([full]);
  const before = await readState();
  const copied = importedCopy(parsed.worlds[0]);
  await mutate(before.revision, (s) => s.worlds.push(copied));
  expect((await readState()).worlds.at(-1)!.snapshots[0].version).toBe("1.21");
});
it("transaction failure does not alter current state", async () => {
  const before = await readState();
  await expect(
    mutate(before.revision, (s) => {
      s.worlds[0].content.world.name = "";
    }),
  ).rejects.toThrow();
  expect(await readState()).toEqual(before);
});
it("mismatched world associations reject before writing", async () => {
  const w = {
    content: { world: blank("世界"), entities: [] },
    snapshots: [],
    trashed: false,
  };
  const s = snapshot(w.content);
  s.content.world.id = "wrong";
  const b = {
    format: "w-pam-backup",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    worlds: [{ ...w, snapshots: [s] }],
    images: [],
  };
  await expect(
    parseBackup(new File([JSON.stringify(b)], "broken.json")),
  ).rejects.toThrow("関連");
});
it("asset write failure rolls back the state write in the same transaction", async () => {
  const before = await readState();
  await expect(
    mutate(
      before.revision,
      (s) => {
        s.settings.tutorial = 99;
      },
      [
        {
          id: "bad",
          blob: (() => {}) as unknown as Blob,
          thumbnail: new Blob(),
        },
      ],
    ),
  ).rejects.toThrow();
  expect(await readState()).toEqual(before);
});
it("rejects dangling related items without changing saved data", async () => {
  const before = await readState();
  await expect(
    mutate(before.revision, (s) => {
      s.worlds[0].content.world.relatedIds = ["missing-entity"];
    }),
  ).rejects.toThrow("関連");
  expect(await readState()).toEqual(before);
});
