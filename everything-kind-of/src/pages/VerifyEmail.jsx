import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function VerifyEmail() {
  const { user, isEmailVerified, resendVerification } = useAuth();
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-sm px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Check your inbox</h1>
      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
        We sent a verification link to <strong>{user?.email}</strong>. Please verify your email to complete your account setup.
      </p>

      {isEmailVerified && <p className="mt-4 text-sm text-[var(--color-rose-700)]">Your email is already verified.</p>}

      <button
        onClick={async () => {
          await resendVerification();
          setSent(true);
        }}
        className="mt-6 rounded-full bg-[var(--color-rose-500)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-rose-600)]"
      >
        Resend email
      </button>

      {sent && <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Sent. Give it a minute to arrive.</p>}
    </div>
  );
}
