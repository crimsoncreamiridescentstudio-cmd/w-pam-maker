import { defineConfig } from "vite";
import process from "node:process";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "./",
  build: { reportCompressedSize: false },
  plugins: [
    {
      name: "wpam-modern-fonts",
      enforce: "pre",
      transform(code, id) {
        if (id.includes("@fontsource/") && id.endsWith(".css"))
          return code.replace(
            /,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g,
            "",
          );
      },
    },
    {
      name: "wpam-social-preview",
      transformIndexHtml() {
        const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
        const image = base && /^https:\/\//.test(base)
          ? new URL("/og.png", base).href
          : "/og.png";
        const tags = [
          {
            tag: "meta",
            attrs: {
              property: "og:title",
              content: "W-Pam — 創作世界のパンフレット",
            },
          },
          {
            tag: "meta",
            attrs: {
              property: "og:description",
              content:
                "白紙からつくる創作世界観光パンフ。ログイン不要、端末内保存。",
            },
          },
          { tag: "meta", attrs: { property: "og:type", content: "website" } },
          { tag: "meta", attrs: { property: "og:site_name", content: "W-Pam" } },
          { tag: "meta", attrs: { property: "og:image", content: image } },
          { tag: "meta", attrs: { property: "og:image:type", content: "image/png" } },
          { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
          { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
          {
            tag: "meta",
            attrs: {
              property: "og:image:alt",
              content: "W-Pam — 創作世界のパンフレット",
            },
          },
          { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
          {
            tag: "meta",
            attrs: {
              name: "twitter:title",
              content: "W-Pam — 創作世界のパンフレット",
            },
          },
          {
            tag: "meta",
            attrs: {
              name: "twitter:description",
              content:
                "白紙からつくる創作世界観光パンフ。ログイン不要、端末内保存。",
            },
          },
          { tag: "meta", attrs: { name: "twitter:image", content: image } },
          {
            tag: "meta",
            attrs: {
              name: "twitter:image:alt",
              content: "W-Pam — 創作世界のパンフレット",
            },
          },
        ];
        if (base && /^https:\/\//.test(base)) {
          tags.push({
            tag: "meta",
            attrs: {
              property: "og:url",
              content: new URL("/", base).href,
            },
          });
        }
        return tags;
      },
    },
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "ワールドパンフレットメーカー（仮）",
        short_name: "W-Pam",
        lang: "ja",
        start_url: "./",
        scope: "./",
        display: "standalone",
        theme_color: "#E9A928",
        background_color: "#FFFBF1",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 8000000,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
