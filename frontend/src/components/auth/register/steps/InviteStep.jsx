import { FaArrowLeft, FaPlus, FaRocket, FaTimes } from "react-icons/fa";
import AuthButton from "../../shared/AuthButton";
import AuthErrorMessage from "../../shared/AuthErrorMessage";
import AuthInput from "../../shared/AuthInput";

const InviteStep = ({ invites, onChange, onBack, onSubmit, loading, submitError }) => {
  const addInvite = () => {
    onChange([...invites, { email: "", role: "Member" }]);
  };

  const removeInvite = (index) => {
    onChange(invites.filter((_, inviteIndex) => inviteIndex !== index));
  };

  const updateInvite = (index, field, value) => {
    const updated = [...invites];
    updated[index][field] = value;
    onChange(updated);
  };

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-text-primary mb-1">
        Invite your team
      </h1>

      <p className="text-[13px] text-text-secondary mb-7">
        Invite colleagues now or skip and do it later.
      </p>

      <div className="space-y-2.5">
        {invites.map((invite, index) => (
          <div key={index} className="flex items-end gap-2.5">
            <div className="flex-1">
              <AuthInput
                label={index === 0 ? "Email" : ""}
                type="email"
                placeholder="colleague@org.com"
                value={invite.email}
                onChange={(event) => updateInvite(index, "email", event.target.value)}
              />
            </div>

            <div className="w-[120px]">
              {index === 0 && (
                <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
                  Role
                </label>
              )}
              <select
                value={invite.role}
                onChange={(event) => updateInvite(index, "role", event.target.value)}
                className="w-full py-[11px] px-3.5 text-[13px] border-[1.5px] border-border rounded bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              >
                <option>Member</option>
                <option>Manager</option>
                <option>Admin</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => removeInvite(index)}
              className="w-9 h-9 mb-px flex items-center justify-center border-[1.5px] border-border rounded bg-white text-text-tertiary hover:text-danger hover:border-danger hover:bg-[#fef2f2] transition"
              aria-label="Remove invite"
            >
              <FaTimes className="text-xs" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addInvite}
        className="flex items-center gap-1.5 text-[13px] font-medium text-primary bg-transparent border-0 cursor-pointer py-2 mt-1"
      >
        <FaPlus className="text-xs" /> Add another
      </button>

      <AuthErrorMessage className="mt-2">{submitError}</AuthErrorMessage>

      <div className="flex gap-3 mt-6">
        <AuthButton variant="outline" onClick={onBack}>
          <FaArrowLeft className="text-xs" /> Back
        </AuthButton>

        <AuthButton loading={loading} loadingLabel="Launching..." onClick={() => onSubmit()}>
          <FaRocket className="text-xs" /> Launch Workspace
        </AuthButton>
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ skipInvites: true })}
        className="mt-2.5 w-full p-3 rounded text-[13px] text-text-tertiary hover:text-text-secondary transition"
      >
        Skip — I'll invite later
      </button>
    </div>
  );
};

export default InviteStep;
