import { Link } from "react-router-dom";
import { Heart, Bookmark, BookOpen } from "lucide-react";

// No cover photos: the card leans on typography and metadata instead.
export default function StoryCard({ story }) {
  return (
    <Link
      to={`/stories/${story.id}`}
      className="block border-b border-[var(--color-line)] py-6 first:pt-0"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-rose-600)]">
        <span>{story.genre}</span>
        {story.status === "completed" ? <span>· Completed</span> : <span>· Ongoing</span>}
      </div>

      <h3 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{story.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-soft)]">{story.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-ink-soft)]">
        <span>by {story.authorName}</span>
        <span className="flex items-center gap-1">
          <BookOpen size={13} /> {story.chapterCount ?? 0} chapters
        </span>
        <span className="flex items-center gap-1">
          <Heart size={13} /> {story.likesCount ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <Bookmark size={13} /> {story.bookmarksCount ?? 0}
        </span>
        {story.tags?.length > 0 && <span>{story.tags.join(", ")}</span>}
      </div>
    </Link>
  );
}
