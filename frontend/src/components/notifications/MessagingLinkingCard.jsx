import { useEffect, useState } from "react";
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
  // Telegram scanner state
  const [unlinkedChats, setUnlinkedChats] = useState([]);
  const [tgScanning, setTgScanning] = useState(false);
  const [tgError, setTgError] = useState("");
  const [tgSuccess, setTgSuccess] = useState("");

  // Telegram manual pair state
  const [tgManualChatId, setTgManualChatId] = useState("");
  const [tgManualUsername, setTgManualUsername] = useState("");

  // WhatsApp verification state
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
      const res = await getTelegramUnlinkedChats(spaceId);
      setUnlinkedChats(res.chats || []);
      if (res.chats?.length === 0) {
        setTgSuccess("No new active chats found. Make sure you sent /start to the bot first.");
      }
    } catch (err) {
      setTgError(err.response?.data?.message || err.message || "Failed to scan chats");
    } finally {
      setTgScanning(false);
    }
  };

  const handlePairTelegram = async (chatId, username) => {
    setTgError("");
    setTgSuccess("");
    try {
      await linkTelegramContact(spaceId, { chatId, username });
      setTgSuccess("Telegram account successfully paired!");
      onRefetch();
    } catch (err) {
      setTgError(err.response?.data?.message || err.message || "Failed to pair Telegram");
    }
  };

  const handleManualPairTelegram = async (e) => {
    e.preventDefault();
    if (!tgManualChatId.trim()) return;
    setTgError("");
    setTgSuccess("");
    try {
      await linkTelegramContact(spaceId, {
        chatId: tgManualChatId.trim(),
        username: tgManualUsername.trim() || undefined,
      });
      setTgSuccess("Telegram account paired manually!");
      setTgManualChatId("");
      setTgManualUsername("");
      onRefetch();
    } catch (err) {
      setTgError(err.response?.data?.message || err.message || "Failed to pair Telegram");
    }
  };

  const handleDisconnectTelegram = async () => {
    setTgError("");
    setTgSuccess("");
    try {
      await unlinkTelegramContact(spaceId);
      setTgSuccess("Telegram bot disconnected.");
      onRefetch();
    } catch (err) {
      setTgError(err.response?.data?.message || err.message || "Failed to disconnect Telegram");
    }
  };

  const handleRequestWhatsAppOtp = async (e) => {
    e.preventDefault();
    if (!waPhoneNumber.trim()) return;
    setWaError("");
    setWaSuccess("");
    setWaLoading(true);
    try {
      await requestWhatsAppOtp(spaceId, { phoneNumber: waPhoneNumber.trim() });
      setWaOtpRequested(true);
      setWaSuccess("OTP code sent to your WhatsApp number.");
    } catch (err) {
      setWaError(err.response?.data?.message || err.message || "Failed to send code");
    } finally {
      setWaLoading(false);
    }
  };

  const handleConfirmWhatsAppOtp = async (e) => {
    e.preventDefault();
    if (!waOtpCode.trim()) return;
    setWaError("");
    setWaSuccess("");
    setWaLoading(true);
    try {
      await confirmWhatsAppOtp(spaceId, {
        phoneNumber: waPhoneNumber.trim(),
        code: waOtpCode.trim(),
      });
      setWaSuccess("WhatsApp successfully linked!");
      onRefetch();
    } catch (err) {
      setWaError(err.response?.data?.message || err.message || "Failed to verify code");
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setWaError("");
    setWaSuccess("");
    try {
      await unlinkWhatsAppContact(spaceId);
      setWaSuccess("WhatsApp notifications disabled.");
      onRefetch();
    } catch (err) {
      setWaError(err.response?.data?.message || err.message || "Failed to disconnect WhatsApp");
    }
  };

  const tgBotLink = telegramStatus?.botUsername
    ? `https://t.me/${telegramStatus.botUsername.replace("@", "")}`
    : null;

  const isTgConnected = telegramStatus?.contact?.isVerified && telegramStatus?.contact?.optedIn;
  const isWaConnected = whatsappStatus?.contact?.isVerified && whatsappStatus?.contact?.optedIn;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Telegram Card */}
      <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
            <h3 className="text-md font-bold text-slate-805 dark:text-slate-100 flex items-center gap-2">
              <i className="fa-brands fa-telegram text-sky-500 text-lg" />
              Telegram Channel
            </h3>
            {isTgConnected && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                Connected
              </span>
            )}
          </div>

          {!telegramStatus?.configured ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800/60">
              ⚠️ Telegram is not configured for this workspace. Ask your admin to setup the Bot Token under App Integrations.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {tgError && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/10 p-3 text-xs text-red-700 dark:text-red-400">
                  {tgError}
                </div>
              )}
              {tgSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                  {tgSuccess}
                </div>
              )}

              {isTgConnected ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Linked account username: <strong className="text-slate-800 dark:text-slate-100">{telegramStatus.contact.username || "@" + telegramStatus.contact.chatId}</strong>
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Chat ID: <span className="font-mono">{telegramStatus.contact.chatId}</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Link your Telegram to receive task updates and approvals directly on your device.
                  </p>
                  
                  {tgBotLink && (
                    <div className="rounded-xl bg-sky-50/50 dark:bg-sky-950/20 p-3 border border-sky-100/50 dark:border-sky-900/30 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-sky-700 dark:text-sky-400 block mb-1">Step 1: Open the bot</span>
                      Click here to start a chat with our bot:{" "}
                      <a href={tgBotLink} target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 underline font-semibold">
                        {telegramStatus.botUsername}
                      </a>{" "}
                      and click <strong>Start</strong>.
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Step 2: Connect Chat</span>
                    <button
                      type="button"
                      onClick={handleTelegramScan}
                      disabled={tgScanning}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 text-sm font-semibold transition cursor-pointer border border-transparent dark:border-slate-700/50"
                    >
                      <i className={`fa-solid fa-arrows-spin ${tgScanning ? "animate-spin" : ""}`} />
                      {tgScanning ? "Scanning recent messages..." : "Scan for My Chat"}
                    </button>
                  </div>

                  {unlinkedChats.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Recent active chats:</span>
                      <div className="grid gap-1">
                        {unlinkedChats.map((c) => (
                          <button
                            key={c.chatId}
                            type="button"
                            onClick={() => handlePairTelegram(c.chatId, c.username)}
                            className="flex items-center justify-between text-left p-2 rounded-lg border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30 hover:bg-sky-50 dark:hover:bg-sky-950/20 hover:border-sky-300 dark:hover:border-sky-900 text-xs font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer"
                          >
                            <span>
                              {c.username ? <strong>@{c.username}</strong> : <span className="text-slate-400">Anonymous</span>}{" "}
                              <span className="text-slate-400 dark:text-slate-500 font-mono">({c.chatId})</span>
                            </span>
                            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">Pair Account</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Backup pairing */}
                  <form onSubmit={handleManualPairTelegram} className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Or pair manually</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Telegram Chat ID"
                        value={tgManualChatId}
                        onChange={(e) => setTgManualChatId(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <input
                        type="text"
                        placeholder="Username (optional)"
                        value={tgManualUsername}
                        onChange={(e) => setTgManualUsername(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-slate-100 dark:text-slate-900 text-white text-xs font-semibold px-3 py-1.5 transition cursor-pointer"
                      >
                        Link
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {isTgConnected && (
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end">
            <button
              type="button"
              onClick={handleDisconnectTelegram}
              className="text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/20 hover:bg-red-100/50 border border-red-200/50 dark:border-red-900/30 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              Disconnect Bot
            </button>
          </div>
        )}
      </div>

      {/* WhatsApp Card */}
      <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
            <h3 className="text-md font-bold text-slate-805 dark:text-slate-100 flex items-center gap-2">
              <i className="fa-brands fa-whatsapp text-green-500 text-lg" />
              WhatsApp Channel
            </h3>
            {isWaConnected && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                Connected
              </span>
            )}
          </div>

          {!whatsappStatus?.configured ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800/60">
              ⚠️ WhatsApp messaging is not configured for this workspace. Ask your admin to setup Phone Number ID under App Integrations.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {waError && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/10 p-3 text-xs text-red-700 dark:text-red-400">
                  {waError}
                </div>
              )}
              {waSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                  {waSuccess}
                </div>
              )}

              {isWaConnected ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Linked phone number: <strong className="text-slate-800 dark:text-slate-100">{whatsappStatus.contact.phoneNumber}</strong>
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Status: Verified and active.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Verify your phone number to receive critical notifications on WhatsApp.
                  </p>

                  {!waOtpRequested ? (
                    <form onSubmit={handleRequestWhatsAppOtp} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Phone Number</label>
                        <input
                          type="text"
                          placeholder="e.g. +201002345678"
                          value={waPhoneNumber}
                          onChange={(e) => setWaPhoneNumber(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={waLoading}
                        className="w-full rounded-xl bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 text-sm font-semibold transition cursor-pointer"
                      >
                        {waLoading ? "Sending Code..." : "Send Verification Code"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmWhatsAppOtp} className="space-y-3">
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Entering code for <strong className="text-slate-600 dark:text-slate-300">{waPhoneNumber}</strong>.
                      </p>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">6-Digit Code</label>
                        <input
                          type="text"
                          placeholder="Enter 6-digit code"
                          value={waOtpCode}
                          onChange={(e) => setWaOtpCode(e.target.value)}
                          maxLength={6}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:bg-white text-center font-bold tracking-widest text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWaOtpRequested(false)}
                          className="flex-1 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300 px-4 py-2.5 text-sm font-semibold transition cursor-pointer"
                        >
                          Change Number
                        </button>
                        <button
                          type="submit"
                          disabled={waLoading}
                          className="flex-1 rounded-xl bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 text-sm font-semibold transition cursor-pointer"
                        >
                          {waLoading ? "Confirming..." : "Verify Code"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {isWaConnected && (
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end">
            <button
              type="button"
              onClick={handleDisconnectWhatsApp}
              className="text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/20 hover:bg-red-100/50 border border-red-200/50 dark:border-red-900/30 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              Disconnect WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagingLinkingCard;
