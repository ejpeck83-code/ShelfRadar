import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Shelf Radar", short_name: "Shelf Radar", start_url: "/discover", display: "standalone", background_color: "#ffffff", theme_color: "#176b37", description: "TMNT discovery and sourcing signals" }; }
