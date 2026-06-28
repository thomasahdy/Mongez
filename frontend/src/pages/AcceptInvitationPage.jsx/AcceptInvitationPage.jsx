import { useState } from "react";
import AuthLogo from "../../components/AcceptInvitation/AuthLogo";
import OrgBadge from "../../components/AcceptInvitation/OrgBadge";
import InviteDetailsTable from "./sections/InviteDetailsTable";
import JoinForm from "./sections/JoinFrom";
import InviterCard from "../../components/AcceptInvitation/InviterCard";

const MOCK_INVITE = {
  organization: "Al-Noor Foundation",
  department:   "Education Department",
  role:         "Manager",
  expires:      "Dec 1, 2026",
  inviter: {
    initials: "AH",
    name:     "Ahmed Hassan",
    email:    "ahmed@alnoor-foundation.org",
  },
};
 
 
/**
 * AcceptInvitationPage
 * Route: /invite/:token
 *
 * Props:
 *   token      — invitation token from URL params
 *   invite     — invitation data (from API / React Query); falls back to mock
 *   onAccept({ firstName, lastName, password }) — called on form submit
 *   onDecline()                                 — called on decline click
 *   loading    — true while the accept mutation is in flight
 *
 * Usage (with React Router + React Query):
 *   const { token } = useParams();
 *   const { data: invite } = useQuery(["invite", token], () => getInvite(token));
 *   const { mutateAsync, isLoading } = useMutation(({ token, ...body }) => acceptInvite(token, body));
 *
 *   <AcceptInvitationPage
 *     token={token}
 *     invite={invite}
 *     onAccept={(body) => mutateAsync({ token, ...body }).then(() => navigate("/onboarding"))}
 *     onDecline={() => declineInvite(token).then(() => navigate("/"))}
 *     loading={isLoading}
 *   />
 */
export default function AcceptInvitationPage({
  invite  = MOCK_INVITE,
  onAccept  = async (body) => console.info("Accept", body),
  onDecline = ()          => console.info("Declined"),
  loading   = false,
}) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
 
      {/* Full-page centered layout */}
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-5 py-10 font-sans">
        <div className="w-full max-w-[440px] animate-[fadeIn_0.4s_ease]">
 
          {/* Brand */}
          <AuthLogo />
 
          {/* Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-9 shadow-sm text-center">
 
            {/* Org badge */}
            <OrgBadge name={invite.organization} />
 
            {/* Heading */}
            <h1 className="text-[22px] font-extrabold text-slate-900 dark:text-slate-50 mb-2 tracking-tight">
              You've been invited!
            </h1>
            <p className="text-[14px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              <strong className="text-slate-800 dark:text-slate-200">{invite.inviter.name}</strong> invited you to join
              the <strong className="text-slate-800 dark:text-slate-200">{invite.department}</strong> workspace.
            </p>
 
            {/* Who invited you */}
            <InviterCard inviter={invite.inviter} />
 
            {/* Invite details */}
            <InviteDetailsTable invite={invite} />
 
            {/* Join form */}
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