import React from 'react'
import InviteDetailRow from './InviteDetailRow';
import RoleBadge from '../../../components/AcceptInvitation/RoleBadge';

const InviteDetailsTable = ({ invite }) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-1 mb-6 text-left">
      <InviteDetailRow label="Organization" value={invite.organization} />
      <InviteDetailRow label="Department"   value={invite.department} />
      <InviteDetailRow label="Your Role">
        <RoleBadge role={invite.role} />
      </InviteDetailRow>
      <InviteDetailRow label="Expires" value={invite.expires} />
    </div>
  );
}

export default InviteDetailsTable
