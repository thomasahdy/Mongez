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
  taskIdentifier?: string | null;
  dueDate?: string | null;
  boardName?: string | null;
};

type TemplateRenderer = (ctx: TemplateCtx) => { title: string; body: string };

const NOTIFICATION_TEMPLATES: Record<
  string,
  Record<MessagingLang, TemplateRenderer>
> = {
  TASK_ASSIGNED: {
    en: (c) => ({
      title: '📋 Task assigned',
      body: `${c.taskIdentifier || c.title || 'A task'} was assigned to you${c.actorName ? ` by ${c.actorName}` : ''}.${c.boardName ? `\n\nBoard: ${c.boardName}` : ''}`,
    }),
    ar: (c) => ({
      title: '📋 مهمة جديدة',
      body: `${c.actorName ? `قام ${c.actorName} بتعيين` : 'تم تعيين'} ${c.taskIdentifier || c.title || 'مهمة'} إليك.${c.boardName ? `\n\nاللوح: ${c.boardName}` : ''}`,
    }),
  },
  TASK_DUE: {
    en: (c) => ({
      title: '⏰ Task due soon',
      body: `${c.taskIdentifier || c.title || 'A task'} is due soon${c.dueDate ? ` at ${c.dueDate}` : ''}.`,
    }),
    ar: (c) => ({
      title: '⏰ موعد تسليم قريب',
      body: `${c.taskIdentifier || c.title || 'مهمة'} موعد تسليمه قريب${c.dueDate ? ` ${c.dueDate}` : ''}.`,
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
      body: `${c.actorName || 'Someone'} mentioned you in a comment${c.entityLabel ? ` on ${c.entityLabel}` : ''}.`,
    }),
    ar: (c) => ({
      title: '💬 تمت الإشارة إليك',
      body: `${c.actorName || 'شخص ما'} أشركك في تعليق${c.entityLabel ? ` على ${c.entityLabel}` : ''}.`,
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
        '• /inbox — review your inbox (approvals, mentions, tasks)',
        '• /tasks — list my open tasks',
        '• /done <id> — mark a task complete',
        '• /approvals — list pending approvals',
        '• /approve <id> — approve a request',
        '• /reject <id> — reject a request',
        '• /delegate <name> <date> — delegate approvals',
      ].join('\n'),
    ar: () =>
      [
        '🤖 *أوامر منجز*',
        '• /inbox أو "الوارد" — مراجعة صندوق الوارد',
        '• /tasks أو "مهامي" — عرض مهامي المفتوحة',
        '• /done <id> أو "تم <id>" — إنهاء مهمة',
        '• /approvals أو "موافقاتي" — عرض طلبات الموافقة',
        '• /approve <id> أو "موافق <id>" — الموافقة على طلب',
        '• /reject <id> أو "رفض <id>" — رفض طلب',
        '• /delegate أو "تفويض" — تفويض الموافقات',
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
  APPROVAL_BUTTON_OPEN: {
    en: () => 'Open',
    ar: () => 'فتح',
  },
  APPROVAL_OPEN_LINK: {
    en: (url: string) => `🔗 Open in Mongez: ${url}`,
    ar: (url: string) => `🔗 افتح في منجز: ${url}`,
  },
  APPROVAL_EXPIRED: {
    en: () => '⏰ This approval has expired.',
    ar: () => '⏰ انتهت صلاحية هذا الطلب.',
  },
  RATE_LIMITED: {
    en: () => '⚠️ Too many requests. Please wait a moment.',
    ar: () => '⚠️ طلبات كثيرة جدًا. يرجى الانتظار قليلاً.',
  },
  TASK_FORBIDDEN: {
    en: () => '⛔ You are not allowed to modify this task.',
    ar: () => '⛔ ليس مسموحًا لك بتعديل هذه المهمة.',
  },
  TASK_INVALID_TRANSITION: {
    en: () => '⚠️ Cannot change task status to the requested state.',
    ar: () => '⚠️ لا يمكن تغيير حالة المهمة إلى الحالة المطلوبة.',
  },
  TASK_ERROR_GENERIC: {
    en: () => '⚠️ An error occurred while processing the task.',
    ar: () => '⚠️ حدث خطأ أثناء معالجة المهمة.',
  },

  // ── Inbox Zero Review Deck ──────────────────────────

  INBOX_SUMMARY: {
    en: (approvals: number, mentions: number, tasks: number) =>
      [
        '📥 *Mongez Inbox*',
        `Approvals: ${approvals} | Mentions: ${mentions} | Due Today: ${tasks}`,
        '',
        '[ Start Review ⚡ ]',
      ].join('\n'),
    ar: (approvals: number, mentions: number, tasks: number) =>
      [
        '📥 *صندوق وارد منجز*',
        `موافقات: ${approvals} | إشارات: ${mentions} | مستحقة اليوم: ${tasks}`,
        '',
        '[ بدء المراجعة ⚡ ]',
      ].join('\n'),
  },
  INBOX_EMPTY: {
    en: () => '✅ Your inbox is clear! Nothing pending.',
    ar: () => '✅ صندوق الوارد فارغ! لا شيء معلق.',
  },
  INBOX_REVIEW_APPROVAL: {
    en: (index: number, total: number, title: string, requester: string, amount: string) =>
      [
        `📋 Review (${index}/${total}) — Approval`,
        `*${title}*`,
        requester ? `Requested by: ${requester}` : '',
        amount ? `Amount: ${amount}` : '',
      ].filter(Boolean).join('\n'),
    ar: (index: number, total: number, title: string, requester: string, amount: string) =>
      [
        `📋 مراجعة (${index}/${total}) — موافقة`,
        `*${title}*`,
        requester ? `طلب بواسطة: ${requester}` : '',
        amount ? `المبلغ: ${amount}` : '',
      ].filter(Boolean).join('\n'),
  },
  INBOX_REVIEW_MENTION: {
    en: (index: number, total: number, actor: string, content: string) =>
      `💬 Review (${index}/${total}) — Mention\n${actor} said: "${content}"`,
    ar: (index: number, total: number, actor: string, content: string) =>
      `💬 مراجعة (${index}/${total}) — إشارة\n${actor} قال: "${content}"`,
  },
  INBOX_REVIEW_TASK: {
    en: (index: number, total: number, identifier: string, title: string) =>
      `📝 Review (${index}/${total}) — Due Today\n*${identifier}* — ${title}`,
    ar: (index: number, total: number, identifier: string, title: string) =>
      `📝 مراجعة (${index}/${total}) — مستحقة اليوم\n*${identifier}* — ${title}`,
  },
  INBOX_CLEARED: {
    en: () => '🎉 Inbox Cleared! Great work.',
    ar: () => '🎉 تم تفريغ صندوق الوارد! عمل رائع.',
  },

  // ── Delegation ──────────────────────────────────────

  DELEGATION_SET: {
    en: (fromName: string, toName: string, endDate: string) =>
      `✅ Approvals delegated from ${fromName} to ${toName} until ${endDate}.`,
    ar: (fromName: string, toName: string, endDate: string) =>
      `✅ تم تفويض الموافقات من ${fromName} إلى ${toName} حتى ${endDate}.`,
  },
  DELEGATION_NOT_FOUND: {
    en: () => '⚠️ Could not find the user to delegate to. Check the name or email.',
    ar: () => '⚠️ لم يتم العثور على المستخدم للتفويض. تحقق من الاسم أو البريد.',
  },
  DELEGATION_ACTIVE: {
    en: (toName: string, endDate: string) =>
      `ℹ️ You currently have approvals delegated to ${toName} until ${endDate}.`,
    ar: (toName: string, endDate: string) =>
      `ℹ️ لديك حاليًا تفويض موافقات إلى ${toName} حتى ${endDate}.`,
  },

  // ── SLA & Escalation ────────────────────────────────

  SLA_REMINDER: {
    en: (title: string, hoursLeft: string) =>
      `⚠️ *Reminder*: "${title}" needs your review. Only ${hoursLeft} hours left before escalation.`,
    ar: (title: string, hoursLeft: string) =>
      `⚠️ *تذكير*: "${title}" تحتاج مراجعتك. متبقي ${hoursLeft} ساعات قبل التصعيد.`,
  },
  SLA_ESCALATED: {
    en: (title: string, escalationType: string) =>
      `🔺 "${title}" has been escalated (${escalationType}) due to timeout.`,
    ar: (title: string, escalationType: string) =>
      `🔺 تم تصعيد "${title}" (${escalationType}) بسبب انتهاء المهلة.`,
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
