import admin from './firebaseAdmin.js';
import axios from 'axios';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { initializeApp, deleteApp } from '../everything-kind-of/node_modules/firebase/app/dist/esm/index.esm.js';
import { getAuth, signInWithCustomToken } from '../everything-kind-of/node_modules/firebase/auth/dist/esm/index.esm.js';
import { getFirestore, doc, setDoc } from '../everything-kind-of/node_modules/firebase/firestore/dist/esm/index.esm.js';
import { chapterText } from './routes/discussions.js';

const chapterId = 'passage-verification-chapter';
const storyId = 'passage-verification-story';
const readerIds = ['passage-verification-reader-a', 'passage-verification-reader-b'];
const db = admin.firestore();
async function cleanup() {
  for (const name of ['comments', 'commentThreads', 'commentReactions', 'commentReports']) {
    const docs = await db.collection(name).where('chapterId', '==', chapterId).get();
    for (const snap of docs.docs) await snap.ref.delete();
  }
  await db.doc(`chapters/${chapterId}`).delete(); await db.doc(`stories/${storyId}`).delete();
  const owner = await admin.auth().getUserByEmail('fluttershyyzh@gmail.com');
  for (const uid of [...readerIds, owner.uid]) await db.doc(`users/${uid}/readingProgress/${storyId}`).delete();
  for (const uid of readerIds) { try { await admin.auth().deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; } }
  console.log('Temporary discussion fixture removed.');
}
if (process.argv.includes('--cleanup')) await cleanup();
else {
  const apps = [];
  try {
    const env = parse(readFileSync(new URL('../everything-kind-of/.env', import.meta.url)));
    const author = await admin.auth().getUserByEmail('fluttershyyzh@gmail.com');
    for (const uid of readerIds) await admin.auth().createUser({ uid, displayName: uid.endsWith('-a') ? 'Test Reader A' : 'Test Reader B' });
    const clients = [];
    for (const uid of [...readerIds, author.uid]) {
      const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, projectId: env.VITE_FIREBASE_PROJECT_ID }, uid); apps.push(app);
      const session = await signInWithCustomToken(getAuth(app), await admin.auth().createCustomToken(uid));
      clients.push(axios.create({ baseURL: 'http://localhost:5000/api/discussions', proxy: false, timeout: 20000, headers: { Authorization: `Bearer ${await session.user.getIdToken()}` }, validateStatus: () => true }));
    }
    const [a, b, owner] = clients;
    assert.equal((await db.doc(`stories/${storyId}`).get()).exists, false);
    const html = '<p>The silver compass glimmered. The silver compass stayed shut.</p><p>Mara heard a knock at the door.</p>';
    const text = chapterText(html); const quote = 'silver compass';
    const anchor = { start: text.indexOf(quote), end: text.indexOf(quote) + quote.length, quote };
    const second = { start: text.lastIndexOf(quote), end: text.lastIndexOf(quote) + quote.length, quote };
    await db.doc(`stories/${storyId}`).set({ title: 'Passage verification', authorId: author.uid, visibility: 'public', status: 'ongoing', createdAt: new Date(), updatedAt: new Date() });
    await db.doc(`chapters/${chapterId}`).set({ storyId, title: 'A passage to discuss', contentHtml: html, status: 'published', wordCount: 23, readingTimeMinutes: 1 });
    const endpoint = `/chapters/${chapterId}`;
    assert.equal((await a.get(endpoint)).data.threads.length, 0);
    assert.equal((await a.get(endpoint)).data.threads.length, 0);
    console.log('PASS: reading/selecting does not create conversations.');
    const first = await a.post(`${endpoint}/comments`, { anchor, text: 'This compass seems important.' }); assert.equal(first.status, 201);
    const again = await b.post(`${endpoint}/comments`, { anchor, text: 'I noticed it too.' }); assert.equal(again.data.threadId, first.data.threadId);
    const other = await b.post(`${endpoint}/comments`, { anchor: second, text: 'Why is it still shut?' }); assert.notEqual(other.data.threadId, first.data.threadId);
    assert.equal((await a.get(endpoint)).data.threads.length, 2);
    const reply = await b.post(`${endpoint}/comments`, { threadId: first.data.threadId, parentCommentId: first.data.id, text: 'Maybe it belongs to Eli.' }); assert.equal(reply.status, 201);
    assert.equal((await a.post(`${endpoint}/comments`, { threadId: other.data.threadId, parentCommentId: first.data.id, text: 'Wrong conversation' })).status, 400);
    console.log('PASS: identical phrases at different positions have separate threads; replies cannot cross threads.');
    assert.equal((await b.patch(`/comments/${first.data.id}`, { text: 'Unauthorized edit' })).status, 403);
    assert.equal((await b.delete(`/comments/${first.data.id}`)).status, 403);
    assert.equal((await a.patch(`/comments/${first.data.id}`, { text: 'The silver compass feels significant.' })).status, 200);
    assert.equal((await b.patch(`/comments/${reply.data.id}`, { text: 'Perhaps Eli left it for Mara.' })).status, 200);
    await b.post(`/comments/${first.data.id}/reaction`, { emoji: 'heart' });
    let comment = (await a.get(endpoint)).data.comments.find(c => c.id === first.data.id); assert.equal(comment.reactionCounts.heart, 1);
    await b.post(`/comments/${first.data.id}/reaction`, { emoji: 'heart' });
    comment = (await a.get(endpoint)).data.comments.find(c => c.id === first.data.id); assert.equal(comment.reactionCounts.heart, 0);
    await b.post(`/comments/${first.data.id}/reaction`, { emoji: 'wow' });
    console.log('PASS: ownership checks, comment/reply editing, and reaction toggles.');
    const report = await b.post(`/comments/${first.data.id}/report`, { reason: 'Spoilers', details: 'Verification report.' }); assert.equal(report.status, 200);
    const duplicate = await b.post(`/comments/${first.data.id}/report`, { reason: 'Spam' }); assert.equal(duplicate.data.id, report.data.id);
    assert.equal((await a.get('/reports')).data.reports.length, 0);
    assert.equal((await b.get('/reports')).data.reports.length, 1);
    assert.equal((await b.get('/reports?moderation=true')).status, 403);
    assert.equal((await b.post(`/reports/${report.data.id}/review`, { decision: 'remove' })).status, 403);
    assert.equal((await owner.post(`/reports/${report.data.id}/review`, { decision: 'remove', note: 'Removed after review.' })).status, 200);
    comment = (await a.get(endpoint)).data.comments.find(c => c.id === first.data.id); assert.equal(comment.text, ''); assert.equal(comment.status, 'removed');
    assert.equal((await a.patch(`/comments/${first.data.id}`, { text: 'Restore removed content' })).status, 409);
    assert.equal((await b.get('/reports')).data.reports[0].status, 'removed');
    assert.equal((await b.delete(`/comments/${reply.data.id}`)).status, 200);
    const remaining = (await a.get(endpoint)).data.comments;
    assert.equal(remaining.find(c => c.id === reply.data.id).status, 'deleted');
    assert.ok(remaining.some(c => c.id === again.data.id));
    console.log('PASS: private deduplicated reports, author moderation, reporter outcomes, and tombstones preserving other messages.');
    await assert.rejects(setDoc(doc(getFirestore(apps[0]), 'comments', 'passage-direct-write'), { chapterId, userId: readerIds[0], text: 'Bypass' }), error => error.code === 'permission-denied');
    console.log('PASS: direct database writes cannot bypass discussion moderation.');
    console.log(`UI fixture: http://localhost:5173/stories/${storyId}/chapters/${chapterId}`);
  } catch (error) { console.error('Verification failed:', error.code || error.name, error.message); process.exitCode = 1; }
  finally { await Promise.all(apps.map(deleteApp)); }
}
