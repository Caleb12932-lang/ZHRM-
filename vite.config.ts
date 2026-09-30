import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
    allowedHosts: ["hunchback-octagon-washboard.ngrok-free.dev"],
  },

  resolve: {
    tsconfigPaths: true,
  },

  plugins: [
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});