import { useState } from 'react';

const reactions = [['heart', '♥', 'Love'], ['like', '👍', 'Like'], ['laugh', '😄', 'Laugh'], ['wow', '😮', 'Wow'], ['sad', '😢', 'Sad']];
export default function DiscussionComment({ comment, parent, user, onReply, perform }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('Harassment');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reported, setReported] = useState(false);
  const own = user?.uid === comment.userId;
  const unavailable = ['deleted', 'removed'].includes(comment.status);
  async function act(method, suffix = '', body) {
    if (busy) return false;
    setBusy(true); setError('');
    try { await perform(method, `/comments/${comment.id}${suffix}`, body); return true; }
    catch (failure) { setError(failure.response?.data?.error || 'Could not complete this action. Try again.'); return false; }
    finally { setBusy(false); }
  }
  return <article className={`discussion-comment ${comment.parentCommentId ? 'is-reply' : ''}`}>
    <header><strong>{comment.userName}</strong>{comment.isAuthor && <span className="author-badge">Author</span>}<time>{comment.createdAt ? new Date(comment.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</time></header>
    {parent && <p className="reply-reference">Replying to {parent.userName}: {['deleted', 'removed'].includes(parent.status) ? '[comment unavailable]' : parent.text.slice(0, 90)}</p>}
    {unavailable ? <p className="comment-placeholder">{comment.status === 'removed' ? 'Removed by the author.' : 'This comment was deleted.'}</p> : editing ? <form onSubmit={async event => { event.preventDefault(); if (await act('patch', '', { text: editText })) setEditing(false); }}>
      <textarea aria-label="Edit comment" maxLength={3000} value={editText} onChange={event => setEditText(event.target.value)} required />
      <div className="comment-actions"><button disabled={busy || !editText.trim()} type="submit">Save changes</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>
    </form> : <p className="comment-text">{comment.text}{comment.editedAt > 0 && <small> (edited)</small>}</p>}
    {!unavailable && !editing && <>
      <div className="comment-reactions" aria-label={`Reactions to ${comment.userName}'s comment`}>{reactions.map(([key, emoji, label]) => <button key={key} title={label} aria-label={`${label} reaction (${comment.reactionCounts?.[key] || 0})`} aria-pressed={comment.myReaction === key} disabled={!user || busy} onClick={() => act('post', '/reaction', { emoji: key })}>{emoji} <span>{comment.reactionCounts?.[key] || 0}</span></button>)}</div>
      {user && <div className="comment-actions"><button onClick={() => onReply(comment)}>Reply</button>{own ? <><button onClick={() => { setEditText(comment.text); setEditing(true); }}>Edit</button><button onClick={() => setDeleting(true)}>Delete</button></> : <button disabled={reported} onClick={() => setReporting(!reporting)}>{reported ? 'Reported' : 'Report'}</button>}</div>}
    </>}
    {deleting && !unavailable && <div className="inline-confirm">Delete your comment? Replies will remain.<div className="comment-actions"><button disabled={busy} onClick={async () => { if (await act('delete')) setDeleting(false); }}>Confirm delete</button><button onClick={() => setDeleting(false)}>Cancel</button></div></div>}
    {reporting && !unavailable && <form className="report-form" onSubmit={async event => { event.preventDefault(); if (await act('post', '/report', { reason, details })) { setReporting(false); setReported(true); } }}><label>Report reason<select aria-label="Report reason" value={reason} onChange={event => setReason(event.target.value)}>{['Harassment', 'Hate or discrimination', 'Spam', 'Spoilers', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><textarea aria-label="Report details" maxLength={2000} placeholder="Optional details for the author" value={details} onChange={event => setDetails(event.target.value)} /><p>Only the author can review this report. Track its outcome in My reports.</p><div className="comment-actions"><button disabled={busy}>Submit report</button><button type="button" onClick={() => setReporting(false)}>Cancel</button></div></form>}
    {error && <p role="alert" className="discussion-error">{error}</p>}
  </article>;
}
