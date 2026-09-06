import { describe, it, expect } from "vitest";
import {
  blank,
  entitySchema,
  relationSchema,
  worldSchema,
  initialState,
  snapshot,
  duplicateWorld,
  recordOverrideSchema,
  relationOverrideSchema,
  type WorldFolder,
  type World,
  type State,
} from "../src/model";
import {
  resolveContent,
  resolveRecord,
  normalizeState,
  validSelection,
  deleteFolder,
  assignFolder,
  usageCount,
  validateDimensions,
  mergeFolderImports,
  transferOverride,
  dimensionLabel,
} from "../src/dimensions";
import {
  backup,
  parseBackup,
  importedCopy,
  readState,
  mutate,
  db,
} from "../src/db";
const now = "2026-09-06T00:00:00.000Z";
function fixture() {
  const folder: WorldFolder = {
    id: "folder",
    name: "Abilitia",
    description: "",
    createdAt: now,
    updatedAt: now,
    dimensionAxes: [
      {
        id: "line",
        name: "世界線",
        options: [
          { id: "standard", name: "STANDARD" },
          { id: "back", name: "BACKSIDE" },
        ],
      },
      {
        id: "time",
        name: "時系列",
        options: [
          { id: "main", name: "本編" },
          { id: "future", name: "10年後" },
        ],
      },
      {
        id: "spoiler",
        name: "ネタバレ",
        options: [
          { id: "no", name: "なし" },
          { id: "yes", name: "あり" },
        ],
      },
    ],
  };
  const world: World = worldSchema.parse({
    folderId: folder.id,
    content: { world: blank("世界"), entities: [] },
    snapshots: [],
    trashed: false,
  });
  const a = entitySchema.parse({
    ...blank("主人公"),
    summary: "明るい主人公",
    kind: "character",
    worldId: world.content.world.id,
  });
  const b = entitySchema.parse({
    ...blank("研究所"),
    kind: "location",
    worldId: world.content.world.id,
  });
  world.content.entities.push(a, b);
  world.content.relations.push(
    relationSchema.parse({
      id: "relation",
      from: a.id,
      to: b.id,
      type: "幼馴染",
      direction: "mutual",
      note: "基本メモ",
      createdAt: now,
      updatedAt: now,
    }),
  );
  return {
    folder,
    world,
    a,
    b,
    state: { ...initialState(), worlds: [world], worldFolders: [folder] },
  };
}
const back = [{ axisId: "line", optionId: "back" }];
const future = [{ axisId: "time", optionId: "future" }];
const override = (
  id: string,
  conditions = back,
  patch = { summary: "冷酷な主人公" },
) => recordOverrideSchema.parse({ id, conditions, patch });

describe("Item Dimension UX operations", () => {
  it("moves just the selected override without mutating the source", () => {
    const source = [override("a"), override("b", [...back, ...future])];
    const original = structuredClone(source);
    const moved = transferOverride(source, "a", future, "move");
    expect(source).toEqual(original);
    expect(moved[0].id).toBe("a"); expect(moved[0].conditions).toEqual(future);
    expect(moved[1]).toEqual(source[1]);
  });
  it("copies with a new override ID and retains explicit empty/hidden values", () => {
    const source = [recordOverrideSchema.parse({id:"a", conditions:back, patch:{summary:"", visible:false}})];
    const copied = transferOverride(source, "a", future, "copy");
    expect(copied[0]).toEqual(source[0]); expect(copied[1].id).not.toBe("a");
    expect(copied[1].patch).toEqual({summary:"", visible:false});
  });
  it("optionally hides the old condition while preserving identity and relation data", () => {
    const {world, a} = fixture(); a.overrides = [override("a")];
    const identity = {id:a.id, imageIds:a.imageIds, relatedIds:a.relatedIds};
    const relations = structuredClone(world.content.relations);
    a.overrides = recordOverrideSchema.array().parse(transferOverride(a.overrides, "a", future, "move", true));
    expect({id:a.id, imageIds:a.imageIds, relatedIds:a.relatedIds}).toEqual(identity);
    expect(world.content.relations).toEqual(relations);
    expect(resolveContent(world.content, {line:"back"}).entities.some(e => e.id === a.id)).toBe(false);
    expect(resolveContent(world.content, {line:"back"}).relations).toHaveLength(0);
    expect(resolveContent(world.content, {time:"future"}).entities.find(e => e.id === a.id)?.summary).toBe("冷酷な主人公");
  });
  it("returns to inheritance when a move does not hide the source", () => {
    const {a} = fixture(); const base = a.summary;
    a.overrides = recordOverrideSchema.array().parse(transferOverride([override("a")], "a", future, "move"));
    expect(resolveRecord(a, {line:"back"}).summary).toBe(base);
  });
  it("refuses an occupied or identical destination without changing anything", () => {
    const source = [override("a"), override("b", future)]; const original = structuredClone(source);
    expect(() => transferOverride(source,"a",future,"move")).toThrow("上書き");
    expect(() => transferOverride(source,"a",back,"copy")).toThrow("上書き");
    expect(source).toEqual(original);
  });
  it("rejects missing sources and invalid conditions", () => {
    expect(() => transferOverride([],"missing",future,"move")).toThrow();
    expect(() => transferOverride([override("a")],"a",[],"move")).toThrow();
    expect(() => transferOverride([override("a")],"a",[...future,...future],"move")).toThrow();
  });
  it("keeps equal-specificity precedence stable on move", () => {
    const {a} = fixture();
    a.overrides = recordOverrideSchema.array().parse(transferOverride([override("a"), override("b", [{axisId:"line",optionId:"standard"}], {summary:"later"})], "a", future, "move"));
    expect(resolveRecord(a, {time:"future",line:"standard"}).summary).toBe("later");
  });
  it("preserves old snapshot contents and passes dimension validation", () => {
    const {world,a,state} = fixture(); a.overrides = [override("a")];
    world.snapshots.push(snapshot(world.content,"","before"));
    a.overrides = recordOverrideSchema.array().parse(transferOverride(a.overrides,"a",future,"move",true));
    expect(world.snapshots[0].content.entities.find(e => e.id === a.id)?.overrides?.[0].conditions).toEqual(back);
    expect(() => validateDimensions(state)).not.toThrow();
  });
  it("transfers relation patches without changing endpoints", () => {
    const {world} = fixture(); const r = world.content.relations[0]; const endpoints = [r.from,r.to];
    r.overrides = relationOverrideSchema.array().parse(transferOverride([{id:"rel",conditions:back,patch:{type:"宿敵",direction:"directed",note:""}}],"rel",future,"copy"));
    expect([r.from,r.to]).toEqual(endpoints); expect(resolveRecord(r,{time:"future"}).type).toBe("宿敵");
  });
  it("labels independent axes and the base view", () => {
    const {folder} = fixture(); expect(dimensionLabel(folder,{})).toBe("基本データ");
    expect(dimensionLabel(folder,{line:"back",time:"future"})).toContain(" ＋ ");
  });
});

describe("Dimension resolution and migration", () => {
  it("migrates a v1 state and leaves base data unchanged", () => {
    const { world } = fixture();
    delete world.folderId;
    const legacy = {
      schemaVersion: 1,
      revision: 7,
      worlds: [world],
      settings: { font: 1.2, theme: "dark", density: 0.8, tutorial: 1 },
    };
    const next = normalizeState(legacy);
    expect(next.schemaVersion).toBe(2);
    expect(next.worldFolders).toEqual([]);
    expect(next.worlds).toEqual(legacy.worlds);
    expect(next.settings).toEqual(legacy.settings);
    expect(next.revision).toBe(7);
    expect(resolveContent(next.worlds[0].content, {})).toEqual(world.content);
    expect(legacy.schemaVersion).toBe(1);
  });
  it("rejects unknown future versions", () =>
    expect(() => normalizeState({ schemaVersion: 3 })).toThrow());
  it("applies single conditions, skips mismatches, and never mutates base", () => {
    const { world, a } = fixture();
    a.overrides = [override("back")];
    const base = structuredClone(world.content);
    expect(
      resolveContent(world.content, { line: "back" }).entities[0].summary,
    ).toBe("冷酷な主人公");
    expect(
      resolveContent(world.content, { line: "standard" }).entities[0].summary,
    ).toBe("明るい主人公");
    expect(resolveContent(world.content, {}).entities[0].summary).toBe(
      "明るい主人公",
    );
    expect(world.content).toEqual(base);
  });
  it("applies more specific patches last regardless of storage order and inherits other fields", () => {
    const { a } = fixture();
    a.overrides = [
      override("both", [...back, ...future], { summary: "王となった" }),
      override("back"),
      override("time", future, { age: "30歳" } as never),
    ];
    const result = resolveRecord(a, { line: "back", time: "future" });
    expect(result.summary).toBe("王となった");
    expect(result.age).toBe("30歳");
    expect(result.name).toBe(a.name);
    expect(resolveRecord(a, { line: "back" }).summary).toBe("冷酷な主人公");
  });
  it("has stable last-saved-order tie behavior, including explicit empty string", () => {
    const { a } = fixture();
    a.overrides = [override("a"), override("b", future, { summary: "" })];
    expect(resolveRecord(a, { line: "back", time: "future" }).summary).toBe("");
  });
  it("keeps patches sparse and rejects changes to identity, endpoints or images", () => {
    expect(override("a").patch).toEqual({ summary: "冷酷な主人公" });
    for (const patch of [
      { id: "other" },
      { imageIds: ["x"] },
      { relatedIds: ["x"] },
    ])
      expect(
        recordOverrideSchema.safeParse({ id: "a", conditions: back, patch })
          .success,
      ).toBe(false);
    expect(
      relationOverrideSchema.safeParse({
        id: "a",
        conditions: back,
        patch: { from: "x" },
      }).success,
    ).toBe(false);
  });
  it("hides entities, incident graph relations and all structured links", () => {
    const { world, a, b } = fixture();
    b.overrides = [
      recordOverrideSchema.parse({
        id: "hide",
        conditions: back,
        patch: { visible: false },
      }),
    ];
    a.relatedIds = [b.id];
    a.parentId = b.id;
    world.content.world.relatedIds = [b.id];
    world.content.collections = [
      {
        id: "group",
        name: "組",
        description: "",
        entityIds: [a.id, b.id],
        createdAt: now,
        updatedAt: now,
      },
    ];
    world.content.events = [
      {
        id: "event",
        title: "章",
        date: "",
        sortKey: "",
        description: "",
        entityIds: [b.id],
        createdAt: now,
        updatedAt: now,
      },
    ];
    const result = resolveContent(world.content, { line: "back" });
    expect(result.entities.map((e) => e.id)).toEqual([a.id]);
    expect(result.relations).toEqual([]);
    expect(result.entities[0].relatedIds).toEqual([]);
    expect(result.entities[0].parentId).toBe("");
    expect(result.world.relatedIds).toEqual([]);
    expect(result.collections[0].entityIds).toEqual([a.id]);
    expect(result.events[0].entityIds).toEqual([]);
  });
  it("allows more specific visible=true to restore an entity", () => {
    const { world, a } = fixture();
    a.overrides = [
      recordOverrideSchema.parse({
        id: "off",
        conditions: back,
        patch: { visible: false },
      }),
      recordOverrideSchema.parse({
        id: "on",
        conditions: [...back, ...future],
        patch: { visible: true },
      }),
    ];
    expect(
      resolveContent(world.content, {
        line: "back",
        time: "future",
      }).entities.some((e) => e.id === a.id),
    ).toBe(true);
  });
  it("resolves relation text, direction and note, hides relations from graph input", () => {
    const { world } = fixture();
    const r = world.content.relations[0];
    r.overrides = [
      relationOverrideSchema.parse({
        id: "enemy",
        conditions: back,
        patch: { type: "宿敵", direction: "directed", note: "差分メモ" },
      }),
      relationOverrideSchema.parse({
        id: "hide",
        conditions: future,
        patch: { visible: false },
      }),
    ];
    expect(
      resolveContent(world.content, { line: "back" }).relations[0],
    ).toMatchObject({
      type: "宿敵",
      direction: "directed",
      note: "差分メモ",
      from: r.from,
      to: r.to,
    });
    expect(
      resolveContent(world.content, { line: "back", time: "future" }).relations,
    ).toEqual([]);
    expect(resolveContent(world.content, {}).relations[0].type).toBe("幼馴染");
  });
  it("rejects duplicate condition sets even with different order and duplicate axes", () => {
    const { state, a } = fixture();
    a.overrides = [
      override("a", [...back, ...future]),
      override("b", [...future, ...back]),
    ];
    expect(() => validateDimensions(state)).toThrow("重複");
    expect(
      recordOverrideSchema.safeParse({
        id: "a",
        conditions: [...back, ...back],
        patch: { summary: "x" },
      }).success,
    ).toBe(false);
  });
  it("validates selections against current axes and options", () => {
    const { folder } = fixture();
    expect(
      validSelection(folder, { line: "back", time: "invalid", unknown: "x" }),
    ).toEqual({ line: "back" });
    expect(validSelection(undefined, { line: "back" })).toEqual({});
  });
  it("deleting a folder detaches every pamphlet and retains differences and snapshots", () => {
    const { state, world, a } = fixture();
    a.overrides = [override("a")];
    world.snapshots.push(snapshot(world.content));
    const before = structuredClone(world.content);
    deleteFolder(state, "folder");
    expect(state.worldFolders).toEqual([]);
    expect(state.worlds).toHaveLength(1);
    expect(world.folderId).toBeUndefined();
    expect(world.content).toEqual(before);
    expect(world.snapshots).toHaveLength(1);
    expect(world.dimensionArchive?.dimensionAxes).toHaveLength(3);
    expect(() => validateDimensions(state)).not.toThrow();
    const restored = world.dimensionArchive!;
    state.worldFolders.push(restored);
    assignFolder(state, world, restored.id);
    expect(world.dimensionArchive).toBeUndefined();
    expect(
      resolveContent(world.content, { line: "back" }).entities[0].summary,
    ).toBe("冷酷な主人公");
  });
  it("counts usage in snapshots and trash and refuses dangling option deletion", () => {
    const { state, world, a, folder } = fixture();
    a.overrides = [override("a")];
    world.snapshots.push(snapshot(world.content));
    delete a.overrides;
    world.trashed = true;
    expect(usageCount(state, "line", "back")).toBe(1);
    folder.dimensionAxes[0].options.pop();
    expect(() => validateDimensions(state)).toThrow("条件");
  });
  it("does not allow moving active or historical differences to an incompatible folder", () => {
    const { state, world, a } = fixture();
    a.overrides = [override("a")];
    state.worldFolders.push({
      ...state.worldFolders[0],
      id: "other",
      dimensionAxes: [],
    });
    expect(() => assignFolder(state, world, "other")).toThrow("履歴");
    expect(world.folderId).toBe("folder");
  });
  it("duplicates pamphlets and imports without losing folder or overrides", () => {
    const { world, a } = fixture();
    a.overrides = [override("a")];
    world.snapshots.push(snapshot(world.content));
    for (const copy of [duplicateWorld(world), importedCopy(world)]) {
      expect(copy.folderId).toBe(world.folderId);
      expect(copy.content.entities[0].overrides).toEqual(a.overrides);
      expect(copy.content.entities[0].id).not.toBe(a.id);
      expect(copy.content.relations[0].from).toBe(copy.content.entities[0].id);
    }
  });
  it("merges conflicting folder IDs without changing definitions of existing worlds", () => {
    const { state, folder, world } = fixture();
    const incoming = {
      ...structuredClone(folder),
      name: "別定義",
      dimensionAxes: [],
    };
    const copies = mergeFolderImports(state, [incoming], [world]);
    expect(state.worldFolders).toHaveLength(2);
    expect(state.worldFolders[0]).toEqual(folder);
    expect(copies[0].folderId).not.toBe(world.folderId);
  });
});

describe("Dimension storage and backup", () => {
  it("round trips v2 folders, entity and relation overrides, snapshots and detached archives", async () => {
    const { state, world, a } = fixture();
    a.overrides = [override("a")];
    world.content.relations[0].overrides = [
      relationOverrideSchema.parse({
        id: "r",
        conditions: back,
        patch: { type: "宿敵" },
      }),
    ];
    world.snapshots.push(snapshot(world.content));
    const exported = await backup(state.worlds, state.worldFolders);
    expect(exported.schemaVersion).toBe(2);
    const parsed = await parseBackup(
      new File([JSON.stringify(exported)], "new.json"),
    );
    expect(parsed.worlds).toEqual(state.worlds);
    expect(parsed.worldFolders).toEqual(state.worldFolders);
    deleteFolder(state, "folder");
    const detached = await parseBackup(
      new File(
        [JSON.stringify(await backup(state.worlds, state.worldFolders))],
        "detached.json",
      ),
    );
    expect(detached.worlds[0].dimensionArchive).toEqual(world.dimensionArchive);
  });
  it("reads old schema v1 backups with no Dimension defaults added to records", async () => {
    const { world } = fixture();
    delete world.folderId;
    const b = {
      format: "w-pam-backup",
      schemaVersion: 1,
      exportedAt: now,
      worlds: [world],
      images: [],
    };
    const parsed = await parseBackup(
      new File([JSON.stringify(b)], "legacy.json"),
    );
    expect(parsed.worldFolders).toEqual([]);
    expect(parsed.worlds).toEqual([world]);
  });
  it("migrates actual IndexedDB v1 state on read and persists v2 on the next mutation", async () => {
    const conn = await db;
    const { world } = fixture();
    delete world.folderId;
    const before = await conn.get("state", "main");
    try {
      await conn.put(
        "state",
        {
          schemaVersion: 1,
          revision: 21,
          worlds: [world],
          settings: initialState().settings,
        },
        "main",
      );
      const read = await readState();
      expect(read.schemaVersion).toBe(2);
      expect(read.worlds[0].folderId).toBeUndefined();
      await mutate(read.revision, (s) => {
        s.settings.font = 1.2;
      });
      expect((await conn.get("state", "main")).schemaVersion).toBe(2);
    } finally {
      if (before) await conn.put("state", before, "main");
      else await conn.delete("state", "main");
    }
  });
  it("rolls back attempts to delete an option used by a saved snapshot", async () => {
    const { state, world, a } = fixture();
    a.overrides = [override("a")];
    world.snapshots.push(snapshot(world.content));
    delete a.overrides;
    const before = await readState();
    const saved = await mutate(before.revision, (s) => {
      s.worlds = state.worlds;
      s.worldFolders = state.worldFolders;
    });
    await expect(
      mutate(saved.revision, (s) => {
        s.worldFolders[0].dimensionAxes[0].options.pop();
      }),
    ).rejects.toThrow("条件");
    expect(await readState()).toEqual(saved);
  });
});
