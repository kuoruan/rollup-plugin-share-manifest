export const VirtualModuleId = `virtual:shared-manifest`;
export const VirtualModulesId = `virtual:shared-manifests`;

/**
 * - virtual:shared-manifest
 * - virtual:shared-manifest/assets
 * - virtual:shared-manifest/chunks
 */
export const VirtualModuleIdRegex = new RegExp(
  `^${VirtualModuleId}(?:\\/(assets|chunks))?$`,
);

/**
 * - virtual:shared-manifests
 * - virtual:shared-manifests/key
 * - virtual:shared-manifests/key/assets
 * - virtual:shared-manifests/key/chunks
 */
export const VirtualModulesIdRegex = new RegExp(
  `^${VirtualModulesId}(?:\\/([^\\/]+)(?:\\/(assets|chunks))?)?$`,
);

export const ResolvedIdPrefix = "\0";

export const ResolvedModulesIdRegex = new RegExp(
  `^${ResolvedIdPrefix}${VirtualModulesId}(?:\\/([^\\/]+)(?:\\/(assets|chunks))?)?$`,
);
