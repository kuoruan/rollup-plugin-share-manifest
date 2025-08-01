import { isBuiltin } from "node:module";
import type { OutputAsset, OutputBundle } from "rollup";
import {
  ResolvedModulesIdRegex,
  VirtualModuleIdRegex,
  VirtualModulesIdRegex,
} from "./constants.js";
import type { ManifestOptions } from "./types.js";

export function normalizeKey(key: unknown): string | symbol {
  if (typeof key === "string" || typeof key === "symbol") {
    return key;
  }

  return String(key);
}

export function isVirtualModuleId(id: string): boolean {
  return VirtualModuleIdRegex.test(id);
}

export function isVirtualModulesId(id: string): boolean {
  return VirtualModulesIdRegex.test(id);
}

export function isResolvedModulesId(id: string): boolean {
  return ResolvedModulesIdRegex.test(id);
}

export function extractManifestOptions(
  id: string,
): ManifestOptions | undefined {
  const match = id.match(ResolvedModulesIdRegex);

  return match
    ? ({ key: match[1], type: match[2] } as ManifestOptions)
    : undefined;
}

export function isAssetOutput(
  output: OutputBundle[string],
): output is OutputAsset {
  return output.type === "asset";
}

export function getAssetName(asset: OutputAsset): string | undefined {
  if (Array.isArray(asset.names) && asset.names.length > 0) {
    return asset.names[0];
  }

  return asset.name;
}

export function removeQuery(id: string): string {
  const queryIndex = id.indexOf("?");
  return queryIndex !== -1 ? id.slice(0, queryIndex) : id;
}

export function isBuiltinModule(name: string): boolean {
  return isBuiltin(name);
}

export function getPackageNameFromImport(
  importSpecifier: string,
): string | undefined {
  if (importSpecifier.startsWith(".") || importSpecifier.startsWith("/")) {
    return undefined; // Local imports do not have a package name
  }

  const match = importSpecifier.match(/^(@[^/]+\/)?([^/@]+)/);

  return match ? match[0] : undefined;
}
