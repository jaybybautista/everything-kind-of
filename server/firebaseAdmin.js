import admin from "firebase-admin";
import fs from "fs";
import "dotenv/config";

let credential;

function parseServiceAccount(raw) {
  if (typeof raw === "object" && raw !== null) return raw;
  const str = String(raw).trim();
  
  // Try direct JSON.parse
  try {
    const parsed = JSON.parse(str);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (_) {}

  // Try fixing escaped newlines or raw newlines inside quotes
  try {
    const sanitized = str.replace(/\r?\n/g, "\\n");
    const parsed = JSON.parse(sanitized);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (_) {}

  // Try Base64 decoding (cleaning all whitespace/newlines first)
  try {
    const cleanedB64 = str.replace(/\s+/g, "");
    const decoded = Buffer.from(cleanedB64, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (_) {}

  throw new Error("Unable to parse FIREBASE_SERVICE_ACCOUNT JSON or Base64 string");
}

if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  // Option 1: Individual env vars (most reliable on Render)
  credential = admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID || "everything-kind-of",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Option 2: Full JSON or Base64 string
  const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  credential = admin.credential.cert(serviceAccount);
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  // Option 3: File path specified in GOOGLE_APPLICATION_CREDENTIALS
  const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
  credential = admin.credential.cert(serviceAccount);
} else if (fs.existsSync("./serviceAccountKey.json")) {
  // Option 4: Local serviceAccountKey.json
  const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf-8"));
  credential = admin.credential.cert(serviceAccount);
} else {
  credential = admin.credential.applicationDefault();
}

admin.initializeApp({
  credential,
});

export default admin;
