import { describe, expect, it } from "vitest";
import { createCaptureTexter } from "./capture-texter.ts";

describe("createCaptureTexter", () => {
  it("keeps each text and answers with a numbered id", async () => {
    const texter = createCaptureTexter();
    const first = await texter.send({ to: "+13125551234", line: "account", body: "Ruken: one" });
    const second = await texter.send({ to: "+13125551235", line: "news", body: "Ruken: two" });

    expect(first).toEqual({ sent: true, providerId: "SM-test-1" });
    expect(second).toEqual({ sent: true, providerId: "SM-test-2" });
    expect(texter.sent.map((text) => text.body)).toEqual(["Ruken: one", "Ruken: two"]);
  });

  it("answers changedHands from `hands`, cannot_say for a number it was not told about", async () => {
    const texter = createCaptureTexter();
    texter.hands.set("+13125551234", "yes");

    expect(await texter.changedHands("+13125551234", new Date())).toBe("yes");
    expect(await texter.changedHands("+13125551235", new Date())).toBe("cannot_say");
  });
});
