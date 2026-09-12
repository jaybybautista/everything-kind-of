# Author studio

Sign in with the author account and open `/dashboard`. Author pages use a dedicated studio layout with the site's original pink palette and Poppins typography. The feather logo is also the site favicon.

## Writing and saving

Open a story's Chapters page, then select a chapter. The toolbar supports bold, italic, underline, strikethrough, headings, lists, quotations, scene breaks, clear formatting, undo, and redo. Changes autosave after a short pause. Save writes immediately. Publishing changes chapter status; readers still require the parent story to be public.

Saving uses ordered writes so older requests cannot overwrite newer edits. Failed saves show an error. When browser storage is available, a recovery copy is retained until cloud saving succeeds. A newer recovery copy is offered when the chapter is reopened.

## Gemini suggestions

Expand Story memory and save character facts, relationships, timeline details, world rules, and future plans. These notes are stored privately in `authorMemory` and accessed only through the authenticated author API. Every request reloads notes and earlier chapters, then includes the current unsaved chapter. Long earlier chapters are excerpted; the panel indicates when this occurs. Memory guides generation but does not guarantee perfect continuity.

Choose a continuation, alternative scenes, twist, dialogue, rewrite, expansion, polish, or continuity review. Rewrite, expansion, and polish require a selection. Optional author direction guides the request. Detailed mode asks for roughly 180-300 words per draft passage, scene beats, and rationale. Most actions offer three alternatives; polish and continuity return one result.

Insert into chapter appends only the prose, using plain-text editor nodes. The alternate insertion button targets the saved cursor or original selection. If the manuscript changed after generation, replacement is disabled to protect the newer text. Undo can revert insertion. Error messages and continuity reports are never offered as chapter prose.

## Reader conversations and reports

Readers can tap a word or highlight a phrase and choose to comment. Opening the conversation does not create a stored thread: the first posted comment creates it. Each passage has its own conversation, including separate occurrences of the same phrase. Existing conversations are highlighted in the chapter. Readers can also use the whole-chapter conversation.

Signed-in readers can reply, edit or delete their own comments and replies, and react with heart, like, laugh, wow, or sad. Deleted or moderated comments retain a placeholder so replies remain readable. Conversations refresh every five seconds while the page is visible.

Readers can report another person's comment and track its status on My reports. The author reviews reports from Comment reports in the studio, dismisses them or removes the comment, and can add a review note visible to the reporter. Readers cannot access other readers' reports or author moderation controls. Discussion writes go through the authenticated backend; direct Firestore comment writes are blocked.

`server/verify-discussions.mjs` verifies passage separation, ownership, reactions, reporting, moderation, and Firestore restrictions with temporary fixtures. `server/verify-discussion-retries.mjs` verifies duplicate submission protection against that fixture. Run `node verify-discussions.mjs --cleanup` from `server` after verification to remove the fixture and temporary accounts.

## Services and development

Gemini uses `GEMINI_API_KEY` and `GEMINI_MODEL` in `server/.env`. The verified model is `gemini-3.6-flash`. Keys remain on the server. Test connection in the editor makes a small generation request. LanguageTool and LibreTranslate endpoints have been removed. The backend watcher monitors source and configuration explicitly, excluding dependency-file changes that previously interrupted requests.

Start the frontend with `npm run dev` inside `everything-kind-of`, and the backend with `npm run dev` inside `server`. The defaults are ports 5173 and 5000.

## Verification

`server/verify-editor-services.mjs` uses a temporary private fixture to verify memory, context, multiple structured suggestions, rejected invalid requests, and removal of the old endpoints. Run it from `server`; use `--cleanup` afterward. The fixture has fixed verification-only IDs and initial setup refuses to overwrite existing records. `--existing` resumes checks against a fixture from an interrupted run.

Browser checks covered formatting, title saving, generation, insertion, undo, protection of changed selections, and persistence after reload. Temporary verification records were removed.
