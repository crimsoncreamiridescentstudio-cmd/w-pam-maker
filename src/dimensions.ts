import {
  worldFolderSchema,
  worldSchema,
  initialState,
  type State,
  type Content,
  type World,
  type WorldFolder,
  type DimensionCondition,
  type DimensionSelection,
} from "./model";
import { z } from "zod";

export type Override = {
  id: string;
  conditions: DimensionCondition[];
  patch: Record<string, unknown>;
};
export const conditionKey = (conditions: DimensionCondition[]) =>
  JSON.stringify(
    conditions
      .map((c) => [c.axisId, c.optionId])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

export function transferOverride(overrides: Override[], sourceId: string, destination: DimensionCondition[], mode: "move" | "copy", hideSource = false): Override[] {
  const source = overrides.find(o => o.id === sourceId);
  if (!source) throw new Error("移動する姿が見つかりません。");
  if (!destination.length || new Set(destination.map(c => c.axisId)).size !== destination.length)
    throw new Error("移動先の条件を選んでください。");
  if (overrides.some(o => conditionKey(o.conditions) === conditionKey(destination)))
    throw new Error("移動先には同じ条件の姿があります。先にその姿を編集・整理してください。上書きはしません。");
  const next = structuredClone(overrides);
  const index = next.findIndex(o => o.id === sourceId);
  const transferred = { ...structuredClone(source), id: mode === "copy" ? crypto.randomUUID() : source.id, conditions: structuredClone(destination) };
  if (mode === "copy") next.push(transferred);
  else {
    next[index] = transferred;
    if (hideSource) next.push({id: crypto.randomUUID(), conditions: structuredClone(source.conditions), patch: {visible: false}});
  }
  return next;
}

export function dimensionLabel(folder: WorldFolder, selection: DimensionSelection): string {
  return folder.dimensionAxes.filter(a => selection[a.id]).map(a => `${a.name}：${a.options.find(o => o.id === selection[a.id])?.name || "不明"}`).join(" ＋ ") || "基本データ";
}
export function validSelection(
  folder: WorldFolder | undefined,
  selection: DimensionSelection,
): DimensionSelection {
  return Object.fromEntries(
    (folder?.dimensionAxes || []).flatMap((a) =>
      a.options.some((o) => o.id === selection[a.id])
        ? [[a.id, selection[a.id]]]
        : [],
    ),
  );
}
export function resolveRecord<T extends { overrides?: Override[] }>(
  base: T,
  selection: DimensionSelection,
): T & { visible?: boolean } {
  const matching = (base.overrides || []).filter(
    (o) =>
      o.conditions.length &&
      o.conditions.every((c) => selection[c.axisId] === c.optionId),
  );
  // Equal specificity: stable saved order, later entry wins. UI reports overlap.
  matching.sort((a, b) => a.conditions.length - b.conditions.length);
  return Object.assign({}, base, ...matching.map((o) => o.patch));
}
export function resolveContent(
  content: Content,
  selection: DimensionSelection,
): Content {
  if (!Object.keys(selection).length) return content;
  const entities = content.entities
    .map((e) => resolveRecord(e, selection))
    .filter((e) => e.visible !== false);
  const ids = new Set(entities.map((e) => e.id));
  const cleanRecord = <T extends Content["world"]>(r: T): T => ({
    ...r,
    relatedIds: r.relatedIds.filter((id) => ids.has(id)),
    parentId: ids.has(r.parentId) ? r.parentId : "",
  });
  return {
    ...content,
    world: cleanRecord(resolveRecord(content.world, selection)),
    entities: entities.map(cleanRecord),
    relations: content.relations
      .map((r) => resolveRecord(r, selection))
      .filter((r) => r.visible !== false && ids.has(r.from) && ids.has(r.to)),
    collections: content.collections.map((c) => ({
      ...c,
      entityIds: c.entityIds.filter((id) => ids.has(id)),
    })),
    events: content.events.map((e) => ({
      ...e,
      entityIds: e.entityIds.filter((id) => ids.has(id)),
    })),
  };
}
export function allOverrides(world: World): Override[] {
  return [world.content, ...world.snapshots.map((s) => s.content)].flatMap(
    (c) =>
      [c.world, ...c.entities, ...(c.relations || [])].flatMap(
        (r) => r.overrides || [],
      ),
  );
}
export function usageCount(
  state: Pick<State, "worlds">,
  axisId: string,
  optionId?: string,
): number {
  return state.worlds
    .flatMap(allOverrides)
    .filter((o) =>
      o.conditions.some(
        (c) => c.axisId === axisId && (!optionId || c.optionId === optionId),
      ),
    ).length;
}
export function assignFolder(state: State, world: World, folderId?: string) {
  const previous =
    state.worldFolders.find((f) => f.id === world.folderId) ||
    world.dimensionArchive;
  const next = state.worldFolders.find((f) => f.id === folderId);
  if (folderId && !next) throw new Error("世界フォルダが見つかりません");
  if (
    next &&
    allOverrides(world).some((o) =>
      o.conditions.some(
        (c) =>
          !next.dimensionAxes.some(
            (a) =>
              a.id === c.axisId && a.options.some((v) => v.id === c.optionId),
          ),
      ),
    )
  )
    throw new Error(
      "差分や履歴で使用中のDimensionが移動先にありません。元のフォルダへ戻すか、パンフレットを複製して差分・履歴を整理してください。",
    );
  world.folderId = folderId;
  world.dimensionArchive =
    !next && previous && allOverrides(world).length
      ? structuredClone(previous)
      : undefined;
}
export function deleteFolder(state: State, id: string) {
  state.worlds
    .filter((w) => w.folderId === id)
    .forEach((w) => assignFolder(state, w));
  state.worldFolders = state.worldFolders.filter((f) => f.id !== id);
}
export function validateDimensions(
  state: Pick<State, "worlds" | "worldFolders">,
) {
  const folders = z.array(worldFolderSchema).max(100).parse(state.worldFolders);
  if (new Set(folders.map((f) => f.id)).size !== folders.length)
    throw new Error("世界フォルダIDが重複しています");
  for (const world of state.worlds) {
    const folder =
      folders.find((f) => f.id === world.folderId) ||
      (!world.folderId ? world.dimensionArchive : undefined);
    if (world.folderId && !folder)
      throw new Error("所属世界フォルダが見つかりません");
    for (const content of [
      world.content,
      ...world.snapshots.map((s) => s.content),
    ]) {
      for (const record of [
        content.world,
        ...content.entities,
        ...(content.relations || []),
      ]) {
        const overrides = record.overrides || [];
        if (
          new Set(overrides.map((o) => o.id)).size !== overrides.length ||
          new Set(overrides.map((o) => conditionKey(o.conditions))).size !==
            overrides.length
        )
          throw new Error("差分IDまたは同一条件セットが重複しています");
        for (const override of overrides)
          for (const condition of override.conditions)
            if (
              !folder?.dimensionAxes.some(
                (a) =>
                  a.id === condition.axisId &&
                  a.options.some((o) => o.id === condition.optionId),
              )
            )
              throw new Error(
                "差分のDimension条件が定義に存在しません（履歴を含む）",
              );
      }
    }
  }
}
export function normalizeState(raw?: unknown): State {
  if (!raw) return initialState();
  const source = z
    .object({
      schemaVersion: z.union([z.literal(1), z.literal(2)]),
      revision: z.number().int().nonnegative().default(0),
      worlds: z.array(worldSchema).max(100).default([]),
      worldFolders: z.array(worldFolderSchema).max(100).default([]),
      settings: z
        .object({
          font: z.number(),
          density: z.number(),
          theme: z.enum(["light", "dark", "system"]),
          tutorial: z.number(),
          lastBackup: z.string().optional(),
        })
        .partial()
        .default({}),
    })
    .parse(raw);
  const state: State = {
    ...source,
    schemaVersion: 2,
    settings: { ...initialState().settings, ...source.settings },
  };
  validateDimensions(state);
  return state;
}
// Import folders without ever replacing the definitions used by other pamphlets.
export function mergeFolderImports(
  state: State,
  incoming: WorldFolder[],
  worlds: World[],
): World[] {
  const idMap = new Map<string, string>();
  for (const f of incoming) {
    const existing = state.worldFolders.find((x) => x.id === f.id);
    if (!existing) {
      state.worldFolders.push(structuredClone(f));
      idMap.set(f.id, f.id);
    } else if (JSON.stringify(existing) === JSON.stringify(f))
      idMap.set(f.id, f.id);
    else {
      const copy = {
        ...structuredClone(f),
        id: crypto.randomUUID(),
        name: f.name + "（読込）",
      };
      state.worldFolders.push(copy);
      idMap.set(f.id, copy.id);
    }
  }
  return worlds.map((w) => ({
    ...structuredClone(w),
    folderId: w.folderId ? idMap.get(w.folderId) : undefined,
  }));
}
