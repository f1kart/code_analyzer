import React, { useState } from 'react';
import axios from 'axios';

const AuthComponent = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3000/register', { email, password });
      setToken(response.data.token);
      localStorage.setItem('token', response.data.token);
      setMessage('Registration successful!');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Registration failed');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3000/login', { email, password });
      setToken(response.data.token);
      localStorage.setItem('token', response.data.token);
      setMessage('Login successful!');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Login failed');
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setMessage('Logged out');
  };

  const fetchProfile = async () => {
    try {
      const response = await axios.get('http://localhost:3000/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(JSON.stringify(response.data, null, 2));
    } catch (error) {
      setMessage('Failed to fetch profile');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>JWT Authentication System</h2>
      {!token ? (
        <div>
          <form onSubmit={handleRegister}>
            <h3>Register</h3>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Register</button>
          </form>

          <form onSubmit={handleLogin} style={{ marginTop: '20px' }}>
            <h3>Login</h3>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Login</button>
          </form>
        </div>
      ) : (
        <div>
          <p>Logged in with token: {token.slice(0, 20)}...</p>
          <button onClick={fetchProfile}>Get Profile</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
      {message && <p>{message}</p>}
    </div>
  );
};

export default AuthComponent;
