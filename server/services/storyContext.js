import admin from '../firebaseAdmin.js';
export function validateId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw Object.assign(new Error('A valid story and chapter are required.'), { status: 400 });
}
export function plainText(html = '') {
  return String(html).replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
export async function buildContext(uid, storyId, chapterId) {
  validateId(storyId); validateId(chapterId);
  const db = admin.firestore();
  const [storyDoc, chapterDoc, memoryDoc, chapters] = await Promise.all([
    db.doc(`stories/${storyId}`).get(), db.doc(`chapters/${chapterId}`).get(),
    db.doc(`authorMemory/${storyId}`).get(), db.collection('chapters').where('storyId', '==', storyId).get(),
  ]);
  if (!storyDoc.exists || storyDoc.data().authorId !== uid || !chapterDoc.exists || chapterDoc.data().storyId !== storyId) throw Object.assign(new Error('Story or chapter not found for your account.'), { status: 403 });
  const ordered = chapters.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id.localeCompare(b.id));
  const earlier = ordered.slice(0, ordered.findIndex(c => c.id === chapterId));
  const allowance = Math.max(200, Math.floor(60000 / Math.max(1, earlier.length)));
  let truncated = false;
  const previousChapters = earlier.map(c => {
    const text = plainText(c.contentHtml);
    if (text.length > allowance) truncated = true;
    return { title: c.title, text: text.length > allowance ? text.slice(0, Math.floor(allowance / 3)) + '\n[Middle omitted for length]\n' + text.slice(-Math.floor(allowance * 2 / 3)) : text };
  });
  const story = storyDoc.data();
  const notes = memoryDoc.data()?.notes || '';
  return {
    info: { storyTitle: story.title, chapterTitle: chapterDoc.data().title, previousChapterCount: earlier.length, notes, truncated },
    prompt: { title: story.title, premise: story.description, genre: story.genre, language: story.language, canonNotes: notes, previousChapters },
  };
}
