import { FaArrowLeft, FaPlus, FaRocket, FaTimes } from "react-icons/fa";
import AuthButton from "../../shared/AuthButton";
import AuthErrorMessage from "../../shared/AuthErrorMessage";
import AuthInput from "../../shared/AuthInput";

const InviteStep = ({ invites, onChange, onBack, onSubmit, loading, submitError, onSkip }) => {
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

  const roleOptions = ["Member", "Manager", "Admin"];

  return (
    <div className="animate-fadeIn">
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-text-primary mb-1 text-center">
        Invite your team
      </h1>

      <p className="text-[13px] text-text-secondary mb-7 text-center">
        Invite colleagues now or skip and do it later.
      </p>

      <div className="space-y-2.5 mb-4">
        {invites.map((invite, index) => (
          <div key={index} className="flex items-end gap-2.5 animate-slideIn">
            <div className="flex-1 min-w-0">
              <AuthInput
                label={index === 0 ? "Email" : ""}
                type="email"
                placeholder="colleague@org.com"
                value={invite.email}
                onChange={(event) => updateInvite(index, "email", event.target.value)}
              />
            </div>

            <div className="w-[120px] flex-shrink-0">
              {index === 0 && (
                <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
                  Role
                </label>
              )}
              <select
                value={invite.role}
                onChange={(event) => updateInvite(index, "role", event.target.value)}
                className="w-full py-[11px] px-3.5 text-[13px] border-[1.5px] border-border rounded-lg bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => removeInvite(index)}
              className="w-9 h-9 mb-px flex items-center justify-center border-[1.5px] border-border rounded-lg bg-white text-text-tertiary hover:text-danger hover:border-danger hover:bg-[#fef2f2] transition-all duration-200 hover:scale-105 flex-shrink-0"
              aria-label="Remove invite"
            >
              <FaTimes className="text-[10px]" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addInvite}
        className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-primary bg-transparent border-0 cursor-pointer py-2 mt-1 hover:underline w-full"
      >
        <FaPlus className="text-[10px]" /> Add another
      </button>

      <AuthErrorMessage className="mt-3 mb-4">{submitError}</AuthErrorMessage>

      <div className="flex gap-3 mb-3">
        <AuthButton variant="outline" onClick={onBack}>
          <FaArrowLeft className="text-[10px]" /> Back
        </AuthButton>

        <AuthButton loading={loading} loadingLabel="Launching workspace..." onClick={() => onSubmit()}>
          <FaRocket className="text-[10px]" /> Launch Workspace
        </AuthButton>
      </div>

      <button
        type="button"
        onClick={onSkip}  // ← Use the separate handler
        className="w-full py-3 rounded-lg text-[13px] text-text-tertiary hover:text-text-secondary hover:bg-bg-body transition-all duration-200 border-0 bg-transparent cursor-pointer"
      >
        Skip — I'll invite later
      </button>
    </div>
  );
};

export default InviteStep;
