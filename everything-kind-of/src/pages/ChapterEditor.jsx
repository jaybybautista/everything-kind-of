import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Sparkles, ArrowLeft, BookOpen, Check, Save, Send, ChevronRight } from 'lucide-react';
import { db } from '../firebase/config';
import api from '../lib/api';
import EditorToolbar from '../components/EditorToolbar';

const ACTIONS = [
  ['continue', 'What happens next?', 'Continue naturally from your last paragraph.'],
  ['scenes', 'Explore other scenes', 'Three different directions for the next scene.'],
  ['twist', 'Introduce a twist', 'Surprising turns that fit your established story.'],
  ['dialogue', 'Develop dialogue', 'Distinct conversations grounded in your characters.'],
  ['rewrite', 'Rewrite selection', 'Three ways to improve the selected passage.'],
  ['expand', 'Expand selection', 'Add atmosphere, emotion, and sensory detail.'],
  ['grammar', 'Polish selection', 'Correct grammar while preserving your voice.'],
  ['consistency', 'Check continuity', 'Review names, timeline, point of view, and loose threads.'],
];
const message = error => error.response?.data?.error || 'Could not connect. Please try again.';
const paragraphs = text => text.replace(/\r\n/g, '\n').split(/\n\s*\n/).filter(p => p.trim()).map(p => ({
  type: 'paragraph', content: p.split('\n').flatMap((line, index) => [...(index ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line }] : [])]),
}));

export default function ChapterEditor() {
  const { storyId, chapterId } = useParams();
  return <EditorWorkspace key={chapterId} storyId={storyId} chapterId={chapterId} />;
}

function EditorWorkspace({ storyId, chapterId }) {
  const [draft, setDraft] = useState({ title: '', status: 'draft', contentHtml: '', plainText: '' });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState('saved');
  const [saveError, setSaveError] = useState('');
  const [recovery, setRecovery] = useState(null);
  const [context, setContext] = useState(null);
  const [notes, setNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [action, setAction] = useState('continue');
  const [detail, setDetail] = useState('detailed');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [response, setResponse] = useState(null);
  const [activeOption, setActiveOption] = useState(0);
  const [inserted, setInserted] = useState([]);
  const [notice, setNotice] = useState('');
  const [connection, setConnection] = useState('Not checked');
  const [checking, setChecking] = useState(false);
  const latest = useRef(draft);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const timer = useRef(null);
  const queue = useRef(Promise.resolve());
  const alive = useRef(true);
  const ready = useRef(false);
  const saveRef = useRef(null);
  const changeRef = useRef(null);
  const [requestSnapshot, setRequestSnapshot] = useState(null);
  const requestBusy = useRef(false);
  const backupKey = `chapter-backup:${storyId}:${chapterId}`;

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: '', editable: false, shouldRerenderOnTransaction: true,
    editorProps: { attributes: { role: 'textbox', 'aria-label': 'Chapter content', 'aria-multiline': 'true', 'data-placeholder': 'Every story starts with a sentence. Write yours here...' } },
    onUpdate: ({ editor: current }) => changeRef.current?.({ contentHtml: current.getHTML(), plainText: current.getText() }),
  });

  function change(patch) {
    if (!ready.current) return;
    latest.current = { ...latest.current, ...patch };
    revision.current++;
    setDraft(latest.current);
    if (patch.plainText !== undefined && response) {
      const text = patch.plainText.replace(/\s+/g, ' ');
      setInserted(current => current.filter(index => text.includes(response.suggestions[index].text.replace(/\s+/g, ' '))));
    }
    setSaveState('unsaved');
    setSaveError('');
    try { localStorage.setItem(backupKey, JSON.stringify({ ...latest.current, backedUpAt: Date.now() })); } catch { /* Remote saving remains available. */ }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveRef.current?.(), 1000);
  }

  async function save() {
    clearTimeout(timer.current);
    if (!ready.current) return false;
    const snapshot = { ...latest.current };
    const version = revision.current;
    if (alive.current) setSaveState('saving');
    const operation = queue.current.catch(() => {}).then(async () => {
      const words = snapshot.plainText.trim().split(/\s+/).filter(Boolean).length;
      const batch = writeBatch(db);
      batch.update(doc(db, 'chapters', chapterId), { title: snapshot.title, status: snapshot.status, contentHtml: snapshot.contentHtml, wordCount: words, readingTimeMinutes: Math.max(1, Math.ceil(words / 200)), updatedAt: serverTimestamp() });
      batch.update(doc(db, 'stories', storyId), { updatedAt: serverTimestamp() });
      await batch.commit();
      savedRevision.current = version;
      if (revision.current === version) {
        try { localStorage.removeItem(backupKey); } catch { /* No local backup to clear. */ }
        if (alive.current) { setSaveState('saved'); setSaveError(''); }
      }
      return true;
    });
    queue.current = operation;
    try { return await operation; }
    catch {
      if (alive.current) { setSaveState('error'); setSaveError('Could not save to the cloud. Keep this page open and try Save again. A local recovery copy is kept when browser storage is available.'); }
      return false;
    }
  }
  useLayoutEffect(() => { changeRef.current = change; saveRef.current = save; });

  useEffect(() => {
    alive.current = true;
    const beforeUnload = event => { if (revision.current !== savedRevision.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      // Read the latest edit counters on unmount, not their mount-time values.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (ready.current && revision.current !== savedRevision.current) void saveRef.current?.();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!editor) return;
    let active = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'chapters', chapterId));
        if (!active) return;
        if (!snap.exists() || snap.data().storyId !== storyId) throw new Error('This chapter could not be found.');
        const data = snap.data();
        editor.chain().setMeta('addToHistory', false).setContent(data.contentHtml || '', { emitUpdate: false }).run();
        editor.setEditable(true);
        latest.current = { title: data.title || '', status: data.status || 'draft', contentHtml: editor.getHTML(), plainText: editor.getText() };
        setDraft(latest.current); ready.current = true; setLoaded(true);
        try {
          const backup = JSON.parse(localStorage.getItem(backupKey) || 'null');
          if (backup && backup.backedUpAt > (data.updatedAt?.toMillis() || 0) && (backup.contentHtml !== latest.current.contentHtml || backup.title !== latest.current.title)) setRecovery(backup);
        } catch { /* Ignore invalid recovery data. */ }
      } catch (error) { if (active) setLoadError(error.code === 'permission-denied' ? 'Please log in again with your author account.' : error.message); }
    }
    load();
    return () => { active = false; };
  }, [editor, chapterId, storyId, backupKey]);

  useEffect(() => {
    let active = true;
    api.get('/api/gemini/context', { params: { storyId, chapterId } }).then(({ data }) => {
      if (active) { setContext(data); setNotes(data.notes); setSavedNotes(data.notes); }
    }).catch(error => { if (active) setAiError(message(error)); });
    return () => { active = false; };
  }, [storyId, chapterId]);

  async function saveNotes() {
    setNotesBusy(true); setAiError('');
    try { await api.put('/api/gemini/memory', { storyId, notes }); setSavedNotes(notes); setNotice('Story memory saved. Future suggestions will use these notes.'); return true; }
    catch (error) { setAiError(message(error)); return false; }
    finally { setNotesBusy(false); }
  }
  async function generateSuggestions() {
    if (!editor || requestBusy.current) return;
    const selection = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, '\n');
    if (['rewrite', 'expand', 'grammar'].includes(action) && !selectedText.trim()) { setAiError('Select some chapter text first, then generate suggestions.'); return; }
    requestBusy.current = true; setBusy(true); setAiError(''); setNotice('');
    try {
      if (notes !== savedNotes && !(await saveNotes())) return;
      const snapshot = { from: selection.from, to: selection.to, html: editor.getHTML(), selectedText, action };
      const { data } = await api.post('/api/gemini/assist', { storyId, chapterId, action, fullText: editor.getText(), selectedText, instructions, detail });
      if (!alive.current) return;
      setRequestSnapshot(snapshot);
      setResponse(data); setActiveOption(0); setInserted([]); setContext(current => ({ ...current, ...data.context })); setConnection('Connected');
    } catch (error) { if (alive.current) setAiError(message(error)); }
    finally { requestBusy.current = false; if (alive.current) setBusy(false); }
  }
  function insertSuggestion(mode) {
    const suggestion = response?.suggestions[activeOption];
    if (!suggestion?.text.trim() || inserted.includes(activeOption)) return;
    const snapshot = requestSnapshot;
    if (mode !== 'append' && editor.getHTML() !== snapshot.html) { setAiError('The chapter changed since this suggestion was generated. Append it, or generate again for a new selection.'); return; }
    const position = mode === 'append' ? editor.state.doc.content.size : mode === 'replace' ? { from: snapshot.from, to: snapshot.to } : snapshot.to;
    const ok = editor.chain().focus().insertContentAt(position, paragraphs(suggestion.text)).run();
    if (ok) { setInserted(current => [...current, activeOption]); setNotice('Suggestion inserted. Use Undo to revert it.'); void saveRef.current(); }
  }

  const words = draft.plainText.trim().split(/\s+/).filter(Boolean).length;
  const option = response?.suggestions[activeOption];
  const selectionChanged = response && draft.contentHtml !== requestSnapshot?.html;
  if (loadError) return <div className="studio-page"><p role="alert">{loadError}</p><Link to={`/write/${storyId}/chapters`}>Back to chapters</Link></div>;
  return <div className="writer-workspace">
    <div className="writer-heading"><div><Link className="back-link" to={`/write/${storyId}/chapters`}><ArrowLeft size={14} /> All chapters</Link><p className="eyebrow">THE MANUSCRIPT</p><h1>{context?.storyTitle || 'Your writing desk'}</h1></div>
      <div className="writer-actions"><span role="status" className={`save-status ${saveState}`}><span className="live-dot" />{({ saved: 'All changes saved', saving: 'Saving...', unsaved: 'Unsaved changes', error: 'Save failed' })[saveState]}</span>
        <button className="studio-button secondary" disabled={!loaded} onClick={() => save()}><Save size={15} /> Save</button>
        <button className="studio-button" disabled={!loaded || saveState === 'saving'} onClick={async () => { change({ status: draft.status === 'published' ? 'draft' : 'published' }); await save(); }}><Send size={15} /> {draft.status === 'published' ? 'Unpublish' : 'Publish chapter'}</button></div>
    </div>
    {saveError && <p className="studio-alert" role="alert">{saveError}</p>}
    {recovery && <div className="studio-alert">A newer local recovery copy is available. <button onClick={() => { editor.commands.setContent(recovery.contentHtml, { emitUpdate: false }); change({ title: recovery.title, contentHtml: editor.getHTML(), plainText: editor.getText() }); setRecovery(null); }}>Restore recovery copy</button> <button onClick={() => { localStorage.removeItem(backupKey); setRecovery(null); }}>Keep cloud version</button></div>}
    <div className="writer-grid">
      <section className="manuscript-panel" aria-label="Manuscript editor">
        <div className="manuscript-meta"><span><BookOpen size={14} /> CHAPTER DRAFT</span><span className="status-pill">{draft.status}</span></div>
        <input aria-label="Chapter title" className="chapter-title-input" placeholder="Give this chapter a title" value={draft.title} disabled={!loaded} onChange={event => change({ title: event.target.value })} />
        <EditorToolbar editor={loaded ? editor : null} />
        {!loaded && <p className="editor-loading" role="status">Opening your manuscript...</p>}
        <div className="editor-content manuscript-body"><EditorContent editor={editor} /></div>
        <footer className="manuscript-footer"><span>{words.toLocaleString()} words</span><span>{Math.max(1, Math.ceil(words / 200))} min read</span><span>Autosaves as you write</span></footer>
      </section>
      <aside className="assistant-panel" aria-label="Writing assistant">
        <div className="assistant-heading"><div className="sparkle-box"><Sparkles size={20} /></div><div><h2>Your creative companion</h2><p>A second perspective. Your story, always.</p></div></div>
        <div className="connection-row"><span>{connection === 'Connected' ? '● Gemini connected' : 'Gemini writing assistant'}</span><button disabled={checking} onClick={async () => { setChecking(true); setAiError(''); try { await api.get('/api/gemini/status'); setConnection('Connected'); } catch (error) { setConnection('Unavailable'); setAiError(message(error)); } finally { setChecking(false); } }}>{checking ? 'Checking...' : 'Test connection'}</button></div>
        <details className="story-memory"><summary><BookOpen size={15} /> Story memory <span>{context ? `${context.previousChapterCount} earlier chapters` : 'Loading...'}</span></summary>
          <p>Earlier chapters and your current draft are read with each request. Keep character facts, relationships, world rules, and planned events here. These notes are private.</p>
          {context?.truncated && <p className="memory-warning">Longer earlier chapters are excerpted. Keep essential details in these notes.</p>}
          <textarea aria-label="Story memory notes" placeholder="Characters and relationships...&#10;Setting and timeline...&#10;Facts that must stay consistent...&#10;Plans and unresolved threads..." maxLength={16000} value={notes} disabled={notesBusy || busy} onChange={event => setNotes(event.target.value)} />
          <div className="memory-footer"><span>{notes === savedNotes ? 'Notes saved' : 'Unsaved notes'}</span><button className="studio-button secondary small" disabled={notesBusy || busy || !context} onClick={saveNotes}>{notesBusy ? 'Saving...' : 'Save memory'}</button></div>
        </details>
        <label className="field-label" htmlFor="assistant-action">What would help you write?</label>
        <select id="assistant-action" value={action} disabled={busy} onChange={event => setAction(event.target.value)}>{ACTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <p className="action-description">{ACTIONS.find(a => a[0] === action)[2]}</p>
        <textarea className="author-direction" aria-label="Author direction" placeholder="Optional direction: build tension slowly, keep the ending hopeful, focus on their unresolved conflict..." maxLength={4000} value={instructions} onChange={event => setInstructions(event.target.value)} />
        <div className="generation-options"><span>Suggestion detail</span><div><button aria-pressed={detail === 'brief'} onClick={() => setDetail('brief')}>Brief</button><button aria-pressed={detail === 'detailed'} onClick={() => setDetail('detailed')}>Detailed</button></div></div>
        <button className="studio-button generate-button" disabled={!loaded || busy || notesBusy} onMouseDown={event => event.preventDefault()} onClick={generateSuggestions}><Sparkles size={16} />{busy ? 'Reading your story & thinking...' : 'Generate suggestions'} {!busy && <ChevronRight size={16} />}</button>
        {busy && <p className="assistant-progress" role="status">Connecting the earlier chapters, story notes, and current draft. You can keep writing.</p>}
        {aiError && <p className="studio-alert" role="alert">{aiError}</p>}
        {notice && <p className="insert-notice" role="status"><Check size={14} /> {notice}</p>}
        {!response && !busy && <div className="assistant-empty"><Sparkles size={24} /><h3>Every story has possibilities.</h3><p>Explore three different paths, compare the scene beats, and choose the one that feels like your story.</p></div>}
        {response && <section className="suggestion-results" aria-label="Generated suggestions">
          <details className="context-review"><summary>How the assistant read your story</summary><p>{response.contextSummary}</p></details>
          <div className="suggestion-tabs" role="group" aria-label="Suggestion options">{response.suggestions.map((item, index) => <button key={index} aria-pressed={activeOption === index} onClick={() => setActiveOption(index)}>Option {index + 1}{inserted.includes(index) ? ' ✓' : ''}</button>)}</div>
          {option && <article className="suggestion-card"><span className="eyebrow">{option.angle}</span><h3>{option.title}</h3><p>{option.rationale}</p>
            <details><summary>Scene beats</summary><ol>{option.outline.map((beat, index) => <li key={index}>{beat}</li>)}</ol></details>
            {option.text.trim() && <><div className="suggestion-prose">{option.text.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
              <div className="insert-actions"><button className="studio-button" disabled={inserted.includes(activeOption)} onClick={() => insertSuggestion('append')}>{inserted.includes(activeOption) ? 'Inserted' : 'Insert into chapter'} <span>at end</span></button>
                <button className="studio-button secondary" disabled={inserted.includes(activeOption) || selectionChanged} onClick={() => insertSuggestion(requestSnapshot.selectedText ? 'replace' : 'cursor')}>{requestSnapshot.selectedText ? 'Replace original selection' : 'Insert at saved cursor'}</button></div>
              {selectionChanged && !inserted.includes(activeOption) && <p className="action-description">Your draft changed. Append this option or generate again to replace a selection safely.</p>}</>}
          </article>}
          {response.continuityNotes?.length > 0 && <details className="continuity-notes" open={action === 'consistency'}><summary>Continuity & editorial notes</summary><ul>{response.continuityNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
        </section>}
      </aside>
    </div>
  </div>;
}
