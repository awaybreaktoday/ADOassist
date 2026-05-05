import { AppError } from "../errors.js";
const azureAksSources = [
    {
        title: "Upgrade an AKS cluster",
        url: "https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster"
    },
    {
        title: "Upgrade node pools in AKS",
        url: "https://learn.microsoft.com/en-us/azure/aks/upgrade-node-pools"
    },
    {
        title: "Supported Kubernetes versions in AKS",
        url: "https://learn.microsoft.com/en-us/azure/aks/supported-kubernetes-versions"
    },
    {
        title: "Roll back an AKS node pool version",
        url: "https://learn.microsoft.com/en-us/azure/aks/roll-back-node-pool-version"
    }
];
const azureAksFacts = [
    {
        text: "AKS cluster upgrades must follow a supported upgrade path; do not assume skipping minor versions is allowed.",
        sourceUrl: "https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster"
    },
    {
        text: "AKS control plane and node pool Kubernetes downgrades are not supported through the normal upgrade/update path.",
        sourceUrl: "https://learn.microsoft.com/en-us/azure/aks/upgrade-node-pools"
    },
    {
        text: "AKS Kubernetes version availability and support windows vary by version and region; verify target versions with Microsoft Learn and `az aks get-versions` before merge.",
        sourceUrl: "https://learn.microsoft.com/en-us/azure/aks/supported-kubernetes-versions"
    },
    {
        text: "Use `az aks get-versions --location <region>` to verify regional Kubernetes version availability, and `az aks get-upgrades --resource-group <rg> --name <cluster>` to verify supported upgrade paths for an existing cluster.",
        sourceUrl: "https://learn.microsoft.com/en-us/azure/aks/upgrade-aks-cluster"
    },
    {
        text: "When control plane and node pool versions differ, describe the skew as at or near a supported limit unless the supplied docs explicitly prove it exceeds that limit; ask reviewers to verify current AKS skew rules.",
        sourceUrl: "https://learn.microsoft.com/en-us/azure/aks/upgrade-node-pools"
    },
    {
        text: "AKS node pool version rollback is a limited feature with documented constraints; do not describe Terraform version reverts as a guaranteed rollback after apply.",
        sourceUrl: "https://learn.microsoft.com/en-us/azure/aks/roll-back-node-pool-version"
    }
];
export function resolveDocCheckProfile(value) {
    if (value === undefined || value === false) {
        return undefined;
    }
    if (value === true || value === "" || value === "azure-aks") {
        return "azure-aks";
    }
    throw new AppError("--check-docs must be azure-aks");
}
export async function checkDocs(profile, options = {}) {
    if (profile !== "azure-aks") {
        throw new AppError("--check-docs must be azure-aks");
    }
    const fetchImpl = options.fetchImpl ?? fetch;
    const checkedSources = [];
    for (const source of azureAksSources) {
        const response = await fetchImpl(source.url, { headers: { Accept: "text/html, text/plain;q=0.9" } });
        if (!response.ok) {
            throw new AppError(`Doc check failed for ${source.url} with ${response.status}`);
        }
        const text = await response.text();
        checkedSources.push({
            ...source,
            title: extractTitle(text) ?? source.title
        });
    }
    return {
        profile,
        checkedAt: (options.checkedAt ?? new Date()).toISOString(),
        sources: checkedSources,
        facts: azureAksFacts
    };
}
function extractTitle(html) {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = match?.[1]?.replace(/\s+/g, " ").trim();
    return title || undefined;
}
