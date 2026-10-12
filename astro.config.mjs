// @ts-check
import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";

// URL と CSP の方針は docs/architecture.md の「公開」「CSP」を参照
export default defineConfig({
  site: "https://yamadentanaka.github.io",
  base: "/yamaden_site/",
  trailingSlash: "always",
  integrations: [preact()],
  // Shiki はインラインスタイルを使い CSP と両立しないので、Markdown のコードの色付けは Prism にする
  markdown: { syntaxHighlight: "prism" },
  security: {
    csp: {
      // script-src と style-src は書かない（Astro が 'self' とハッシュを出力する。書くと設定エラーになる）
      directives: [
        "default-src 'none'",
        "img-src 'self' blob:",
        "connect-src 'none'",
        "font-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        "object-src 'none'",
      ],
    },
  },
});
