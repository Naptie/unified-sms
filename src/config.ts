function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  apiSecret: requireEnv("API_SECRET"),
  aliyun: {
    accessKeyId: requireEnv("ALIYUN_ACCESS_KEY_ID"),
    accessKeySecret: requireEnv("ALIYUN_ACCESS_KEY_SECRET"),
    signName: requireEnv("ALIYUN_SIGN_NAME"),
    templateCode: requireEnv("ALIYUN_TEMPLATE_CODE"),
  },
} as const;
