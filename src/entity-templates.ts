import { type EntityTemplate, type Kind, uuid } from "./model";

export type TemplateDefinition = Pick<
  EntityTemplate,
  "id" | "name" | "kind" | "fields"
> & {
  builtin?: boolean;
};

const template = (
  id: string,
  name: string,
  kind: Kind,
  labels: string[],
): TemplateDefinition => ({
  id,
  name,
  kind,
  builtin: true,
  fields: labels.map((label, index) => ({ id: `${id}-${index}`, label })),
});

export const builtinEntityTemplates: TemplateDefinition[] = [
  template("builtin-character-story", "物語キャラクター", "character", [
    "物語上の役割",
    "目的",
    "葛藤",
    "秘密",
    "転機",
    "成長・変化",
  ]),
  template("builtin-character-profile", "日常プロフィール", "character", [
    "性格",
    "外見・服装",
    "誕生日",
    "好きなもの",
    "苦手なもの",
    "得意なこと",
    "大切なもの",
  ]),
  template("builtin-character-battle", "戦闘・能力", "character", [
    "クラス・役職",
    "能力",
    "能力の条件・代償",
    "弱点",
    "装備",
    "戦い方",
  ]),
  template("builtin-character-voice", "口調・演技", "character", [
    "一人称",
    "二人称",
    "話し方の特徴",
    "感情が出る場面",
    "よく使う言葉",
  ]),
  template("builtin-location-setting", "場所設定", "location", [
    "景観",
    "気候・環境",
    "文化・暮らし",
    "名物",
    "危険・問題",
    "アクセス",
  ]),
  template("builtin-organization-setting", "組織設定", "organization", [
    "目的・理念",
    "規模",
    "拠点",
    "役職・階級",
    "活動内容",
    "対立・協力先",
  ]),
  template("builtin-lore-setting", "設定記事", "lore", [
    "成立・由来",
    "仕組み",
    "制約・例外",
    "社会への影響",
    "物語での扱い",
  ]),
  template("builtin-work-setting", "作品情報", "work", [
    "あらすじ",
    "テーマ",
    "対象読者",
    "見どころ",
    "公開・頒布情報",
  ]),
  template("builtin-term-setting", "用語解説", "term", [
    "意味",
    "読み方・別名",
    "初出・由来",
    "使用例",
    "注意・例外",
  ]),
];

export function templatesForKind(
  kind: Kind,
  custom: EntityTemplate[],
): TemplateDefinition[] {
  return [
    ...builtinEntityTemplates.filter((item) => item.kind === kind),
    ...custom
      .filter((item) => item.kind === kind)
      .map((item) => ({ ...item, builtin: false })),
  ];
}

export function instantiateTemplateFields(
  fields: TemplateDefinition["fields"],
) {
  return fields.map((field) => ({ id: uuid(), label: field.label, value: "" }));
}

export function mergeEntityTemplateImports(
  current: EntityTemplate[],
  incoming: EntityTemplate[],
) {
  const next = structuredClone(current);
  for (const source of incoming) {
    const exact = next.find(
      (item) =>
        item.id === source.id &&
        JSON.stringify(item) === JSON.stringify(source),
    );
    if (exact) continue;
    const conflict = next.some(
      (item) =>
        item.id === source.id ||
        (item.kind === source.kind && item.name === source.name),
    );
    const now = new Date().toISOString();
    next.push(
      conflict
        ? {
            ...structuredClone(source),
            id: uuid(),
            name: `${source.name}（読み込み）`.slice(0, 100),
            createdAt: now,
            updatedAt: now,
          }
        : structuredClone(source),
    );
  }
  return next;
}
