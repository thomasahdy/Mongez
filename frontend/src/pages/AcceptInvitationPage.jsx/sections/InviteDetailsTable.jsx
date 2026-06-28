import React from "react";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";
import RoleBadge from "../../../components/AcceptInvitation/RoleBadge";
import InviteDetailRow from "./InviteDetailRow";

const InviteDetailsTable = ({ invite }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <div
      className={`mb-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-1 dark:border-slate-700 dark:bg-slate-700/40 ${
        isRTL ? "text-right" : "text-left"
      }`}
    >
      <InviteDetailRow label={t("acceptInvitation.labels.organization")} value={invite.organization} />
      <InviteDetailRow label={t("acceptInvitation.labels.department")} value={invite.department} />
      <InviteDetailRow label={t("acceptInvitation.labels.yourRole")}>
        <RoleBadge role={invite.role} />
      </InviteDetailRow>
      <InviteDetailRow label={t("acceptInvitation.labels.expires")} value={invite.expires} />
    </div>
  );
};

export default InviteDetailsTable;
