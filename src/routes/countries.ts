import { Elysia, t } from "elysia";

import { authPlugin } from "../plugins/auth.js";
import { SUPPORTED_COUNTRIES } from "../providers/registry.js";

const CountrySchema = t.Object({
  dialCode: t.String({
    description: 'Dial code without the leading "+" sign',
    examples: ["86"],
  }),
  name: t.String({
    description: "Human-readable country or region name",
    examples: ["China (Mainland)"],
  }),
  isoCode: t.String({
    description: "ISO 3166-1 alpha-2 code",
    examples: ["CN"],
  }),
});

export const countriesRoutes = new Elysia({ prefix: "/countries" })
  .use(authPlugin)
  .get("/", () => SUPPORTED_COUNTRIES, {
    response: {
      200: t.Array(CountrySchema),
    },
    detail: {
      summary: "List supported countries/regions",
      description:
        "Returns all country/region dial codes that this hub currently supports for SMS delivery.",
      tags: ["Countries"],
      security: [{ bearerAuth: [] }],
    },
  });
