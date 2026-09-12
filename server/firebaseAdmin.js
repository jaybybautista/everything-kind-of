import admin from "firebase-admin";
import fs from "fs";
import "dotenv/config";

// GOOGLE_APPLICATION_CREDENTIALS points at the service account JSON
// you downloaded from Firebase Console > Project Settings > Service Accounts.
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
