import { Treaty } from '@elysia/eden';
import { Elysia } from 'elysia';

declare const app: Elysia<"", {
    decorator: {};
    store: {};
    derive: {};
    resolve: {};
}, {
    typebox: {};
    error: {};
} & {
    typebox: {};
    error: {};
}, {
    schema: {};
    standaloneSchema: {};
    macro: {};
    macroFn: {};
    parser: {};
    response: {};
} & {
    schema: {};
    standaloneSchema: {};
    macro: {};
    macroFn: {};
    parser: {};
}, {
    regions: {};
} & {
    regions: {
        get: {
            body: unknown;
            params: {};
            query: unknown;
            headers: unknown;
            response: {
                200: {
                    name: {
                        [x: string]: string;
                    };
                    dialCode: string;
                    isoCode: string;
                    regionId: string;
                    method: "sms" | "telegram";
                }[];
                422: {
                    type: "validation";
                    on: string;
                    summary?: string;
                    message?: string;
                    found?: unknown;
                    property?: string;
                    expected?: string;
                };
            };
        };
    };
} & {
    sms: {};
} & {
    sms: {
        send: {
            post: {
                body: {
                    locale?: "en" | "zh" | "ja" | undefined;
                    codeLength?: number | undefined;
                    validTime?: number | undefined;
                    dialCode: string;
                    phoneNumber: string;
                };
                params: {};
                query: unknown;
                headers: unknown;
                response: {
                    200: {
                        requestId?: string | undefined;
                        method: "sms";
                        success: true;
                    } | {
                        method: "telegram";
                        success: true;
                        sessionId: string;
                        deepLink: string;
                        expiresAt: string;
                        ttl: number;
                    };
                    422: {
                        error: string;
                        success: false;
                    };
                    500: {
                        error: string;
                        success: false;
                    };
                    502: {
                        error: string;
                        success: false;
                    };
                };
            };
        };
    };
} & {
    sms: {
        verify: {
            post: {
                body: {
                    locale?: "en" | "zh" | "ja" | undefined;
                    code: string;
                    dialCode: string;
                    phoneNumber: string;
                };
                params: {};
                query: unknown;
                headers: unknown;
                response: {
                    200: {
                        success: true;
                        verified: boolean;
                    };
                    422: {
                        error: string;
                        success: false;
                    };
                    500: {
                        error: string;
                        success: false;
                    };
                    502: {
                        error: string;
                        success: false;
                    };
                };
            };
        };
    };
} & {
    sms: {
        status: {
            ":sessionId": {
                get: {
                    body: unknown;
                    params: {
                        sessionId: string;
                    };
                    query: {
                        locale?: "en" | "zh" | "ja" | undefined;
                    };
                    headers: unknown;
                    response: {
                        200: {
                            status: "pending";
                            success: true;
                        } | {
                            status: "verified";
                            success: true;
                            verifiedNumber: string;
                        } | {
                            status: "expired";
                            success: true;
                        };
                        404: {
                            error: string;
                            success: false;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    telegram: {
        webhook: {
            post: {
                body: unknown;
                params: {};
                query: unknown;
                headers: unknown;
                response: {
                    200: {
                        success: true;
                    };
                    403: {
                        error: string;
                        success: false;
                    };
                    404: {
                        error: string;
                        success: false;
                    };
                    422: {
                        type: "validation";
                        on: string;
                        summary?: string;
                        message?: string;
                        found?: unknown;
                        property?: string;
                        expected?: string;
                    };
                };
            };
        };
    };
}, {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {};
}, {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {
        200: {
            success: boolean;
            error: string;
        };
    };
} & {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
} & {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {};
}>;
type App = typeof app;

/**
 * Creates a fully typed Eden Treaty client for unified-sms.
 *
 * @param baseUrl - Base URL of the running server, e.g. `"http://127.0.0.1:3000"`
 * @param config  - Optional treaty config (custom `fetch`, default headers, etc.)
 *
 * @example
 * ```ts
 * import { createClient } from "unified-sms-client";
 *
 * const sms = createClient("http://127.0.0.1:3000", {
 *   headers: { authorization: "Bearer my-secret" },
 * });
 *
 * const { data, error } = await sms.sms.send.post({
 *   phoneNumber: "13800138000",
 *   dialCode: "86",
 * });
 * ```
 */
declare const createClient: (baseUrl: string, config?: Treaty.Config) => Treaty.Create<App>;
type Client = ReturnType<typeof createClient>;

export { type App, type Client, createClient };
