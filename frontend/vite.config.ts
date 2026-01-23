import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        // ✅ name it popup so we can control output
        popup: resolve(__dirname, "src/popup/index.html"),
        sw: resolve(__dirname, "src/sw/sw.ts"),
        content: resolve(__dirname, "src/cs/content.ts"),
      },
      output: {
        // ✅ keep JS flat
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",

        // ✅ IMPORTANT: flatten html output
        // Rollup only applies these naming rules to JS/assets, not HTML,
        // but naming the input "popup" makes Vite emit "popup.html" at root.
      },
    },
  },
});
