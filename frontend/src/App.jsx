import { useState, useRef, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "";

// ── Status badge ──────────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    idle: ["#94a3b8", "Ready to upload"],
    uploading: ["#f59e0b", "Uploading…"],
    converting: ["#3b82f6", "Converting PDF…"],
    ready: ["#10b981", "Ready to edit"],
    saving: ["#8b5cf6", "Saving…"],
    saved: ["#10b981", "Saved ✓"],
    error: ["#ef4444", "Error"],
  };
  const [color, label] = map[status] || map.idle;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: color + "22", color, border: `1px solid ${color}55`,
      borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 600,
    }}>
      {["uploading", "converting", "saving"].includes(status) && (
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, animation: "pulse 1s infinite" }} />
      )}
      {label}
    </span>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({ onUpload, disabled }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handle = (file) => {
    if (!file || file.type !== "application/pdf") return alert("Please upload a PDF file.");
    onUpload(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${drag ? "#3b82f6" : "#cbd5e1"}`,
        borderRadius: 16, padding: "52px 40px", textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer", transition: "all .2s",
        background: drag ? "#eff6ff" : "#f8fafc",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ fontSize: 52, marginBottom: 12 }}>📄</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: "#1e293b", marginBottom: 6 }}>
        Drop your PDF here
      </div>
      <div style={{ color: "#64748b", fontSize: 14 }}>or click to browse · Max 50 MB</div>
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: "none" }}
        onChange={e => handle(e.target.files[0])} />
    </div>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function TBtn({ icon, label, onClick, disabled, primary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "8px 18px",
      borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 600, fontSize: 14, transition: "all .15s",
      background: primary ? "#3b82f6" : "#f1f5f9",
      color: primary ? "white" : "#374151",
      opacity: disabled ? 0.45 : 1,
      boxShadow: primary ? "0 2px 8px #3b82f640" : "none",
    }}>
      <span>{icon}</span> {label}
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [status, setStatus] = useState("idle");
  const [docId, setDocId] = useState(null);
  const [editorUrl, setEditorUrl] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    setStatus("uploading");
    setError(null);
    setFileName(file.name);
    setEditorUrl(null);
    setDocId(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/api/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setDocId(data.id);
      setStatus("converting");
      startPolling(data.id);
    } catch (e) {
      setStatus("error");
      setError(e.message);
    }
  };

  // ── Poll conversion ─────────────────────────────────────────────────────────
  const startPolling = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/status/${id}`);
        const state = await res.json();
        if (state.error) {
          clearInterval(pollRef.current);
          setStatus("error");
          setError(state.error);
        } else if (state.ready) {
          clearInterval(pollRef.current);
          await loadEditor(id);
        }
      } catch (e) {
        clearInterval(pollRef.current);
        setStatus("error");
        setError(e.message);
      }
    }, 2000);
  };

  // ── Load editor URL ─────────────────────────────────────────────────────────
  const loadEditor = async (id) => {
    try {
      const res = await fetch(`${API}/api/doc/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditorUrl(data.editorUrl);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e.message);
    }
  };

  // ── Download ────────────────────────────────────────────────────────────────
  const download = async (type) => {
    const url = type === "pdf" ? `${API}/api/download/${docId}` : `${API}/api/download-docx/${docId}`;
    const ext = type === "pdf" ? "pdf" : "docx";
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json();
        return alert(d.error || "Download failed. Make sure you saved the document in the editor first.");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `document.${ext}`;
      a.click();
    } catch (e) {
      alert(e.message);
    }
  };

  const reset = () => {
    clearInterval(pollRef.current);
    setStatus("idle"); setDocId(null); setEditorUrl(null);
    setError(null); setFileName(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        background: "white", borderBottom: "1px solid #e2e8f0",
        padding: "0 28px", height: 58, display: "flex", alignItems: "center",
        justifyContent: "space-between", boxShadow: "0 1px 4px #0000000d",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>📝</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#1e293b" }}>PDF Editor</span>
        </div>

        {docId && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Badge status={status} />
            <TBtn icon="⬇️" label="Download PDF" onClick={() => download("pdf")}
              disabled={!docId} primary />
            <TBtn icon="📄" label="Download DOCX" onClick={() => download("docx")}
              disabled={!docId} />
            <TBtn icon="🔄" label="New File" onClick={reset} />
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <main style={{ maxWidth: editorUrl ? "100%" : 680, margin: "0 auto", padding: editorUrl ? 0 : "48px 20px" }}>

        {/* Upload screen */}
        {!editorUrl && (
          <div>
            {!docId && (
              <>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1e293b", margin: "0 0 8px" }}>
                    Edit your PDF like a Word document
                  </h1>
                  <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>
                    Upload a PDF → Edit text, images & formatting → Download as PDF or DOCX
                  </p>
                </div>
                <UploadZone onUpload={handleUpload} disabled={status !== "idle"} />
              </>
            )}

            {/* Converting state */}
            {status === "converting" && (
              <div style={{ marginTop: 28, background: "white", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 2px 12px #0000000f" }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>⚙️</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#1e293b", marginBottom: 8 }}>
                  Converting your PDF…
                </div>
                <div style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
                  This usually takes 10–30 seconds. Please wait.
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 8, height: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#3b82f6", width: "60%", borderRadius: 8, animation: "pulse 1.5s infinite" }} />
                </div>
                <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 13 }}>📄 {fileName}</div>
              </div>
            )}

            {/* Error state */}
            {status === "error" && (
              <div style={{ marginTop: 28, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 16, padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>❌</div>
                <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Something went wrong</div>
                <div style={{ color: "#7f1d1d", fontSize: 14, marginBottom: 18, wordBreak: "break-word" }}>{error}</div>
                <button onClick={reset} style={{
                  background: "#dc2626", color: "white", border: "none", borderRadius: 8,
                  padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14
                }}>Try again</button>
              </div>
            )}
          </div>
        )}

        {/* ── Editor ── */}
        {editorUrl && (
          <div style={{ height: "calc(100vh - 58px)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#1e293b", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                📄 <span style={{ color: "white", fontWeight: 600 }}>{fileName}</span>
                <span style={{ marginLeft: 12, color: "#64748b" }}>— Edit below, then click Save in the toolbar, then Download</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => download("pdf")} style={{
                  background: "#3b82f6", color: "white", border: "none", borderRadius: 7,
                  padding: "6px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13
                }}>⬇️ PDF</button>
                <button onClick={() => download("docx")} style={{
                  background: "#475569", color: "white", border: "none", borderRadius: 7,
                  padding: "6px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13
                }}>⬇️ DOCX</button>
              </div>
            </div>
            <iframe
              src={editorUrl}
              style={{ flex: 1, border: "none", width: "100%" }}
              allow="fullscreen"
              title="Document Editor"
            />
          </div>
        )}
      </main>
    </div>
  );
}
