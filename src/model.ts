import { z } from "zod";

export const kinds = [
  "character",
  "location",
  "organization",
  "lore",
  "work",
  "term",
] as const;
export type Kind = (typeof kinds)[number];
export const labels: Record<Kind, string> = {
  character: "キャラクター",
  location: "場所",
  organization: "組織",
  lore: "設定・記事",
  work: "作品",
  term: "用語辞典",
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
  dialogueSamples: "セリフ・口調サンプル",
};
const text = z.string().max(50000);
export const imagePositionSchema = z.object({
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
});
export type ImagePosition = z.infer<typeof imagePositionSchema>;
const baseRecordSchema = z.object({
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
  dialogueSamples: text.default(""),
  favorite: z.boolean().default(false),
  pinned: z.boolean().default(false),
  parentId: z.string().max(100).default(""),
  customFields: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        label: z.string().trim().min(1).max(80),
        value: text,
      }),
    )
    .max(30)
    .default([]),
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
export const dimensionConditionSchema = z.object({ axisId: z.string().min(1).max(100), optionId: z.string().min(1).max(100) });
const conditionsSchema = z.array(dimensionConditionSchema).min(1).max(20).refine(c => new Set(c.map(x => x.axisId)).size === c.length, "同じ軸を複数条件に指定できません");
export const dimensionAxisSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100),
  options: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100) })).min(1).max(100)
    .refine(o => new Set(o.map(x => x.id)).size === o.length, "選択肢IDが重複しています"),
});
export const worldFolderSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100), description: text.default(""),
  dimensionAxes: z.array(dimensionAxisSchema).max(20).refine(a => new Set(a.map(x => x.id)).size === a.length, "軸IDが重複しています"),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type DimensionAxis = z.infer<typeof dimensionAxisSchema>;
export type WorldFolder = z.infer<typeof worldFolderSchema>;
export type DimensionCondition = z.infer<typeof dimensionConditionSchema>;
export type DimensionSelection = Record<string, string>;
// Remove defaults before making fields optional: zod defaults inside partial()
// would otherwise erase inherited fields with empty strings during parsing.
function withoutDefaults<T extends z.ZodRawShape>(shape: T) {
  return Object.fromEntries(Object.entries(shape).map(([key, schema]) => [key, schema instanceof z.ZodDefault ? schema.removeDefault() : schema])) as {
    [K in keyof T]: T[K] extends z.ZodDefault<infer U> ? U : T[K]
  };
}
// Identity, links and image ownership stay in the base record in v1.
export const dimensionRecordPatchSchema = z.object(withoutDefaults(baseRecordSchema.omit({
  id: true, createdAt: true, updatedAt: true, imageIds: true, imagePositions: true,
  relatedIds: true, parentId: true, favorite: true, pinned: true,
}).shape)).partial().extend({ visible: z.boolean().optional() }).strict();
export const recordOverrideSchema = z.object({
  id: z.string().min(1).max(100), conditions: conditionsSchema, patch: dimensionRecordPatchSchema,
});
export const recordSchema = baseRecordSchema.extend({ overrides: z.array(recordOverrideSchema).max(1000).optional() });
export type RecordData = z.infer<typeof recordSchema>;
export const entitySchema = recordSchema.extend({
  kind: z.enum(kinds),
  worldId: z.string().min(1).max(100),
});
export type Entity = z.infer<typeof entitySchema>;
const baseRelationSchema = z.object({
  id: z.string().min(1).max(100),
  from: z.string().min(1).max(100),
  to: z.string().min(1).max(100),
  type: z.string().trim().min(1).max(80),
  direction: z.enum(["directed", "mutual"]),
  note: text.default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const dimensionRelationPatchSchema = z.object(withoutDefaults(baseRelationSchema.pick({ type: true, direction: true, note: true }).shape)).partial().extend({ visible: z.boolean().optional() }).strict();
export const relationOverrideSchema = z.object({ id: z.string().min(1).max(100), conditions: conditionsSchema, patch: dimensionRelationPatchSchema });
export const relationSchema = baseRelationSchema.extend({ overrides: z.array(relationOverrideSchema).max(1000).optional() });
export type Relation = z.infer<typeof relationSchema>;
export const collectionSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  description: text.default(""),
  entityIds: z.array(z.string().min(1).max(100)).max(10000).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Collection = z.infer<typeof collectionSchema>;
export const eventSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  date: z.string().max(100).default(""),
  sortKey: z.string().max(100).default(""),
  description: text.default(""),
  entityIds: z.array(z.string().min(1).max(100)).max(1000).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TimelineEvent = z.infer<typeof eventSchema>;
export const contentSchema = z.object({
  world: recordSchema,
  entities: z.array(entitySchema).max(10000),
  relations: z.array(relationSchema).max(50000).default([]),
  collections: z.array(collectionSchema).max(5000).default([]),
  events: z.array(eventSchema).max(10000).default([]),
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
  folderId: z.string().min(1).max(100).optional(),
  dimensionArchive: worldFolderSchema.optional(),
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
  schemaVersion: 2;
  worldFolders: WorldFolder[];
  revision: number;
  worlds: World[];
  settings: Settings;
};
export const initialState = (): State => ({
  schemaVersion: 2,
  worldFolders: [],
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
    customFields: [],
    createdAt: now,
    updatedAt: now,
  });
}
export function shownName(record: Pick<RecordData, "name" | "displayName">) {
  return record.displayName.trim() || record.name;
}
export function relationDisplayLines(label: string, lineLength = 10, maxLines = 2) {
  const chars = Array.from(label.trim());
  const limit = lineLength * maxLines;
  const clipped = chars.slice(0, limit);
  if (chars.length > limit && clipped.length) clipped[clipped.length - 1] = "…";
  return Array.from({ length: maxLines }, (_, index) =>
    clipped.slice(index * lineLength, (index + 1) * lineLength).join(""),
  ).filter(Boolean);
}
export function relationDisplayLabel(label: string) {
  return relationDisplayLines(label).join("\n");
}
export function relationCurveOffsets(relations: Pick<Relation, "id" | "from" | "to">[]) {
  const groups = new Map<string, Pick<Relation, "id" | "from" | "to">[]>();
  for (const relation of relations) {
    const key = [relation.from, relation.to].sort().join("::");
    groups.set(key, [...(groups.get(key) || []), relation]);
  }
  const offsets = new Map<string, number>();
  for (const group of groups.values())
    group.forEach((relation, index) =>
      offsets.set(
        relation.id,
        group.length === 1 ? 0 : (index - (group.length - 1) / 2) * 96,
      ),
    );
  return offsets;
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
    folderId: w.folderId,
    dimensionArchive: w.dimensionArchive ? structuredClone(w.dimensionArchive) : undefined,
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
        parentId: e.parentId ? entityIds.get(e.parentId) || "" : "",
        createdAt: now,
        updatedAt: now,
      })),
      relations: (w.content.relations || []).map((relation) => ({
        ...structuredClone(relation),
        id: uuid(),
        from: entityIds.get(relation.from)!,
        to: entityIds.get(relation.to)!,
        createdAt: now,
        updatedAt: now,
      })),
      collections: (w.content.collections || []).map((collection) => ({
        ...structuredClone(collection),
        id: uuid(),
        entityIds: remapRelations(collection.entityIds),
        createdAt: now,
        updatedAt: now,
      })),
      events: (w.content.events || []).map((event) => ({
        ...structuredClone(event),
        id: uuid(),
        entityIds: remapRelations(event.entityIds),
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
      "dialogueSamples",
      "favorite",
      "pinned",
      "parentId",
      "customFields",
      "overrides",
    ] as (keyof RecordData)[]) {
      if (JSON.stringify(x[key]) !== JSON.stringify(y[key]))
        out.push({
          name: y.name,
          field:
            fields[key] || (key === "overrides" ? "Dimension差分" : "") ||
            (key === "relatedIds" ? "関連項目" : "画像・表示位置"),
          before: Array.isArray(x[key]) ? x[key].join(", ") : String(x[key]),
          after: Array.isArray(y[key]) ? y[key].join(", ") : String(y[key]),
          type: "変更",
        });
    }
  }
  for (const [key, label] of [
    ["relations", "関係性"],
    ["collections", "グループ"],
    ["events", "年表"],
  ] as const) {
    const leftValue = a[key];
    const rightValue = b[key];
    if (JSON.stringify(leftValue) !== JSON.stringify(rightValue))
      out.push({
        name: shownName(b.world),
        field: label,
        before: `${leftValue.length}件`,
        after: `${rightValue.length}件`,
        type: "変更",
      });
  }
  return out;
}
