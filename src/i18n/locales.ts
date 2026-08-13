export const LOCALES = ["en", "zh", "ja"] as const;

export type Locale = (typeof LOCALES)[number];

interface TranslationDict {
  [key: string]: string;
}

export const RESOURCES: Record<Locale, { translation: TranslationDict }> = {
  en: {
    translation: {
      "sms.send.invalidPhone": "Invalid phone number or dial code",
      "sms.send.telegramUnavailable": "Telegram verification is not configured on this server",
      "sms.send.startFailed": "Failed to start verification. Please try again later.",
      "sms.send.noProvider": "No SMS provider is registered for this dial code",
      "sms.send.sendFailed": "Failed to send SMS. Please try again later.",
      "sms.verify.telegramChannel":
        "Numbers outside China Mainland are verified via the Telegram bot; " +
        "poll GET /sms/status/:sessionId instead of submitting a code.",
      "sms.verify.noProvider": "No SMS provider is registered for this dial code",
      "sms.verify.verifyFailed": "Failed to verify code. Please try again later.",
      "sms.status.notFound": "Unknown verification session",
      "bot.start.noPayload":
        "Start the verification on the website to get your personal verification link.",
      "bot.start.invalid":
        "This verification link is invalid. Please return to the website and start again.",
      "bot.start.verified": "This link has already been verified. You can return to the app.",
      "bot.start.expired":
        "This verification link has expired. Please return to the website and start again.",
      "bot.start.claimed":
        "This verification link was already claimed by another Telegram account. " +
        "Please return to the website and start again.",
      "bot.start.prompt":
        "Please click the 'Share Phone Number' button below to verify your account.",
      "bot.contact.noSession":
        "No active verification found. Return to the website and tap the verification link to start.",
      "bot.contact.notOwn":
        "You must share your own phone number using the 'Share Phone Number' button.",
      "bot.contact.numberMismatch":
        "The number you shared (+{{shared}}) does not match the number you entered on the website. " +
        "Please return to the website and start over with the number registered on this Telegram account.",
      "bot.contact.sessionInvalid":
        "This verification session is no longer valid. Please return to the website and start again.",
      "bot.contact.verified": "Verified! You can now return to the app.",
      "bot.other.returnToApp": "Return to the app and tap the verification link to start.",
      "bot.keyboard.share": "Share Phone Number",
    },
  },
  zh: {
    translation: {
      "sms.send.invalidPhone": "无效的手机号或区号",
      "sms.send.telegramUnavailable": "该服务器未配置 Telegram 验证",
      "sms.send.startFailed": "启动验证失败，请稍后重试。",
      "sms.send.noProvider": "该区号没有注册短信服务商",
      "sms.send.sendFailed": "短信发送失败，请稍后重试。",
      "sms.verify.telegramChannel":
        "中国大陆以外的号码通过 Telegram 机器人验证；请改用 GET /sms/status/:sessionId 轮询，" +
        "而不是提交验证码。",
      "sms.verify.noProvider": "该区号没有注册短信服务商",
      "sms.verify.verifyFailed": "验证码校验失败，请稍后重试。",
      "sms.status.notFound": "验证会话不存在",
      "bot.start.noPayload": "请先在网站上发起验证，获取您的专属验证链接。",
      "bot.start.invalid": "此验证链接无效，请返回网站重新开始。",
      "bot.start.verified": "此链接已完成验证，您可以返回应用。",
      "bot.start.expired": "此验证链接已过期，请返回网站重新开始。",
      "bot.start.claimed": "此验证链接已被其他 Telegram 账号认领，请返回网站重新开始。",
      "bot.start.prompt": "请点击下方「分享电话号码」按钮完成验证。",
      "bot.contact.noSession": "没有进行中的验证，请返回网站点击验证链接重新开始。",
      "bot.contact.notOwn": "您必须通过「分享电话号码」按钮分享您自己的号码。",
      "bot.contact.numberMismatch":
        "您分享的号码（+{{shared}}）与网站上填写的号码不一致，请返回网站，使用本 Telegram 账号" +
        "绑定的号码重新开始。",
      "bot.contact.sessionInvalid": "此验证会话已失效，请返回网站重新开始。",
      "bot.contact.verified": "验证成功！您现在可以返回应用了。",
      "bot.other.returnToApp": "请返回应用并点击验证链接开始验证。",
      "bot.keyboard.share": "分享电话号码",
    },
  },
  ja: {
    translation: {
      "sms.send.invalidPhone": "電話番号または国番号が無効です",
      "sms.send.telegramUnavailable": "このサーバーには Telegram 認証が設定されていません",
      "sms.send.startFailed":
        "認証を開始できませんでした。しばらくしてからもう一度お試しください。",
      "sms.send.noProvider": "この国番号には SMS プロバイダーが登録されていません",
      "sms.send.sendFailed": "SMS の送信に失敗しました。しばらくしてからもう一度お試しください。",
      "sms.verify.telegramChannel":
        "中国本土以外の番号は Telegram ボットで認証されます。コードの代わりに " +
        "GET /sms/status/:sessionId をポーリングしてください。",
      "sms.verify.noProvider": "この国番号には SMS プロバイダーが登録されていません",
      "sms.verify.verifyFailed":
        "コードの検証に失敗しました。しばらくしてからもう一度お試しください。",
      "sms.status.notFound": "不明な認証セッションです",
      "bot.start.noPayload": "Web サイトで認証を開始すると、専用の認証リンクが発行されます。",
      "bot.start.invalid":
        "この認証リンクは無効です。Web サイトに戻ってもう一度やり直してください。",
      "bot.start.verified": "このリンクはすでに認証済みです。アプリに戻ってください。",
      "bot.start.expired":
        "この認証リンクは期限切れです。Web サイトに戻ってもう一度やり直してください。",
      "bot.start.claimed":
        "この認証リンクは別の Telegram アカウントによってすでに使用されています。Web サイトに戻って" +
        "もう一度やり直してください。",
      "bot.start.prompt": "下の「電話番号を共有」ボタンをタップして認証してください。",
      "bot.contact.noSession":
        "進行中の認証が見つかりません。Web サイトに戻り、認証リンクをタップして開始してください。",
      "bot.contact.notOwn": "「電話番号を共有」ボタンでご自身の電話番号を共有してください。",
      "bot.contact.numberMismatch":
        "共有された番号（+{{shared}}）が Web サイトで入力した番号と一致しません。この Telegram " +
        "アカウントに登録されている番号で Web サイトに戻り、やり直してください。",
      "bot.contact.sessionInvalid":
        "この認証セッションは無効です。Web サイトに戻ってもう一度やり直してください。",
      "bot.contact.verified": "認証完了！アプリに戻ることができます。",
      "bot.other.returnToApp": "アプリに戻り、認証リンクをタップして開始してください。",
      "bot.keyboard.share": "電話番号を共有",
    },
  },
};
