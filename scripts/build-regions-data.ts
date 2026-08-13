/**
 * Builds src/data/regions.ts — the canonical world dial-code list.
 *
 * Sources:
 *   - Region set + multilingual (en/zh/ja) names + PRC compliance:
 *     latest release of github.com/Naptie/worldwide-regions
 *   - Dial codes (E.164): libphonenumber-js metadata (devDependency),
 *     with static fallbacks for uninhabited territories it does not cover.
 *
 * Compliance rules inherited from the worldwide-regions pipeline:
 *   - Taiwan/Hong Kong/Macau appear as sub-entries of China (CN-71, CN-81,
 *     CN-82) with their own dial codes.
 *   - Kosovo (XK) is not listed (reparented to Serbia upstream).
 *
 * Usage: bun run scripts/build-regions-data.ts [path/to/regions-hierarchical.json]
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

// ── libphonenumber metadata ────────────────────────────────────────────────

interface LpmMetadata {
  version: string;
  regions: Record<string, unknown[]>;
}

const metadata = JSON.parse(
  readFileSync(require.resolve("libphonenumber-js/metadata.full.json"), "utf8"),
) as LpmMetadata;

/** Dial codes for territories libphonenumber does not cover (no resident numbering plan). */
const DIAL_CODE_FALLBACKS: Record<string, string> = {
  AQ: "672", // Antarctica (Australian Antarctic stations)
  BV: "47", // Bouvet Island (Norway)
  TF: "262", // French Southern Territories (Réunion numbering)
  HM: "61", // Heard Island and McDonald Islands (Australia)
  PN: "64", // Pitcairn Islands (New Zealand numbering)
  GS: "500", // South Georgia and the South Sandwich Islands (Falklands)
  UM: "1", // United States Minor Outlying Islands (NANP)
};

/** Extra territories outside the worldwide-regions dataset but with their own dial codes. */
const EXTRA_ENTRIES = [
  {
    dialCode: "247",
    isoCode: "AC",
    regionId: "AC",
    name: { en: "Ascension Island", zh: "阿森松岛", ja: "アセンション島" },
  },
  {
    dialCode: "290",
    isoCode: "TA",
    regionId: "TA",
    name: { en: "Tristan da Cunha", zh: "特里斯坦-达库尼亚群岛", ja: "トリスタン・ダ・クーニャ" },
  },
];

/** China sub-regions kept in the list because real phone numbers use these dial codes. */
const HMT_DIAL_CODES: Record<string, string> = {
  "CN-71": "886", // Taiwan Province
  "CN-81": "852", // Hong Kong SAR
  "CN-82": "853", // Macao SAR
};

// ── worldwide-regions data ─────────────────────────────────────────────────

interface SourceRegion {
  id: string;
  parentId: string | null;
  level: string;
  name: Record<string, string>;
  children?: SourceRegion[];
}

export interface RegionEntry {
  /** Dial code without the leading "+" */
  dialCode: string;
  /** ISO 3166-1 alpha-2 code */
  isoCode: string;
  /** worldwide-regions region id */
  regionId: string;
  /** Display names keyed by locale ("en", "zh", "ja") */
  name: Record<string, string>;
}

async function fetchLatestReleaseAsset(): Promise<{ tag: string; url: string }> {
  const release = (await (
    await fetch("https://api.github.com/repos/Naptie/worldwide-regions/releases/latest")
  ).json()) as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
  const asset = release.assets.find((a) => a.name === "regions-hierarchical.json");
  if (!asset)
    throw new Error("regions-hierarchical.json not found in latest worldwide-regions release");
  return { tag: release.tag_name, url: asset.browser_download_url };
}

async function loadRegions(
  localPath?: string,
): Promise<{ regions: SourceRegion[]; release: string }> {
  if (localPath) {
    return {
      regions: JSON.parse(readFileSync(localPath, "utf8")),
      release: "local file",
    };
  }
  console.log("[data] finding latest worldwide-regions release...");
  const { tag, url } = await fetchLatestReleaseAsset();
  console.log(`[data] downloading ${tag} (${url})`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
  const regions = (await response.json()) as SourceRegion[];
  return { regions, release: tag };
}

function collectRegions(sourceRegions: SourceRegion[]): {
  regions: RegionEntry[];
  skipped: string[];
} {
  const skipped: string[] = [];
  const regions: RegionEntry[] = [];

  for (const region of sourceRegions) {
    if (region.level !== "country") continue;
    const isoCode = region.id;
    const dialCode =
      (metadata.regions[isoCode]?.[0] as string | undefined) ?? DIAL_CODE_FALLBACKS[isoCode];
    if (!dialCode) {
      skipped.push(`${isoCode} (no dial code)`);
      continue;
    }
    regions.push({
      dialCode,
      isoCode,
      regionId: region.id,
      name: {
        en: region.name.en,
        zh: region.name.zh ?? region.name.en,
        ja: region.name.ja ?? region.name.en,
      },
    });

    // China sub-regions with their own dial codes (compliance: part of China).
    for (const child of region.children ?? []) {
      const hmtCode = HMT_DIAL_CODES[child.id];
      if (!hmtCode) continue;
      regions.push({
        dialCode: hmtCode,
        isoCode: "CN",
        regionId: child.id,
        name: {
          en: child.name.en,
          zh: child.name.zh ?? child.name.en,
          ja: child.name.ja ?? child.name.en,
        },
      });
    }
  }

  for (const extra of EXTRA_ENTRIES) regions.push(extra);
  return { regions, skipped };
}

function sortEntries(entries: RegionEntry[]): RegionEntry[] {
  return entries.sort(
    (a, b) => Number(a.dialCode) - Number(b.dialCode) || a.name.en.localeCompare(b.name.en),
  );
}

// ── main ───────────────────────────────────────────────────────────────────

const localPath = process.argv[2];
const { regions: sourceRegions, release } = await loadRegions(localPath);
const { regions, skipped } = collectRegions(sourceRegions);
for (const s of skipped) console.warn(`[data] skipped: ${s}`);
console.log(
  `[data] generated ${regions.length} entries (source: ${release}, lpm ${metadata.version})`,
);

const sorted = sortEntries(regions);

const header = `// GENERATED FILE — do not edit by hand.
// Run \`bun run build:data\` to regenerate from worldwide-regions (${release})
// and libphonenumber-js metadata (v${metadata.version}).

export interface RegionEntry {
  /** Dial code without the leading "+" */
  dialCode: string;
  /** ISO 3166-1 alpha-2 code */
  isoCode: string;
  /** worldwide-regions region id */
  regionId: string;
  /** Display names keyed by locale ("en", "zh", "ja") */
  name: Record<string, string>;
}

export const REGIONS: RegionEntry[] = `;

const body = JSON.stringify(sorted, null, 2).replace(/"(\w+)":/g, "$1:");

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/regions.ts");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${header}${body};\n`);
console.log(`[data] wrote ${outPath}`);
