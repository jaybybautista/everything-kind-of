import admin from "firebase-admin";
import fs from "fs";
import "dotenv/config";

let credential;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === "string" 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
    : process.env.FIREBASE_SERVICE_ACCOUNT;
  credential = admin.credential.cert(serviceAccount);
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
  credential = admin.credential.cert(serviceAccount);
} else {
  credential = admin.credential.applicationDefault();
}

admin.initializeApp({
  credential,
});

export default admin;
