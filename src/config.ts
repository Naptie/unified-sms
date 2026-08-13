function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT) || 3000,
  apiSecret: requireEnv("API_SECRET"),
  aliyun: {
    accessKeyId: requireEnv("ALIYUN_ACCESS_KEY_ID"),
    accessKeySecret: requireEnv("ALIYUN_ACCESS_KEY_SECRET"),
    signName: requireEnv("ALIYUN_SIGN_NAME"),
    templateCode: requireEnv("ALIYUN_TEMPLATE_CODE"),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL ?? "",
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
    sessionTtlSeconds: Math.max(1, Number(process.env.TELEGRAM_SESSION_TTL) || 600),
    maxConnections: Math.min(100, Math.max(1, Number(process.env.TELEGRAM_MAX_CONNECTIONS) || 5)),
  },
} as const;
