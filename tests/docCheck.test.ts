import { describe, expect, it, vi } from "vitest";
import { checkDocs, resolveDocCheckProfile } from "../src/docs/check.js";

describe("resolveDocCheckProfile", () => {
  it("defaults bare --check-docs to azure-aks", () => {
    expect(resolveDocCheckProfile(true)).toBe("azure-aks");
  });

  it("accepts azure-aks and rejects unsupported profiles", () => {
    expect(resolveDocCheckProfile("azure-aks")).toBe("azure-aks");
    expect(() => resolveDocCheckProfile("kubernetes")).toThrow("--check-docs must be azure-aks");
  });
});

describe("checkDocs", () => {
  it("fetches Azure AKS docs and returns sourced guardrails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><title>AKS docs</title><main>content</main></html>"
    });

    const result = await checkDocs("azure-aks", { fetchImpl: fetchMock, checkedAt: new Date("2026-05-05T12:00:00Z") });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.profile).toBe("azure-aks");
    expect(result.checkedAt).toBe("2026-05-05T12:00:00.000Z");
    expect(result.sources.map((source) => source.url)).toContain(
      "https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster"
    );
    expect(result.facts.map((fact) => fact.text)).toContain(
      "AKS cluster upgrades must follow a supported upgrade path; do not assume skipping minor versions is allowed."
    );
    expect(result.facts.map((fact) => fact.text)).toContain(
      "AKS control plane and node pool Kubernetes downgrades are not supported through the normal upgrade/update path."
    );
    expect(result.facts.map((fact) => fact.text)).toContain(
      "Use `az aks get-versions --location <region>` to verify regional Kubernetes version availability, and `az aks get-upgrades --resource-group <rg> --name <cluster>` to verify supported upgrade paths for an existing cluster."
    );
    expect(result.facts.map((fact) => fact.text)).toContain(
      "When control plane and node pool versions differ, describe the skew as at or near a supported limit unless the supplied docs explicitly prove it exceeds that limit; ask reviewers to verify current AKS skew rules."
    );
  });
});
