export default function EditorToolbar({ editor }) {
  if (!editor) return null;
  const tools = [
    ['Bold', 'B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
    ['Italic', 'I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
    ['Underline', 'U', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline')],
    ['Strikethrough', 'S', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike')],
    ['Heading 2', 'H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 })],
    ['Heading 3', 'H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 })],
    ['Bullet list', '• List', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')],
    ['Numbered list', '1. List', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList')],
    ['Block quote', '“ Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote')],
    ['Scene break', '* * *', () => editor.chain().focus().setHorizontalRule().run(), false],
    ['Clear formatting', 'Clear', () => editor.chain().focus().unsetAllMarks().clearNodes().run(), false],
  ];
  return <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
    {tools.map(([label, text, action, active]) => <button key={label} type="button" aria-label={label} title={label} aria-pressed={active} onMouseDown={e => e.preventDefault()} onClick={action}>{text}</button>)}
    <span className="toolbar-divider" />
    <button type="button" aria-label="Undo" onMouseDown={e => e.preventDefault()} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</button>
    <button type="button" aria-label="Redo" onMouseDown={e => e.preventDefault()} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</button>
  </div>;
}
