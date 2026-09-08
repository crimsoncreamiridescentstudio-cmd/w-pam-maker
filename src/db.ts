import { openDB } from "idb";
import {
  initialState,
  type State,
  type World,
  imageRefs,
  worldSchema,
  worldFolderSchema,
  type WorldFolder,
  entityTemplateSchema,
  type EntityTemplate,
  uuid,
} from "./model";
import { z } from "zod";
import { normalizeState, validateDimensions } from "./dimensions";
export { normalizeState } from "./dimensions";

export type ImageAsset = {
  id: string;
  blob: Blob;
  thumbnail: Blob;
  thumbnailVersion?: number;
};
export const db = openDB("w-pam", 1, {
  upgrade(db) {
    db.createObjectStore("state");
    db.createObjectStore("images", { keyPath: "id" });
  },
  blocked() {
    window.dispatchEvent(new Event("wpam-blocked"));
  },
});
const validateRelations = (worlds: World[]) => {
  for (const w of worlds)
    for (const content of [w.content, ...w.snapshots.map((s) => s.content)]) {
      const ids = new Set(content.entities.map((e) => e.id));
      for (const record of [content.world, ...content.entities])
        if (record.relatedIds.some((id) => !ids.has(id) || id === record.id))
          throw new Error("存在しない項目、または自分自身への関連があります");
      for (const entity of content.entities)
        if (
          entity.parentId &&
          (!ids.has(entity.parentId) || entity.parentId === entity.id)
        )
          throw new Error("親項目の指定が不正です");
      for (const relation of content.relations || [])
        if (
          !ids.has(relation.from) ||
          !ids.has(relation.to) ||
          relation.from === relation.to
        )
          throw new Error("関係性の参照先が不正です");
      for (const collection of content.collections || [])
        if (collection.entityIds.some((id) => !ids.has(id)))
          throw new Error("グループの参照先が不正です");
      for (const event of content.events || [])
        if (event.entityIds.some((id) => !ids.has(id)))
          throw new Error("出来事の参照先が不正です");
    }
};
export async function readState(): Promise<State> {
  return normalizeState(await (await db).get("state", "main"));
}
export async function mutate(
  revision: number,
  fn: (s: State) => void,
  assets: ImageAsset[] = [],
  options: { pruneUnusedImages?: boolean } = {},
): Promise<State> {
  const conn = await db;
  const tx = conn.transaction(["state", "images"], "readwrite");
  try {
    const s = normalizeState(await tx.objectStore("state").get("main"));
    if (s.revision !== revision) {
      await tx.done;
      throw new Error(
        "別の画面で更新されました。入力をコピーして閉じ、最新状態を読み直してください。",
      );
    }
    fn(s);
    if (s.worlds.length > 100)
      throw new Error("世界は安全コピー・ごみ箱を含め100件までです。");
    if (s.entityTemplates.length > 200)
      throw new Error("自作テンプレートは200件までです。");
    if (
      new Set(s.entityTemplates.map((item) => item.id)).size !==
      s.entityTemplates.length
    )
      throw new Error("自作テンプレートのIDが重複しています。");
    for (const item of s.entityTemplates) entityTemplateSchema.parse(item);
    for (const w of s.worlds) worldSchema.parse(w);
    validateRelations(s.worlds);
    validateDimensions(s);
    s.revision++;
    await tx.objectStore("state").put(s, "main");
    for (const asset of assets) await tx.objectStore("images").put(asset);
    if (options.pruneUnusedImages) {
      const referenced = imageRefs(s.worlds);
      const imageStore = tx.objectStore("images");
      for (const key of await imageStore.getAllKeys())
        if (!referenced.has(String(key))) await imageStore.delete(key);
    }
    await tx.done;
    return s;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Transaction may already be complete. */
    }
    await tx.done.catch(() => {});
    throw error;
  }
}

export function permanentlyDeleteWorld(revision: number, worldId: string) {
  return mutate(
    revision,
    (s) => {
      const index = s.worlds.findIndex((w) => w.content.world.id === worldId);
      if (index < 0) throw new Error("削除する世界が見つかりません");
      if (!s.worlds[index].trashed)
        throw new Error("完全削除できるのはごみ箱の世界だけです");
      s.worlds.splice(index, 1);
    },
    [],
    { pruneUnusedImages: true },
  );
}
const thumbnailUpgrades = new Map<string, Promise<ImageAsset>>();
async function resizeBlob(blob: Blob, max: number, quality = 0.9) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
    const rate = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * rate));
    canvas.height = Math.max(1, Math.round(img.height * rate));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("画像変換に失敗しました")),
        "image/webp",
        quality,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function asset(
  id: string,
  highQualityThumbnail = false,
): Promise<ImageAsset | undefined> {
  const conn = await db;
  const current = await conn.get("images", id);
  if (!current || !highQualityThumbnail || current.thumbnailVersion === 2)
    return current;
  if (!thumbnailUpgrades.has(id))
    thumbnailUpgrades.set(
      id,
      (async () => {
        const next = {
          ...current,
          thumbnail: await resizeBlob(current.blob, 960),
          thumbnailVersion: 2,
        };
        await conn.put("images", next);
        return next;
      })()
        .catch(() => current)
        .finally(() => thumbnailUpgrades.delete(id)),
    );
  return thumbnailUpgrades.get(id);
}
export async function prepareImage(file: File): Promise<ImageAsset> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("画像は1枚20MBまでです。縮小してから選んでください。");
  if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type))
    throw new Error(
      "PNG・JPEG・WebP・GIF・AVIFを選んでください。HEICはJPEG等へ変換してください。",
    );
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
    if (img.width * img.height > 50000000)
      throw new Error("画像の縦横サイズが大きすぎます。縮小してください。");
    const resize = async (max: number) => {
      const rate = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * rate));
      c.height = Math.max(1, Math.round(img.height * rate));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      return new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("画像変換に失敗しました"))),
          "image/webp",
          0.85,
        ),
      );
    };
    return {
      id: uuid(),
      blob: await resize(1600),
      thumbnail: await resize(960),
      thumbnailVersion: 2,
    };
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "画像を読み込めませんでした",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
const encode = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const f = new FileReader();
    f.onload = () => resolve(String(f.result));
    f.onerror = reject;
    f.readAsDataURL(blob);
  });
const imageSchema = z.object({
  id: z.string().min(1).max(100),
  data: z
    .string()
    .max(8000000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
});
export const backupSchema = z.object({
  format: z.literal("w-pam-backup"),
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  worldFolders: z.array(worldFolderSchema).max(100).default([]),
  entityTemplates: z.array(entityTemplateSchema).max(200).default([]),
  exportedAt: z.string().datetime(),
  worlds: z.array(worldSchema).max(100),
  images: z.array(imageSchema).max(10000),
});
export async function backup(
  worlds: World[],
  worldFolders: WorldFolder[] = [],
  entityTemplates: EntityTemplate[] = [],
) {
  validateDimensions({ worlds, worldFolders });
  const images = [];
  for (const id of imageRefs(worlds)) {
    const a = await asset(id);
    if (!a)
      throw new Error(
        "参照先の画像が見つかりません。バックアップを中断しました。",
      );
    images.push({ id, data: await encode(a.blob) });
  }
  return {
    format: "w-pam-backup",
    schemaVersion: 3,
    worldFolders: structuredClone(worldFolders),
    entityTemplates: structuredClone(entityTemplates),
    exportedAt: new Date().toISOString(),
    worlds: structuredClone(worlds),
    images,
  };
}
export async function parseBackup(file: File) {
  if (file.size > 100 * 1024 * 1024)
    throw new Error(
      "読み込めるバックアップは100MBまでです。世界ごとに分けてください。",
    );
  const raw = JSON.parse(await file.text());
  const b = backupSchema.parse(raw);
  // Empty v0.2 collections remain absent in the returned copy; importing still
  // normalizes them on the next state read. This keeps old backup round trips exact.
  b.worlds.forEach((world, worldIndex) => {
    const rawWorld = raw.worlds?.[worldIndex];
    for (const [content, rawContent] of [
      [world.content, rawWorld?.content],
      ...world.snapshots.map((item, index) => [
        item.content,
        rawWorld?.snapshots?.[index]?.content,
      ]),
    ] as const) {
      if (rawContent && !("relations" in rawContent))
        delete (content as Partial<typeof content>).relations;
      if (rawContent && !("collections" in rawContent))
        delete (content as Partial<typeof content>).collections;
      if (rawContent && !("events" in rawContent))
        delete (content as Partial<typeof content>).events;
    }
  });
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (
    !unique(b.worlds.map((w) => w.content.world.id)) ||
    !unique(b.images.map((i) => i.id))
  )
    throw new Error("重複IDがあるバックアップです");
  for (const w of b.worlds) {
    if (!unique(w.snapshots.map((s) => s.id)))
      throw new Error("履歴IDが重複しています");
    for (const c of [w.content, ...w.snapshots.map((s) => s.content)]) {
      if (
        c.world.id !== w.content.world.id ||
        c.entities.some((e) => e.worldId !== c.world.id) ||
        !unique([c.world.id, ...c.entities.map((e) => e.id)])
      )
        throw new Error("世界と項目の関連が不正です");
    }
  }
  validateRelations(b.worlds);
  validateDimensions(b);
  const ids = new Set(b.images.map((i) => i.id));
  if ([...imageRefs(b.worlds)].some((id) => !ids.has(id)))
    throw new Error("バックアップに必要な画像が不足しています");
  const assets: ImageAsset[] = [];
  const remap = new Map<string, string>();
  for (const i of b.images) {
    const blob = await (await fetch(i.data)).blob();
    const a = await prepareImage(
      new File([blob], "restore", { type: blob.type }),
    );
    assets.push({ ...a, blob });
    remap.set(i.id, a.id);
  }
  for (const w of b.worlds)
    for (const c of [w.content, ...w.snapshots.map((s) => s.content)])
      for (const r of [c.world, ...c.entities]) {
        r.imageIds = r.imageIds.map((id) => remap.get(id)!);
        r.imagePositions = Object.fromEntries(
          Object.entries(r.imagePositions).flatMap(([id, position]) => {
            const mapped = remap.get(id);
            return mapped ? [[mapped, position]] : [];
          }),
        );
      }
  return {
    worlds: b.worlds,
    worldFolders: b.worldFolders,
    entityTemplates: b.entityTemplates,
    assets,
  };
}
export function importedCopy(
  w: World,
  options: { preserveTrash?: boolean } = {},
): World {
  const result = structuredClone(w);
  const ids = new Map<string, string>();
  const map = (id: string) => {
    if (!ids.has(id)) ids.set(id, uuid());
    return ids.get(id)!;
  };
  for (const c of [result.content, ...result.snapshots.map((s) => s.content)]) {
    c.relations ||= [];
    c.collections ||= [];
    c.events ||= [];
    c.world.id = map(c.world.id);
    for (const e of c.entities) {
      e.id = map(e.id);
      e.worldId = c.world.id;
    }
    for (const record of [c.world, ...c.entities])
      record.relatedIds = record.relatedIds.map(map);
    for (const entity of c.entities)
      entity.parentId = entity.parentId ? map(entity.parentId) : "";
    for (const relation of c.relations || []) {
      relation.id = uuid();
      relation.from = map(relation.from);
      relation.to = map(relation.to);
    }
    for (const collection of c.collections || []) {
      collection.id = uuid();
      collection.entityIds = collection.entityIds.map(map);
    }
    for (const event of c.events || []) {
      event.id = uuid();
      event.entityIds = event.entityIds.map(map);
    }
  }
  for (const s of result.snapshots) s.id = uuid();
  if (!options.preserveTrash) result.trashed = false;
  return result;
}

export function applyWorldImports(
  state: State,
  worlds: World[],
  mode: "copy" | "replace",
) {
  for (const world of worlds) {
    const index = state.worlds.findIndex(
      (current) => current.content.world.id === world.content.world.id,
    );
    if (mode === "replace") {
      if (index >= 0) {
        const safety = importedCopy(state.worlds[index]);
        safety.content.world.name += "（読み込み前の安全コピー）";
        safety.trashed = true;
        state.worlds.push(safety);
        state.worlds[index] = world;
      } else {
        state.worlds.push(world);
      }
    } else {
      state.worlds.push(importedCopy(world, { preserveTrash: true }));
    }
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
