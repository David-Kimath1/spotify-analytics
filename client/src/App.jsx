import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Wrapped from './pages/Wrapped';
import Layout from './layouts/Layout';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
            <Route path="/friends" element={<PrivateRoute><Layout><Friends /></Layout></PrivateRoute>} />
            <Route path="/wrapped" element={<PrivateRoute><Layout><Wrapped /></Layout></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;