import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/api", () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import { api } from "@/utils/api";
import { buildCreateFormData, createPipeline } from "./pipelineApi";

const file = (n: string) => new File(["x"], n);

describe("pipelineApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds multipart with indexed files and a JSON candidates list", () => {
    const fd = buildCreateFormData({
      workspaceId: "w1",
      title: " T ",
      jdText: "jd text",
      rows: [
        { key: "a", resume: file("a.pdf"), photo: file("a.png"), description: " hi " },
        { key: "b", resume: null, photo: null, description: "only text" },
      ],
    });
    expect(fd.get("jd_title")).toBe("T");
    expect(fd.get("workspace_id")).toBe("w1");
    expect(JSON.parse(fd.get("candidates") as string)).toEqual([
      { description: "hi" },
      { description: "only text" },
    ]);
    expect((fd.get("resume_0") as File).name).toBe("a.pdf");
    expect((fd.get("photo_0") as File).name).toBe("a.png");
    expect(fd.get("resume_1")).toBeNull();
  });

  it("posts with long timeout and no JSON content-type", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: "p", status: "queued" } } });
    const res = await createPipeline({ workspaceId: "w", title: "t", jdText: "j", rows: [] });
    expect(res.id).toBe("p");
    const cfg = vi.mocked(api.post).mock.calls[0][2] as {
      timeout: number;
      headers: Record<string, unknown>;
    };
    expect(cfg.timeout).toBeGreaterThan(45_000);
    expect(cfg.headers["Content-Type"]).toBeUndefined();
  });
});
