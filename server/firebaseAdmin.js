import admin from "firebase-admin";
import fs from "fs";
import "dotenv/config";

let credential;

function parseServiceAccount(raw) {
  if (typeof raw === "object" && raw !== null) return raw;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err1) {
    // Render/system env vars often convert \n to raw line breaks or double backslashes
    try {
      const sanitized = raw.replace(/\r?\n/g, "\\n");
      parsed = JSON.parse(sanitized);
    } catch (err2) {
      // Base64 decoded fallback
      try {
        const decoded = Buffer.from(raw, "base64").toString("utf-8");
        parsed = JSON.parse(decoded);
      } catch (err3) {
        console.error("FIREBASE_SERVICE_ACCOUNT parse error:", err1.message);
        throw err1;
      }
    }
  }
  // Ensure private_key has proper newlines for RSA verification
  if (parsed && typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
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
