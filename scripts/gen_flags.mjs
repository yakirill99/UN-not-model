#!/usr/bin/env node
/**
 * Placeholder flags for frontend/public/flags/<code>.svg.
 *
 * The name of the file is the whole contract: the frontend looks a country up
 * by its ISO code (src/world/countries.json) and a real flag replaces the
 * placeholder by simply dropping a file with the same name. The five scenario
 * countries and a few famous ones get close-to-real color schemes, the rest
 * get deterministic three-band pennants. generic-1..3 are the fallbacks for
 * unknown countries.
 *
 * Run: node scripts/gen_flags.mjs   (from frontend/)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "frontend", "public", "flags");
mkdirSync(outDir, { recursive: true });

const countries = JSON.parse(
    readFileSync(
        join(here, "..", "frontend", "src", "world", "countries.json"),
        "utf8",
    ),
);

const W = 64;
const H = 42;

const band = (color, y, h) =>
    `<rect width="${W}" height="${h}" y="${y}" fill="${color}"/>`;
const vband = (color, x, w) =>
    `<rect width="${w}" height="${H}" x="${x}" fill="${color}"/>`;

const hbands = (colors) =>
    colors
        .map((c, i) =>
            band(c, (i * H) / colors.length, H / colors.length + 0.2),
        )
        .join("");
const vbands = (colors) =>
    colors
        .map((c, i) =>
            vband(c, (i * W) / colors.length, W / colors.length + 0.2),
        )
        .join("");

const DISC = (cx, cy, r, color) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;

/** Hand-tuned approximations: recognizable, but five minutes of SVG. */
const PRESETS = {
    ru: hbands(["#ffffff", "#0039a6", "#d52b1e"]),
    fr: vbands(["#0055a4", "#ffffff", "#ef4135"]),
    ir:
        hbands(["#239f40", "#ffffff", "#da0000"]) +
        DISC(W / 2, H / 2, 5, "#da0000"),
    us: (() => {
        let s = "";
        for (let i = 0; i < 7; i++)
            s += band(i % 2 ? "#ffffff" : "#b22234", (i * H) / 7, H / 7 + 0.2);
        s += `<rect width="${W * 0.42}" height="${(H / 7) * 4}" fill="#3c3b6e"/>`;
        return s;
    })(),
    kp: (() => {
        let s = band("#024fa2", 0, 7);
        s += band("#ffffff", 7, 3.5);
        s += band("#ed1c27", 10.5, 21);
        s += band("#ffffff", 31.5, 3.5);
        s += band("#024fa2", 35, 7);
        s += DISC(22, 21, 7.5, "#ffffff");
        return s;
    })(),
    gb: (() => {
        let s = `<rect width="${W}" height="${H}" fill="#012169"/>`;
        s += `<path d="M0 0 L${W} ${H} M${W} 0 L0 ${H}" stroke="#ffffff" stroke-width="8"/>`;
        s += `<path d="M${W / 2} 0 V${H} M0 ${H / 2} H${W}" stroke="#ffffff" stroke-width="12"/>`;
        s += `<path d="M${W / 2} 0 V${H} M0 ${H / 2} H${W}" stroke="#c8102e" stroke-width="7"/>`;
        return s;
    })(),
    de: hbands(["#000000", "#dd0000", "#ffce00"]),
    it: vbands(["#009246", "#ffffff", "#ce2b37"]),
    jp:
        `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
        DISC(W / 2, H / 2, 9, "#bc002d"),
    cn:
        `<rect width="${W}" height="${H}" fill="#de2910"/>` +
        DISC(12, 12, 6, "#ffde00"),
    ua: hbands(["#005bbb", "#ffd500"]),
    pl: hbands(["#ffffff", "#dc143c"]),
};

const PALETTE = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#0ea5e9",
    "#84cc16",
    "#f97316",
    "#14b8a6",
    "#ec4899",
    "#64748b",
    "#eab308",
];

function hash(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
    return Math.abs(h);
}

function pennant(name) {
    const h = hash(name);
    const a = PALETTE[h % PALETTE.length];
    let b = PALETTE[(h >> 3) % PALETTE.length];
    if (b === a) b = PALETTE[(h + 5) % PALETTE.length];
    const c = "#f8fafc";
    return h % 2 === 0 ? hbands([a, c, b]) : vbands([a, c, b]);
}

const wrap = (inner) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${inner}</svg>\n`;

const isos = new Set(Object.values(countries).map((c) => c.iso));
for (const iso of isos) {
    const svg = wrap(PRESETS[iso] ?? pennant(iso));
    writeFileSync(join(outDir, `${iso}.svg`), svg);
}

// Fallbacks for countries missing from the table.
for (let i = 1; i <= 3; i++) {
    writeFileSync(
        join(outDir, `generic-${i}.svg`),
        wrap(pennant(`generic-${i}`)),
    );
}

console.log(`Flags written: ${isos.size + 3} files in ${outDir}`);
