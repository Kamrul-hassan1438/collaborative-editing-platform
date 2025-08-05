
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
    if (roleFromLink === 'viewer' || roleFromLink === 'member') {
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
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Join Workspace</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleJoin}>
        <div className="mb-4">
          <label className="block text-gray-700">Role</label>
          <input
            type="text"
            value={role === 'member' ? 'Editor' : 'Viewer'}
            readOnly
            className="w-full p-2 border rounded bg-gray-100"
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
          Join Workspace
        </button>
      </form>
    </div>
  );
}

export default JoinWorkspace;