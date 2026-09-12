import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError("Couldn't log you in. Check your email and password.");
    }
  }

  async function handleReset() {
    if (!email) {
      setError("Enter your email above first, then tap 'Forgot password?' again.");
      return;
    }
    await resetPassword(email);
    setResetSent(true);
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Log in to continue your story journey.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 outline-none focus:border-[var(--color-rose-500)]"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 outline-none focus:border-[var(--color-rose-500)]"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {resetSent && <p className="text-sm text-[var(--color-rose-700)]">Password reset email sent.</p>}

        <button
          type="submit"
          className="w-full rounded-full bg-[var(--color-rose-500)] py-2.5 font-medium text-white hover:bg-[var(--color-rose-600)]"
        >
          Log in
        </button>

        <button type="button" onClick={handleReset} className="w-full text-center text-sm text-[var(--color-ink-soft)]">
          Forgot password?
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-ink-soft)]">
        New here?{" "}
        <Link to="/register" className="text-[var(--color-rose-700)]">
          Create an account
        </Link>
      </p>
    </div>
  );
}
