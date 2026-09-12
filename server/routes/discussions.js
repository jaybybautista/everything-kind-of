import { Router } from 'express';
import { createHash } from 'node:crypto';
import admin from '../firebaseAdmin.js';

const router = Router();
const db = admin.firestore();
const stamp = () => admin.firestore.FieldValue.serverTimestamp();
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const id = value => { if (typeof value !== 'string' || !/^[\w-]{1,128}$/.test(value)) fail(400, 'Invalid identifier.'); return value; };
const author = user => user?.admin === true && user?.author === true && user.email === 'fluttershyyzh@gmail.com';
const signedIn = req => { if (!req.user) fail(401, 'Log in to join the conversation.'); };
const textValue = (text, limit = 3000) => { if (typeof text !== 'string' || !text.trim() || text.length > limit) fail(400, `Enter between 1 and ${limit} characters.`); return text.trim(); };
const handler = fn => async (req, res) => { try { await fn(req, res); } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to complete this action. Please try again.' }); } };
const millis = value => value?.toMillis?.() || 0;
const serialize = snap => ({ id: snap.id, ...snap.data(), createdAt: millis(snap.data().createdAt), editedAt: millis(snap.data().editedAt), reviewedAt: millis(snap.data().reviewedAt) });
export function chapterText(html = '') {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return html.replace(/<(script|style|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] || match;
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '\ufffd';
  });
}
function anchorMatches(text, anchor) {
  return anchor && Number.isInteger(anchor.start) && Number.isInteger(anchor.end) && anchor.start >= 0 && anchor.end > anchor.start && anchor.end <= text.length && anchor.end - anchor.start <= 500 && text.slice(anchor.start, anchor.end) === anchor.quote;
}
async function access(req, chapterId) {
  const chapter = await db.doc(`chapters/${id(chapterId)}`).get();
  if (!chapter.exists) fail(404, 'Chapter not found.');
  const story = await db.doc(`stories/${id(chapter.data().storyId)}`).get();
  if (!story.exists || (!author(req.user) && (chapter.data().status !== 'published' || story.data().visibility !== 'public'))) fail(403, 'This chapter is not available.');
  return { chapter: chapter.data(), story: story.data() };
}
async function commentAccess(req, commentId) {
  const ref = db.doc(`comments/${id(commentId)}`);
  const snap = await ref.get();
  if (!snap.exists) fail(404, 'Comment not found.');
  await access(req, snap.data().chapterId);
  return { ref, data: snap.data() };
}
router.use(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return next();
  try { req.user = await admin.auth().verifyIdToken(header.replace(/^Bearer /, '')); next(); }
  catch { res.status(401).json({ error: 'Please log in again.' }); }
});

router.get('/chapters/:chapterId', handler(async (req, res) => {
  await access(req, req.params.chapterId);
  const [threadDocs, commentDocs, reactions] = await Promise.all([
    db.collection('commentThreads').where('chapterId', '==', req.params.chapterId).get(),
    db.collection('comments').where('chapterId', '==', req.params.chapterId).get(),
    req.user ? db.collection('commentReactions').where('userId', '==', req.user.uid).get() : Promise.resolve({ docs: [] }),
  ]);
  const mine = new Map(reactions.docs.map(d => [d.data().commentId, d.data().emoji]));
  res.json({ threads: threadDocs.docs.map(serialize), comments: commentDocs.docs.map(snap => {
    const comment = serialize(snap);
    return { ...comment, text: ['deleted', 'removed'].includes(comment.status) ? '' : comment.text, myReaction: mine.get(snap.id) || null };
  }).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)) });
}));

router.post('/chapters/:chapterId/comments', handler(async (req, res) => {
  signedIn(req);
  const { chapter, story } = await access(req, req.params.chapterId);
  const text = textValue(req.body.text);
  const { anchor, parentCommentId = null } = req.body;
  let threadId = req.body.threadId || null;
  if (threadId) id(threadId);
  let threadData;
  if (anchor && !threadId) {
    const canonical = chapterText(chapter.contentHtml || '');
    if (!anchorMatches(canonical, anchor)) fail(409, 'The passage has changed. Refresh and select it again.');
    const safeAnchor = { start: anchor.start, end: anchor.end, quote: anchor.quote, prefix: canonical.slice(Math.max(0, anchor.start - 40), anchor.start), suffix: canonical.slice(anchor.end, anchor.end + 40) };
    threadId = hash(`${req.params.chapterId}:${anchor.start}:${anchor.end}:${anchor.quote}`);
    threadData = { chapterId: req.params.chapterId, storyId: chapter.storyId, anchor: safeAnchor, createdBy: req.user.uid, createdAt: stamp() };
  }
  const ref = req.body.submissionId ? db.doc(`comments/${hash(`${req.user.uid}:${req.params.chapterId}:${id(req.body.submissionId)}`)}`) : db.collection('comments').doc();
  await db.runTransaction(async tx => {
    const existingComment = await tx.get(ref);
    if (existingComment.exists) {
      if (existingComment.data().text !== text || (existingComment.data().parentCommentId || null) !== parentCommentId) fail(409, 'This submission was already used for another comment.');
      threadId = existingComment.data().threadId;
      return;
    }
    const threadRef = threadId ? db.doc(`commentThreads/${threadId}`) : null;
    const thread = threadRef ? await tx.get(threadRef) : null;
    if (threadRef && !thread.exists && !threadData) fail(404, 'Conversation not found.');
    if (thread?.exists && thread.data().chapterId !== req.params.chapterId) fail(400, 'Conversation belongs to another chapter.');
    if (parentCommentId) {
      const parent = await tx.get(db.doc(`comments/${id(parentCommentId)}`));
      if (!parent.exists || parent.data().chapterId !== req.params.chapterId || (parent.data().threadId || null) !== threadId) fail(400, 'Choose a reply in this conversation.');
    }
    if (threadRef && !thread.exists) tx.create(threadRef, threadData);
    tx.create(ref, { chapterId: req.params.chapterId, storyId: chapter.storyId, chapterTitle: chapter.title || '', storyTitle: story.title || '', threadId, parentCommentId, userId: req.user.uid, userName: req.user.name || 'Reader', isAuthor: author(req.user), text, status: 'active', reactionCounts: {}, createdAt: stamp() });
  });
  res.status(201).json({ id: ref.id, threadId });
}));

router.patch('/comments/:commentId', handler(async (req, res) => {
  signedIn(req); const text = textValue(req.body.text);
  const { ref } = await commentAccess(req, req.params.commentId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const comment = snap.data();
    if (!comment || comment.userId !== req.user.uid) fail(403, 'You can only edit your own comments.');
    if (['deleted', 'removed'].includes(comment.status)) fail(409, 'This comment is no longer editable.');
    tx.update(ref, { text, editedAt: stamp() });
  }); res.json({ ok: true });
}));
router.delete('/comments/:commentId', handler(async (req, res) => {
  signedIn(req); const { ref } = await commentAccess(req, req.params.commentId);
  await db.runTransaction(async tx => {
    const comment = (await tx.get(ref)).data();
    if (!comment || comment.userId !== req.user.uid) fail(403, 'You can only delete your own comments.');
    tx.update(ref, { text: '', status: 'deleted', reactionCounts: {}, deletedAt: stamp() });
  }); res.json({ ok: true });
}));

router.post('/comments/:commentId/reaction', handler(async (req, res) => {
  signedIn(req); const { emoji } = req.body;
  if (!['heart', 'like', 'laugh', 'wow', 'sad'].includes(emoji)) fail(400, 'Choose a supported reaction.');
  const { ref } = await commentAccess(req, req.params.commentId);
  const reactionRef = db.doc(`commentReactions/${hash(`${req.params.commentId}:${req.user.uid}`)}`);
  await db.runTransaction(async tx => {
    const [snap, previous] = await Promise.all([tx.get(ref), tx.get(reactionRef)]);
    const comment = snap.data();
    if (!comment || ['deleted', 'removed'].includes(comment.status)) fail(409, 'This comment is no longer available.');
    const counts = { ...comment.reactionCounts }; const old = previous.data()?.emoji;
    if (old) counts[old] = Math.max(0, (counts[old] || 0) - 1);
    if (old === emoji) tx.delete(reactionRef);
    else { counts[emoji] = (counts[emoji] || 0) + 1; tx.set(reactionRef, { commentId: ref.id, chapterId: comment.chapterId, userId: req.user.uid, emoji }); }
    tx.update(ref, { reactionCounts: counts });
  }); res.json({ ok: true });
}));

router.post('/comments/:commentId/report', handler(async (req, res) => {
  signedIn(req); const reason = req.body.reason; const details = req.body.details || '';
  if (!['Harassment', 'Hate or discrimination', 'Spam', 'Spoilers', 'Other'].includes(reason) || typeof details !== 'string' || details.length > 2000) fail(400, 'Choose a report reason and keep details under 2,000 characters.');
  const { ref } = await commentAccess(req, req.params.commentId);
  const reportRef = db.doc(`commentReports/${hash(`${ref.id}:${req.user.uid}`)}`);
  await db.runTransaction(async tx => {
    const [commentDoc, existing] = await Promise.all([tx.get(ref), tx.get(reportRef)]);
    if (existing.exists) return;
    const comment = commentDoc.data();
    if (!comment || comment.userId === req.user.uid || ['deleted', 'removed'].includes(comment.status)) fail(400, 'Only available comments by other people can be reported.');
    tx.create(reportRef, { commentId: ref.id, chapterId: comment.chapterId, storyId: comment.storyId || '', chapterTitle: comment.chapterTitle || '', commentText: comment.text, commentUserName: comment.userName, reporterId: req.user.uid, reason, details, status: 'pending', createdAt: stamp() });
  }); res.json({ ok: true, id: reportRef.id });
}));
router.get('/reports', handler(async (req, res) => {
  signedIn(req); const moderation = req.query.moderation === 'true';
  if (moderation && !author(req.user)) fail(403, 'Only the author can review all reports.');
  const source = moderation ? db.collection('commentReports') : db.collection('commentReports').where('reporterId', '==', req.user.uid);
  const docs = await source.get();
  res.json({ reports: docs.docs.map(serialize).sort((a, b) => b.createdAt - a.createdAt) });
}));
router.post('/reports/:reportId/review', handler(async (req, res) => {
  if (!author(req.user)) fail(403, 'Only the author can review reports.');
  const { decision, note = '' } = req.body;
  if (!['dismiss', 'remove'].includes(decision) || typeof note !== 'string' || note.length > 2000) fail(400, 'Choose a review decision.');
  const ref = db.doc(`commentReports/${id(req.params.reportId)}`);
  await db.runTransaction(async tx => {
    const report = await tx.get(ref);
    if (!report.exists) fail(404, 'Report not found.');
    if (report.data().status !== 'pending') fail(409, 'This report has already been reviewed.');
    const commentRef = db.doc(`comments/${report.data().commentId}`);
    const comment = await tx.get(commentRef);
    if (decision === 'remove' && comment.exists) tx.update(commentRef, { text: '', status: 'removed', reactionCounts: {}, removedAt: stamp() });
    tx.update(ref, { status: decision === 'remove' ? 'removed' : 'dismissed', resolutionNote: note.trim(), reviewedBy: req.user.uid, reviewedAt: stamp() });
  }); res.json({ ok: true });
}));
export default router;
