import { shareManifest } from "@/index.js";

describe("shareManifest", () => {
  it("should be a function", () => {
    expect(typeof shareManifest).toBe("function");
  });

  it("should return an object with record and provide methods", () => {
    const plugin = shareManifest();

    expect(plugin).toBeTypeOf("object");
    expect(plugin).toHaveProperty("record");
    expect(plugin).toHaveProperty("provide");
    expect(plugin).toHaveProperty("getManifests");
    expect(plugin).toHaveProperty("getManifest");
    expect(typeof plugin.record).toBe("function");
    expect(typeof plugin.provide).toBe("function");
    expect(typeof plugin.getManifests).toBe("function");
    expect(typeof plugin.getManifest).toBe("function");
  });

  it("record method should return a rollup plugin", () => {
    const plugin = shareManifest();
    const recordPlugin = plugin.record();

    expect(recordPlugin).toBeTypeOf("object");
    expect(recordPlugin).toHaveProperty("name");
    expect(recordPlugin.name).toBe("share-manifest:record");
    expect(recordPlugin).toHaveProperty("buildStart");
    expect(recordPlugin).toHaveProperty("generateBundle");
  });

  it("provide method should return a rollup plugin", () => {
    const plugin = shareManifest();
    const providePlugin = plugin.provide();

    expect(providePlugin).toBeTypeOf("object");
    expect(providePlugin).toHaveProperty("name");
    expect(providePlugin.name).toBe("share-manifest:provide");
    expect(providePlugin).toHaveProperty("resolveId");
    expect(providePlugin).toHaveProperty("load");
    expect(providePlugin).toHaveProperty("transform");
  });
});
