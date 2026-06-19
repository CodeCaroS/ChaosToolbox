import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), vue()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4174"
    }
  }
});
