import { useState } from 'react'; 
import { useNavigate } from 'react-router-dom';
import axios from '../axios'; 

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:8000/api/login/', { username, password });
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      localStorage.setItem('user_id', response.data.user_id);
      console.log('Login successful:', response.data);

      navigate('/workspaces');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      console.error('Login Error:', err.response?.data);
    }
  };

  return (
    <div className="container py-8">
      <div className="card max-w-md mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Login</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">Login</button>
        </form>
      </div>
    </div>
  );
}

export default Login;