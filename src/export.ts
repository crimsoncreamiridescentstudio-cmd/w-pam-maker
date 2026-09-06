import { jsPDF } from "jspdf";
import JSZip from "jszip";
import {
  type Content,
  type Kind,
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
  template?: "encyclopedia" | "character" | "tourism" | "setting";
  logo: boolean;
  separate: boolean;
  width: number;
};
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
  const margin = 56,
    bottom = 1050;
  const themes = {
    encyclopedia: { bg: "#FFFBF1", accent: "#E9A928", title: "WORLD ENCYCLOPEDIA" },
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
    ctx.font = font;
    let row = "";
    const flush = () => {
      if (y + leading > bottom) newPage();
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(row, margin, y + leading);
      y += leading;
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
  const image = async (id: string) => {
    const a = await asset(id);
    if (!a) throw new Error("画像が見つかりません");
    const url = URL.createObjectURL(a.blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const r = Math.min(682 / img.width, 310 / img.height);
      const w = img.width * r,
        h = img.height * r;
      if (y + h + 24 > bottom) newPage();
      ctx.drawImage(img, margin, y + 18, w, h);
      y += h + 32;
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const entry = async (r: RecordData, heading: string) => {
    line(heading, '500 14px "Zen Kaku Gothic Antique"', "#776457", 24);
    line(shownName(r), '700 32px "Kaisei Opti"', "#49382D", 46);
    if (r.displayName) {
      line("正式名称", '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(r.name);
      y += 12;
    }
    if (r.catchphrase)
      line(plainText(r.catchphrase), '500 22px "Kaisei Opti"', "#785638", 36);
    for (const id of r.imageIds) await image(id);
    y += 12;
    for (const [k, v] of Object.entries(fields)) {
      if (["name", "displayName", "memo", "catchphrase"].includes(k)) continue;
      const text = String(r[k as keyof RecordData] || "");
      if (!text) continue;
      line(v, '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(plainText(text));
      y += 12;
    }
    for (const field of r.customFields || []) {
      if (!field.value) continue;
      line(field.label, '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(plainText(field.value));
      y += 12;
    }
    const related = content.entities.filter((entity) =>
      r.relatedIds.includes(entity.id),
    );
    if (related.length) {
      line("関連項目", '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(related.map(shownName).join("・"));
      y += 12;
    }
    const relations = (content.relations || []).filter((relation) => relation.from === r.id || relation.to === r.id);
    if (relations.length) {
      line("関係性", '700 15px "Zen Kaku Gothic Antique"', "#776457", 28);
      line(relations.map((relation) => {
        const otherId = relation.from === r.id ? relation.to : relation.from;
        const other = content.entities.find((entity) => entity.id === otherId);
        return other ? `${relation.type}${relation.direction === "mutual" ? " ↔ " : relation.from === r.id ? " → " : " ← "}${shownName(other)}` : "";
      }).filter(Boolean).join(" ／ "));
      y += 12;
    }
  };
  newPage();
  await entry(content.world, theme.title);
  for (const e of content.entities.filter((e) =>
    options.kinds.includes(e.kind) && (options.entityIds || content.entities.map((entity) => entity.id)).includes(e.id),
  )) {
    if (options.separate || y > bottom - 150) newPage();
    else y += 35;
    await entry(e, labels[e.kind]);
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
