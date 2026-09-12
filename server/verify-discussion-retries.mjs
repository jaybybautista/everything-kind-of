import admin from './firebaseAdmin.js';
import axios from 'axios';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { initializeApp, deleteApp } from '../everything-kind-of/node_modules/firebase/app/dist/esm/index.esm.js';
import { getAuth, signInWithCustomToken } from '../everything-kind-of/node_modules/firebase/auth/dist/esm/index.esm.js';
const env = parse(readFileSync(new URL('../everything-kind-of/.env', import.meta.url)));
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY });
try {
  const session = await signInWithCustomToken(getAuth(app), await admin.auth().createCustomToken('passage-verification-reader-a'));
  const client = axios.create({ baseURL: 'http://localhost:5000/api/discussions', proxy: false, headers: { Authorization: `Bearer ${await session.user.getIdToken()}` } });
  const payload = { text: 'A retry should not duplicate this message.', submissionId: 'verification-retry' };
  const endpoint = '/chapters/passage-verification-chapter/comments';
  const [first, second] = await Promise.all([client.post(endpoint, payload), client.post(endpoint, payload)]);
  assert.equal(first.data.id, second.data.id);
  const { data } = await client.get('/chapters/passage-verification-chapter');
  assert.equal(data.comments.filter(comment => comment.id === first.data.id).length, 1);
  console.log('PASS: simultaneous retries create only one comment.');
} catch (error) { console.error(error.response?.status || error.code || error.name, error.response?.data?.error || error.message); process.exitCode = 1; }
finally { await deleteApp(app); }
