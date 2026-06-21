import assert from "node:assert/strict";
import test from "node:test";
import { createAssetStore } from "../server/assetStore";

test("asset store creates, updates and deletes image assets", () => {
  const store = createAssetStore(":memory:");
  const saved = store.addAsset({
    title: "Wallpaper",
    imageUrl: "https://example.com/wallpaper.png",
    gallery: "Wallpapers",
    description: "Old graphics gallery item",
    categoryId: null
  });

  assert.equal(saved.title, "Wallpaper");
  assert.deepEqual(store.updateAsset(saved.id, { ...saved, title: "Icon" }), {
    ...saved,
    title: "Icon"
  });
  assert.equal(store.deleteAsset(saved.id), true);
  assert.deepEqual(store.listAssets(), []);
  store.close();
});
