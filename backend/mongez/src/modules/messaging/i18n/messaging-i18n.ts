/**
 * Bilingual (Arabic / English) message helpers for the WhatsApp, Telegram and
 * shared messaging layers.
 *
 * Pure functions only — no DI — so they can be imported from any module
 * (channels, processors, command executor) without creating module cycles.
 *
 * Language selection follows the plan: render in the user's
 * `UserPreference.language` (`ar` or `en`), defaulting to `en`.
 */

export type MessagingLang = 'ar' | 'en';

export function normalizeLang(lang?: string | null): MessagingLang {
  return lang?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

// ─── Notification templates (Phase 1 channel rendering) ────────────────

type TemplateCtx = {
  title?: string | null;
  body?: string | null;
  actorName?: string | null;
  entityLabel?: string | null;
};

type TemplateRenderer = (ctx: TemplateCtx) => { title: string; body: string };

const NOTIFICATION_TEMPLATES: Record<
  string,
  Record<MessagingLang, TemplateRenderer>
> = {
  TASK_ASSIGNED: {
    en: (c) => ({
      title: '📋 Task assigned',
      body: c.body || c.title || 'A task was assigned to you.',
    }),
    ar: (c) => ({
      title: '📋 مهمة جديدة',
      body: c.body || c.title || 'تم تكليفك بمهمة جديدة.',
    }),
  },
  TASK_DUE: {
    en: (c) => ({
      title: '⏰ Task due soon',
      body: c.body || c.title || 'A task is due soon.',
    }),
    ar: (c) => ({
      title: '⏰ موعد تسليم قريب',
      body: c.body || c.title || 'اقترب موعد تسليم مهمة.',
    }),
  },
  APPROVAL_REQUESTED: {
    en: (c) => ({
      title: '✅ Approval requested',
      body: c.body || 'A task needs your approval.',
    }),
    ar: (c) => ({
      title: '✅ طلب موافقة',
      body: c.body || 'هناك مهمة بحاجة إلى موافقتك.',
    }),
  },
  WORKFLOW_APPROVAL_REQUEST: {
    en: (c) => ({
      title: '🔔 Approval needed',
      body: c.body || 'An approval step is waiting on you.',
    }),
    ar: (c) => ({
      title: '🔔 موافقة مطلوبة',
      body: c.body || 'هناك خطوة موافقة في انتظارك.',
    }),
  },
  APPROVAL_RESOLVED: {
    en: (c) => ({
      title: '🔏 Approval resolved',
      body: c.body || 'Your approval request was resolved.',
    }),
    ar: (c) => ({
      title: '🔏 تم البت في الطلب',
      body: c.body || 'تم البت في طلب الموافقة الخاص بك.',
    }),
  },
  COMMENT_MENTION: {
    en: (c) => ({
      title: '💬 You were mentioned',
      body: c.body || 'You were mentioned in a comment.',
    }),
    ar: (c) => ({
      title: '💬 تمت الإشارة إليك',
      body: c.body || 'تمت الإشارة إليك في تعليق.',
    }),
  },
  SYSTEM: {
    en: (c) => ({ title: c.title || 'Mongez', body: c.body || '' }),
    ar: (c) => ({ title: c.title || 'منجز', body: c.body || '' }),
  },
};

/**
 * Resolve a localized {title, body} for a notification. Falls back to the raw
 * stored title/body when no template exists for the given type.
 */
export function renderNotification(
  type: string,
  lang: MessagingLang,
  ctx: TemplateCtx,
): { title: string; body: string } {
  const tpl = NOTIFICATION_TEMPLATES[type]?.[lang];
  if (tpl) return tpl(ctx);
  // Fallback: keep the stored copy as-is (no translation available).
  return {
    title: ctx.title || 'Mongez',
    body: ctx.body || '',
  };
}

// ─── Command-response strings (Phase 2) ───────────────────────────────

const COMMAND_RESPONSES: Record<
  string,
  Record<MessagingLang, (...args: (string | number)[]) => string>
> = {
  UNKNOWN: {
    en: () => "Sorry, I didn't understand that. Send /help to see commands.",
    ar: () => 'عذرًا، لم أفهم الرسالة. أرسل /help لعرض الأوامر المتاحة.',
  },
  HELP: {
    en: () =>
      [
        '🤖 *Mongez commands*',
        '• /tasks — list my open tasks',
        '• /done <id> — mark a task complete',
        '• /approvals — list pending approvals',
        '• /approve <id> — approve a request',
        '• /reject <id> — reject a request',
      ].join('\n'),
    ar: () =>
      [
        '🤖 *أوامر منجز*',
        '• /tasks أو "مهامي" — عرض مهامي المفتوحة',
        '• /done <id> أو "تم <id>" — إنهاء مهمة',
        '• /approvals أو "موافقاتي" — عرض طلبات الموافقة',
        '• /approve <id> أو "موافق <id>" — الموافقة على طلب',
        '• /reject <id> أو "رفض <id>" — رفض طلب',
      ].join('\n'),
  },
  NO_TASKS: {
    en: () => '✅ You have no open tasks.',
    ar: () => '✅ لا توجد لديك مهام مفتوحة.',
  },
  TASKS_HEADER: {
    en: (n: number) => `📝 You have ${n} open task(s):`,
    ar: (n: number) => `📝 لديك ${n} مهمة مفتوحة:`,
  },
  TASK_DONE: {
    en: (id: string) => `✅ Task ${id} marked as done.`,
    ar: (id: string) => `✅ تم إنهاء المهمة ${id}.`,
  },
  TASK_NOT_FOUND: {
    en: (id: string) => `⚠️ Task "${id}" was not found.`,
    ar: (id: string) => `⚠️ لم يتم العثور على المهمة "${id}".`,
  },
  TASK_DONE_FORBIDDEN: {
    en: () => '⛔ You are not allowed to update this task.',
    ar: () => '⛔ ليس مسموحًا لك بتعديل هذه المهمة.',
  },
  MISSING_ID: {
    en: (cmd: string) => `⚠️ Usage: ${cmd} <id>`,
    ar: (cmd: string) => `⚠️ الاستخدام: ${cmd} <id>`,
  },
  NO_APPROVALS: {
    en: () => '✅ No approvals pending your decision.',
    ar: () => '✅ لا توجد موافقات في انتظار قرارك.',
  },
  APPROVALS_HEADER: {
    en: (n: number) => `🔔 ${n} approval(s) waiting on you:`,
    ar: (n: number) => `🔔 ${n} طلب موافقة في انتظارك:`,
  },
  APPROVED: {
    en: (id: string) => `✅ Request ${id} approved.`,
    ar: (id: string) => `✅ تمت الموافقة على الطلب ${id}.`,
  },
  REJECTED: {
    en: (id: string) => `⛔ Request ${id} rejected.`,
    ar: (id: string) => `⛔ تم رفض الطلب ${id}.`,
  },
  APPROVAL_NOT_FOUND: {
    en: (id: string) => `⚠️ Approval "${id}" was not found or is not yours.`,
    ar: (id: string) => `⚠️ لم يتم العثور على الموافقة "${id}".`,
  },
  NOT_LINKED: {
    en: () => '🔒 Your account is not linked to a Mongez workspace yet.',
    ar: () => '🔒 لم يتم ربط حسابك بمساحة عمل في منجز بعد.',
  },
  APPROVAL_PROMPT: {
    en: (title: string, body: string) =>
      `🔔 *${title || 'Approval needed'}*\n${body || ''}\n\nTap a button to decide.`,
    ar: (title: string, body: string) =>
      `🔔 *${title || 'موافقة مطلوبة'}*\n${body || ''}\n\nاضغط على زر لاتخاذ القرار.`,
  },
  APPROVAL_BUTTON_APPROVE: {
    en: () => 'Approve',
    ar: () => 'موافق',
  },
  APPROVAL_BUTTON_REJECT: {
    en: () => 'Reject',
    ar: () => 'رفض',
  },
};

export function msg(
  key: keyof typeof COMMAND_RESPONSES,
  lang: MessagingLang,
  ...args: (string | number)[]
): string {
  const r = COMMAND_RESPONSES[key]?.[lang];
  return r ? r(...args) : '';
}

/** Approval callback payload encoding (shared by WA/Telegram interactive messages). */
export function encodeApprovalCallback(
  decision: 'approve' | 'reject',
  instanceId: string,
): string {
  return `${decision}:${instanceId}`;
}

export function decodeApprovalCallback(
  data: string,
): { decision: 'approve' | 'reject'; instanceId: string } | null {
  const [decision, instanceId] = data.split(':');
  if ((decision === 'approve' || decision === 'reject') && instanceId) {
    return { decision, instanceId };
  }
  return null;
}
