import { describe, expect, it } from "vitest";
import { tutorialSteps, tutorialVersion } from "../src/tutorial";

describe("tutorial guide", () => {
  it("explains both applying and managing Entity templates", () => {
    const text = tutorialSteps
      .flatMap((step) => [step.title, step.body, ...(step.points || [])])
      .join(" ");

    expect(text).toContain("追加");
    expect(text).toContain("置き換え");
    expect(text).toContain("作成・編集・並べ替え・削除");
    expect(text).toContain("すべての世界");
    expect(
      tutorialSteps.some((step) => step.action?.destination === "templates"),
    ).toBe(true);
  });

  it("has a version newer than the original guide", () => {
    expect(tutorialVersion).toBeGreaterThan(1);
  });
});
