import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Layout from './layouts/Layout';
import AnalyticsPage from './pages/AnalyticsPage';
import Settings from './pages/Settings';

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
            <Route path="/history" element={<PrivateRoute><Layout><AnalyticsPage view="history" /></Layout></PrivateRoute>} />
            <Route path="/discovery" element={<PrivateRoute><Layout><AnalyticsPage view="discovery" /></Layout></PrivateRoute>} />
            <Route path="/lifetime" element={<PrivateRoute><Layout><AnalyticsPage view="lifetime" /></Layout></PrivateRoute>} />
            <Route path="/artists" element={<PrivateRoute><Layout><AnalyticsPage view="artists" /></Layout></PrivateRoute>} />
            <Route path="/artists/:artistKey" element={<ArtistDetail />} />
            <Route path="/tracks" element={<PrivateRoute><Layout><AnalyticsPage view="tracks" /></Layout></PrivateRoute>} />
            <Route path="/tracks/:trackKey" element={<TrackDetail />} />
            <Route path="/albums" element={<PrivateRoute><Layout><AnalyticsPage view="albums" /></Layout></PrivateRoute>} />
            <Route path="/genres" element={<PrivateRoute><Layout><AnalyticsPage view="genres" /></Layout></PrivateRoute>} />
            <Route path="/patterns" element={<PrivateRoute><Layout><AnalyticsPage view="patterns" /></Layout></PrivateRoute>} />
            <Route path="/records" element={<PrivateRoute><Layout><AnalyticsPage view="records" /></Layout></PrivateRoute>} />
            <Route path="/daily" element={<PrivateRoute><Layout><AnalyticsPage view="daily" /></Layout></PrivateRoute>} />
            <Route path="/time" element={<PrivateRoute><Layout><AnalyticsPage view="time" /></Layout></PrivateRoute>} />
            <Route path="/library" element={<PrivateRoute><Layout><AnalyticsPage view="library" /></Layout></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
            <Route path="/friends" element={<PrivateRoute><Layout><Friends /></Layout></PrivateRoute>} />
            <Route path="/wrapped" element={<PrivateRoute><Layout><AnalyticsPage view="wrapped" /></Layout></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

function ArtistDetail() {
  const { artistKey } = useParams();
  return <PrivateRoute><Layout><AnalyticsPage view="artist-detail" entityKey={artistKey} /></Layout></PrivateRoute>;
}

function TrackDetail() {
  const { trackKey } = useParams();
  return <PrivateRoute><Layout><AnalyticsPage view="track-detail" entityKey={trackKey} /></Layout></PrivateRoute>;
}

export default App;
