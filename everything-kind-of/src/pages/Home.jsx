import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import StoryCard from "../components/StoryCard";

export default function Home() {
  const { user } = useAuth();
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    async function fetchRecent() {
      const q = query(
        collection(db, "stories"),
        where("visibility", "==", "public"),
        orderBy("updatedAt", "desc"),
        limit(8)
      );
      const snap = await getDocs(q);
      setRecent(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    fetchRecent();
  }, []);

  return (
    <div>
      <section className="border-b border-[var(--color-line)] bg-[var(--color-rose-50)]">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-3xl font-semibold leading-snug text-[var(--color-ink)] md:text-4xl">
            A quiet place to read stories by fluttershyyzh.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[var(--color-ink-soft)]">
            No covers, no clutter, just stories, chapter by chapter, from fluttershyyzh.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/browse"
              className="rounded-full bg-[var(--color-rose-500)] px-6 py-2.5 font-medium text-white hover:bg-[var(--color-rose-600)]"
            >
              Start reading
            </Link>
            {!user && (
              <Link to="/register" className="rounded-full border border-[var(--color-rose-500)] px-6 py-2.5 font-medium text-[var(--color-rose-700)]">
                Join as a reader
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-lg font-semibold">Recently updated</h2>
        <div className="mt-4">
          {recent.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
          {recent.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">New stories are on their way. Check back soon.</p>}
        </div>
      </section>
    </div>
  );
}
