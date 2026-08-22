import { describe, expect, it } from "vitest";
import { DONATION_URL, SUPPORT_EMAIL } from "../../shared/support";
import { FAQ_ITEMS } from "./FAQTab";

describe("FAQ content", () => {
  it("covers interaction, settings transfer, progression, and future avatars", () => {
    const content = FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`).join(" ").toLowerCase();
    expect(content).toContain("double-click");
    expect(content).toContain("transparent");
    expect(content).toContain("excludes xp");
    expect(content).toContain("more avatars");
    expect(content).toContain("launch at startup");
  });

  it("keeps replaceable support destinations centralized", () => {
    expect(SUPPORT_EMAIL).toBe("placeholder@email.com");
    expect(DONATION_URL).toContain("buymeacoffee.com/placeholder");
  });
});
