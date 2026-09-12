import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Feather, Search, Bell, LogOut, Heart, MessageCircle, UserPlus, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../hooks/useNotifications";

// ── Notification helpers ──────────────────────────────────────────
const NOTIF_ICONS = {
  like:    { icon: <Heart size={14} />,         label: "liked" },
  follow:  { icon: <UserPlus size={14} />,      label: "followed you" },
  comment: { icon: <MessageCircle size={14} />, label: "commented" },
};

function formatRelativeTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function notifMessage(n) {
  switch (n.type) {
    case "like":
      return <><strong>{n.actorName}</strong> liked your story {n.storyTitle ? <em>"{n.storyTitle}"</em> : ""}</>;
    case "follow":
      return <><strong>{n.actorName}</strong> is now following you</>;
    case "comment":
      return <><strong>{n.actorName}</strong> commented on {n.storyTitle ? <em>"{n.storyTitle}"</em> : "your story"}</>;
    default:
      return <><strong>{n.actorName}</strong> sent a notification</>;
  }
}

// ── Navbar ────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, profile, isAuthor, logout } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead } = useNotifications(user);
  const [notifOpen, setNotifOpen] = useState(false);
  const panelRef = useRef(null);
  const bellRef  = useRef(null);

  // Close notification panel on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        notifOpen &&
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current  && !bellRef.current.contains(e.target)
      ) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") setNotifOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  function toggleNotifPanel() {
    setNotifOpen((v) => !v);
  }

  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-[var(--color-rose-700)]">
          <Feather size={20} />
          Everything, kind of
        </Link>

        {/* Search */}
        <div className="hidden flex-1 max-w-md items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2 md:flex">
          <Search size={16} className="text-[var(--color-ink-soft)]" />
          <input
            placeholder="Search stories, tags, authors..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-ink-soft)]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                navigate(`/browse?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
              }
            }}
          />
        </div>

        {/* Nav items */}
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/browse" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            Browse
          </Link>

          {user ? (
            <>
              {isAuthor && (
                <Link to="/dashboard" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                  Dashboard
                </Link>
              )}
              <Link
                to={isAuthor ? "/moderation" : "/my-reports"}
                className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              >
                {isAuthor ? "Reports" : "My reports"}
              </Link>

              {/* ── Notification Bell ── */}
              <div className="notif-wrapper">
                <button
                  ref={bellRef}
                  id="notif-bell-btn"
                  className="notif-bell-btn"
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                  aria-expanded={notifOpen}
                  aria-haspopup="true"
                  onClick={toggleNotifPanel}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="notif-badge" aria-hidden="true">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification panel */}
                {notifOpen && (
                  <div
                    ref={panelRef}
                    className="notif-panel"
                    role="dialog"
                    aria-label="Notifications"
                  >
                    <div className="notif-panel-header">
                      <h3>Notifications</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {unreadCount > 0 && (
                          <button
                            className="notif-mark-all"
                            onClick={markAllRead}
                            aria-label="Mark all notifications as read"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setNotifOpen(false)}
                          aria-label="Close notifications"
                          style={{ color: "var(--color-ink-soft)", cursor: "pointer", display: "flex" }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="notif-list" role="list">
                      {notifications.length === 0 ? (
                        <div className="notif-empty">
                          <Bell size={28} />
                          <p>You're all caught up!</p>
                          <p style={{ opacity: 0.7, fontSize: "0.72rem" }}>
                            Likes, comments, and follows will appear here.
                          </p>
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const { icon } = NOTIF_ICONS[n.type] ?? NOTIF_ICONS.comment;
                          return (
                            <div
                              key={n.id}
                              className={`notif-item${!n.read ? " unread" : ""}`}
                              role="listitem"
                            >
                              <div className="notif-icon" aria-hidden="true">{icon}</div>
                              <div className="notif-body">
                                <p className="notif-text">{notifMessage(n)}</p>
                                <p className="notif-time">{formatRelativeTime(n.createdAt)}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile / display name */}
              {isAuthor ? (
                <Link
                  to={`/authors/${user.uid}`}
                  className="rounded-full bg-[var(--color-rose-100)] px-3 py-1.5 font-medium text-[var(--color-rose-700)]"
                >
                  {profile?.displayName ?? "Profile"}
                </Link>
              ) : (
                <span className="text-[var(--color-ink-soft)]">
                  {profile?.displayName ?? user.displayName ?? "Reader"}
                </span>
              )}

              <button
                onClick={handleLogout}
                className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                aria-label="Log out"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-[var(--color-rose-500)] px-4 py-2 font-medium text-white hover:bg-[var(--color-rose-600)]"
              >
                Join as a reader
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
