import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Profile from "./components/Profile";
import WorkspaceList from "./components/WorkspaceList";
import WorkspaceDetail from "./components/WorkspaceDetail";
import DocumentEditor from "./components/DocumentEditor";
import JoinWorkspace from "./components/JoinWorkspace";
import React from "react";

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error text-center p-6 text-red-500">
          <h2>Something went wrong.</h2>
          <p>{this.state.error?.message || "An unexpected error occurred."}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/workspaces" element={<WorkspaceList />} />
        <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
        <Route path="/workspaces/:id/join" element={<JoinWorkspace />} />
        <Route
          path="/documents/:id"
          element={
            <ErrorBoundary>
              <DocumentEditor />
            </ErrorBoundary>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;