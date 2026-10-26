import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, BarChart3, Clock, LockKeyhole, Music, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const { user, login, handleAuthCallback } = useAuth();
  const navigate = useNavigate();
  const callbackStarted = useRef(false);

  useEffect(() => {
    if (user) {
      navigate('/');
    }

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    if (code && !callbackStarted.current) {
      callbackStarted.current = true;
      handleAuthCallback(code, state).then(success => {
        if (success) navigate('/', { replace: true });
      });
    }
  }, [user, navigate, handleAuthCallback]);

  return (
    <main className="login-screen">
      <motion.section className="login-story" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <div className="brand-lockup"><span className="brand-mark"><Music size={18} /></span><span>SONORA</span></div>
        <div className="login-copy">
          <p className="eyebrow">YOUR LISTENING, IN FOCUS</p>
          <h1>Understand the music<br />that moves you.</h1>
          <p className="login-lede">A considered view of your listening history, habits and discoveries, built from your Spotify data.</p>
          <div className="login-feature-list">
            <Feature icon={<BarChart3 />} text="Personal analytics with clear data provenance" />
            <Feature icon={<Clock />} text="Bring your Extended Streaming History" />
            <Feature icon={<ShieldCheck />} text="Your Spotify connection stays yours" />
          </div>
        </div>
        <p className="login-footnote">Independent listening analytics · Powered by your account</p>
      </motion.section>
      <motion.section className="login-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.45 }}>
        <div className="login-panel-top"><span className="status-dot" /> SECURE CONNECTION</div>
        <div className="login-panel-body">
          <span className="login-icon"><Music size={22} /></span>
          <p className="eyebrow">WELCOME TO SONORA</p>
          <h2>Connect your Spotify account</h2>
          <p>Sign in to see your real listening insights. Your dashboard starts with recent Spotify history and grows as you listen or import your archive.</p>
          <button onClick={login} className="spotify-button"><Music size={18} /><span>Continue with Spotify</span><ArrowRight size={17} /></button>
          <div className="login-security"><LockKeyhole size={14} /><span>Authentication is handled securely by Spotify OAuth.</span></div>
        </div>
      </motion.section>
    </main>
  );
};

const Feature = ({ icon, text }) => (
  <div className="login-feature">
    <span className="login-feature-icon">{icon}</span>
    <span>{text}</span>
  </div>
);

export default Login;
