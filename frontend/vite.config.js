import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    // Bind all interfaces. Without this Vite listens on ::1 only, so the app is
    // unreachable at 127.0.0.1:5174 - and those count as two different origins
    // to the browser, which surfaces as a CORS failure.
    host: true,
  },
});
