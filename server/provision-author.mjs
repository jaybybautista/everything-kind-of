import admin from './firebaseAdmin.js';
import { readFileSync } from 'node:fs';

// Supply the password through stdin; never store it in source control.
const password = readFileSync(0, 'utf8').trim();
if (!password) throw new Error('Supply the author password through stdin.');
const email = 'fluttershyyzh@gmail.com';
try {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    user = await admin.auth().updateUser(user.uid, { displayName: 'fluttershyyzh', password });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await admin.auth().createUser({ email, password, displayName: 'fluttershyyzh' });
  }
  await admin.auth().setCustomUserClaims(user.uid, { ...user.customClaims, admin: true, author: true });
  const profile = admin.firestore().doc(`users/${user.uid}`);
  const existing = await profile.get();
  await profile.set({
    ...(!existing.exists ? { bio: '', followersCount: 0, followingCount: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    name: 'fluttershyyzh', username: 'fluttershyyzh', displayName: 'fluttershyyzh', email, role: 'admin',
  }, { merge: true });
  console.log('Author account and profile configured.');
} catch (error) {
  console.error('Provisioning failed:', error.code || error.name, error.message);
  process.exitCode = 1;
}
