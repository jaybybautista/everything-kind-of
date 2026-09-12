import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

const GENRES = ["Fantasy", "Romance", "Mystery", "Sci-Fi", "Horror", "Slice of Life", "Non-Fiction"];

export default function WriteStory() {
  const { storyId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isEditing = Boolean(storyId);

  const [form, setForm] = useState({
    title: "",
    description: "",
    genre: GENRES[0],
    tags: "",
    language: "English",
    status: "ongoing",
    visibility: "private",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    async function load() {
      const snap = await getDoc(doc(db, "stories", storyId));
      if (snap.exists()) {
        const data = snap.data();
        setForm({ ...data, tags: (data.tags ?? []).join(", ") });
      }
    }
    load();
  }, [storyId, isEditing]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      authorId: user.uid,
      authorName: profile?.displayName ?? "Author",
      updatedAt: serverTimestamp(),
    };

    if (isEditing) {
      await updateDoc(doc(db, "stories", storyId), payload);
      setSaving(false);
    } else {
      const ref = await addDoc(collection(db, "stories"), {
        ...payload,
        createdAt: serverTimestamp(),
        viewsCount: 0,
        likesCount: 0,
        bookmarksCount: 0,
        chapterCount: 0,
      });
      navigate(`/write/${ref.id}/chapters`);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this story and all its chapters? This can't be undone.")) return;
    await deleteDoc(doc(db, "stories", storyId));
    navigate("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">{isEditing ? "Edit story" : "New story"}</h1>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <Field label="Title">
          <input required value={form.title} onChange={(e) => update("title", e.target.value)} className="input" />
        </Field>

        <Field label="Description">
          <textarea required rows={4} value={form.description} onChange={(e) => update("description", e.target.value)} className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Genre">
            <select value={form.genre} onChange={(e) => update("genre", e.target.value)} className="input">
              {GENRES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>

          <Field label="Language">
            <select value={form.language} onChange={(e) => update("language", e.target.value)} className="input">
              <option>English</option>
              <option>Filipino</option>
            </select>
          </Field>
        </div>

        <Field label="Tags (comma separated)">
          <input value={form.tags} onChange={(e) => update("tags", e.target.value)} className="input" placeholder="slow-burn, found-family" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Completion status">
            <select value={form.status} onChange={(e) => update("status", e.target.value)} className="input">
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </Field>

          <Field label="Visibility">
            <select value={form.visibility} onChange={(e) => update("visibility", e.target.value)} className="input">
              <option value="private">Private (only you)</option>
              <option value="public">Public (published)</option>
            </select>
          </Field>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button type="submit" disabled={saving} className="rounded-full bg-[var(--color-rose-500)] px-6 py-2.5 font-medium text-white hover:bg-[var(--color-rose-600)]">
            {saving ? "Saving..." : "Save story"}
          </button>
          {isEditing && (
            <button type="button" onClick={handleDelete} className="text-sm text-red-600">
              Delete story
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
