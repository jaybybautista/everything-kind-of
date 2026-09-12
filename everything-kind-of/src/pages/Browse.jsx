import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import StoryCard from "../components/StoryCard";

const GENRES = ["Fantasy", "Romance", "Mystery", "Sci-Fi", "Horror", "Slice of Life", "Non-Fiction"];

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const q = searchParams.get("q") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const status = searchParams.get("status") ?? "";
  const language = searchParams.get("language") ?? "";

  useEffect(() => {
    let active = true;
    async function fetchStories() {
      setLoading(true);
      setError("");
      setStories([]);
      try {
      // Keep visibility on the server for security; filter and sort the public library locally.
      const storiesQuery = query(collection(db, "stories"), where("visibility", "==", "public"));
      const snap = await getDocs(storiesQuery);
      let results = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => ["ongoing", "completed"].includes(s.status)
          && (!genre || s.genre === genre)
          && (!status || s.status === status)
          && (!language || s.language === language));

      // Simple client-side text match on title/tags: Firestore has no native full-text search.
      if (q) {
        const needle = q.toLowerCase();
        results = results.filter(
          (s) => s.title?.toLowerCase().includes(needle) || s.tags?.some((t) => t.toLowerCase().includes(needle))
        );
      }

      results.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      if (active) setStories(results.slice(0, 50));
      } catch {
        if (active) setError("Stories could not load. Please check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchStories();
    return () => { active = false; };
  }, [q, genre, status, language, retry]);

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  const activeFilterCount = useMemo(() => [genre, status, language].filter(Boolean).length, [genre, status, language]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Browse stories</h1>

      <div className="mt-6 flex flex-wrap gap-3">
        <select
          value={genre}
          onChange={(e) => updateFilter("genre", e.target.value)}
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
        >
          <option value="">Any genre</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
        >
          <option value="">Ongoing or completed</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={language}
          onChange={(e) => updateFilter("language", e.target.value)}
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
        >
          <option value="">Any language</option>
          <option value="English">English</option>
          <option value="Filipino">Filipino</option>
        </select>

        {activeFilterCount > 0 && (
          <button onClick={() => setSearchParams(q ? { q } : {})} className="text-sm text-[var(--color-ink-soft)]">
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-8">
        {loading && <p className="text-sm text-[var(--color-ink-soft)]">Loading stories...</p>}
        {error && <div role="alert"><p>{error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-full bg-[var(--color-rose-500)] px-4 py-2 text-white">Try again</button></div>}
        {!loading && !error && stories.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No stories match yet.</p>}
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </div>
  );
}
