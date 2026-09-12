import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import StoryCard from "../components/StoryCard";

export default function AuthorProfile() {
  const { authorId } = useParams();
  const [author, setAuthor] = useState(null);
  const [stories, setStories] = useState([]);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "users", authorId));
      if (snap.exists()) setAuthor(snap.data());

      const storiesSnap = await getDocs(
        query(collection(db, "stories"), where("authorId", "==", authorId), where("visibility", "==", "public"))
      );
      setStories(storiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    load();
  }, [authorId]);

  if (!author) return <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-[var(--color-ink-soft)]">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">{author.displayName}</h1>
      {author.bio && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{author.bio}</p>}
      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{author.followersCount ?? 0} followers</p>

      <h2 className="mt-8 text-lg font-semibold">Published stories</h2>
      <div className="mt-4">
        {stories.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
        {stories.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No public stories yet.</p>}
      </div>
    </div>
  );
}
