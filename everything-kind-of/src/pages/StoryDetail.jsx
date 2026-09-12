import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { Heart, Bookmark, UserPlus, UserCheck } from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { sendNotification } from "../hooks/useNotifications";

export default function StoryDetail() {
  const { storyId } = useParams();
  const { user, profile } = useAuth();

  const [story, setStory] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [actionError, setActionError] = useState("");

  // These refs hold the LIVE server counts.
  // We only update React state once a transaction has fully settled.
  const serverStoryRef = useRef(null);

  // Pending transaction flags — while true, the onSnapshot must NOT overwrite
  // the counter we already applied optimistically to `story` state.
  const likePending    = useRef(false);
  const bookmarkPending = useRef(false);

  // Prevent double-click races
  const likeBusy    = useRef(false);
  const bookmarkBusy = useRef(false);
  const followBusy  = useRef(false);

  // ── Real-time story listener ──────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stories", storyId), (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() };
      serverStoryRef.current = data;

      setStory((prev) => {
        if (!prev) return data;
        // Only overwrite the counter fields once no transaction is pending.
        // This prevents the onSnapshot from flickering the count back to the
        // old value while our runTransaction is still in flight.
        return {
          ...data,
          likesCount:     likePending.current     ? prev.likesCount     : data.likesCount,
          bookmarksCount: bookmarkPending.current ? prev.bookmarksCount : data.bookmarksCount,
        };
      });
    });
    return unsub;
  }, [storyId]);

  // ── Real-time chapters listener (filter + sort client-side) ───────
  useEffect(() => {
    const q = query(collection(db, "chapters"), where("storyId", "==", storyId));
    const unsub = onSnapshot(q, (snap) => {
      const published = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => c.status === "published")
        .sort((a, b) =>
          (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id.localeCompare(b.id)
        );
      setChapters(published);
    });
    return unsub;
  }, [storyId]);

  // ── User interaction state ────────────────────────────────────────
  useEffect(() => {
    if (!user) { setLiked(false); setBookmarked(false); setFollowing(false); return; }
    const likeUnsub = onSnapshot(
      doc(db, "likes", `${user.uid}_${storyId}`),
      (snap) => setLiked(snap.exists())
    );
    const bookmarkUnsub = onSnapshot(
      doc(db, "bookmarks", `${user.uid}_${storyId}`),
      (snap) => setBookmarked(snap.exists())
    );
    return () => { likeUnsub(); bookmarkUnsub(); };
  }, [user, storyId]);

  useEffect(() => {
    if (!user || !story) return;
    const unsub = onSnapshot(
      doc(db, "follows", `${user.uid}_${story.authorId}`),
      (snap) => setFollowing(snap.exists())
    );
    return unsub;
  }, [user, story?.authorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reaction: Like ───────────────────────────────────────────────
  async function toggleLike() {
    if (!user || !story || likeBusy.current) return;
    likeBusy.current = true;
    likePending.current = true;
    setActionError("");

    // Snapshot the current displayed count so we can revert precisely.
    const prevCount  = story.likesCount ?? 0;
    const wasLiked   = liked;
    const nextCount  = wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1;

    // Optimistic — update story state directly (no separate localLikes state)
    setLiked(!wasLiked);
    setStory((s) => s ? { ...s, likesCount: nextCount } : s);

    try {
      const likeRef  = doc(db, "likes",   `${user.uid}_${storyId}`);
      const storyRef = doc(db, "stories", storyId);

      await runTransaction(db, async (tx) => {
        const storySnap = await tx.get(storyRef);
        if (!storySnap.exists()) throw new Error("Story not found.");
        const serverCount = storySnap.data().likesCount ?? 0;

        if (wasLiked) {
          tx.delete(likeRef);
          tx.update(storyRef, { likesCount: Math.max(0, serverCount - 1) });
        } else {
          tx.set(likeRef, { userId: user.uid, storyId, createdAt: new Date() });
          tx.update(storyRef, { likesCount: serverCount + 1 });
        }
      });

      // After success, sync story state to the confirmed server count.
      // The onSnapshot will also arrive shortly — that's fine, it'll agree.
      if (serverStoryRef.current) {
        const confirmed = wasLiked
          ? Math.max(0, (serverStoryRef.current.likesCount ?? 0) - 1)
          : (serverStoryRef.current.likesCount ?? 0) + 1;
        setStory((s) => s ? { ...s, likesCount: confirmed } : s);
      }

      if (!wasLiked && story.authorId !== user.uid) {
        sendNotification({
          userId:     story.authorId,
          type:       "like",
          actorName:  profile?.displayName ?? user.displayName ?? "Someone",
          storyTitle: story.title,
          storyId,
        });
      }
    } catch (err) {
      // Revert everything on failure
      setLiked(wasLiked);
      setStory((s) => s ? { ...s, likesCount: prevCount } : s);
      setActionError(
        err.code === "permission-denied"
          ? "You must be logged in to react."
          : "Could not save reaction. Please try again."
      );
    } finally {
      likePending.current = false;
      likeBusy.current    = false;
    }
  }

  // ── Reaction: Bookmark ───────────────────────────────────────────
  async function toggleBookmark() {
    if (!user || !story || bookmarkBusy.current) return;
    bookmarkBusy.current  = true;
    bookmarkPending.current = true;
    setActionError("");

    const prevCount      = story.bookmarksCount ?? 0;
    const wasBookmarked  = bookmarked;
    const nextCount      = wasBookmarked ? Math.max(0, prevCount - 1) : prevCount + 1;

    setBookmarked(!wasBookmarked);
    setStory((s) => s ? { ...s, bookmarksCount: nextCount } : s);

    try {
      const bookmarkRef = doc(db, "bookmarks", `${user.uid}_${storyId}`);
      const storyRef    = doc(db, "stories",   storyId);

      await runTransaction(db, async (tx) => {
        const storySnap = await tx.get(storyRef);
        if (!storySnap.exists()) throw new Error("Story not found.");
        const serverCount = storySnap.data().bookmarksCount ?? 0;

        if (wasBookmarked) {
          tx.delete(bookmarkRef);
          tx.update(storyRef, { bookmarksCount: Math.max(0, serverCount - 1) });
        } else {
          tx.set(bookmarkRef, { userId: user.uid, storyId, createdAt: new Date() });
          tx.update(storyRef, { bookmarksCount: serverCount + 1 });
        }
      });

      if (serverStoryRef.current) {
        const confirmed = wasBookmarked
          ? Math.max(0, (serverStoryRef.current.bookmarksCount ?? 0) - 1)
          : (serverStoryRef.current.bookmarksCount ?? 0) + 1;
        setStory((s) => s ? { ...s, bookmarksCount: confirmed } : s);
      }
    } catch (err) {
      setBookmarked(wasBookmarked);
      setStory((s) => s ? { ...s, bookmarksCount: prevCount } : s);
      setActionError(
        err.code === "permission-denied"
          ? "You must be logged in to save."
          : "Could not save. Please try again."
      );
    } finally {
      bookmarkPending.current = false;
      bookmarkBusy.current    = false;
    }
  }

  // ── Follow ───────────────────────────────────────────────────────
  async function toggleFollow() {
    if (!user || !story || followBusy.current) return;
    followBusy.current = true;
    setActionError("");
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      const ref = doc(db, "follows", `${user.uid}_${story.authorId}`);
      if (wasFollowing) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { followerId: user.uid, authorId: story.authorId, createdAt: new Date() });
        if (story.authorId !== user.uid) {
          sendNotification({
            userId:    story.authorId,
            type:      "follow",
            actorName: profile?.displayName ?? user.displayName ?? "Someone",
            storyId,
          });
        }
      }
    } catch {
      setFollowing(wasFollowing);
      setActionError("Could not update follow. Please try again.");
    } finally {
      followBusy.current = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function formatRelativeTime(ts) {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  }

  if (!story) {
    return (
      <div className="story-detail" role="status" style={{ color: "var(--color-ink-soft)", fontSize: "0.9rem" }}>
        Loading story…
      </div>
    );
  }

  return (
    <div className="story-detail">
      {/* Genre / status badge */}
      <div className="story-detail-genre">
        {story.genre}{story.genre && " · "}{story.status === "completed" ? "Completed" : "Ongoing"}
      </div>

      {/* Title */}
      <h1 className="story-detail-title">{story.title}</h1>

      {/* Author */}
      <Link to={`/authors/${story.authorId}`} className="story-detail-author">
        by {story.authorName}
      </Link>

      {/* Updated info */}
      {story.updatedAt && (
        <div style={{ fontSize: "0.72rem", color: "var(--color-ink-soft)", marginTop: "0.35rem" }}>
          Updated {formatRelativeTime(story.updatedAt)}
        </div>
      )}

      {/* Description */}
      <p className="story-detail-description prose-story">{story.description}</p>

      {/* Action error */}
      {actionError && (
        <p role="alert" style={{ fontSize: "0.8rem", color: "#c0392b", marginTop: "0.75rem" }}>
          {actionError}
        </p>
      )}

      {/* Action buttons */}
      <div className="story-actions">
        <button
          id="like-btn"
          onClick={toggleLike}
          className={`story-action-btn${liked ? " active" : ""}`}
          aria-label={liked ? "Unlike this story" : "Like this story"}
          aria-pressed={liked}
          title={user ? undefined : "Log in to like"}
        >
          <Heart size={15} />
          <span className="btn-count">{story.likesCount ?? 0}</span>
        </button>

        <button
          id="bookmark-btn"
          onClick={toggleBookmark}
          className={`story-action-btn${bookmarked ? " active" : ""}`}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark this story"}
          aria-pressed={bookmarked}
          title={user ? undefined : "Log in to bookmark"}
        >
          <Bookmark size={15} />
          <span className="btn-count">{story.bookmarksCount ?? 0}</span>
        </button>

        {user?.uid !== story.authorId && (
          <button
            id="follow-btn"
            onClick={toggleFollow}
            className={`story-action-btn${following ? " active" : ""}`}
            aria-label={following ? "Unfollow author" : "Follow author"}
            aria-pressed={following}
          >
            {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
            {following ? "Following" : "Follow author"}
          </button>
        )}

        {!user && (
          <Link
            to="/login"
            className="story-action-btn"
            style={{ textDecoration: "none" }}
          >
            Log in to react
          </Link>
        )}
      </div>

      {/* Table of contents */}
      <h2 className="story-toc-heading">Table of contents</h2>
      {chapters.length === 0 ? (
        <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "var(--color-ink-soft)" }}>
          No chapters published yet.
        </p>
      ) : (
        <ol className="story-toc-list">
          {chapters.map((chapter, i) => (
            <li key={chapter.id} className="story-toc-item">
              <Link
                to={`/stories/${storyId}/chapters/${chapter.id}`}
                className="story-toc-link"
              >
                <span>{i + 1}.&nbsp;{chapter.title}</span>
                <span className="story-toc-meta">
                  {chapter.readingTimeMinutes ? `${chapter.readingTimeMinutes} min` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
