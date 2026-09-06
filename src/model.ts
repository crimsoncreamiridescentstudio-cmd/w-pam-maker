import { z } from "zod";

export const kinds = [
  "character",
  "location",
  "organization",
  "lore",
  "work",
] as const;
export type Kind = (typeof kinds)[number];
export const labels: Record<Kind, string> = {
  character: "キャラクター",
  location: "場所",
  organization: "組織",
  lore: "設定・記事",
  work: "作品",
};
export const fields: Record<string, string> = {
  name: "正式名称",
  displayName: "表示名・通称",
  reading: "読み",
  catchphrase: "一言紹介",
  summary: "概要",
  description: "説明・自由記述",
  genre: "ジャンル",
  tags: "タグ",
  memo: "作者用メモ",
  affiliation: "所属",
  species: "種族",
  age: "年齢・プロフィール",
  area: "地域・活動場所",
  members: "関連人物・メンバー",
  category: "種別",
  url: "作品URL",
  date: "制作日",
};
const text = z.string().max(50000);
export const imagePositionSchema = z.object({
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
});
export type ImagePosition = z.infer<typeof imagePositionSchema>;
export const recordSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  displayName: z.string().trim().max(100).default(""),
  reading: text.default(""),
  catchphrase: text.default(""),
  summary: text.default(""),
  description: text.default(""),
  genre: text.default(""),
  tags: text.default(""),
  memo: text.default(""),
  affiliation: text.default(""),
  species: text.default(""),
  age: text.default(""),
  area: text.default(""),
  members: text.default(""),
  category: text.default(""),
  url: z
    .string()
    .max(3000)
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      "URLはhttps://またはhttp://から入力してください",
    )
    .default(""),
  date: text.default(""),
  imageIds: z.array(z.string().min(1).max(100)).max(4),
  imagePositions: z
    .record(z.string().min(1).max(100), imagePositionSchema)
    .default({}),
  relatedIds: z
    .array(z.string().min(1).max(100))
    .max(100)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "関連項目が重複しています",
    )
    .default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RecordData = z.infer<typeof recordSchema>;
export const entitySchema = recordSchema.extend({
  kind: z.enum(kinds),
  worldId: z.string().min(1).max(100),
});
export type Entity = z.infer<typeof entitySchema>;
export const contentSchema = z.object({
  world: recordSchema,
  entities: z.array(entitySchema).max(10000),
});
export type Content = z.infer<typeof contentSchema>;
export const snapshotSchema = z.object({
  id: z.string().min(1).max(100),
  number: z.string().max(40),
  version: z.string().max(100),
  title: z.string().max(200),
  note: text,
  createdAt: z.string().datetime(),
  content: contentSchema,
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export const worldSchema = z.object({
  content: contentSchema,
  snapshots: z.array(snapshotSchema).max(1000),
  trashed: z.boolean().default(false),
});
export type World = z.infer<typeof worldSchema>;
export type Settings = {
  font: number;
  density: number;
  theme: "light" | "dark" | "system";
  tutorial: number;
  lastBackup?: string;
};
export type State = {
  schemaVersion: 1;
  revision: number;
  worlds: World[];
  settings: Settings;
};
export const initialState = (): State => ({
  schemaVersion: 1,
  revision: 0,
  worlds: [],
  settings: { font: 1, density: 1, theme: "light", tutorial: 0 },
});
export const uuid = () => crypto.randomUUID();
export function blank(name = ""): RecordData {
  const now = new Date().toISOString();
  return recordSchema.parse({
    id: uuid(),
    name: name || "無題",
    imageIds: [],
    imagePositions: {},
    relatedIds: [],
    createdAt: now,
    updatedAt: now,
  });
}
export function shownName(record: Pick<RecordData, "name" | "displayName">) {
  return record.displayName.trim() || record.name;
}
export function referenceParts(source: string) {
  return source.split(/(\[\[[^\]\n]+\]\])/g).map((part) => {
    const match = part.match(/^\[\[([^|\]]+?)(?:\|([^\]]+))?\]\]$/);
    return match
      ? {
          raw: part,
          query: match[1].trim(),
          label: (match[2] || match[1]).trim(),
        }
      : { raw: part };
  });
}
export function stamp(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
export function snapshot(
  content: Content,
  version = "",
  title = "ここまでを記録",
  note = "",
): Snapshot {
  return {
    id: uuid(),
    number: stamp(),
    version,
    title,
    note,
    createdAt: new Date().toISOString(),
    content: structuredClone(content),
  };
}
export function imageRefs(worlds: World[]) {
  return new Set(
    worlds
      .flatMap((w) => [w.content, ...w.snapshots.map((s) => s.content)])
      .flatMap((c) => [c.world, ...c.entities])
      .flatMap((r) => r.imageIds),
  );
}
export function duplicateWorld(w: World): World {
  const id = uuid();
  const now = new Date().toISOString();
  const entityIds = new Map(w.content.entities.map((e) => [e.id, uuid()]));
  const remapRelations = (ids: string[]) =>
    ids
      .map((relatedId) => entityIds.get(relatedId))
      .filter(Boolean) as string[];
  return {
    content: {
      world: {
        ...structuredClone(w.content.world),
        id,
        name: w.content.world.name + "（複製）",
        relatedIds: remapRelations(w.content.world.relatedIds),
        createdAt: now,
        updatedAt: now,
      },
      entities: w.content.entities.map((e) => ({
        ...structuredClone(e),
        id: entityIds.get(e.id)!,
        worldId: id,
        relatedIds: remapRelations(e.relatedIds),
        createdAt: now,
        updatedAt: now,
      })),
    },
    snapshots: [],
    trashed: false,
  };
}
export type Difference = {
  name: string;
  field: string;
  before: string;
  after: string;
  type: "追加" | "削除" | "変更";
};
export function diff(a: Content, b: Content): Difference[] {
  const out: Difference[] = [];
  const left = [a.world, ...a.entities],
    right = [b.world, ...b.entities];
  for (const id of new Set([...left, ...right].map((e) => e.id))) {
    const x = left.find((e) => e.id === id),
      y = right.find((e) => e.id === id);
    if (!x || !y) {
      out.push({
        name: (y || x)!.name,
        field: "項目全体",
        before: x ? x.name : "",
        after: y ? y.name : "",
        type: x ? "削除" : "追加",
      });
      continue;
    }
    for (const key of [
      ...Object.keys(fields),
      "imageIds",
      "imagePositions",
      "relatedIds",
    ] as (keyof RecordData)[]) {
      if (JSON.stringify(x[key]) !== JSON.stringify(y[key]))
        out.push({
          name: y.name,
          field:
            fields[key] ||
            (key === "relatedIds" ? "関連項目" : "画像・表示位置"),
          before: Array.isArray(x[key]) ? x[key].join(", ") : String(x[key]),
          after: Array.isArray(y[key]) ? y[key].join(", ") : String(y[key]),
          type: "変更",
        });
    }
  }
  return out;
}
