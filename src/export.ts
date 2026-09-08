import { jsPDF } from "jspdf";
import JSZip from "jszip";
import {
  type Content,
  type Kind,
  kinds,
  labels,
  fields,
  shownName,
  referenceParts,
  type RecordData,
} from "./model";
import { asset, download } from "./db";

export type ExportOptions = {
  kinds: Kind[];
  entityIds?: string[];
  order?: "kind" | "registration" | "name" | "manual";
  entityOrder?: string[];
  template?: "encyclopedia" | "character" | "tourism" | "setting";
  logo: boolean;
  separate?: boolean;
  paginationMode?: PaginationMode;
  breakThreshold?: 33 | 50 | 66;
  width: number;
};
export function orderEntities(
  entities: Content["entities"],
  order: ExportOptions["order"] = "kind",
  entityOrder: string[] = [],
): Content["entities"] {
  const indexed = entities.map((entity, index) => ({ entity, index }));
  if (order === "registration") return indexed.map(({ entity }) => entity);
  if (order === "name")
    return indexed
      .sort(
        (a, b) =>
          shownName(a.entity).localeCompare(shownName(b.entity), "ja", {
            numeric: true,
            sensitivity: "base",
          }) || a.index - b.index,
      )
      .map(({ entity }) => entity);
  if (order === "manual") {
    const positions = new Map(entityOrder.map((id, index) => [id, index]));
    return indexed
      .sort(
        (a, b) =>
          (positions.get(a.entity.id) ?? Number.MAX_SAFE_INTEGER) -
            (positions.get(b.entity.id) ?? Number.MAX_SAFE_INTEGER) ||
          a.index - b.index,
      )
      .map(({ entity }) => entity);
  }
  return indexed
    .sort(
      (a, b) =>
        kinds.indexOf(a.entity.kind) - kinds.indexOf(b.entity.kind) ||
        a.index - b.index,
    )
    .map(({ entity }) => entity);
}

export type PaginationMode = "auto" | "one-page" | "threshold" | "always";
export type EntryPlacement = { startNewPage: boolean; compact: boolean };

export function chooseEntryPlacement({
  mode,
  normalHeight,
  compactHeight,
  remaining,
  pageHeight,
  threshold,
}: {
  mode: PaginationMode;
  normalHeight: number;
  compactHeight: number;
  remaining: number;
  pageHeight: number;
  threshold: number;
}): EntryPlacement {
  if (mode === "always") return { startNewPage: true, compact: false };
  if (mode === "auto") return { startNewPage: remaining < 150, compact: false };
  if (normalHeight <= remaining) return { startNewPage: false, compact: false };
  if (mode === "one-page") {
    if (compactHeight <= remaining)
      return { startNewPage: false, compact: true };
    const nextPageShare = Math.max(0, normalHeight - remaining) / pageHeight;
    if (nextPageShare < threshold)
      return { startNewPage: false, compact: false };
    if (normalHeight <= pageHeight)
      return { startNewPage: true, compact: false };
    if (compactHeight <= pageHeight)
      return { startNewPage: true, compact: true };
    return { startNewPage: false, compact: false };
  }
  if (mode === "threshold") {
    const nextPageShare = Math.max(0, normalHeight - remaining) / pageHeight;
    return { startNewPage: nextPageShare >= threshold, compact: false };
  }
  return { startNewPage: false, compact: false };
}
// Canvas pages avoid fragile DOM screenshot heights and provide identical PNG/PDF layouts.
export async function renderPages(
  content: Content,
  options: ExportOptions,
): Promise<HTMLCanvasElement[]> {
  await document.fonts.ready;
  const glyphs = [...new Set(JSON.stringify(content))].join("");
  await Promise.all([
    document.fonts.load('500 20px "Zen Kaku Gothic Antique"', glyphs),
    document.fonts.load('700 15px "Zen Kaku Gothic Antique"', glyphs),
    document.fonts.load('500 22px "Kaisei Opti"', glyphs),
    document.fonts.load('700 32px "Kaisei Opti"', glyphs),
    document.fonts.load('400 24px "Aoboshi One"', "W-Pam"),
  ]);
  const pages: HTMLCanvasElement[] = [];
  const plainText = (value: string) =>
    referenceParts(value)
      .map((part) => part.label || part.raw)
      .join("");
  const width = options.width,
    height = Math.round((width * 297) / 210),
    scale = width / 794;
  let ctx: CanvasRenderingContext2D;
  let y = 0;
  let spacingScale = 1;
  let imageScale = 1;
  const margin = 56,
    bottom = 1050;
  const pageBodyHeight = bottom - 80;
  const imageCache = new Map<string, HTMLImageElement>();
  const themes = {
    encyclopedia: {
      bg: "#FFFBF1",
      accent: "#E9A928",
      title: "WORLD ENCYCLOPEDIA",
    },
    character: { bg: "#FFF8F4", accent: "#D9785F", title: "CHARACTER SHEET" },
    tourism: { bg: "#F5FBF8", accent: "#7FA58A", title: "TRAVEL PAMPHLET" },
    setting: { bg: "#F8F7FC", accent: "#7D78A8", title: "WORLD SETTING FILE" },
  } as const;
  const theme = themes[options.template || "encyclopedia"];
  const newPage = () => {
    if (pages.length >= 24)
      throw new Error(
        "24ページを超えます。メモリ節約のため出力する種類を減らすか、項目を個別に書き出してください。",
      );
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    ctx = c.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, 794, 1123);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(0, 0, 794, 12);
    ctx.fillStyle = "#776457";
    ctx.font = '500 13px "Zen Kaku Gothic Antique"';
    ctx.fillText(shownName(content.world).slice(0, 40), margin, 40);
    ctx.fillText(String(pages.length + 1).padStart(2, "0"), 710, 1090);
    if (options.logo) {
      ctx.font = '400 18px "Aoboshi One"';
      ctx.fillText("W-Pam", margin, 1090);
    }
    pages.push(c);
    y = 80;
  };
  const line = (
    str: string,
    font = '500 19px "Zen Kaku Gothic Antique"',
    color = "#49382D",
    leading = 32,
  ) => {
    const adjustedLeading = Math.max(1, Math.round(leading * spacingScale));
    ctx.font = font;
    let row = "";
    const flush = () => {
      if (y + adjustedLeading > bottom) newPage();
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(row, margin, y + adjustedLeading);
      y += adjustedLeading;
      row = "";
    };
    for (const ch of str) {
      if (ch === "\n") {
        flush();
        continue;
      }
      if (ctx.measureText(row + ch).width > 682 && row) flush();
      row += ch;
    }
    if (row) flush();
  };
  const loadImage = async (id: string) => {
    const cached = imageCache.get(id);
    if (cached) return cached;
    const a = await asset(id);
    if (!a) throw new Error("画像が見つかりません");
    const url = URL.createObjectURL(a.blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      imageCache.set(id, img);
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const imageSize = async (id: string, scaleValue = 1) => {
    const img = await loadImage(id);
    const r = Math.min(682 / img.width, (310 * scaleValue) / img.height);
    return { img, width: img.width * r, height: img.height * r };
  };
  const image = async (id: string) => {
    const size = await imageSize(id, imageScale);
    if (y + size.height + 24 * spacingScale > bottom) newPage();
    ctx.drawImage(
      size.img,
      margin,
      y + 18 * spacingScale,
      size.width,
      size.height,
    );
    y += size.height + 32 * spacingScale;
  };
  const rowCount = (str: string, font: string) => {
    ctx.font = font;
    let rows = 0;
    let row = "";
    const flush = () => {
      rows++;
      row = "";
    };
    for (const ch of str) {
      if (ch === "\n") {
        flush();
        continue;
      }
      if (ctx.measureText(row + ch).width > 682 && row) flush();
      row += ch;
    }
    if (row) flush();
    return rows;
  };
  const measureEntry = async (
    r: RecordData,
    heading: string,
    compact: boolean,
  ) => {
    const ss = compact ? 0.86 : 1;
    const is = compact ? 0.72 : 1;
    let total = 0;
    const addLine = (str: string, font: string, leading: number) => {
      total += rowCount(str, font) * Math.max(1, Math.round(leading * ss));
    };
    addLine(heading, '500 14px "Zen Kaku Gothic Antique"', 24);
    addLine(shownName(r), '700 32px "Kaisei Opti"', 46);
    if (r.displayName) {
      addLine("正式名称", '700 15px "Zen Kaku Gothic Antique"', 28);
      addLine(r.name, '500 19px "Zen Kaku Gothic Antique"', 32);
      total += 12 * ss;
    }
    if (r.catchphrase)
      addLine(plainText(r.catchphrase), '500 22px "Kaisei Opti"', 36);
    for (const id of r.imageIds) {
      const size = await imageSize(id, is);
      total += size.height + 32 * ss;
    }
    total += 12 * ss;
    const addField = (label: string, value: string) => {
      addLine(label, '700 15px "Zen Kaku Gothic Antique"', 28);
      addLine(plainText(value), '500 19px "Zen Kaku Gothic Antique"', 32);
      total += 12 * ss;
    };
    for (const [k, v] of Object.entries(fields)) {
      if (["name", "displayName", "memo", "catchphrase"].includes(k)) continue;
      const text = String(r[k as keyof RecordData] || "");
      if (text) addField(v, text);
    }
    for (const field of r.customFields || [])
      if (field.value) addField(field.label, field.value);
    const related = content.entities.filter((entity) =>
      r.relatedIds.includes(entity.id),
    );
    if (related.length) addField("関連項目", related.map(shownName).join("・"));
    const relations = (content.relations || []).filter(
      (relation) => relation.from === r.id || relation.to === r.id,
    );
    if (relations.length) {
      const relationText = relations
        .map((relation) => {
          const otherId = relation.from === r.id ? relation.to : relation.from;
          const other = content.entities.find(
            (entity) => entity.id === otherId,
          );
          return other
            ? `${relation.type}${relation.direction === "mutual" ? " ↔ " : relation.from === r.id ? " → " : " ← "}${shownName(other)}`
            : "";
        })
        .filter(Boolean)
        .join(" ／ ");
      addField("関係性", relationText);
    }
    return total;
  };
  const entry = async (r: RecordData, heading: string) => {
    line(heading, '500 14px "Zen Kaku Gothic Antique"', "#776457", 24);
    line(shownName(r), '700 32px "Kaisei Opti"', "#49382D", 46);
    if (r.displayName) {
      line("正式名称", '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(r.name);
      y += 12 * spacingScale;
    }
    if (r.catchphrase)
      line(plainText(r.catchphrase), '500 22px "Kaisei Opti"', "#785638", 36);
    for (const id of r.imageIds) await image(id);
    y += 12 * spacingScale;
    for (const [k, v] of Object.entries(fields)) {
      if (["name", "displayName", "memo", "catchphrase"].includes(k)) continue;
      const text = String(r[k as keyof RecordData] || "");
      if (!text) continue;
      line(v, '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(plainText(text));
      y += 12 * spacingScale;
    }
    for (const field of r.customFields || []) {
      if (!field.value) continue;
      line(field.label, '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(plainText(field.value));
      y += 12 * spacingScale;
    }
    const related = content.entities.filter((entity) =>
      r.relatedIds.includes(entity.id),
    );
    if (related.length) {
      line("関連項目", '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(related.map(shownName).join("・"));
      y += 12 * spacingScale;
    }
    const relations = (content.relations || []).filter(
      (relation) => relation.from === r.id || relation.to === r.id,
    );
    if (relations.length) {
      line("関係性", '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(
        relations
          .map((relation) => {
            const otherId =
              relation.from === r.id ? relation.to : relation.from;
            const other = content.entities.find(
              (entity) => entity.id === otherId,
            );
            return other
              ? `${relation.type}${relation.direction === "mutual" ? " ↔ " : relation.from === r.id ? " → " : " ← "}${shownName(other)}`
              : "";
          })
          .filter(Boolean)
          .join(" ／ "),
      );
      y += 12 * spacingScale;
    }
  };
  newPage();
  await entry(content.world, theme.title);
  const paginationMode =
    options.paginationMode || (options.separate ? "always" : "auto");
  const threshold = (options.breakThreshold || 50) / 100;
  const selectedIds =
    options.entityIds || content.entities.map((entity) => entity.id);
  const exportEntities = orderEntities(
    content.entities.filter(
      (entity) =>
        options.kinds.includes(entity.kind) && selectedIds.includes(entity.id),
    ),
    options.order,
    options.entityOrder,
  );
  for (const e of exportEntities) {
    const gap = y > 80 ? 35 : 0;
    const normalHeight = await measureEntry(e, labels[e.kind], false);
    const compactHeight = await measureEntry(e, labels[e.kind], true);
    const placement = chooseEntryPlacement({
      mode: paginationMode,
      normalHeight,
      compactHeight,
      remaining: Math.max(
        0,
        paginationMode === "auto" ? bottom - y : bottom - y - gap,
      ),
      pageHeight: pageBodyHeight,
      threshold,
    });
    if (placement.startNewPage) newPage();
    else y += gap;
    spacingScale = placement.compact ? 0.86 : 1;
    imageScale = placement.compact ? 0.72 : 1;
    await entry(e, labels[e.kind]);
    spacingScale = 1;
    imageScale = 1;
  }
  return pages;
}
const png = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG生成に失敗しました"))),
      "image/png",
    ),
  );
export async function savePNG(pages: HTMLCanvasElement[], name: string) {
  if (pages.length === 1) return download(await png(pages[0]), name + ".png");
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i++)
    zip.file(`${String(i + 1).padStart(3, "0")}.png`, await png(pages[i]));
  download(await zip.generateAsync({ type: "blob" }), name + "-PNG.zip");
}
export async function savePDF(pages: HTMLCanvasElement[], name: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  for (let i = 0; i < pages.length; i++) {
    if (i) pdf.addPage();
    pdf.addImage(
      pages[i].toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      210,
      297,
      undefined,
      "FAST",
    );
  }
  download(pdf.output("blob"), name + ".pdf");
}
