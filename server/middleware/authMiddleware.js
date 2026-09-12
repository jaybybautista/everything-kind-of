import admin from "../firebaseAdmin.js";

// Every request to the AI/proxy routes must include:
//   Authorization: Bearer <firebase-id-token>
// This confirms the request came from a logged-in user before we
// spend API-key budget on Gemini/LanguageTool/etc on their behalf.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing Authorization header." });
  }

  try {
    req.user = await admin.auth().verifyIdToken(token);
    if (req.user.admin !== true || req.user.author !== true ||
        req.user.email !== "fluttershyyzh@gmail.com") {
      return res.status(403).json({ error: "Only the author can use writing tools." });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
