
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import WorkspaceList from './components/WorkspaceList';
import WorkspaceDetail from './components/WorkspaceDetail';
import DocumentEditor from './components/DocumentEditor';
import JoinWorkspace from './components/JoinWorkspace';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/workspaces" element={<WorkspaceList />} />
        <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
        <Route path="/workspaces/:id/join" element={<JoinWorkspace />} />
        <Route path="/documents/:id" element={<DocumentEditor />} />
      </Routes>
    </Router>
  );
}

export default App;