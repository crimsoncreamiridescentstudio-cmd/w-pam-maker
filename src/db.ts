import { openDB } from "idb";
import {
  initialState,
  type State,
  type World,
  imageRefs,
  worldSchema,
  uuid,
} from "./model";
import { z } from "zod";

export type ImageAsset = { id: string; blob: Blob; thumbnail: Blob };
export const db = openDB("w-pam", 1, {
  upgrade(db) {
    db.createObjectStore("state");
    db.createObjectStore("images", { keyPath: "id" });
  },
  blocked() {
    window.dispatchEvent(new Event("wpam-blocked"));
  },
});
export async function readState(): Promise<State> {
  return (await (await db).get("state", "main")) || initialState();
}
export async function mutate(
  revision: number,
  fn: (s: State) => void,
  assets: ImageAsset[] = [],
): Promise<State> {
  const conn = await db;
  const tx = conn.transaction(["state", "images"], "readwrite");
  try {
    const s: State =
      (await tx.objectStore("state").get("main")) || initialState();
    if (s.revision !== revision) {
      await tx.done;
      throw new Error(
        "別の画面で更新されました。入力をコピーして閉じ、最新状態を読み直してください。",
      );
    }
    fn(s);
    if (s.worlds.length > 100)
      throw new Error("世界は安全コピー・ごみ箱を含め100件までです。");
    for (const w of s.worlds) worldSchema.parse(w);
    s.revision++;
    await tx.objectStore("state").put(s, "main");
    for (const asset of assets) await tx.objectStore("images").put(asset);
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
export async function asset(id: string): Promise<ImageAsset | undefined> {
  return (await db).get("images", id);
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
      thumbnail: await resize(320),
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
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  worlds: z.array(worldSchema).max(100),
  images: z.array(imageSchema).max(10000),
});
export async function backup(worlds: World[]) {
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
    schemaVersion: 1,
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
  const b = backupSchema.parse(JSON.parse(await file.text()));
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
      for (const r of [c.world, ...c.entities])
        r.imageIds = r.imageIds.map((id) => remap.get(id)!);
  return { worlds: b.worlds, assets };
}
export function importedCopy(w: World): World {
  const result = structuredClone(w);
  const ids = new Map<string, string>();
  const map = (id: string) => {
    if (!ids.has(id)) ids.set(id, uuid());
    return ids.get(id)!;
  };
  for (const c of [result.content, ...result.snapshots.map((s) => s.content)]) {
    c.world.id = map(c.world.id);
    for (const e of c.entities) {
      e.id = map(e.id);
      e.worldId = c.world.id;
    }
  }
  for (const s of result.snapshots) s.id = uuid();
  result.trashed = false;
  return result;
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
