import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import { db } from "../firebase/config";

export default function ChapterList() {
  const { storyId } = useParams();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const addingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // A story's chapter list is small. Sort locally so it needs no composite index.
      const snap = await getDocs(query(collection(db, "chapters"), where("storyId", "==", storyId)));
      setChapters(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id.localeCompare(b.id)));
    } catch (err) {
      setError(err.code === "permission-denied"
        ? "Please log in again with your author account to manage chapters."
        : "Couldn't load chapters. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addChapter() {
    if (addingRef.current || loading || error) return;
    addingRef.current = true;
    setAdding(true);
    setError("");
    try {
      const chapter = {
      storyId,
      title: "Untitled chapter",
      contentHtml: "",
      status: "draft",
      orderIndex: chapters.reduce((max, item) => Math.max(max, item.orderIndex ?? -1), -1) + 1,
      wordCount: 0,
      readingTimeMinutes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "chapters"), chapter);
      setChapters((current) => [...current, { ...chapter, id: ref.id }]);
    } catch (err) {
      setError(err.code === "permission-denied"
        ? "Please log in again with your author account to add a chapter."
        : "Couldn't add the chapter. Please try again.");
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }

  async function removeChapter(id) {
    if (!confirm("Delete this chapter?")) return;
    await deleteDoc(doc(db, "chapters", id));
    load();
  }

  // Manual reordering: swap orderIndex with the neighbor and persist both in one batch
  async function move(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    const batch = writeBatch(db);
    const a = chapters[index];
    const b = chapters[targetIndex];
    batch.update(doc(db, "chapters", a.id), { orderIndex: b.orderIndex });
    batch.update(doc(db, "chapters", b.id), { orderIndex: a.orderIndex });
    await batch.commit();
    load();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chapters</h1>
        <button type="button" onClick={addChapter} disabled={adding || loading || Boolean(error)} aria-busy={adding} className="flex cursor-pointer items-center gap-2 rounded-full bg-[var(--color-rose-500)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-rose-600)] disabled:cursor-wait disabled:opacity-60">
          <Plus size={16} /> {adding ? "Adding chapter..." : "Add chapter"}
        </button>
      </div>

      {error && <div role="alert" className="mt-4 text-sm text-red-600">
        <p>{error}</p>
        <button type="button" onClick={load} className="mt-2 cursor-pointer font-medium">Try again</button>
      </div>}
      {loading && <p role="status" className="mt-6 text-sm text-[var(--color-ink-soft)]">Loading chapters...</p>}
      {adding && <p role="status" className="mt-4 text-sm text-[var(--color-ink-soft)]">Creating your draft chapter...</p>}
      <div className="mt-6">
        {chapters.map((chapter, i) => (
          <div key={chapter.id} className="flex items-center justify-between border-b border-[var(--color-line)] py-3">
            <div>
              <Link to={`/write/${storyId}/chapters/${chapter.id}`} className="font-medium">
                {i + 1}. {chapter.title}
              </Link>
              <p className="text-xs capitalize text-[var(--color-ink-soft)]">{chapter.status}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 hover:bg-[var(--color-rose-50)] disabled:opacity-30">
                <ArrowUp size={15} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === chapters.length - 1} className="rounded p-1.5 hover:bg-[var(--color-rose-50)] disabled:opacity-30">
                <ArrowDown size={15} />
              </button>
              <button onClick={() => removeChapter(chapter.id)} className="rounded p-1.5 text-red-600 hover:bg-red-50">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!loading && !error && chapters.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No chapters yet. Add your first one.</p>}
      </div>
    </div>
  );
}
