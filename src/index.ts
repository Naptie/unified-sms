import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

import { config } from "./config.js";
import { countriesRoutes } from "./routes/countries.js";
import { smsRoutes } from "./routes/sms.js";

const app = new Elysia()
  .use(
    swagger({
      path: "/swagger",
      documentation: {
        info: {
          title: "unified-sms",
          version: "0.1.0",
          description:
            "The easiest SMS hub — send and verify OTP codes across multiple providers and regions.\n\n" +
            "All endpoints require `Authorization: Bearer <API_SECRET>` header.",
        },
        tags: [
          { name: "Countries", description: "Query supported country/region codes" },
          { name: "SMS", description: "Send and verify OTP codes" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description: "API secret shared with all authorized server-side clients",
            },
          },
        },
      },
    }),
  )
  .use(countriesRoutes)
  .use(smsRoutes)
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { success: false, error: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 422;
      return { success: false, error: error.message };
    }
    console.error("[unhandled error]", error);
    set.status = 500;
    return { success: false, error: "Internal server error" };
  })
  .listen({ hostname: config.hostname, port: config.port });

console.log(`Listening on http://${config.hostname}:${app.server?.port}`);
