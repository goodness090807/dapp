import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            "/pinata": {
                target: "https://api.pinata.cloud",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/pinata/, ""),
            },
        },
    },
});
