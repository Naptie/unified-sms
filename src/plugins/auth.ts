import { Elysia } from "elysia";
import { config } from "../config.js";

/**
 * Scoped Bearer-token auth plugin.
 * Any Elysia plugin that `.use(authPlugin)` will require a valid
 * `Authorization: Bearer <API_SECRET>` header on every request it handles.
 */
export const authPlugin = new Elysia({ name: "auth" })
  .derive({ as: "scoped" }, ({ headers }) => {
    const authHeader = headers.authorization ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    return { bearer };
  })
  .onBeforeHandle({ as: "scoped" }, ({ bearer, request, set }) => {
    if (bearer !== config.apiSecret) {
      console.error(
        `[auth] unauthorized ${request.method} ${new URL(request.url).pathname} ` +
          `(missing, malformed or invalid bearer token)`,
      );
      set.status = 401;
      return { success: false, error: "Unauthorized" };
    }
  });
