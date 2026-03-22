import { translations } from "../../src/i18n/translations";

describe("translations", () => {
  it("keeps English and German translation keys in sync", () => {
    expect(Object.keys(translations.de).sort()).toEqual(
      Object.keys(translations.en).sort(),
    );
  });
});
