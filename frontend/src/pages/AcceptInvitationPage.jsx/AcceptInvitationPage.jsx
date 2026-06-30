import AuthLogo from "../../components/AcceptInvitation/AuthLogo";
import InviterCard from "../../components/AcceptInvitation/InviterCard";
import OrgBadge from "../../components/AcceptInvitation/OrgBadge";
import { useTranslation } from "react-i18next";
import InviteDetailsTable from "./sections/InviteDetailsTable";
import JoinForm from "./sections/JoinFrom";

const MOCK_INVITE = {
  organization: "Mongez Workspace",
  department: "Education Department",
  role: "Manager",
  expires: "Dec 1, 2026",
  inviter: {
    initials: "AH",
    name: "Ahmed Hassan",
    email: "invite@mongez.app",
  },
};

export default function AcceptInvitationPage({
  invite = MOCK_INVITE,
  onAccept = async (body) => console.info("Accept", body),
  onDecline = () => console.info("Declined"),
  loading = false,
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 font-sans dark:bg-slate-900">
        <div className="w-full max-w-[440px] animate-[fadeIn_0.4s_ease]">
          <AuthLogo />

          <div className="rounded-2xl border border-slate-200 bg-white p-9 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <OrgBadge name={invite.organization} />

            <h1 className="mb-2 text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              {t("acceptInvitation.invitedTitle")}
            </h1>
            <p className="mb-6 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
              {t("acceptInvitation.invitedDescription", {
                inviter: invite.inviter.name,
                department: invite.department,
              })}
            </p>

            <InviterCard inviter={invite.inviter} />
            <InviteDetailsTable invite={invite} />

            <JoinForm
              onAccept={onAccept}
              onDecline={onDecline}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </>
  );
}
