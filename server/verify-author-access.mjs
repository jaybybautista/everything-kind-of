import admin from './firebaseAdmin.js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parse } from 'dotenv';
import { initializeApp, deleteApp } from '../everything-kind-of/node_modules/firebase/app/dist/esm/index.esm.js';
import { getAuth, signInWithCustomToken } from '../everything-kind-of/node_modules/firebase/auth/dist/esm/index.esm.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, writeBatch, increment, collection, query, where, getDocs } from '../everything-kind-of/node_modules/firebase/firestore/dist/esm/index.esm.js';
import { requireAuth } from './middleware/authMiddleware.js';
import axios from 'axios';

const env = parse(readFileSync(new URL('../everything-kind-of/.env', import.meta.url)));
const config = { apiKey: env.VITE_FIREBASE_API_KEY, projectId: env.VITE_FIREBASE_PROJECT_ID };
const suffix = randomUUID();
const readerId = `role-check-${suffix}`;
const storyId = `role-check-${suffix}`;
const chapterId = `role-check-${suffix}`;
const apps = [];
let readerCreated = false;
const cleanup = [`users/${readerId}`, `stories/${storyId}`, `chapters/${chapterId}`, `comments/${chapterId}`, `likes/${readerId}_${storyId}`, `bookmarks/${readerId}_${storyId}`, `follows/${readerId}_author`, `users/${readerId}/readingProgress/${storyId}`];
async function client(uid) {
  const app = initializeApp(config, uid);
  apps.push(app);
  const token = await admin.auth().createCustomToken(uid);
  const credential = await signInWithCustomToken(getAuth(app), token);
  return { db: getFirestore(app), token: await credential.user.getIdToken() };
}
async function denied(label, action) {
  try { await action(); } catch (error) {
    if (error.code === 'permission-denied') { console.log('PASS:', label); return; }
    throw error;
  }
  throw new Error(`Access unexpectedly allowed: ${label}`);
}
async function backend(token, expected) {
  let status = 200;
  const res = { status(code) { status = code; return this; }, json() {} };
  await requireAuth({ headers: { authorization: `Bearer ${token}` } }, res, () => {});
  if (status !== expected) throw new Error(`Expected backend ${expected}, got ${status}`);
}
try {
  const authorUser = await admin.auth().getUserByEmail('fluttershyyzh@gmail.com');
  if (!authorUser.customClaims?.admin || !authorUser.customClaims?.author) throw new Error('Author claims missing');
  await admin.auth().createUser({ uid: readerId, email: `role-check-${suffix}@example.invalid` });
  readerCreated = true;
  const author = await client(authorUser.uid);
  const reader = await client(readerId);
  await backend(reader.token, 403);
  await backend(author.token, 200);
  console.log('PASS: backend author/reader access');
  await setDoc(doc(reader.db, 'users', readerId), { displayName: 'Role check', email: `role-check-${suffix}@example.invalid`, role: 'reader' });
  await denied('reader cannot promote profile', () => updateDoc(doc(reader.db, 'users', readerId), { role: 'admin', admin: true }));
  await denied('reader cannot create stories', () => setDoc(doc(reader.db, 'stories', storyId), { authorId: readerId, visibility: 'public' }));
  await setDoc(doc(author.db, 'stories', storyId), { authorId: authorUser.uid, visibility: 'private', likesCount: 0, bookmarksCount: 0 });
  await setDoc(doc(author.db, 'chapters', chapterId), { storyId, status: 'draft' });
  console.log('PASS: author can create stories and chapters');
  await denied('reader cannot read private stories', () => getDoc(doc(reader.db, 'stories', storyId)));
  await denied('reader cannot read draft chapters', () => getDoc(doc(reader.db, 'chapters', chapterId)));
  await denied('reader cannot edit stories', () => updateDoc(doc(reader.db, 'stories', storyId), { title: 'Forbidden' }));
  await denied('reader cannot publish chapters', () => updateDoc(doc(reader.db, 'chapters', chapterId), { status: 'published' }));
  await updateDoc(doc(author.db, 'stories', storyId), { visibility: 'public' });
  await updateDoc(doc(author.db, 'chapters', chapterId), { status: 'published' });
  await getDoc(doc(reader.db, 'stories', storyId));
  await getDocs(query(collection(reader.db, 'chapters'), where('storyId', '==', storyId), where('status', '==', 'published')));
  const posted = await axios.post(`http://localhost:5000/api/discussions/chapters/${chapterId}/comments`, { text: 'Temporary access test' }, { proxy: false, headers: { Authorization: `Bearer ${reader.token}` } });
  cleanup.push(`comments/${posted.data.id}`);
  await getDocs(query(collection(reader.db, 'comments'), where('chapterId', '==', chapterId)));
  for (const [kind, field] of [['likes', 'likesCount'], ['bookmarks', 'bookmarksCount']]) {
    for (const add of [true, false]) {
      const batch = writeBatch(reader.db);
      const ref = doc(reader.db, kind, `${readerId}_${storyId}`);
      if (add) batch.set(ref, { userId: readerId, storyId, createdAt: new Date() });
      else batch.delete(ref);
      batch.update(doc(reader.db, 'stories', storyId), { [field]: increment(add ? 1 : -1) });
      await batch.commit();
    }
  }
  await setDoc(doc(reader.db, 'users', readerId, 'readingProgress', storyId), { lastChapterId: chapterId });
  console.log('PASS: reader can read published chapters, comment, like, bookmark, and save progress');
} catch (error) {
  console.error('Verification failed:', error.code || error.name, error.message);
  process.exitCode = 1;
} finally {
  await Promise.all(apps.map(deleteApp));
  if (readerCreated) {
    const batch = admin.firestore().batch();
    cleanup.forEach(path => batch.delete(admin.firestore().doc(path)));
    await batch.commit();
    await admin.auth().deleteUser(readerId);
    console.log('Temporary verification data removed.');
  }
}
