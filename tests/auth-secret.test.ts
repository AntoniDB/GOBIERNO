import { describe, it, expect } from "vitest";
import { readAuthSecret, requireAuthSecret } from "@/lib/auth-secret";

describe("readAuthSecret", () => {
  it("usa AUTH_SECRET", () => expect(readAuthSecret({ AUTH_SECRET: "a" })).toBe("a"));
  it("cae a NEXTAUTH_SECRET (nombre antiguo)", () => expect(readAuthSecret({ NEXTAUTH_SECRET: "b" })).toBe("b"));
  it("AUTH_SECRET tiene prioridad", () => expect(readAuthSecret({ AUTH_SECRET: "a", NEXTAUTH_SECRET: "b" })).toBe("a"));
  it("ignora valores vacíos o en blanco", () => {
    expect(readAuthSecret({ AUTH_SECRET: "  ", NEXTAUTH_SECRET: "b" })).toBe("b");
    expect(readAuthSecret({ AUTH_SECRET: "" })).toBeUndefined();
  });
  it("sin ninguna devuelve undefined", () => expect(readAuthSecret({})).toBeUndefined());
});

describe("requireAuthSecret", () => {
  it("devuelve el secreto si existe, sea cual sea la variable", () => {
    expect(requireAuthSecret({ AUTH_SECRET: "a" })).toBe("a");
    expect(requireAuthSecret({ NEXTAUTH_SECRET: "b" })).toBe("b");
  });
  it("sin secreto lanza un error accionable", () => {
    expect(() => requireAuthSecret({})).toThrow(/AUTH_SECRET/);
  });
});
