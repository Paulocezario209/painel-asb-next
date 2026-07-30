import type { MetadataRoute } from "next";

// Manifest do painel (App Router serve em /manifest.webmanifest e injeta o <link rel="manifest">).
// Fundo grafite #15161c: o logo oficial tem as áreas escuras TRANSPARENTES — sobre fundo claro
// o monograma AS some. É também o fundo que o iOS exige (apple-touch-icon ignora alpha).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "American Steak Brasil — Painel",
    short_name: "ASB Painel",
    description: "Painel comercial, compras e marketing da American Steak Brasil",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#15161c",
    theme_color: "#15161c",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable = conteúdo dentro da safe zone (círculo central de 80%), pro Android
      // recortar em qualquer formato sem comer o logo.
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
