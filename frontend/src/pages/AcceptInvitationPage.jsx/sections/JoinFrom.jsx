import React, { useState } from 'react'
import FormField from '../../../components/AcceptInvitation/FormField';
import PasswordField from '../../../components/AcceptInvitation/PasswordField';

export default function JoinForm({ onAccept, onDecline, loading }) {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState(null);
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
 
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
 
    try {
      await onAccept({ firstName, lastName, password });
    } catch (err) {
      setError(err.message ?? "Something went wrong. Please try again.");
    }
  };
 
  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Accept invitation form">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <FormField
          id="firstName"
          label="First name"
          placeholder="Your name"
          value={firstName}
          onChange={setFirstName}
          required
          autoComplete="given-name"
        />
        <FormField
          id="lastName"
          label="Last name"
          placeholder="Last name"
          value={lastName}
          onChange={setLastName}
          required
          autoComplete="family-name"
        />
      </div>
 
      {/* Password */}
      <div className="mb-5">
        <PasswordField
          id="password"
          label="Create password"
          placeholder="Choose a strong password"
          value={password}
          onChange={setPassword}
          required
        />
      </div>
 
      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4"
        >
          <i className="fa-solid fa-circle-exclamation shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
 
      {/* Accept */}
      <button
        type="submit"
        disabled={loading || !firstName || !lastName || !password}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-semibold transition-all duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <i className="fa-solid fa-circle-notch animate-spin text-[13px]" aria-hidden="true" />
            Joining…
          </>
        ) : (
          <>
            <i className="fa-solid fa-check text-[13px]" aria-hidden="true" />
            Accept &amp; Join Workspace
          </>
        )}
      </button>
 
      {/* Decline */}
      <button
        type="button"
        onClick={onDecline}
        disabled={loading}
        className="w-full mt-3 py-2 text-[13px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-lg"
      >
        Decline invitation
      </button>
    </form>
  );
}
 