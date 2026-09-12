import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { MessageCircle, X, Send } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import DiscussionComment from '../components/DiscussionComment';
import { sanitizeChapter, highlightPassages, selectedPassage, tappedWord, resolveAnchor } from '../lib/passageAnchors';
import '../discussions.css';

export default function ChapterReader() {
  const { storyId, chapterId } = useParams();
  return <Reader key={chapterId} storyId={storyId} chapterId={chapterId} />;
}
function Reader({ storyId, chapterId }) {
  const { user } = useAuth();
  const [chapter, setChapter] = useState(null);
  const [threads, setThreads] = useState([]);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  const [discussionError, setDiscussionError] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [posting, setPosting] = useState(false);
  const [overlaps, setOverlaps] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const root = useRef(null);
  const composer = useRef(null);
  const postingRef = useRef(false);
  const submission = useRef(null);
  const pointer = useRef(null);
  const requestNumber = useRef(0);
  const safeHtml = useMemo(() => sanitizeChapter(chapter?.contentHtml), [chapter?.contentHtml]);
  const canonicalText = useMemo(() => new DOMParser().parseFromString(safeHtml, 'text/html').body.textContent, [safeHtml]);
  const decoratedHtml = useMemo(() => highlightPassages(safeHtml, threads), [safeHtml, threads]);

  const refresh = useCallback(async () => {
    const request = ++requestNumber.current;
    const { data } = await api.get(`/api/discussions/chapters/${chapterId}`);
    if (request === requestNumber.current) { setThreads(data.threads); setComments(data.comments); setDiscussionError(''); }
  }, [chapterId]);
  useEffect(() => {
    let live = true;
    getDoc(doc(db, 'chapters', chapterId)).then(snap => {
      if (!live) return;
      if (!snap.exists() || snap.data().storyId !== storyId) throw new Error('Chapter not found.');
      setChapter(snap.data());
    }).catch(failure => { if (live) setError(failure.code === 'permission-denied' ? 'This chapter is not available to read.' : failure.message); });
    return () => { live = false; };
  }, [chapterId, storyId]);
  useEffect(() => {
    let live = true;
    let polling = false;
    const update = async () => {
      if (polling || document.hidden) return;
      polling = true;
      try { await refresh(); } catch { if (live) setDiscussionError('Conversations could not refresh. Please try again.'); }
      finally { polling = false; }
    };
    update();
    const interval = setInterval(update, 5000);
    // Invalidate the latest pending request when leaving this chapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { live = false; requestNumber.current++; clearInterval(interval); };
  }, [refresh, user?.uid]);
  useEffect(() => {
    if (user && chapter) setDoc(doc(db, 'users', user.uid, 'readingProgress', storyId), { storyId, lastChapterId: chapterId, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [user, chapter, chapterId, storyId]);
  useEffect(() => {
    const changed = () => { const passage = root.current && selectedPassage(root.current); if (passage) setCandidate(passage); };
    const escape = event => { if (event.key === 'Escape') { setCandidate(null); setActive(null); } };
    document.addEventListener('selectionchange', changed); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('selectionchange', changed); document.removeEventListener('keydown', escape); };
  }, []);

  function openThread(thread) {
    setActive({ threadId: thread?.id || null, anchor: thread?.anchor || null });
    setCandidate(null); setReply(null); setText(''); setAnnouncement('');
  }
  function startPassage() {
    const existing = threads.find(thread => { const found = resolveAnchor(root.current.textContent, thread.anchor); return found?.start === candidate.start && found?.end === candidate.end; });
    if (existing) openThread(existing);
    else { setActive({ threadId: null, anchor: candidate }); setCandidate(null); setReply(null); setText(''); setAnnouncement(''); }
  }
  function handlePointerUp(event) {
    if (event.target.closest('a')) return;
    const selection = selectedPassage(root.current);
    if (selection) { setCandidate(selection); return; }
    const distance = pointer.current ? Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) : 0;
    if (distance > 10) return;
    const mark = event.target.closest('mark[data-thread-ids]');
    if (mark) { const ids = mark.dataset.threadIds.split(' '); const found = threads.filter(thread => ids.includes(thread.id)); setOverlaps(found); if (found.length === 1) openThread(found[0]); return; }
    const word = tappedWord(root.current, event.clientX, event.clientY);
    if (word) { setCandidate(word); setOverlaps([]); }
  }
  async function perform(method, path, body) {
    await api.request({ method, url: `/api/discussions${path}`, data: body });
    await refresh().catch(() => setDiscussionError('Your change was saved, but the conversation could not refresh yet.'));
  }
  async function post(event) {
    event.preventDefault(); if (!user || !text.trim() || postingRef.current) return;
    postingRef.current = true; setPosting(true); setDiscussionError('');
    try {
      const payload = { text, threadId: active.threadId, anchor: active.threadId ? undefined : active.anchor, parentCommentId: reply?.id || null };
      const signature = JSON.stringify(payload);
      if (submission.current?.signature !== signature) submission.current = { signature, id: crypto.randomUUID() };
      const { data } = await api.post(`/api/discussions/chapters/${chapterId}/comments`, { ...payload, submissionId: submission.current.id });
      submission.current = null;
      setActive(current => ({ ...current, threadId: data.threadId })); setText(''); setReply(null); setAnnouncement('Comment posted.');
      await refresh().catch(() => setDiscussionError('Your comment was posted, but the conversation could not refresh yet.'));
    } catch (failure) { setDiscussionError(failure.response?.data?.error || 'Could not post. Please try again.'); }
    finally { postingRef.current = false; setPosting(false); }
  }
  const conversation = active ? comments.filter(comment => (comment.threadId || null) === active.threadId && (active.threadId || !active.anchor)) : [];
  if (error) return <div className="reading-page"><p role="alert">{error}</p><Link to="/browse">Back to stories</Link></div>;
  if (!chapter) return <div className="reading-page" role="status">Loading chapter...</div>;
  return <div className={`reading-page ${active ? 'has-discussion' : ''}`}>
    <article className="reading-manuscript">
      <Link className="reading-back" to={`/stories/${storyId}`}>Back to table of contents</Link>
      <h1>{chapter.title}</h1><p className="reading-meta">{chapter.wordCount || 0} words · {chapter.readingTimeMinutes || 1} min read</p>
      <div className="passage-hint"><MessageCircle size={16} /><span>Tap a word or highlight a phrase to start a conversation. Pink highlights have existing discussions.</span></div>
      {candidate && <div className="selection-prompt" role="region" aria-label="Selected passage"><q>{candidate.quote}</q><button onMouseDown={event => event.preventDefault()} onClick={startPassage}><MessageCircle size={14} /> Comment on this passage</button><button aria-label="Dismiss selection" onClick={() => setCandidate(null)}><X size={15} /></button></div>}
      {overlaps.length > 1 && <div className="overlap-options">Choose a conversation:{overlaps.map(thread => <button key={thread.id} onClick={() => { openThread(thread); setOverlaps([]); }}>{thread.anchor.quote}</button>)}</div>}
      <div ref={root} className="prose-story selectable-story" tabIndex={0} aria-label="Story text" onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={handlePointerUp} dangerouslySetInnerHTML={{ __html: decoratedHtml }} />
      <section className="conversation-directory"><h2>Conversations</h2><p>Each passage has its own conversation. Nothing is created until the first comment is posted.</p>
        <button className="conversation-link" onClick={() => openThread(null)}><MessageCircle size={17} /><span>Whole chapter</span><span>{comments.filter(comment => !comment.threadId).length}</span></button>
        {threads.map(thread => <button className="conversation-link" key={thread.id} onClick={() => openThread(thread)}><MessageCircle size={17} /><span><q>{thread.anchor.quote}</q></span><span>{comments.filter(comment => comment.threadId === thread.id).length}</span></button>)}
        {!threads.length && <p>No passage conversations yet. Highlight something that caught your attention.</p>}
        {discussionError && !active && <p role="alert" className="discussion-error">{discussionError} <button onClick={() => refresh().catch(() => {})}>Retry</button></p>}
      </section>
    </article>
    {active && <aside className="discussion-drawer" role="region" aria-label="Passage conversation">
      <header className="discussion-header"><div><span className="discussion-eyebrow">READ TOGETHER</span><h2>{active.anchor ? 'On this passage' : 'Chapter conversation'}</h2></div><button aria-label="Close conversation" onClick={() => setActive(null)}><X size={19} /></button></header>
      {active.anchor && <blockquote className="discussion-quote">{active.anchor.quote}{!resolveAnchor(canonicalText, active.anchor) && <small>This passage has changed in the current chapter.</small>}</blockquote>}
      <div className="discussion-messages" aria-live="polite">{conversation.length === 0 && <div className="discussion-empty"><MessageCircle size={28} /><h3>Be the first to share a thought.</h3><p>{active.anchor ? 'Your comment will start a conversation about this passage.' : 'What did you think of this chapter?'}</p></div>}
        {conversation.map(comment => <DiscussionComment key={comment.id} comment={comment} parent={comments.find(parent => parent.id === comment.parentCommentId)} user={user} onReply={item => { setReply(item); composer.current?.focus(); }} perform={perform} />)}
      </div>
      <div className="discussion-compose">{discussionError && <p className="discussion-error" role="alert">{discussionError}</p>}{announcement && <p className="discussion-success" role="status">{announcement}</p>}
        {user ? <form onSubmit={post}>{reply && <div className="reply-target">Replying to {reply.userName}<button type="button" aria-label="Cancel reply" onClick={() => setReply(null)}><X size={13} /></button></div>}<textarea ref={composer} aria-label={reply ? 'Write a reply' : 'Write a comment'} placeholder={reply ? 'Write your reply...' : 'Share your thoughts...'} maxLength={3000} value={text} onChange={event => setText(event.target.value)} required /><div className="compose-footer"><span>{text.length}/3000</span><button className="discussion-primary" disabled={posting || !text.trim()}><Send size={14} />{posting ? 'Posting...' : reply ? 'Post reply' : 'Post comment'}</button></div></form> : <p><Link to="/login">Log in</Link> to comment, react, or report.</p>}
      </div>
    </aside>}
  </div>;
}
