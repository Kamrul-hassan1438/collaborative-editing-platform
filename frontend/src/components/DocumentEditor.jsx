import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../axios";
import ReconnectingWebSocket from "reconnecting-websocket";
import VersionHistorySidebar from "./VersionHistorySidebar";
import CommentsSidebar from "./CommentsSidebar";
import Modal from "./Modal";

function DocumentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState("");
  const [comments, setComments] = useState([]);
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState("");
  const [docWs, setDocWs] = useState(null);
  const [commentWs, setCommentWs] = useState(null);
  const [isViewer, setIsViewer] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalClosing, setSaveModalClosing] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState(null);
  const navigatePath = useRef(null);
  const isSaving = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchDocument = async () => {
      try {
        const userId = localStorage.getItem("user_id");
        const token = localStorage.getItem("access_token");
        if (!userId || !token) {
          setError("Please log in to access this document.");
          return;
        }

        const docResponse = await axios.get(
          `http://localhost:8000/api/documents/${id}/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const [commentsResponse, versionsResponse, memberResponse] =
          await Promise.all([
            axios.get(`http://localhost:8000/api/documents/${id}/comments/`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`http://localhost:8000/api/documents/${id}/versions/?page=1`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(
              `http://localhost:8000/api/workspaces/${docResponse.data.workspace.id}/members/`,
              { headers: { Authorization: `Bearer ${token}` } }
            ),
          ]);

        if (isMounted) {
          console.log("Document:", docResponse.data);
          console.log("Comments:", commentsResponse.data);
          console.log("Versions:", versionsResponse.data);
          console.log("Members:", memberResponse.data);
          const validContent =
            typeof docResponse.data.content === "string"
              ? docResponse.data.content
              : docResponse.data.content?.blocks?.[0]?.text || "";
          setDocument({ ...docResponse.data, content: validContent });
          setContent(validContent);
          setUndoStack([validContent]);
          setComments(commentsResponse.data || []);
          setVersions(versionsResponse.data || []);
          const userMember = memberResponse.data.find(
            (m) => m.user.id === parseInt(userId)
          );
          setIsViewer(userMember?.role === "viewer");
          const savedContent = localStorage.getItem(`unsaved_document_${id}`);
          if (savedContent) {
            setContent(savedContent);
            setUndoStack([savedContent]);
            setUnsavedChanges(true);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Fetch Error:", err.response?.data || err.message);
          setError(
            err.response?.data?.error ||
              err.message ||
              "Failed to load document or comments"
          );
        }
      }
    };
    fetchDocument();

    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Please log in to access real-time features");
      return;
    }

    const docWebsocket = new ReconnectingWebSocket(
      `ws://localhost:8000/ws/documents/${id}/?token=${token}`,
      [],
      { maxReconnectionDelay: 10000, minReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1.5 }
    );
    const commentWebsocket = new ReconnectingWebSocket(
      `ws://localhost:8000/ws/comments/${id}/?token=${token}`,
      [],
      { maxReconnectionDelay: 10000, minReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1.5 }
    );

    docWebsocket.onopen = () => {
      console.log("Document WebSocket connected");
    };
    docWebsocket.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      console.log("WebSocket document message:", data);
      if (isMounted && !isSaving.current) {
        if (data.error) {
          setError(data.error);
        } else if (data.content) {
          const newContent =
            typeof data.content === "string"
              ? data.content
              : data.content?.blocks?.[0]?.text || "";
          if (
            data.user_id !== parseInt(localStorage.getItem("user_id")) &&
            newContent !== content
          ) {
            setContent(newContent);
            setDocument((prev) => ({ ...prev, content: newContent }));
            setUndoStack((prev) => [...prev, newContent].slice(-50));
            setRedoStack([]);
            setUnsavedChanges(true);
            localStorage.setItem(`unsaved_document_${id}`, newContent);
          }
          if (data.version_number) {
            try {
              const token = localStorage.getItem("access_token");
              const versionsResponse = await axios.get(
                `http://localhost:8000/api/documents/${id}/versions/?page=1`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              setVersions(versionsResponse.data.results || []);
            } catch (err) {
              console.error("Versions Refresh Error:", err.response?.data || err.message);
              setError("Failed to refresh versions");
            }
          }
        } else {
          console.warn("Invalid WebSocket content:", data);
          setError("Received invalid document content");
        }
      }
    };
    docWebsocket.onclose = (e) => {
      console.log("Document WebSocket closed:", e.code, e.reason, new Date());
      if (e.code === 4001) setError("Authentication required");
      if (e.code === 4003) setError("Permission denied: You are not a workspace member");
      if (e.code === 4004) setError("Document not found");
    };
    docWebsocket.onerror = (e) => {
      console.error("Document WebSocket error:", e);
      setError("WebSocket connection error");
    };

    commentWebsocket.onopen = () => {
      console.log("Comment WebSocket connected");
    };
    commentWebsocket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("WebSocket comment message:", data);
      if (isMounted) {
        if (data.error) {
          setError(data.error);
        } else if (data.comment) {
          setComments((prev) => [...prev, data.comment]);
        } else if (data.delete_comment_id) {
          setComments((prev) =>
            prev.filter((c) => c.id !== data.delete_comment_id)
          );
        }
      }
    };
    commentWebsocket.onclose = (e) => {
      console.log("Comment WebSocket closed:", e.code, e.reason, new Date());
      if (e.code === 4001) setError("Authentication required");
      if (e.code === 4003) setError("Permission denied: You are not a workspace member");
      if (e.code === 4004) setError("Document not found");
    };
    commentWebsocket.onerror = (e) => {
      console.error("Comment WebSocket error:", e);
      setError("WebSocket connection error");
    };

    setDocWs(docWebsocket);
    setCommentWs(commentWebsocket);

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSaveVersion();
      } else if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const handleBeforeUnload = (e) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      isMounted = false;
      setTimeout(() => {
        docWebsocket.close();
        commentWebsocket.close();
      }, 1000);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [id]);

  useEffect(() => {
    if (unsavedChanges && content.trim()) {
      localStorage.setItem(`unsaved_document_${id}`, content);
    }
  }, [content, unsavedChanges, id]);

  const handleNavigation = (path) => {
    if (unsavedChanges) {
      setShowSaveModal(true);
      navigatePath.current = path;
    } else {
      navigate(path);
    }
  };

  const handleModalConfirm = async (shouldSave) => {
    setSaveModalClosing(true);
    setTimeout(async () => {
      setShowSaveModal(false);
      setSaveModalClosing(false);
      if (shouldSave) {
        try {
          await handleSaveVersion();
          if (navigatePath.current) {
            navigate(navigatePath.current);
            navigatePath.current = null;
          }
        } catch (err) {
          console.error("Save Error:", err);
          setError("Failed to save before navigation");
        }
      } else {
        setUnsavedChanges(false);
        setUndoStack([content]);
        setRedoStack([]);
        localStorage.removeItem(`unsaved_document_${id}`);
        if (navigatePath.current) {
          navigate(navigatePath.current);
          navigatePath.current = null;
        }
      }
    }, 300);
  };

  const handleContentChange = (e) => {
    if (isViewer) {
      setError("Viewers cannot edit documents");
      return;
    }
    const newContent = e.target.value || "";
    console.log("Content Change:", { oldContent: content, newContent });
    setUndoStack((prev) => [...prev, content].slice(-50));
    setRedoStack([]);
    setContent(newContent);
    setUnsavedChanges(true);
    if (docWs && docWs.readyState === WebSocket.OPEN) {
      docWs.send(
        JSON.stringify({
          content: { blocks: [{ text: newContent }] },
          user_id: parseInt(localStorage.getItem("user_id")),
        })
      );
    }
  };

  const handleSaveVersion = async () => {
    if (isViewer) {
      setError("Viewers cannot save versions");
      return;
    }
    if (!content.trim()) {
      setError("Cannot save an empty document");
      return;
    }
    if (isSaving.current) {
      console.log("Save in progress, ignoring request");
      return;
    }
    isSaving.current = true;
    console.log("Saving version with content:", content);
    try {
      const response = await axios.post(
        `http://localhost:8000/api/documents/${id}/save_version/`,
        { content: { blocks: [{ text: content }] } },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      console.log("Save Version Response:", response.data);
      const versionsResponse = await axios.get(
        `http://localhost:8000/api/documents/${id}/versions/?page=1`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      console.log("Versions Response:", versionsResponse.data);
      setVersions(versionsResponse.data.results || []);
      setUnsavedChanges(false);
      setUndoStack([content]);
      setRedoStack([]);
      localStorage.removeItem(`unsaved_document_${id}`);
      setError("");
      alert("Version saved successfully!");
    } catch (err) {
      console.error("Save Version Error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to save version");
    } finally {
      isSaving.current = false;
    }
  };

  const handleUndo = () => {
    if (undoStack.length > 1) {
      const currentContent = undoStack[undoStack.length - 1];
      setRedoStack((prev) => [currentContent, ...prev].slice(0, 50));
      setUndoStack((prev) => prev.slice(0, -1));
      setContent(undoStack[undoStack.length - 2]);
      setUnsavedChanges(true);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[0];
      setUndoStack((prev) => [...prev, content].slice(-50));
      setRedoStack((prev) => prev.slice(1));
      setContent(nextContent);
      setUnsavedChanges(true);
    }
  };

  const toggleSidebar = (sidebar) => {
    setActiveSidebar(activeSidebar === sidebar ? null : sidebar);
  };

  if (!document && error)
    return <div className="error text-center">{error}</div>;

  if (!document)
    return <div className="text-center p-6 text-gray-500 dark:text-gray-400">Loading...</div>;

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Main Editor */}
      <div className="flex-1 p-8">
        <div className="container">
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{document.title}</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleSidebar("versions")}
                  className="btn-primary"
                >
                  {activeSidebar === "versions" ? "Hide Versions" : "Show Versions"}
                </button>
                <button
                  onClick={() => toggleSidebar("comments")}
                  className="btn-primary"
                >
                  {activeSidebar === "comments" ? "Hide Comments" : "Show Comments"}
                </button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="mb-4 flex items-center space-x-2">
              <button
                onClick={() => handleNavigation("/dashboard")}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                onClick={handleUndo}
                disabled={undoStack.length <= 1}
                className={undoStack.length <= 1 ? "btn-disabled" : "btn-secondary"}
              >
                Undo (Ctrl+Z)
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={redoStack.length === 0 ? "btn-disabled" : "btn-secondary"}
              >
                Redo (Ctrl+Shift+Z)
              </button>
              {!isViewer && (
                <button
                  onClick={handleSaveVersion}
                  className="btn-primary"
                >
                  Save Version (Ctrl+S)
                </button>
              )}
            </div>
            <textarea
              value={content}
              onChange={handleContentChange}
              className="textarea h-96 text-lg"
              placeholder="Document content..."
              readOnly={isViewer}
            />
          </div>
        </div>
      </div>

      {/* Sidebars */}
      <VersionHistorySidebar
        isOpen={activeSidebar === "versions"}
        versions={versions}
        isViewer={isViewer}
        documentId={id}
        currentContent={content}
        setError={setError}
        setContent={setContent}
        setDocument={setDocument}
        setUnsavedChanges={setUnsavedChanges}
        setUndoStack={setUndoStack}
        setRedoStack={setRedoStack}
        setVersions={setVersions}
        onClose={() => setActiveSidebar(null)}
      />
      <CommentsSidebar
        isOpen={activeSidebar === "comments"}
        comments={comments}
        isViewer={isViewer}
        documentId={id}
        commentWs={commentWs}
        setComments={setComments}
        setError={setError}
        onClose={() => setActiveSidebar(null)}
      />

      {/* Save Modal */}
      {showSaveModal && (
        <Modal
          isOpen={showSaveModal}
          onClose={() => handleModalConfirm(false)}
          title="Unsaved Changes"
          closing={saveModalClosing}
        >
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            You have unsaved changes. Would you like to save a version before leaving?
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => handleModalConfirm(false)}
              className="btn-secondary"
            >
              Don't Save
            </button>
            <button
              onClick={() => handleModalConfirm(true)}
              className="btn-primary"
            >
              Save and Leave
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default DocumentEditor;