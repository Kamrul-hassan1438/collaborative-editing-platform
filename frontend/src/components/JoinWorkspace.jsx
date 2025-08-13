import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

function JoinWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleFromLink = params.get('role');
    if (roleFromLink === 'viewer' || roleFromLink === 'editor') {
      setRole(roleFromLink);
    }
  }, [location.search]);

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `http://localhost:8000/api/workspaces/${id}/join/`,
        { role },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      navigate(`/workspaces/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join workspace');
    }
  };

  return (
    <div className="container py-8">
      <div className="card max-w-md mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Join Workspace</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleJoin}>
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">Role</label>
            <input
              type="text"
              value={role === 'editor' ? 'Editor' : 'Viewer'}
              readOnly
              className="input bg-gray-100"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Join Workspace
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinWorkspace;