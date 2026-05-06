import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";

const C = {
  bg:     "#2A0A0A",
  border: "#4a1a1a",
  accent: "#C9A24A",
  muted:  "#7a6a60",
  text:   "#e8e0d0",
};

const btnStyle = (active) => ({
  background: active ? C.accent : "transparent",
  color: active ? "#0a0c08" : C.muted,
  border: `1px solid ${active ? C.accent : C.border}`,
  borderRadius: 3,
  padding: "3px 8px",
  fontSize: 12,
  fontFamily: "'Share Tech Mono', monospace",
  cursor: "pointer",
  lineHeight: 1.4,
});

export default function LegioEditor({ content, onChange, minHeight = 320, stickyTop = 0 }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 4 }}>
      {/* Toolbar sticky */}
      <div style={{
        position: "sticky", top: stickyTop, zIndex: 10,
        background: "#1a0505", borderBottom: `1px solid ${C.border}`,
        borderRadius: "4px 4px 0 0",
        padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 4,
      }}>
        <button style={btnStyle(editor.isActive("bold"))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}>B</button>
        <button style={{ ...btnStyle(editor.isActive("italic")), fontStyle: "italic" }} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}>I</button>
        <button style={{ ...btnStyle(editor.isActive("underline")), textDecoration: "underline" }} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}>U</button>
        <button style={{ ...btnStyle(editor.isActive("strike")), textDecoration: "line-through" }} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}>S</button>

        <span style={{ width: 1, background: C.border, margin: "0 4px" }} />

        <button style={btnStyle(editor.isActive("heading", { level: 1 }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}>H1</button>
        <button style={btnStyle(editor.isActive("heading", { level: 2 }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}>H2</button>
        <button style={btnStyle(editor.isActive("heading", { level: 3 }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}>H3</button>

        <span style={{ width: 1, background: C.border, margin: "0 4px" }} />

        <button style={btnStyle(editor.isActive("bulletList"))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}>• Lista</button>
        <button style={btnStyle(editor.isActive("orderedList"))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}>1. Lista</button>
        <button style={btnStyle(editor.isActive("blockquote"))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}>" Cita</button>
        <button style={btnStyle(false)} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}>— Sep</button>

        <span style={{ width: 1, background: C.border, margin: "0 4px" }} />

        <button style={btnStyle(editor.isActive({ textAlign: "left" }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign("left").run(); }}>≡L</button>
        <button style={btnStyle(editor.isActive({ textAlign: "center" }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign("center").run(); }}>≡C</button>
        <button style={btnStyle(editor.isActive({ textAlign: "right" }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setTextAlign("right").run(); }}>≡R</button>

        <span style={{ width: 1, background: C.border, margin: "0 4px" }} />

        <button style={btnStyle(false)} onMouseDown={e => { e.preventDefault(); editor.chain().focus().undo().run(); }}>↩</button>
        <button style={btnStyle(false)} onMouseDown={e => { e.preventDefault(); editor.chain().focus().redo().run(); }}>↪</button>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} style={{ padding: "12px 16px", background: "#1a0505", borderRadius: "0 0 4px 4px" }} />

      <style>{`
        .ProseMirror { outline: none; color: ${C.text}; font-size: 14px; line-height: 1.7; font-family: 'Inter', sans-serif; min-height: ${minHeight}px; }
        .ProseMirror h1 { font-family: 'Oswald', sans-serif; font-size: 22px; color: ${C.accent}; letter-spacing: 2px; margin: 16px 0 8px; text-transform: uppercase; }
        .ProseMirror h2 { font-family: 'Oswald', sans-serif; font-size: 18px; color: ${C.accent}; letter-spacing: 1px; margin: 14px 0 6px; }
        .ProseMirror h3 { font-family: 'Oswald', sans-serif; font-size: 15px; color: ${C.text}; margin: 12px 0 4px; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 24px; margin: 8px 0; }
        .ProseMirror li { margin: 4px 0; }
        .ProseMirror blockquote { border-left: 3px solid ${C.accent}; padding-left: 12px; color: ${C.muted}; margin: 8px 0; font-style: italic; }
        .ProseMirror hr { border: none; border-top: 1px solid ${C.border}; margin: 16px 0; }
        .ProseMirror p { margin: 6px 0; }
        .ProseMirror code { font-family: 'Share Tech Mono', monospace; background: #2a1010; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
        .ProseMirror pre { background: #1a0808; padding: 12px; border-radius: 4px; overflow-x: auto; }
        .legio-render h1 { font-family: 'Oswald', sans-serif; font-size: 22px; color: ${C.accent}; letter-spacing: 2px; margin: 16px 0 8px; text-transform: uppercase; }
        .legio-render h2 { font-family: 'Oswald', sans-serif; font-size: 18px; color: ${C.accent}; letter-spacing: 1px; margin: 14px 0 6px; }
        .legio-render h3 { font-family: 'Oswald', sans-serif; font-size: 15px; margin: 12px 0 4px; }
        .legio-render ul, .legio-render ol { padding-left: 24px; margin: 8px 0; }
        .legio-render li { margin: 4px 0; }
        .legio-render blockquote { border-left: 3px solid ${C.accent}; padding-left: 12px; color: ${C.muted}; margin: 8px 0; font-style: italic; }
        .legio-render hr { border: none; border-top: 1px solid ${C.border}; margin: 16px 0; }
        .legio-render p { margin: 6px 0; line-height: 1.7; }
        .legio-render code { font-family: 'Share Tech Mono', monospace; background: #2a1010; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
      `}</style>
    </div>
  );
}
