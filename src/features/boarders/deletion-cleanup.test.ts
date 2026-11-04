import { describe, expect, it, vi } from "vitest";
import { cleanupBoarderUploads } from "./deletion-cleanup";

const org = "00000000-0000-4000-8000-000000000001";
const member = "00000000-0000-4000-8000-000000000002";
const root = `${org}/${member}`;
function fixture(initial: string[]) {
  const files = new Set(initial);
  const remove = vi.fn(async (paths: string[]): Promise<{ error: unknown }> => { paths.forEach((path) => files.delete(path)); return { error: null }; });
  const list = vi.fn(async (folder: string) => ({
    data: [...files].filter((file) => file.startsWith(`${folder}/`)).slice(0, 100).map((file) => ({ name: file.slice(folder.length + 1), id: file })), error: null,
  }));
  const from = vi.fn((name: string) => ({ list, remove, bucket: name }));
  return { files, from, list, remove };
}

describe("orphan cleanup after boarder deletion", () => {
  it("removes only this boarder's prefix and checks both private buckets", async () => {
    const storage = fixture([`${root}/proof.pdf`, `${root}/unreferenced.jpg`, `${org}/other/proof.pdf`]);
    expect(await cleanupBoarderUploads(storage, org, member)).toBe(true);
    expect([...storage.files]).toEqual([`${org}/other/proof.pdf`]);
    expect(storage.from.mock.calls.map(([name]) => name)).toEqual(["payment-proofs", "maintenance-photos"]);
    expect(storage.remove).toHaveBeenCalledWith([`${root}/proof.pdf`, `${root}/unreferenced.jpg`]);
  });
  it("leaves a failed batch retryable and never reports completion on failure", async () => {
    const storage = fixture([`${root}/proof.pdf`]);
    storage.remove.mockResolvedValueOnce({ error: new Error("storage unavailable") });
    expect(await cleanupBoarderUploads(storage, org, member)).toBe(false);
    expect(storage.files.size).toBe(1);
    expect(await cleanupBoarderUploads(storage, org, member)).toBe(true);
  });
  it("does not delete if listing fails", async () => {
    const storage = fixture([`${root}/proof.pdf`]);
    storage.list.mockRejectedValueOnce(new Error("unavailable"));
    expect(await cleanupBoarderUploads(storage, org, member)).toBe(false);
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("rejects unsafe member IDs and unexpected paths from storage", async () => {
    const storage = fixture([`${root}/../other.pdf`]);
    expect(await cleanupBoarderUploads(storage, org, "../other")).toBe(false);
    expect(storage.from).not.toHaveBeenCalled();
    expect(await cleanupBoarderUploads(storage, org, member)).toBe(false);
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it("bounds an unchanging response instead of looping forever", async () => {
    const storage = fixture([`${root}/proof.pdf`]);
    storage.remove.mockImplementation(async () => ({ error: null }));
    expect(await cleanupBoarderUploads(storage, org, member)).toBe(false);
    expect(storage.list.mock.calls.length).toBeLessThanOrEqual(100);
  });
  it("deletes consecutive pages without skipping objects after removal", async () => {
    const storage = fixture(Array.from({ length: 240 }, (_, i) => `${root}/${i}.pdf`));
    expect(await cleanupBoarderUploads(storage, org, member)).toBe(true);
    expect(storage.files.size).toBe(0);
    expect(storage.remove.mock.calls.map(([paths]) => paths.length)).toEqual([100, 100, 40]);
  });
});
