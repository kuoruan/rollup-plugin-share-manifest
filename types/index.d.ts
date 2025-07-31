declare module "virtual:shared-manifest/assets" {
  import type { ManifestAssets } from "rollup-plugin-share-manifest";

  const assets: ManifestAssets;
  export default assets;
}

declare module "virtual:shared-manifest/chunks" {
  import type { ManifestChunks } from "rollup-plugin-share-manifest";

  const chunks: ManifestChunks;
  export default chunks;
}

declare module "virtual:shared-manifest" {
  import type { Manifest } from "rollup-plugin-share-manifest";

  const manifest: Manifest;
  export default manifest;
}

declare module "virtual:shared-manifests/*/assets" {
  import type { ManifestAssets } from "rollup-plugin-share-manifest";

  const assets: ManifestAssets;
  export default assets;
}

declare module "virtual:shared-manifests/*/chunks" {
  import type { ManifestChunks } from "rollup-plugin-share-manifest";

  const chunks: ManifestChunks;
  export default chunks;
}

declare module "virtual:shared-manifests/*" {
  import type { Manifest } from "rollup-plugin-share-manifest";

  const manifest: Manifest;
  export default manifest;
}

declare module "virtual:shared-manifests" {
  import type { Manifests } from "rollup-plugin-share-manifest";

  const manifests: Manifests;
  export default manifests;
}
