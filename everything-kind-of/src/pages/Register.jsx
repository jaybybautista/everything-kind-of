import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password needs to be at least 6 characters.");
      return;
    }
    try {
      await register(email, password, displayName);
      navigate("/verify-email");
    } catch (err) {
      setError(err.code === "auth/email-already-in-use" ? "That email is already registered." : "Something went wrong. Try again.");
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Join as a reader to follow stories, save favorites, and leave comments.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 outline-none focus:border-[var(--color-rose-500)]"
          />
        </div>

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

        <button
          type="submit"
          className="w-full rounded-full bg-[var(--color-rose-500)] py-2.5 font-medium text-white hover:bg-[var(--color-rose-600)]"
        >
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-ink-soft)]">
        Already have an account?{" "}
        <Link to="/login" className="text-[var(--color-rose-700)]">
          Log in
        </Link>
      </p>
    </div>
  );
}
