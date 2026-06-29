import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import {
  getTelegramUnlinkedChats,
  linkTelegramContact,
  unlinkTelegramContact,
  requestWhatsAppOtp,
  confirmWhatsAppOtp,
  unlinkWhatsAppContact,
} from "../../services/api/notificationService";

const MessagingLinkingCard = ({
  spaceId,
  telegramStatus,
  whatsappStatus,
  onRefetch,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  const [unlinkedChats, setUnlinkedChats] = useState([]);
  const [tgScanning, setTgScanning] = useState(false);
  const [tgError, setTgError] = useState("");
  const [tgSuccess, setTgSuccess] = useState("");
  const [tgManualChatId, setTgManualChatId] = useState("");
  const [tgManualUsername, setTgManualUsername] = useState("");
  const [waPhoneNumber, setWaPhoneNumber] = useState("");
  const [waOtpCode, setWaOtpCode] = useState("");
  const [waOtpRequested, setWaOtpRequested] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState("");
  const [waSuccess, setWaSuccess] = useState("");

  const handleTelegramScan = async () => {
    setTgScanning(true);
    setTgError("");
    setTgSuccess("");
    try {
      const response = await getTelegramUnlinkedChats(spaceId);
      setUnlinkedChats(response.chats || []);
      if (response.chats?.length === 0) {
        setTgSuccess(t("notificationsPage.messagingLinking.noNewChats"));
      }
    } catch (error) {
      setTgError(error.response?.data?.message || error.message || t("notificationsPage.messagingLinking.telegramScanFailed"));
    } finally {
      setTgScanning(false);
    }
  };

  const handlePairTelegram = async (chatId, username) => {
    setTgError("");
    setTgSuccess("");
    try {
      await linkTelegramContact(spaceId, { chatId, username });
      setTgSuccess(t("notificationsPage.messagingLinking.telegramLinked"));
      onRefetch();
    } catch (error) {
      setTgError(error.response?.data?.message || error.message || t("notificationsPage.messagingLinking.telegramPairFailed"));
    }
  };

  const handleManualPairTelegram = async (event) => {
    event.preventDefault();
    if (!tgManualChatId.trim()) {
      return;
    }

    setTgError("");
    setTgSuccess("");
    try {
      await linkTelegramContact(spaceId, {
        chatId: tgManualChatId.trim(),
        username: tgManualUsername.trim() || undefined,
      });
      setTgSuccess(t("notificationsPage.messagingLinking.telegramLinkedManual"));
      setTgManualChatId("");
      setTgManualUsername("");
      onRefetch();
    } catch (error) {
      setTgError(error.response?.data?.message || error.message || t("notificationsPage.messagingLinking.telegramPairFailed"));
    }
  };

  const handleDisconnectTelegram = async () => {
    setTgError("");
    setTgSuccess("");
    try {
      await unlinkTelegramContact(spaceId);
      setTgSuccess(t("notificationsPage.messagingLinking.telegramDisconnected"));
      onRefetch();
    } catch (error) {
      setTgError(error.response?.data?.message || error.message || t("notificationsPage.messagingLinking.telegramDisconnectFailed"));
    }
  };

  const handleRequestWhatsAppOtp = async (event) => {
    event.preventDefault();
    if (!waPhoneNumber.trim()) {
      return;
    }

    setWaError("");
    setWaSuccess("");
    setWaLoading(true);
    try {
      await requestWhatsAppOtp(spaceId, { phoneNumber: waPhoneNumber.trim() });
      setWaOtpRequested(true);
      setWaSuccess(t("notificationsPage.messagingLinking.whatsappCodeSent"));
    } catch (error) {
      setWaError(error.response?.data?.message || error.message || t("notificationsPage.messagingLinking.whatsappSendFailed"));
    } finally {
      setWaLoading(false);
    }
  };

  const handleConfirmWhatsAppOtp = async (event) => {
    event.preventDefault();
    if (!waOtpCode.trim()) {
      return;
    }

    setWaError("");
    setWaSuccess("");
    setWaLoading(true);
    try {
      await confirmWhatsAppOtp(spaceId, {
        phoneNumber: waPhoneNumber.trim(),
        code: waOtpCode.trim(),
      });
      setWaSuccess(t("notificationsPage.messagingLinking.whatsappLinked"));
      onRefetch();
    } catch (error) {
      setWaError(error.response?.data?.message || error.message || t("notificationsPage.messagingLinking.whatsappVerifyFailed"));
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setWaError("");
    setWaSuccess("");
    try {
      await unlinkWhatsAppContact(spaceId);
      setWaSuccess(t("notificationsPage.messagingLinking.whatsappDisconnected"));
      onRefetch();
    } catch (error) {
      setWaError(error.response?.data?.message || error.message || t("notificationsPage.messagingLinking.whatsappDisconnectFailed"));
    }
  };

  const tgBotLink = telegramStatus?.botUsername
    ? `https://t.me/${telegramStatus.botUsername.replace("@", "")}`
    : null;

  const isTgConnected = telegramStatus?.contact?.isVerified && telegramStatus?.contact?.optedIn;
  const isWaConnected = whatsappStatus?.contact?.isVerified && whatsappStatus?.contact?.optedIn;

  return (
    <div className="grid gap-6 md:grid-cols-2" dir={isRTL ? "rtl" : "ltr"}>
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className={`flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800/60 ${isRTL ? "flex-row-reverse" : ""}`}>
            <h3 className={`flex items-center gap-2 text-md font-bold text-slate-805 dark:text-slate-100 ${isRTL ? "flex-row-reverse" : ""}`}>
              <i className="fa-brands fa-telegram text-lg text-sky-500" />
              {t("notificationsPage.messagingLinking.telegramTitle")}
            </h3>
            {isTgConnected ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                {t("notificationsPage.messagingLinking.connected")}
              </span>
            ) : null}
          </div>

          {!telegramStatus?.configured ? (
            <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800/60 dark:bg-slate-950/40 dark:text-slate-400">
              {t("notificationsPage.messagingLinking.telegramNotConfigured")}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {tgError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400">
                  {tgError}
                </div>
              ) : null}
              {tgSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/10 dark:text-emerald-400">
                  {tgSuccess}
                </div>
              ) : null}

              {isTgConnected ? (
                <div className="space-y-3">
                  <p className={`text-sm text-slate-600 dark:text-slate-300 ${isRTL ? "text-right" : "text-left"}`}>
                    {t("notificationsPage.messagingLinking.linkedUsername", {
                      value: telegramStatus.contact.username || `@${telegramStatus.contact.chatId}`,
                    })}
                  </p>
                  <p className={`text-xs text-slate-400 dark:text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
                    {t("notificationsPage.messagingLinking.chatId", {
                      value: telegramStatus.contact.chatId,
                    })}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className={`text-sm leading-relaxed text-slate-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                    {t("notificationsPage.messagingLinking.telegramIntro")}
                  </p>

                  {tgBotLink ? (
                    <div className={`rounded-xl border border-sky-100/50 bg-sky-50/50 p-3 text-xs text-slate-600 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                      <span className="mb-1 block font-bold text-sky-700 dark:text-sky-400">
                        {t("notificationsPage.messagingLinking.step1")}
                      </span>
                      {t("notificationsPage.messagingLinking.step1Description")}{" "}
                      <a
                        href={tgBotLink}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-sky-600 underline hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                      >
                        {telegramStatus.botUsername}
                      </a>{" "}
                      {t("notificationsPage.messagingLinking.step1Action")}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <span className={`block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                      {t("notificationsPage.messagingLinking.step2")}
                    </span>
                    <button
                      type="button"
                      onClick={handleTelegramScan}
                      disabled={tgScanning}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <i className={`fa-solid fa-arrows-spin ${tgScanning ? "animate-spin" : ""}`} />
                      {tgScanning
                        ? t("notificationsPage.messagingLinking.scanLoading")
                        : t("notificationsPage.messagingLinking.scanIdle")}
                    </button>
                  </div>

                  {unlinkedChats.length > 0 ? (
                    <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <span className={`block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                        {t("notificationsPage.messagingLinking.recentChats")}
                      </span>
                      <div className="grid gap-1">
                        {unlinkedChats.map((chat) => (
                          <button
                            key={chat.chatId}
                            type="button"
                            onClick={() => handlePairTelegram(chat.chatId, chat.username)}
                            className={`flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300 dark:hover:border-sky-900 dark:hover:bg-sky-950/20 ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                          >
                            <span>
                              {chat.username ? <strong>@{chat.username}</strong> : <span className="text-slate-400">{t("notificationsPage.messagingLinking.anonymous")}</span>}{" "}
                              <span className="font-mono text-slate-400 dark:text-slate-500">({chat.chatId})</span>
                            </span>
                            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                              {t("notificationsPage.messagingLinking.pairAccount")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <form onSubmit={handleManualPairTelegram} className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className={`block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
                      {t("notificationsPage.messagingLinking.pairManual")}
                    </span>
                    <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <input
                        type="text"
                        placeholder={t("notificationsPage.messagingLinking.chatIdPlaceholder")}
                        value={tgManualChatId}
                        onChange={(event) => setTgManualChatId(event.target.value)}
                        className={`flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 ${isRTL ? "text-right" : "text-left"}`}
                      />
                      <input
                        type="text"
                        placeholder={t("notificationsPage.messagingLinking.usernamePlaceholder")}
                        value={tgManualUsername}
                        onChange={(event) => setTgManualUsername(event.target.value)}
                        className={`flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 ${isRTL ? "text-right" : "text-left"}`}
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100"
                      >
                        {t("notificationsPage.messagingLinking.link")}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {isTgConnected ? (
          <div className={`mt-6 flex border-t border-slate-100 pt-4 dark:border-slate-800 ${isRTL ? "justify-start" : "justify-end"}`}>
            <button
              type="button"
              onClick={handleDisconnectTelegram}
              className="rounded-xl border border-red-200/50 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100/50 hover:text-red-600 dark:border-red-900/30 dark:bg-red-950/20"
            >
              {t("notificationsPage.messagingLinking.disconnectTelegram")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className={`flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800/60 ${isRTL ? "flex-row-reverse" : ""}`}>
            <h3 className={`flex items-center gap-2 text-md font-bold text-slate-805 dark:text-slate-100 ${isRTL ? "flex-row-reverse" : ""}`}>
              <i className="fa-brands fa-whatsapp text-lg text-green-500" />
              {t("notificationsPage.messagingLinking.whatsappTitle")}
            </h3>
            {isWaConnected ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                {t("notificationsPage.messagingLinking.connected")}
              </span>
            ) : null}
          </div>

          {!whatsappStatus?.configured ? (
            <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800/60 dark:bg-slate-950/40 dark:text-slate-400">
              {t("notificationsPage.messagingLinking.whatsappNotConfigured")}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {waError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400">
                  {waError}
                </div>
              ) : null}
              {waSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/10 dark:text-emerald-400">
                  {waSuccess}
                </div>
              ) : null}

              {isWaConnected ? (
                <div className="space-y-2">
                  <p className={`text-sm text-slate-600 dark:text-slate-300 ${isRTL ? "text-right" : "text-left"}`}>
                    {t("notificationsPage.messagingLinking.linkedPhone", {
                      value: whatsappStatus.contact.phoneNumber,
                    })}
                  </p>
                  <p className={`text-xs text-slate-400 dark:text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
                    {t("notificationsPage.messagingLinking.verifiedActive")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className={`text-sm leading-relaxed text-slate-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                    {t("notificationsPage.messagingLinking.whatsappIntro")}
                  </p>

                  {!waOtpRequested ? (
                    <form onSubmit={handleRequestWhatsAppOtp} className="space-y-3">
                      <div className="space-y-1">
                        <label className={`block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                          {t("notificationsPage.messagingLinking.phoneNumber")}
                        </label>
                        <input
                          type="text"
                          placeholder={t("notificationsPage.messagingLinking.phoneNumberPlaceholder")}
                          value={waPhoneNumber}
                          onChange={(event) => setWaPhoneNumber(event.target.value)}
                          className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 ${isRTL ? "text-right" : "text-left"}`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={waLoading}
                        className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {waLoading
                          ? t("notificationsPage.messagingLinking.sendingCode")
                          : t("notificationsPage.messagingLinking.sendCode")}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmWhatsAppOtp} className="space-y-3">
                      <p className={`text-xs text-slate-400 dark:text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
                        {t("notificationsPage.messagingLinking.enteringCodeFor", {
                          value: waPhoneNumber,
                        })}
                      </p>
                      <div className="space-y-1">
                        <label className={`block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                          {t("notificationsPage.messagingLinking.codeLabel")}
                        </label>
                        <input
                          type="text"
                          placeholder={t("notificationsPage.messagingLinking.codePlaceholder")}
                          value={waOtpCode}
                          onChange={(event) => setWaOtpCode(event.target.value)}
                          maxLength={6}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-bold tracking-widest text-slate-800 outline-none focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                      <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <button
                          type="button"
                          onClick={() => setWaOtpRequested(false)}
                          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50"
                        >
                          {t("notificationsPage.messagingLinking.changeNumber")}
                        </button>
                        <button
                          type="submit"
                          disabled={waLoading}
                          className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {waLoading
                            ? t("notificationsPage.messagingLinking.confirming")
                            : t("notificationsPage.messagingLinking.verifyCode")}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {isWaConnected ? (
          <div className={`mt-6 flex border-t border-slate-100 pt-4 dark:border-slate-800 ${isRTL ? "justify-start" : "justify-end"}`}>
            <button
              type="button"
              onClick={handleDisconnectWhatsApp}
              className="rounded-xl border border-red-200/50 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100/50 hover:text-red-600 dark:border-red-900/30 dark:bg-red-950/20"
            >
              {t("notificationsPage.messagingLinking.disconnectWhatsApp", {
                defaultValue: isRTL ? "فصل واتساب" : "Disconnect WhatsApp",
              })}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MessagingLinkingCard;
