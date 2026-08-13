import { Elysia, t } from "elysia";

import { authPlugin } from "../plugins/auth.js";
import { SUPPORTED_REGIONS } from "../providers/registry.js";

const RegionSchema = t.Object({
  dialCode: t.String({
    description: 'Dial code without the leading "+" sign',
    examples: ["86", "886"],
  }),
  isoCode: t.String({
    description: "ISO 3166-1 alpha-2 code",
    examples: ["CN"],
  }),
  regionId: t.String({
    description: "worldwide-regions region id",
    examples: ["CN", "CN-71"],
  }),
  name: t.Record(t.String(), t.String(), {
    description: "Display names keyed by locale (en, zh, ja)",
    examples: [{ en: "China", zh: "中国", ja: "中国" }],
  }),
  method: t.Union([t.Literal("sms"), t.Literal("telegram")], {
    description: "How numbers in this entry are verified",
  }),
});

export const regionsRoutes = new Elysia({ prefix: "/regions" })
  .use(authPlugin)
  .get("/", () => SUPPORTED_REGIONS, {
    response: {
      200: t.Array(RegionSchema),
    },
    detail: {
      summary: "List supported countries/regions",
      description:
        "Returns all world country/region dial codes this hub supports, with display names in English, Chinese and Japanese.",
      tags: ["Regions"],
      security: [{ bearerAuth: [] }],
    },
  });
