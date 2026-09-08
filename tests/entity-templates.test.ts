import { describe, expect, it } from "vitest";
import {
  builtinEntityTemplates,
  instantiateTemplateFields,
  mergeEntityTemplateImports,
  templatesForKind,
} from "../src/entity-templates";
import { kinds, type EntityTemplate } from "../src/model";

const custom = (overrides: Partial<EntityTemplate> = {}): EntityTemplate => {
  const now = new Date().toISOString();
  return {
    id: "custom-1",
    name: "自作キャラシ",
    kind: "character",
    fields: [{ id: "field-1", label: "象徴" }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe("Entity templates", () => {
  it("offers at least one built-in template for every Entity kind", () => {
    for (const kind of kinds)
      expect(builtinEntityTemplates.some((item) => item.kind === kind)).toBe(
        true,
      );
  });

  it("combines built-in and custom templates only for the selected kind", () => {
    const characterTemplates = templatesForKind("character", [custom()]);
    expect(
      characterTemplates.some(
        (item) => item.id === "custom-1" && !item.builtin,
      ),
    ).toBe(true);
    expect(characterTemplates.every((item) => item.kind === "character")).toBe(
      true,
    );
    expect(
      templatesForKind("location", [custom()]).some(
        (item) => item.id === "custom-1",
      ),
    ).toBe(false);
  });

  it("creates blank fields with fresh IDs without mutating the template", () => {
    const source = custom().fields;
    const a = instantiateTemplateFields(source);
    const b = instantiateTemplateFields(source);
    expect(a[0]).toMatchObject({ label: "象徴", value: "" });
    expect(a[0].id).not.toBe(source[0].id);
    expect(a[0].id).not.toBe(b[0].id);
  });

  it("keeps exact imports once and makes a safe copy for conflicts", () => {
    const original = custom();
    expect(mergeEntityTemplateImports([original], [original])).toHaveLength(1);
    const conflicting = custom({ fields: [{ id: "other", label: "別項目" }] });
    const merged = mergeEntityTemplateImports([original], [conflicting]);
    expect(merged).toHaveLength(2);
    expect(merged[1].id).not.toBe(original.id);
    expect(merged[1].name).toContain("読み込み");
  });
});
