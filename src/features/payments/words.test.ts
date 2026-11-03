import { describe, expect, it } from "vitest";
import { amountInWords } from "./words";

describe("amountInWords", () => {
  it.each([
    [350050, "Three thousand five hundred pesos and 50/100"],
    [350000, "Three thousand five hundred pesos only"],
    [100, "One peso only"],
    [5, "Zero pesos and 05/100"],
    [0, "Zero pesos only"],
    [1234567, "Twelve thousand three hundred forty-five pesos and 67/100"],
    [100000000, "One million pesos only"],
    [2100001, "Twenty-one thousand pesos and 01/100"],
  ])("%i -> %s", (centavos, expected) => {
    expect(amountInWords(centavos)).toBe(expected);
  });

  it("rejects invalid amounts", () => {
    expect(() => amountInWords(-1)).toThrow();
    expect(() => amountInWords(1.5)).toThrow();
  });
});
