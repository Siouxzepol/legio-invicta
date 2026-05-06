import { useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";

const C = {
  bg:     "#111214",
  border: "rgba(100, 18, 18, 0.25)",
  accent: "#C9A24A",
  muted:  "#7a7a82",
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

const SIZE_PRESETS = ["25%", "50%", "75%", "100%"];

/* Image extension con atributo width */
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        renderHTML: attrs => ({ style: `width: ${attrs.width || "100%"}; height: auto; display: block;` }),
        parseHTML: el => el.style.width || "100%",
      },
    };
  },
});

export default function LegioEditor({ content, onChange, minHeight = 320, stickyTop = 0 }) {
  const [imgOpen, setImgOpen] = useState(false);
  const [imgUrl,  setImgUrl]  = useState("");
  const [imgSize, setImgSize] = useState("100%");
  const imgInputRef = useRef(null);

  const insertImage = () => {
    const url = imgUrl.trim();
    if (url) editor.chain().focus().setImage({ src: url, width: imgSize }).run();
    setImgUrl(""); setImgOpen(false); setImgSize("100%");
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ResizableImage.configure({ allowBase64: false }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const imgSelected = editor.isActive("image");
  const currentWidth = editor.getAttributes("image").width || "100%";

  return (
    <div style={{ border: "1px solid rgba(100, 18, 18, 0.12)", borderRadius: 6, boxShadow: "0 0 18px rgba(90, 12, 12, 0.2), 0 4px 14px rgba(0,0,0,0.4)" }}>
      {/* Toolbar sticky */}
      <div style={{
        position: "sticky", top: stickyTop, zIndex: 10,
        background: "#16171a", borderBottom: `1px solid ${C.border}`,
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

        <button style={btnStyle(imgOpen || imgSelected)} onMouseDown={e => {
          e.preventDefault();
          if (imgSelected) return;
          setImgOpen(o => !o);
          setTimeout(() => imgInputRef.current?.focus(), 50);
        }}>IMG</button>

        {/* Presets de tamaño — solo visibles cuando hay imagen seleccionada */}
        {imgSelected && (
          <>
            <span style={{ width: 1, background: C.border, margin: "0 4px" }} />
            {SIZE_PRESETS.map(w => (
              <button key={w} style={btnStyle(currentWidth === w)}
                onMouseDown={e => { e.preventDefault(); editor.chain().focus().updateAttributes("image", { width: w }).run(); }}>
                {w}
              </button>
            ))}
          </>
        )}

        <span style={{ width: 1, background: C.border, margin: "0 4px" }} />

        <button style={btnStyle(false)} onMouseDown={e => { e.preventDefault(); editor.chain().focus().undo().run(); }}>↩</button>
        <button style={btnStyle(false)} onMouseDown={e => { e.preventDefault(); editor.chain().focus().redo().run(); }}>↪</button>
      </div>

      {/* Panel insertar imagen */}
      {imgOpen && (
        <div style={{ background: "#1a1b1e", borderBottom: `1px solid ${C.border}`, padding: "6px 10px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input
            ref={imgInputRef}
            value={imgUrl}
            onChange={e => setImgUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); insertImage(); } if (e.key === "Escape") { setImgOpen(false); setImgUrl(""); } }}
            placeholder="https://ejemplo.com/imagen.jpg"
            style={{ flex: 1, minWidth: 200, background: "#111214", border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, padding: "4px 10px", fontSize: 12, fontFamily: "'Share Tech Mono', monospace", outline: "none" }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {SIZE_PRESETS.map(w => (
              <button key={w} style={btnStyle(imgSize === w)}
                onMouseDown={e => { e.preventDefault(); setImgSize(w); }}>
                {w}
              </button>
            ))}
          </div>
          <button style={{ ...btnStyle(true), padding: "4px 12px" }} onMouseDown={e => { e.preventDefault(); insertImage(); }}>Insertar</button>
          <button style={{ ...btnStyle(false), padding: "4px 8px" }} onMouseDown={e => { e.preventDefault(); setImgOpen(false); setImgUrl(""); setImgSize("100%"); }}>✕</button>
        </div>
      )}

      {/* Editor area */}
      <EditorContent editor={editor} style={{ padding: "12px 16px", background: "#16171a", borderRadius: "0 0 4px 4px" }} />

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
        .ProseMirror code { font-family: 'Share Tech Mono', monospace; background: #1e1f22; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
        .ProseMirror pre { background: #16171a; padding: 12px; border-radius: 4px; overflow-x: auto; }
        .ProseMirror img { height: auto; border-radius: 4px; border: 1px solid rgba(100,18,18,0.25); margin: 8px 0; display: block; }
        .ProseMirror img.ProseMirror-selectednode { outline: 2px solid ${C.accent}; }
        .legio-render h1 { font-family: 'Oswald', sans-serif; font-size: 22px; color: ${C.accent}; letter-spacing: 2px; margin: 16px 0 8px; text-transform: uppercase; }
        .legio-render h2 { font-family: 'Oswald', sans-serif; font-size: 18px; color: ${C.accent}; letter-spacing: 1px; margin: 14px 0 6px; }
        .legio-render h3 { font-family: 'Oswald', sans-serif; font-size: 15px; margin: 12px 0 4px; }
        .legio-render ul, .legio-render ol { padding-left: 24px; margin: 8px 0; }
        .legio-render li { margin: 4px 0; }
        .legio-render blockquote { border-left: 3px solid ${C.accent}; padding-left: 12px; color: ${C.muted}; margin: 8px 0; font-style: italic; }
        .legio-render hr { border: none; border-top: 1px solid ${C.border}; margin: 16px 0; }
        .legio-render p { margin: 6px 0; line-height: 1.7; }
        .legio-render code { font-family: 'Share Tech Mono', monospace; background: #1e1f22; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
        .legio-render img { height: auto; border-radius: 4px; border: 1px solid rgba(100,18,18,0.25); margin: 8px 0; display: block; }
      `}</style>
    </div>
  );
}
