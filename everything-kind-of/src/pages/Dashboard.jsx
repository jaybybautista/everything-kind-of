import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Eye, Heart, Bookmark, Users, Plus } from "lucide-react";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stories, setStories] = useState([]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const snap = await getDocs(query(collection(db, "stories"), where("authorId", "==", user.uid)));
      setStories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0)));
    }
    load();
  }, [user]);

  const totals = stories.reduce(
    (acc, s) => ({
      views: acc.views + (s.viewsCount ?? 0),
      likes: acc.likes + (s.likesCount ?? 0),
      bookmarks: acc.bookmarks + (s.bookmarksCount ?? 0),
    }),
    { views: 0, likes: 0, bookmarks: 0 }
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your dashboard</h1>
        <Link
          to="/write"
          className="flex items-center gap-2 rounded-full bg-[var(--color-rose-500)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-rose-600)]"
        >
          <Plus size={16} /> New story
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric icon={<Eye size={16} />} label="Total views" value={totals.views} />
        <Metric icon={<Heart size={16} />} label="Total likes" value={totals.likes} />
        <Metric icon={<Bookmark size={16} />} label="Bookmarks" value={totals.bookmarks} />
        <Metric icon={<Users size={16} />} label="Followers" value={profile?.followersCount ?? 0} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Your stories</h2>
      <div className="mt-4">
        {stories.map((story) => (
          <div key={story.id} className="flex items-center justify-between border-b border-[var(--color-line)] py-4">
            <div>
              <p className="font-medium">{story.title}</p>
              <p className="text-xs text-[var(--color-ink-soft)] capitalize">
                {story.visibility} · {story.status}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <Link to={`/write/${story.id}`} className="text-[var(--color-rose-700)]">
                Edit
              </Link>
              <Link to={`/write/${story.id}/chapters`} className="text-[var(--color-rose-700)]">
                Chapters
              </Link>
            </div>
          </div>
        ))}
        {stories.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">You haven't started a story yet.</p>}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-rose-600)]">{icon}</div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
    </div>
  );
}
