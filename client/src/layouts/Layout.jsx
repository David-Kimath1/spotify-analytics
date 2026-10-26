import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity, Album, BarChart3, CalendarDays, Clock, Disc3,
  Headphones, History, LayoutDashboard, Library, LogOut, Menu, Mic2,
  MoreHorizontal, Music2, Settings, Sparkles, Users, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const sections = [
  { title: 'ANALYTICS', items: [
    { path: '/', icon: LayoutDashboard, label: 'Overview', exact: true },
    { path: '/history', icon: History, label: 'Listening history' },
    { path: '/discovery', icon: Sparkles, label: 'Discoveries' },
    { path: '/lifetime', icon: Clock, label: 'Lifetime analytics' },
    { path: '/artists', icon: Mic2, label: 'Top artists' },
    { path: '/tracks', icon: Music2, label: 'Top tracks' },
    { path: '/albums', icon: Album, label: 'Top albums' },
    { path: '/genres', icon: Disc3, label: 'Genres' },
    { path: '/patterns', icon: Activity, label: 'Listening patterns' },
    { path: '/time', icon: CalendarDays, label: 'Time analysis' },
    { path: '/records', icon: BarChart3, label: 'Personal records' },
    { path: '/wrapped', icon: Sparkles, label: 'Your recap' }
  ] },
  { title: 'YOUR SPACE', items: [
    { path: '/library', icon: Library, label: 'Library' },
    { path: '/settings', icon: Settings, label: 'Settings' },
    { path: '/friends', icon: Users, label: 'Friends' }
  ] }
];

const mobileItems = [sections[0].items[0], sections[0].items[1], sections[0].items[3], sections[0].items[4]];

function Navigation({ onNavigate, compact = false }) {
  const location = useLocation();
  return <nav className={compact ? 'mobile-drawer-nav' : 'sidebar-nav'}>
    {sections.map(section => <div className="nav-section" key={section.title}>
      <p className="nav-caption">{section.title}</p>
      {section.items.map(({ path, icon: Icon, label, exact }) => <NavLink
        key={path}
        to={path}
        end={exact}
        onClick={onNavigate}
        className={({ isActive }) => `nav-link${isActive || (path === '/time' && location.pathname.startsWith('/time')) ? ' active' : ''}`}
      ><Icon size={17} strokeWidth={1.8} /><span>{label}</span></NavLink>)}
    </div>)}
  </nav>;
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setDrawerOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [drawerOpen]);

  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink to="/" className="brand-lockup sidebar-brand"><span className="brand-mark"><Headphones size={17} /></span><span>SONORA</span></NavLink>
      <Navigation />
      <div className="sidebar-profile">
        <div className="connection-label"><span className="status-dot" /> SPOTIFY CONNECTED</div>
        <div className="profile-row">
          {user?.profileImage ? <img className="profile-avatar" src={user.profileImage} alt="" /> : <span className="profile-avatar profile-avatar-fallback"><Music2 size={17} /></span>}
          <div className="profile-copy"><span className="profile-name">{user?.displayName || 'Spotify listener'}</span><span className="profile-subtitle">Personal account</span></div>
          <button className="icon-button logout-button" onClick={handleLogout} aria-label="Log out" title="Log out"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>

    {drawerOpen && <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}
    <aside id="mobile-navigation" className={`mobile-drawer${drawerOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Main navigation" aria-hidden={!drawerOpen}>
      <div className="drawer-head"><NavLink to="/" onClick={() => setDrawerOpen(false)} className="brand-lockup"><span className="brand-mark"><Headphones size={17} /></span><span>SONORA</span></NavLink><button className="icon-button" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <Navigation compact onNavigate={() => setDrawerOpen(false)} />
      <button className="drawer-logout" onClick={handleLogout}><LogOut size={16} />Log out</button>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <button className="icon-button mobile-menu-trigger" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" aria-controls="mobile-navigation" aria-expanded={drawerOpen}><Menu size={21} /></button>
        <div className="topbar-context"><span className="topbar-dot" />Your listening, in focus</div>
        <div className="topbar-actions"><span className="topbar-period">PERSONAL ANALYTICS</span></div>
      </header>
      <main className="page-content" key={location.pathname}>{children}</main>
    </div>

    <nav className="bottom-nav" aria-label="Mobile navigation">
      {mobileItems.map(({ path, icon: Icon, label, exact }) => <NavLink key={path} to={path} end={exact} className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}><Icon size={18} /><span>{label === 'Listening history' ? 'History' : label.replace('Top ', '')}</span></NavLink>)}
      <button className={`bottom-link${drawerOpen ? ' active' : ''}`} onClick={() => setDrawerOpen(true)}><MoreHorizontal size={19} /><span>More</span></button>
    </nav>
  </div>;
}
