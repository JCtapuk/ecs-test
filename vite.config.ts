import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/ecs-test/",
  build: {
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), "index.html"),
        game: resolve(process.cwd(), "game.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
