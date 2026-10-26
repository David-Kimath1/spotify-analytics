import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Clock3, Disc3, Headphones, Music2, RefreshCw, Radio, Users2, ArrowUpRight, ChevronDown, CalendarDays, CircleHelp } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';
import { useAuth } from '../context/AuthContext';
import Artwork from '../components/Artwork';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const PERIODS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'],
  ['3m', 'Last 3 months'], ['6m', 'Last 6 months'], ['12m', 'Last 12 months'], ['all', 'All available time'], ['custom', 'Custom range']
];
const number = value => Number(value || 0).toLocaleString();

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [overview, history] = await Promise.all([
        api.get('/analytics/overview', { params: { period, ...(period === 'custom' ? { from: customFrom || undefined, to: customTo || undefined } : {}) } }),
        api.get('/analytics/recently-played', { params: { limit: 6 } })
      ]);
      setData(overview.data);
      setRecent(history.data || []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'We could not load your listening data.'));
    } finally { setLoading(false); }
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let live = true;
    const getPlaying = async () => {
      try { const response = await api.get('/analytics/currently-playing'); if (live) setPlaying(response.data?.is_playing && response.data?.item ? response.data.item : null); }
      catch { if (live) setPlaying(null); }
    };
    getPlaying();
    const timer = window.setInterval(getPlaying, 45000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await api.post('/spotify/sync');
      toast.success(`${number(result.data.synced || 0)} new plays added`);
      await load(true);
    } catch (e) { toast.error(getApiErrorMessage(e, 'Spotify sync failed. Reconnect in Settings and try again.')); }
    finally { setRefreshing(false); }
  };

  const chart = useMemo(() => ({
    labels: (data?.timeline || []).map(item => new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [{
      data: (data?.timeline || []).map(item => item.minutes),
      borderColor: '#69d99b', backgroundColor: 'rgba(105, 217, 155, .08)',
      fill: true, tension: .36, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2
    }]
  }), [data]);

  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: '#202723', titleColor: '#aab5ae', bodyColor: '#f2f4f2', padding: 12, callbacks: { label: item => `${item.parsed.y.toLocaleString()} min` } } },
    scales: { x: { grid: { display: false }, ticks: { color: '#737e77', maxTicksLimit: 7, maxRotation: 0 }, border: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.055)' }, ticks: { color: '#737e77', maxTicksLimit: 5 }, border: { display: false } } }
  }), []);

  const totals = data?.totals || {};
  const getStatLabel = () => period === 'custom' ? 'Custom range' : PERIODS.find(([id]) => id === period)?.[1] || 'Selected period';

  return <div className="page-stack">
    <div className="page-heading heading-with-actions">
      <div><p className="eyebrow">OVERVIEW <span className="eyebrow-separator">/</span> {getStatLabel().toUpperCase()}</p><h1>Your listening, measured.</h1><p className="page-subtitle">A clear view of what you’ve been playing.</p></div>
      <div className="heading-actions">
        <label className="select-wrap"><CalendarDays size={15} /><select value={period} onChange={e => setPeriod(e.target.value)} aria-label="Analytics time period">{PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={14} /></label>
        {period === 'custom' && <div className="custom-date-range"><label><span>From</span><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label><label><span>To</span><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label></div>}
        <button className="button button-secondary" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /><span>{refreshing ? 'Syncing' : 'Sync data'}</span></button>
      </div>
    </div>

    {error && <div className="alert alert-error"><CircleHelp size={17} /><div><strong>Analytics unavailable</strong><span>{error}</span></div><button onClick={() => load()}>Try again</button><Link to="/settings">Open settings</Link></div>}

    {loading ? <DashboardSkeleton /> : <>
      {playing && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="playing-banner">
        <Artwork src={playing.album?.images?.[0]?.url} className="playing-art" />
        <div className="playing-copy"><span className="eyebrow">ON SPOTIFY NOW</span><strong>{playing.name}</strong><span>{(playing.artists || []).map(item => item.name).join(', ')}</span></div>
        <span className="playing-live"><span /> LIVE</span>
      </motion.div>}

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }} className="listening-hero panel">
        <div className="hero-topline"><span className="section-kicker"><Clock3 size={15} /> LISTENING TIME</span><span className="hero-period">{getStatLabel()}</span></div>
        <div className="hero-time-row"><div className="hero-time">{number(totals.totalMinutes)}<span>min</span></div><span className="hero-estimate"><CircleHelp size={13} /> {number(totals.exactMinutes)} exact · {number(totals.estimatedMinutes)} estimated</span></div>
        <div className="hero-conversions"><span>{number(totals.totalHours)} <small>hours</small></span><i /> <span>{Number(totals.totalDays || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} <small>days</small></span></div>
        <div className="hero-foot"><span>Listening duration across {number(totals.tracksPlayed)} captured plays</span><Link to="/history">View history <ArrowUpRight size={14} /></Link></div>
      </motion.section>

      <section className="metric-grid">
        <MetricCard icon={Headphones} label="Tracks played" value={totals.tracksPlayed} helper="Captured plays" />
        <MetricCard icon={Music2} label="Unique tracks" value={totals.uniqueTracks} helper="Distinct recordings" />
        <MetricCard icon={Users2} label="Artists" value={totals.uniqueArtists} helper="Distinct artists" />
        <MetricCard icon={Disc3} label="Albums" value={totals.uniqueAlbums} helper="Distinct albums" />
      </section>

      <section className="dashboard-grid">
        <div className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Listening over time</h2></div><span className="chart-unit">MINUTES / DAY</span></div>
          {data?.timeline?.length ? <div className="overview-chart"><Line data={chart} options={chartOptions} /></div> : <EmptyState title="No plays in this period" text="Spotify only shares recent plays through its API. Sync now or import your Extended Streaming History for older data." action={<Link to="/settings">Import listening history <ArrowUpRight size={14} /></Link>} />}
        </div>
        <div className="panel ranking-panel">
          <div className="panel-heading"><div><p className="eyebrow">ON REPEAT</p><h2>Top artists</h2></div><Link className="text-link" to="/artists">See all <ArrowUpRight size={14} /></Link></div>
          {data?.topArtists?.length ? <div className="ranking-list">{data.topArtists.slice(0, 5).map((artist, i) => <Link to={`/artists/${encodeURIComponent(artist.artistId || artist.name)}`} className="ranking-row ranking-row-link" key={artist.id || artist.name}>
            <span className="rank-number">{String(i + 1).padStart(2, '0')}</span>
            <Artwork src={artist.image} className="ranking-image" artist />
            <div className="ranking-copy"><strong>{artist.name}</strong><span>{number(artist.plays)} plays</span></div><span className="ranking-minutes">{number(Math.round(artist.minutes))}<small> min</small></span>
          </Link>)}</div> : <EmptyState title="Your artists will show up here" text="There are no captured plays yet. Sync Spotify or import an archive to populate these rankings." action={<button type="button" onClick={refresh} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Sync Spotify</button>} />}
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading"><div><p className="eyebrow">LATEST PLAYS</p><h2>Recently played</h2></div><Link className="text-link" to="/history">Full history <ArrowUpRight size={14} /></Link></div>
        {recent.length ? <div className="recent-list">{recent.map((item, i) => <div className="recent-row" key={item._id || `${item.trackId}-${item.playedAt}-${i}`}>
          <Artwork src={item.albumImage} className="recent-art" />
          <div className="recent-track"><strong>{item.trackName || 'Unavailable track'}</strong><span>{item.artistName || 'Unknown artist'}{item.albumName ? ` · ${item.albumName}` : ''}</span></div>
          <span className="source-pill">{(item.sources || [item.source]).includes('extended-history') ? 'ARCHIVE' : 'SPOTIFY API'}</span>
          <time>{item.playedAt ? new Date(item.playedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</time>
        </div>)}</div> : <EmptyState title="No recent plays yet" text="The API does not return your full past. Sync recent Spotify plays or import Extended Streaming History for a longer timeline." action={<Link to="/settings">Import listening history <ArrowUpRight size={14} /></Link>} />}
      </section>

      <div className="coverage-note"><CircleHelp size={15} /><p><strong>About this data.</strong> {data?.coverage?.note} This range includes {number(data?.coverage?.totalRecords)} stored plays; Spotify’s recent-play feed is not a complete historical archive, and its play durations are estimates. Import Extended Streaming History in Settings to compare a complete seven-day total using exact recorded milliseconds.</p><Link to="/settings">Manage data</Link></div>
    </>}
  </div>;
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return <motion.div className="metric-card panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
    <div className="metric-top"><span className="metric-icon"><Icon size={16} /></span><span className="metric-helper">{helper}</span></div>
    <strong>{number(value)}</strong><span>{label}</span>
  </motion.div>;
}

function EmptyState({ title, text, action }) { return <div className="empty-state"><span className="empty-icon"><BarChart3 size={19} /></span><strong>{title}</strong><p>{text}</p>{action && <div className="empty-action">{action}</div>}</div>; }

function DashboardSkeleton() {
  return <div className="skeleton-layout" aria-label="Loading dashboard"><div className="skeleton skeleton-hero" /><div className="metric-grid">{[1, 2, 3, 4].map(i => <div className="skeleton skeleton-metric" key={i} />)}</div><div className="dashboard-grid"><div className="skeleton skeleton-chart" /><div className="skeleton skeleton-chart" /></div><div className="skeleton skeleton-recent" /></div>;
}
