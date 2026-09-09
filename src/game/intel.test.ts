import { describe, it, expect } from "vitest";
import { INTEL_DOCS, docsForAct, docIdFor } from "./intel";

describe("docsForAct", () => {
  it("Act I has exactly 3 documents with unique ids, one per slot", () => {
    const docs = docsForAct(1);
    expect(docs.length).toBe(3);
    expect(new Set(docs.map((d) => d.id)).size).toBe(3);
    expect(docs.map((d) => d.slot)).toEqual([0, 1, 2]);
  });

  it("returns [] for an act with no authored documents yet", () => {
    expect(docsForAct(2)).toEqual([]);
    expect(docsForAct(99)).toEqual([]);
  });

  it("every document's id is a real key in INTEL_DOCS", () => {
    for (const d of docsForAct(1)) expect(INTEL_DOCS[d.id]).toBe(d);
  });
});

describe("docIdFor", () => {
  it("resolves each of Act I's 3 slots to a distinct doc id", () => {
    const ids = [docIdFor(1, 0), docIdFor(1, 1), docIdFor(1, 2)];
    expect(ids.every((id) => id !== null)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it("returns null for an act/slot with no document", () => {
    expect(docIdFor(2, 0)).toBeNull();
  });
});
