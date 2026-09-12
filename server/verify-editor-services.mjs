import admin from './firebaseAdmin.js';
import axios from 'axios';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { initializeApp, deleteApp } from '../everything-kind-of/node_modules/firebase/app/dist/esm/index.esm.js';
import { getAuth, signInWithCustomToken } from '../everything-kind-of/node_modules/firebase/auth/dist/esm/index.esm.js';
import assert from 'node:assert/strict';

const storyId = 'editor-verification-story';
const previousId = 'editor-verification-previous';
const chapterId = 'editor-verification-current';
const paths = [`stories/${storyId}`, `chapters/${previousId}`, `chapters/${chapterId}`, `authorMemory/${storyId}`];
const db = admin.firestore();
if (process.argv.includes('--cleanup')) {
  const batch = db.batch(); paths.forEach(path => batch.delete(db.doc(path))); await batch.commit();
  console.log('Temporary editor verification records removed.');
} else {
  let app;
  try {
    const user = await admin.auth().getUserByEmail('fluttershyyzh@gmail.com');
    console.log('Author account loaded.');
    const env = parse(readFileSync(new URL('../everything-kind-of/.env', import.meta.url)));
    app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY }, 'editor-service-check');
    const credential = await signInWithCustomToken(getAuth(app), await admin.auth().createCustomToken(user.uid));
    console.log('Authenticated verification session.');
    const client = axios.create({ baseURL: process.env.TEST_API_URL || 'http://localhost:5000', proxy: false, headers: { Authorization: `Bearer ${await credential.user.getIdToken()}` }, timeout: 100000 });
    if (!process.argv.includes('--existing')) {
    for (const path of paths) assert.equal((await db.doc(path).get()).exists, false, 'Temporary fixture already exists. Clean it up first.');
    const stamp = admin.firestore.FieldValue.serverTimestamp();
    await db.doc(`stories/${storyId}`).set({ title: 'Editor verification', description: 'Mara must reach the lighthouse before the storm. Her brother Eli disappeared there.', authorId: user.uid, authorName: 'fluttershyyzh', visibility: 'private', status: 'ongoing', genre: 'Mystery', language: 'English', createdAt: stamp, updatedAt: stamp });
    await db.doc(`chapters/${previousId}`).set({ storyId, title: 'The promise', orderIndex: 0, status: 'draft', contentHtml: '<p>Mara promised Eli she would never open the silver compass. At dusk she found his coat on the harbor steps. The lighthouse had been dark for eleven years.</p>', createdAt: stamp, updatedAt: stamp });
    await db.doc(`chapters/${chapterId}`).set({ storyId, title: 'At the lighthouse', orderIndex: 1, status: 'draft', contentHtml: '<p>Mara reached the lighthouse with the unopened silver compass in her pocket. A light moved behind the door.</p>', createdAt: stamp, updatedAt: stamp });
    }
    const notes = 'Mara and Eli are siblings. The silver compass must remain unopened until the final chapter. The lighthouse has been dark for eleven years. No magic has been established.';
    console.log('Checking memory endpoint.');
    await client.put('/api/gemini/memory', { storyId, notes });
    const { data: context } = await client.get('/api/gemini/context', { params: { storyId, chapterId } });
    assert.equal(context.previousChapterCount, 1); assert.equal(context.notes, notes);
    console.log('PASS: private story memory persists and earlier chapters load.');
    const { data: result } = await client.post('/api/gemini/assist', { storyId, chapterId, action: 'scenes', detail: 'brief', fullText: 'Mara reached the lighthouse with the unopened silver compass in her pocket. A light moved behind the door.' });
    assert.equal(result.suggestions.length, 3);
    assert.equal(new Set(result.suggestions.map(s => s.title)).size, 3);
    assert.ok(result.suggestions.every(s => s.text.trim().length > 50 && s.outline.length > 0));
    assert.equal(result.context.previousChapterCount, 1);
    console.log('PASS: Gemini generates three distinct prose options with outlines and story context.');
    for (const endpoint of ['/api/languagetool/check', '/api/translate']) {
      const response = await client.post(endpoint, {}, { validateStatus: () => true });
      assert.equal(response.status, 404);
    }
    const invalid = await client.post('/api/gemini/assist', { storyId, chapterId, action: 'rewrite' }, { validateStatus: () => true });
    assert.equal(invalid.status, 400);
    console.log('PASS: removed services are unavailable and empty rewrite selections are rejected.');
    console.log(`UI fixture: http://localhost:5173/write/${storyId}/chapters/${chapterId}`);
  } catch (error) {
    console.error('Verification failed:', error.response?.status || error.code || error.name, error.response?.data?.error || error.message);
    process.exitCode = 1;
  } finally { if (app) await deleteApp(app); }
}
