import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Disc3, Headphones,
  History, Mic2, Music2, Radio, Share2, FileDown, Sparkles, Users2
} from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend } from 'chart.js';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/apiError';
import Artwork from '../components/Artwork';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

const RANGES = [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['3m', '3 months'], ['6m', '6 months'], ['12m', '12 months'], ['lifetime', 'Lifetime']];
const TITLES = {
  history: ['Listening history', 'Your plays, in order.', History],
  discovery: ['Music discovery', 'The artists and tracks first seen in your history.', Sparkles],
  lifetime: ['Lifetime analytics', 'Everything available in your listening archive.', Clock3],
  'artist-detail': ['Artist details', 'A closer look at this artist in your listening.', Mic2],
  'track-detail': ['Track details', 'A closer look at this track in your listening.', Music2],
  artists: ['Top artists', 'The artists you return to.', Mic2],
  tracks: ['Top tracks', 'Your most played tracks.', Music2],
  albums: ['Top albums', 'Albums in your rotation.', Disc3],
  genres: ['Genre analytics', 'A map of your sound.', BarChart3],
  patterns: ['Listening patterns', 'When your listening happens.', Activity],
  records: ['Personal records', 'Your standout listening moments.', BarChart3],
  daily: ['Daily listening', 'A closer look at your day.', Clock3],
  time: ['Time analysis', 'Your listening across the calendar.', CalendarDays],
  wrapped: ['Your listening recap', 'A year of music, in your numbers.', Sparkles],
  library: ['Your library', 'Your saved music from Spotify.', Headphones]
};
const number = value => Number(value || 0).toLocaleString();
const humanDate = value => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const formatMinutes = value => `${number(Math.round(value || 0))} min`;

export default function AnalyticsPage({ view, entityKey }) {
  const [period, setPeriod] = useState(view === 'history' || view === 'patterns' || view === 'wrapped' || view === 'discovery' || view === 'records' || view === 'lifetime' ? 'lifetime' : '30d');
  const [timeMode, setTimeMode] = useState('weekly');
  const [dateChoice, setDateChoice] = useState(new Date().toISOString().slice(0, 10));
  const [monthChoice, setMonthChoice] = useState(new Date().toISOString().slice(0, 7));
  const [yearChoice, setYearChoice] = useState(String(new Date().getUTCFullYear()));
  const [sort, setSort] = useState('plays');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [libraryOffset, setLibraryOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let response;
      if (view === 'history') response = await api.get('/analytics/listening-history', { params: { period, page, limit: 25 } });
      else if (view === 'artists') response = await api.get('/analytics/artists', { params: { period, limit: 50 } });
      else if (view === 'tracks') response = await api.get('/analytics/tracks', { params: { period, limit: 50, sort } });
      else if (view === 'albums') response = await api.get('/analytics/albums', { params: { period, limit: 50 } });
      else if (view === 'genres') response = await api.get('/analytics/genres', { params: { period } });
      else if (view === 'patterns') response = await api.get('/analytics/patterns', { params: { period } });
      else if (view === 'records') response = await api.get('/analytics/records', { params: { period } });
      else if (view === 'discovery') response = await api.get('/analytics/discovery', { params: { period } });
      else if (view === 'lifetime') {
        const [overview, records, patterns, genres] = await Promise.all([
          api.get('/analytics/lifetime'), api.get('/analytics/records', { params: { period: 'lifetime' } }),
          api.get('/analytics/patterns', { params: { period: 'lifetime' } }), api.get('/analytics/genres', { params: { period: 'lifetime' } })
        ]);
        response = { data: { overview: overview.data, records: records.data, patterns: patterns.data, genres: genres.data } };
      }
      else if (view === 'artist-detail') response = await api.get(`/analytics/artists/${encodeURIComponent(entityKey)}`);
      else if (view === 'track-detail') response = await api.get(`/analytics/tracks/${encodeURIComponent(entityKey)}`);
      else if (view === 'daily') response = await api.get('/analytics/daily', { params: { date: dateChoice } });
      else if (view === 'time' && timeMode === 'daily') response = await api.get('/analytics/daily', { params: { date: dateChoice } });
      else if (view === 'time') response = await api.get(`/analytics/${timeMode}`, { params: timeMode === 'monthly' ? { month: monthChoice } : timeMode === 'yearly' ? { year: yearChoice } : {} });
      else if (view === 'wrapped') {
        const year = new Date().getUTCFullYear();
        const start = `${year}-01-01T00:00:00.000Z`; const end = `${year + 1}-01-01T00:00:00.000Z`;
        const [yearly, genres] = await Promise.all([
          api.get('/analytics/yearly', { params: { year } }), api.get('/analytics/genres', { params: { from: start, to: end } })
        ]);
        response = { data: { ...yearly.data, topGenre: genres.data.genres?.[0] || null, genreCount: genres.data.genres?.length || 0 } };
      }
      else if (view === 'library') response = await api.get('/spotify/library', { params: { limit: 30, offset: libraryOffset } });
      setData(response?.data ?? null);
    } catch (e) { setError(getApiErrorMessage(e, 'We could not load this view.')); }
    finally { setLoading(false); }
  }, [view, period, timeMode, sort, page, libraryOffset, dateChoice, monthChoice, yearChoice, entityKey]);

  useEffect(() => { load(); }, [load]);

  const [title, subtitle, Icon] = TITLES[view] || TITLES.history;
  const showRange = ['history', 'discovery', 'artists', 'tracks', 'albums', 'genres', 'patterns', 'records'].includes(view);
  const dataCoverage = data?.coverage || data?.overview?.coverage;

  const displayTitle = view === 'artist-detail' || view === 'track-detail' ? data?.name || title : title;

  return <div className="page-stack">
    <div className="page-heading heading-with-actions"><div><p className="eyebrow"><Icon size={13} /> SONORA / {title.toUpperCase()}</p><h1>{displayTitle}</h1><p className="page-subtitle">{subtitle}</p></div><div className="heading-actions">
      {view === 'tracks' && <label className="select-wrap"><span className="visually-hidden">Sort tracks</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="plays">Most played</option><option value="minutes">Most minutes</option><option value="recent">Most recent</option><option value="artist">Artist</option><option value="album">Album</option></select><ChevronDown size={14} /></label>}
      {view === 'time' && <label className="select-wrap"><select value={timeMode} onChange={e => setTimeMode(e.target.value)} aria-label="Time period"><option value="daily">Today</option><option value="weekly">This week</option><option value="monthly">This month</option><option value="yearly">This year</option></select><ChevronDown size={14} /></label>}
      {((view === 'daily') || (view === 'time' && timeMode === 'daily')) && <label className="date-control"><span>DAY</span><input type="date" value={dateChoice} onChange={e => setDateChoice(e.target.value)} /></label>}
      {view === 'time' && timeMode === 'monthly' && <label className="date-control"><span>MONTH</span><input type="month" value={monthChoice} onChange={e => setMonthChoice(e.target.value)} /></label>}
      {view === 'time' && timeMode === 'yearly' && <label className="date-control"><span>YEAR</span><input type="number" min="1970" max={new Date().getUTCFullYear()} value={yearChoice} onChange={e => setYearChoice(e.target.value)} /></label>}
      {showRange && <label className="select-wrap"><CalendarDays size={15} /><select value={period} onChange={e => { setPage(1); setPeriod(e.target.value); }} aria-label="Analytics time period">{RANGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={14} /></label>}
    </div></div>
    {error && <div className="alert alert-error"><CircleHelp size={17} /><div><strong>Data unavailable</strong><span>{error}</span></div><button onClick={load}>Try again</button><Link to="/settings">Connection &amp; import settings</Link></div>}
    {loading ? <PageSkeleton /> : <>
      {view === 'history' && <HistoryView data={data} page={page} setPage={setPage} />}
      {view === 'discovery' && <DiscoveryView data={data} />}
      {view === 'lifetime' && <LifetimeView data={data} />}
      {(view === 'artist-detail' || view === 'track-detail') && <DetailView type={view === 'artist-detail' ? 'artist' : 'track'} data={data} />}
      {view === 'artists' && <ArtistsView rows={Array.isArray(data) ? data : []} />}
      {view === 'tracks' && <TracksView rows={Array.isArray(data) ? data : []} />}
      {view === 'albums' && <AlbumsView rows={Array.isArray(data) ? data : []} />}
      {view === 'genres' && <GenresView data={data} />}
      {view === 'patterns' && <PatternsView data={data} />}
      {view === 'records' && <RecordsView data={data} />}
      {view === 'daily' && <DailyView data={data} />}
      {view === 'time' && (timeMode === 'daily' ? <DailyView data={data} /> : <TimeView data={data} mode={timeMode} />)}
      {view === 'wrapped' && <WrappedView data={data} />}
      {view === 'library' && <LibraryView data={data} offset={libraryOffset} setOffset={setLibraryOffset} />}
      {dataCoverage?.note && <div className="coverage-note"><CircleHelp size={15} /><p>{dataCoverage.note}</p><Link to="/settings">Manage data</Link></div>}
    </>}
  </div>;
}

function PageSkeleton() { return <div className="skeleton-layout"><div className="metric-grid">{[1, 2, 3, 4].map(i => <div className="skeleton skeleton-metric" key={i} />)}</div><div className="skeleton skeleton-chart" /><div className="skeleton skeleton-recent" /></div>; }

function SummaryStrip({ data }) {
  const totals = data?.totals || data?.summary || {};
  return <div className="metric-grid compact-metrics"><Metric icon={Clock3} value={formatMinutes(totals.totalMinutes)} label="Listening time" /><Metric icon={Headphones} value={number(totals.tracksPlayed)} label="Plays captured" /><Metric icon={Users2} value={number(totals.uniqueArtists)} label="Artists" /><Metric icon={Disc3} value={number(totals.uniqueAlbums)} label="Albums" /></div>;
}

function Metric({ icon: Icon, value, label }) { return <div className="metric-card panel"><span className="metric-icon"><Icon size={16} /></span><strong>{value}</strong><span>{label}</span></div>; }

function HistoryView({ data, page, setPage }) {
  const items = data?.items || [];
  return <><SummaryStrip data={data} /><div className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">CAPTURED LISTENING</p><h2>{number(data?.total)} plays</h2></div><span className="chart-unit">PAGE {page} OF {Math.max(data?.pages || 1, 1)}</span></div>
    {items.length ? <div className="history-list">{items.map((item, i) => <TrackRow key={item._id || `${item.playedAt}-${i}`} item={item} timestamp source />)}</div> : <EmptyState title="No listening history yet" text="Sync your Spotify activity or import your Extended Streaming History to start building a record." />}
    <div className="pagination"><span>{number(data?.total)} records · sorted newest first</span><div><button className="icon-button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><button className="icon-button" disabled={page >= (data?.pages || 1)} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div>
  </div></>;
}

function DetailView({ type, data }) {
  const isArtist = type === 'artist';
  const history = data?.history || [];
  const trend = isArtist ? (data?.timeline || []) : (data?.listeningFrequency || []);
  const labels = trend.map(item => {
    const value = isArtist ? item.month : item.month;
    const date = new Date(`${value}-01T00:00:00.000Z`);
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
  });
  const chartData = { labels, datasets: [{ data: trend.map(item => item.minutes), borderColor: '#71d89d', backgroundColor: 'rgba(113,216,157,.09)', fill: true, tension: .36, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }] };
  const topArtistTracks = data?.topTracks || [];
  return <>
    <section className="panel detail-hero">
      <Artwork src={data?.image} className={`detail-art${isArtist ? ' artist-image' : ''}`} artist={isArtist} />
      <div className="detail-copy"><p className="eyebrow">{isArtist ? 'ARTIST PROFILE' : 'TRACK PROFILE'}</p><h2>{data?.name || 'Unknown'}</h2><span>{isArtist ? (data?.genres?.join(' · ') || 'Genre metadata unavailable') : `${data?.artist || 'Unknown artist'}${data?.album ? ` · ${data.album}` : ''}`}</span>
        {isArtist && <div className="detail-meta">{data?.followers !== null && data?.followers !== undefined && <span>{number(data.followers)} followers</span>}{data?.popularity !== null && data?.popularity !== undefined && <span>Popularity {number(data.popularity)} / 100</span>}</div>}
        {!isArtist && data?.trackDurationMs && <div className="detail-meta"><span>{(data.trackDurationMs / 60000).toFixed(1)} min track length</span><span>{number(data.exactPlays)} exact-duration plays</span></div>}
      </div>
      <Link className="button button-secondary detail-back" to={isArtist ? '/artists' : '/tracks'}>Back to ranking</Link>
    </section>
    <div className="metric-grid compact-metrics">
      <Metric icon={Headphones} value={number(data?.plays)} label="Captured plays" />
      <Metric icon={Clock3} value={formatMinutes(data?.minutes)} label={isArtist ? 'Listening time' : 'Recorded time'} />
      <Metric icon={CalendarDays} value={humanDate(data?.firstPlayedAt)} label="First listened" />
      <Metric icon={Radio} value={humanDate(data?.lastPlayedAt)} label="Last listened" />
    </div>
    <section className="panel chart-panel large-chart"><div className="panel-heading"><div><p className="eyebrow">LISTENING TREND</p><h2>Monthly activity</h2></div><span className="chart-unit">UTC · MINUTES</span></div>{trend.length ? <div className="time-chart"><Line data={chartData} options={{ ...lineOptions, maintainAspectRatio: false, plugins: { ...lineOptions.plugins, tooltip: { ...lineOptions.plugins.tooltip, callbacks: { label: context => `${number(context.parsed.y)} min · ${number(trend[context.dataIndex].plays)} plays` } } } }} /></div> : <EmptyState title="No frequency trend available" text="Monthly activity will appear as more history is collected." />}</section>
    {data?.metadataNote && <div className="callout-strip"><CircleHelp size={16} /><span>{data.metadataNote}</span></div>}
    {isArtist ? <div className="split-grid"><section className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">MOST PLAYED</p><h2>Top tracks</h2></div></div><RankedList rows={topArtistTracks} kind="track" /></section><section className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">ALBUMS IN YOUR HISTORY</p><h2>Top albums</h2></div></div><RankedList rows={data?.albums || []} kind="album" /></section></div> : <section className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT PLAYS</p><h2>Listening history</h2></div></div>{history.length ? <div className="history-list">{history.map((item, index) => <TrackRow item={item} timestamp source key={item._id || `${item.playedAt}-${index}`} />)}</div> : <EmptyState title="No listening history" text="This track has no stored play records yet." />}</section>}
    {isArtist && <section className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT PLAYS</p><h2>Listening history</h2></div><span className="chart-unit">LATEST 20</span></div>{history.length ? <div className="history-list">{history.map((item, index) => <TrackRow item={item} timestamp source key={item._id || `${item.playedAt}-${index}`} />)}</div> : <EmptyState title="No listening history" text="This artist has no stored play records yet." />}</section>}
    <div className="coverage-note"><CircleHelp size={15} /><p>{data?.coverage?.note || 'Spotify API play duration is estimated from track length. Imported Extended Streaming History provides exact listened milliseconds.'}</p></div>
  </>;
}

function TrackRow({ item, timestamp = false, source = false, ranking }) {
  return <div className="data-row">
    {ranking !== undefined && <span className="data-rank">{String(ranking + 1).padStart(2, '0')}</span>}
    <Artwork src={item.albumImage || item.image} className="data-art" />
    <div className="data-row-main"><strong>{item.trackName || item.name || 'Unknown track'}</strong><span>{item.artistName || item.artist || ''}{(item.albumName || item.album) ? ` · ${item.albumName || item.album}` : ''}</span></div>
    {source && <span className="source-pill">{(item.sources || [item.source]).includes('extended-history') ? 'ARCHIVE' : 'SPOTIFY API'}</span>}
    {timestamp ? <time className="data-detail">{humanDate(item.playedAt)}</time> : <><span className="data-detail">{number(item.plays)} plays</span><span className="data-detail data-minutes">{formatMinutes(item.minutes)}</span></>}
  </div>;
}

function RankedList({ rows, kind }) {
  const isArtists = kind === 'artist';
  return rows.length ? <div className="ranked-list">{rows.map((item, i) => { const target = isArtists ? `/artists/${encodeURIComponent(item.artistId || item.name)}` : kind === 'track' && item.trackId ? `/tracks/${encodeURIComponent(item.trackId)}` : null; const contents = <>
    <span className="data-rank">{String(i + 1).padStart(2, '0')}</span>
    <Artwork src={item.image} className="data-art" artist={isArtists} />
    <div className="data-row-main"><strong>{item.name}</strong><span>{isArtists ? (item.genres?.slice(0, 3).join(' · ') || `${number(item.albums)} albums · ${number(item.tracks)} tracks`) : (item.artist || '')}</span></div>
    {isArtists && <span className="data-detail optional-detail">{item.genres?.[0] || 'Genre unavailable'}</span>}
    <span className="data-detail">{number(item.plays)} plays</span><span className="data-detail data-minutes">{formatMinutes(item.minutes)}</span>
  </>; return target ? <Link className="ranked-row ranked-row-link" key={item.id || `${item.name}-${i}`} to={target}>{contents}</Link> : <div className="ranked-row" key={item.id || `${item.name}-${i}`}>{contents}</div>; })}</div> : <EmptyState title="No records for this period" text="Try a wider period or sync and import more of your listening history." />;
}

function ArtistsView({ rows }) {
  return <>{rows.find(row => row.metadataNote)?.metadataNote && <div className="callout-strip"><CircleHelp size={16} /><span>{rows.find(row => row.metadataNote).metadataNote}</span></div>}<div className="callout-strip"><Mic2 size={16} /><span>Rankings use plays captured from your account. Spotify artist profiles provide images and current genre metadata where available.</span></div><div className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">ARTIST RANKING</p><h2>{rows.length ? `${number(rows.length)} artists` : 'Your artist ranking'}</h2></div><span className="chart-unit">PLAYS · MINUTES</span></div><RankedList rows={rows} kind="artist" /></div></>;
}
function TracksView({ rows }) { return <>{rows.find(row => row.metadataNote)?.metadataNote && <div className="callout-strip"><CircleHelp size={16} /><span>{rows.find(row => row.metadataNote).metadataNote}</span></div>}<div className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">TRACK RANKING</p><h2>{rows.length ? `${number(rows.length)} tracks` : 'Your track ranking'}</h2></div><span className="chart-unit">PLAYS · MINUTES</span></div><RankedList rows={rows} kind="track" /></div></>; }
function AlbumsView({ rows }) { return <>{rows.find(row => row.metadataNote)?.metadataNote && <div className="callout-strip"><CircleHelp size={16} /><span>{rows.find(row => row.metadataNote).metadataNote}</span></div>}<div className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">ALBUM RANKING</p><h2>{rows.length ? `${number(rows.length)} albums` : 'Your album ranking'}</h2></div><span className="chart-unit">PLAYS · MINUTES</span></div><RankedList rows={rows} kind="album" /></div></>; }

const CHART_COLORS = ['#71d89d', '#a0a6ff', '#e2b973', '#dd8eb3', '#6db6c7', '#bd9ce4', '#ee8c79', '#9ab68c', '#c3a8a4', '#82a9e8'];
const lineOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: '#202723', titleColor: '#aab5ae', bodyColor: '#f2f4f2', padding: 12 } },
  scales: { x: { grid: { display: false }, ticks: { color: '#737e77', maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.055)' }, ticks: { color: '#737e77', maxTicksLimit: 5 }, border: { display: false } } }
};

function GenresView({ data }) {
  const rows = data?.genres || [];
  const total = data?.totalAttributedPlays || 0;
  const chartData = { labels: rows.slice(0, 8).map(row => row.name), datasets: [{ data: rows.slice(0, 8).map(row => row.plays), backgroundColor: CHART_COLORS, borderColor: '#161b18', borderWidth: 4, hoverOffset: 4 }] };
  const chartOptions = { cutout: '76%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#202723', titleColor: '#aab5ae', bodyColor: '#f2f4f2', padding: 12, callbacks: { label: context => ` ${Math.round(context.parsed / Math.max(total, 1) * 100)}% · ${number(context.parsed)} plays` } } } };
  return <><SummaryStrip data={{ totals: data?.summary || {} }} />{data?.metadataNote && <div className="callout-strip"><CircleHelp size={16} /><span>{data.metadataNote}</span></div>}<div className="split-grid"><section className="panel genre-chart-panel"><div className="panel-heading"><div><p className="eyebrow">DISTRIBUTION</p><h2>Genre mix</h2></div></div>{rows.length ? <div className="genre-chart-wrap"><Doughnut data={chartData} options={chartOptions} /><div className="genre-chart-center"><strong>{number(total)}</strong><span>ATTRIBUTED PLAYS</span></div></div> : <EmptyState title="Genre metadata isn’t available" text={data?.note || 'Spotify has not provided genre metadata for your artists.'} />}</section>
    <section className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">GENRE RANKING</p><h2>Top genres</h2></div></div>{rows.length ? <div className="genre-list">{rows.slice(0, 12).map((row, index) => <div className="genre-row" key={row.name}><span className="genre-color" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} /><span className="genre-name">{row.name}</span><span className="genre-share">{total ? `${Math.round(row.plays / total * 100)}%` : '—'}</span><span className="genre-count">{formatMinutes(row.minutes)}</span></div>)}</div> : <p className="muted-copy">{data?.note || 'No artist genres to display.'}</p>}</section></div><div className="coverage-note"><CircleHelp size={15} /><p>{data?.note || 'Genres are inferred from current Spotify artist metadata, not from streaming history records.'}</p><Link to="/artists">View artists</Link></div></>;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function PatternsView({ data }) {
  const cells = data?.cells || [];
  const max = Math.max(1, ...cells.map(cell => cell.minutes));
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const averageByHour = hours.map(hour => cells.filter(cell => cell.hour === hour).reduce((sum, cell) => sum + cell.minutes, 0));
  const peakHour = averageByHour.indexOf(Math.max(0, ...averageByHour));
  return <><SummaryStrip data={{ totals: data?.summary || {} }} /><section className="panel heatmap-panel"><div className="panel-heading"><div><p className="eyebrow">HOUR × DAY</p><h2>Listening activity</h2></div><span className="chart-unit">UTC · MINUTES</span></div>
    {cells.length ? <div className="heatmap-scroll"><div className="heatmap-hours"><span />{hours.filter(hour => hour % 3 === 0).map(hour => <span key={hour} style={{ gridColumn: `${hour + 2} / span 3` }}>{String(hour).padStart(2, '0')}:00</span>)}</div><div className="heatmap-grid">{DAYS.map((day, dayIndex) => <React.Fragment key={day}><span className="heatmap-day">{day}</span>{hours.map(hour => { const cell = cells.find(item => item.day === dayIndex && item.hour === hour); const intensity = cell?.minutes ? .12 + .82 * Math.sqrt(cell.minutes / max) : 0; return <span key={`${dayIndex}-${hour}`} className={`heat-cell${hour === peakHour && cell?.minutes ? ' peak' : ''}`} style={{ '--heat': intensity }} title={`${day}, ${String(hour).padStart(2, '0')}:00\n${number(cell?.minutes)} minutes\n${number(cell?.tracks)} tracks\n${number(cell?.artists)} artists`} />; })}</React.Fragment>)}</div><div className="heatmap-legend"><span>{DAYS[0]} through Saturday · cells aggregate all available records</span><span>Less <i className="heat-cell" /> <i className="heat-cell" style={{ '--heat': .48 }} /> <i className="heat-cell" style={{ '--heat': .94 }} /> More</span></div></div> : <EmptyState title="Not enough history for a heatmap" text="Import more history or sync over time to reveal listening patterns." />}
  </section><div className="insight-strip"><Clock3 size={16} /><span>Most active hour in this dataset:</span><strong>{`${String(peakHour).padStart(2, '0')}:00 UTC`}</strong><span className="insight-divider" /><span>{number(averageByHour[peakHour])} total minutes across records.</span></div></>;
}

function TimeView({ data, mode }) {
  const summary = data?.totals || {};
  const dailyRows = data?.timeline || [];
  const monthlyRows = mode === 'yearly' ? Object.values(dailyRows.reduce((groups, item) => {
    const month = item.date.slice(0, 7); const current = groups[month] || { date: `${month}-01`, minutes: 0, tracks: 0 };
    current.minutes += item.minutes; current.tracks += item.tracks; groups[month] = current; return groups;
  }, {})) : dailyRows;
  const labels = monthlyRows.map(item => {
    const date = new Date(`${item.date}T00:00:00.000Z`);
    return mode === 'monthly' ? date.toLocaleDateString(undefined, { day: 'numeric', weekday: 'short' }) : mode === 'yearly' ? date.toLocaleDateString(undefined, { month: 'short' }) : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  });
  const chartData = { labels, datasets: [{ label: 'Minutes', data: monthlyRows.map(item => item.minutes), backgroundColor: mode === 'weekly' ? 'rgba(113,216,157,.76)' : 'rgba(113,216,157,.12)', borderColor: '#71d89d', borderWidth: mode === 'weekly' ? 0 : 2, borderRadius: 5, fill: mode !== 'weekly', tension: .35, pointRadius: 0 }] };
  const options = mode === 'weekly' ? { ...lineOptions, plugins: { ...lineOptions.plugins, tooltip: { ...lineOptions.plugins.tooltip, callbacks: { label: c => `${number(c.parsed.y)} min · ${number(data?.timeline?.[c.dataIndex]?.tracks)} tracks` } } } } : lineOptions;
  const growth = data?.comparison?.changePercent;
  return <><div className="metric-grid compact-metrics"><Metric icon={Clock3} value={formatMinutes(summary.totalMinutes)} label={mode === 'weekly' ? 'This week' : mode === 'monthly' ? 'This month' : 'This year'} /><Metric icon={Headphones} value={number(summary.tracksPlayed)} label="Tracks played" /><Metric icon={Users2} value={number(summary.uniqueArtists)} label="Artists" /><Metric icon={Disc3} value={number(summary.uniqueAlbums)} label="Albums" /></div>
    <section className="panel chart-panel large-chart"><div className="panel-heading"><div><p className="eyebrow">{mode.toUpperCase()} LISTENING</p><h2>{mode === 'weekly' ? 'Day by day' : mode === 'monthly' ? 'Daily trend' : 'Monthly trend'}</h2></div>{data?.comparison && <span className={`change-pill${growth > 0 ? ' positive' : growth < 0 ? ' negative' : ''}`}>{growth > 0 ? <ArrowUpRight size={14} /> : growth < 0 ? <ArrowDownRight size={14} /> : null}{growth === null || growth === undefined ? 'No prior period data' : `${growth > 0 ? '+' : ''}${growth}% vs previous ${mode === 'weekly' ? 'week' : mode === 'monthly' ? 'month' : 'year'}`}</span>}</div>
      {monthlyRows.length ? <div className="time-chart"><Bar data={chartData} options={{ ...options, maintainAspectRatio: false, plugins: { ...options.plugins, legend: { display: false }, tooltip: { ...options.plugins.tooltip, callbacks: { label: context => `${number(context.parsed.y)} min · ${number(monthlyRows[context.dataIndex].tracks)} tracks` } } }, scales: { ...options.scales, y: { ...options.scales.y, title: { display: true, text: 'Minutes', color: '#737e77' } } } }} /></div> : <EmptyState title="No listening data in this period" text="Sync your account or import the historical Spotify archive to fill in this view." />}
    </section>
    {mode === 'yearly' && monthlyRows.length > 0 && <YearHeatmap rows={dailyRows} />}
    <div className="coverage-note"><CircleHelp size={15} /><p>{data?.coverage?.note} Calendar periods use UTC.</p><Link to="/settings">Import history</Link></div></>;
}

function YearHeatmap({ rows }) {
  const year = Number(rows[0]?.date?.slice(0, 4)) || new Date().getFullYear();
  const max = Math.max(1, ...rows.map(row => row.minutes));
  const byDate = new Map(rows.map(row => [row.date, row]));
  const start = new Date(Date.UTC(year, 0, 1));
  const offset = start.getUTCDay();
  const days = new Date(Date.UTC(year + 1, 0, 1)).getUTCDate() === 366 ? 366 : ((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000);
  const cells = Array.from({ length: offset + days }, (_, index) => {
    if (index < offset) return null;
    const date = new Date(Date.UTC(year, 0, index - offset + 1)).toISOString().slice(0, 10);
    const row = byDate.get(date);
    return { date, row, level: row?.minutes ? .12 + .82 * Math.sqrt(row.minutes / max) : 0 };
  });
  const monthLabels = Array.from({ length: 12 }, (_, month) => new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }));
  return <section className="panel year-heatmap"><div className="panel-heading"><div><p className="eyebrow">YEAR AT A GLANCE</p><h2>Listening calendar</h2></div><span className="chart-unit">{year} · UTC</span></div><div className="year-heatmap-scroll"><div className="year-months">{monthLabels.map((month, index) => <span key={month} style={{ gridColumn: `${Math.floor((offset + (Date.UTC(year, index, 1) - Date.UTC(year, 0, 1)) / 86400000) / 7) + 1} / span 4` }}>{month}</span>)}</div><div className="year-grid">{cells.map((cell, index) => cell ? <span key={cell.date} className="heat-cell" style={{ '--heat': cell.level }} title={`${cell.date}\n${number(cell.row?.minutes)} minutes · ${number(cell.row?.tracks)} plays`} /> : <span key={`blank-${index}`} />)}</div></div></section>;
}

function WrappedView({ data }) {
  const totals = data?.totals || {};
  const topArtist = data?.topArtists?.[0]; const topTrack = data?.topTracks?.[0]; const topAlbum = data?.topAlbums?.[0];
  const year = data?.period || new Date().getFullYear();
  const topGenre = data?.topGenre;
  const listeningStyle = !totals.tracksPlayed ? 'Not enough data yet' : topArtist?.plays / Math.max(totals.tracksPlayed, 1) > .35 ? 'Artist devotee' : data?.genreCount >= 5 && totals.uniqueArtists >= 15 ? 'Style explorer' : totals.uniqueTracks && totals.tracksPlayed / totals.uniqueTracks > 2 ? 'Repeat listener' : 'Wide-ranging listener';
  const recapSummary = { year, totals, topArtist: topArtist || null, topTrack: topTrack || null, topAlbum: topAlbum || null, topGenre: topGenre || null, listeningStyle };
  const shareRecap = async () => {
    const text = `${year} listening recap\n${number(totals.totalMinutes)} minutes · ${number(totals.uniqueArtists)} artists · ${number(totals.uniqueTracks)} tracks\nTop artist: ${topArtist?.name || 'No data'}\nTop track: ${topTrack?.name || 'No data'}${topTrack?.artist ? ` — ${topTrack.artist}` : ''}\nTop genre: ${topGenre?.name || 'Unavailable'}\nListening style: ${listeningStyle}\nBased on available listening records.`;
    try { if (navigator.share) await navigator.share({ title: `My ${year} listening recap`, text }); else { await navigator.clipboard.writeText(text); toast.success('Recap copied to clipboard'); } }
    catch (error) { if (error.name !== 'AbortError') toast.error('Could not share the recap on this device.'); }
  };
  const exportRecap = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(recapSummary, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `sonora-recap-${year}.json`; anchor.click(); URL.revokeObjectURL(url);
    toast.success('Recap JSON downloaded');
  };
  return <><div className="recap-cover panel"><div className="recap-cover-text"><p className="eyebrow">YOUR YEAR IN SOUND · {year}</p><h2>A year shaped<br />by what you played.</h2><span>Every number on this page comes from your available listening records.</span><div className="recap-actions"><button className="button button-secondary" onClick={shareRecap} disabled={!totals.tracksPlayed}><Share2 size={14} />Share recap</button><button className="button button-secondary" onClick={exportRecap} disabled={!totals.tracksPlayed}><FileDown size={14} />Export JSON</button></div></div><div className="recap-minutes"><strong>{number(totals.totalMinutes)}</strong><span>MINUTES LISTENED</span><small>{number(totals.totalHours)} hours · {number(totals.uniqueArtists)} artists</small></div></div>
    <div className="recap-grid"><RecapCard label="YOUR TOP ARTIST" value={topArtist?.name || 'No data yet'} detail={topArtist ? `${number(topArtist.plays)} captured plays` : 'Sync or import history to see a top artist.'} icon={Users2} />
      <RecapCard label="MOST PLAYED TRACK" value={topTrack?.name || 'No data yet'} detail={topTrack ? `${topTrack.artist} · ${number(topTrack.plays)} plays` : 'Your track ranking will appear here.'} icon={Music2} />
      <RecapCard label="TOP ALBUM" value={topAlbum?.name || 'No data yet'} detail={topAlbum ? `${topAlbum.artist} · ${number(topAlbum.plays)} plays` : 'Your album ranking will appear here.'} icon={Disc3} />
      <RecapCard label="TOP GENRE" value={topGenre?.name || 'Unavailable'} detail={topGenre ? `${formatMinutes(topGenre.minutes)} attributed · ${number(topGenre.plays)} plays` : 'Current Spotify genre metadata is unavailable for these artists.'} icon={Sparkles} />
      <RecapCard label="LISTENING FOOTPRINT" value={`${number(totals.uniqueTracks)} tracks`} detail={`${number(totals.uniqueAlbums)} albums · ${number(totals.uniqueArtists)} artists`} icon={Radio} />
      <RecapCard label="LISTENING STYLE · INFERRED" value={listeningStyle} detail="A lightweight description based on your available plays and artist mix." icon={Activity} />
    </div>
    <div className="coverage-note"><CircleHelp size={15} /><p>{data?.coverage?.note} This recap reflects the records available for {year}; it does not claim to cover your full Spotify account history.</p><Link to="/settings">Import history</Link></div>
  </>;
}
function RecapCard({ label, value, detail, icon: Icon }) { return <div className="recap-card panel"><Icon size={18} /><span className="eyebrow">{label}</span><strong>{value}</strong><p>{detail}</p></div>; }

function RecordsView({ data }) {
  const entries = [
    { label: 'Most played artist', value: data?.mostPlayedArtist?.name, detail: data?.mostPlayedArtist ? `${number(data.mostPlayedArtist.plays)} plays · ${formatMinutes(data.mostPlayedArtist.minutes)}` : null, icon: Users2 },
    { label: 'Most played track', value: data?.mostPlayedTrack?.name, detail: data?.mostPlayedTrack ? `${data.mostPlayedTrack.artist} · ${number(data.mostPlayedTrack.plays)} plays` : null, icon: Music2 },
    { label: 'Biggest listening day', value: data?.highestMinutesDay ? humanDate(data.highestMinutesDay.date) : null, detail: data?.highestMinutesDay ? `${formatMinutes(data.highestMinutesDay.minutes)} recorded` : null, icon: Clock3 },
    { label: 'Most tracks in one day', value: data?.highestTracksDay ? number(data.highestTracksDay.tracks) : null, detail: data?.highestTracksDay ? humanDate(data.highestTracksDay.date) : null, icon: Headphones },
    { label: 'Longest listening streak', value: data?.days ? `${number(data.longestStreak)} days` : null, detail: data?.days ? `${number(data.days)} active days in this range` : null, icon: Activity },
    { label: 'Longest session', value: data?.longestSession ? formatMinutes(data.longestSession.minutes) : null, detail: data?.longestSession ? `${number(data.longestSession.tracks)} tracks · ${humanDate(data.longestSession.startedAt)}` : null, icon: Radio },
    { label: 'Average session', value: data?.sessionCount ? formatMinutes(data.averageSessionMinutes) : null, detail: data?.sessionCount ? `${number(data.sessionCount)} sessions` : null, icon: Clock3 }
  ];
  return <><div className="metric-grid compact-metrics"><Metric icon={Activity} value={data?.days ? `${number(data.longestStreak)} days` : '—'} label="Longest streak" /><Metric icon={Clock3} value={data?.highestMinutesDay ? formatMinutes(data.highestMinutesDay.minutes) : '—'} label="Top listening day" /><Metric icon={Headphones} value={number(data?.highestTracksDay?.tracks)} label="Most tracks in a day" /><Metric icon={Users2} value={number(data?.days)} label="Days with listening" /></div>
    <div className="records-grid">{entries.map(({ label, value, detail, icon: Icon }) => <div className="record-card panel" key={label}><span className="record-icon"><Icon size={17} /></span><p className="eyebrow">{label.toUpperCase()}</p><strong>{value || 'No records yet'}</strong><span>{detail || 'More listening data is needed for this record.'}</span></div>)}</div>
    <div className="coverage-note"><CircleHelp size={15} /><p>Records use stored plays in the selected range. Sessions group adjacent plays less than 30 minutes apart and sum recorded track duration; Spotify API durations are estimates.</p><Link to="/settings">Import history</Link></div>
  </>;
}

function DailyView({ data }) {
  const hours = data?.hours || [];
  const peak = data?.peakListeningHour;
  const labels = hours.map(row => `${String(row.hour).padStart(2, '0')}:00`);
  const chartData = { labels, datasets: [{ data: hours.map(row => row.minutes), backgroundColor: hours.map(row => row.hour === peak ? '#71d89d' : 'rgba(113,216,157,.32)'), borderRadius: 3 }] };
  const time = value => value ? new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—';
  return <><div className="metric-grid compact-metrics"><Metric icon={Clock3} value={formatMinutes(data?.totals?.totalMinutes)} label="Today" /><Metric icon={Headphones} value={number(data?.totals?.tracksPlayed)} label="Tracks played" /><Metric icon={Users2} value={number(data?.totals?.uniqueArtists)} label="Artists" /><Metric icon={Disc3} value={number(data?.totals?.uniqueAlbums)} label="Albums" /></div>
    <div className="daily-facts panel"><Fact label="First listening" value={time(data?.firstListeningAt)} /><Fact label="Last listening" value={time(data?.lastListeningAt)} /><Fact label="Peak hour" value={peak === null ? '—' : `${String(peak).padStart(2, '0')}:00 UTC`} /><Fact label="Most played artist" value={data?.topArtist?.name || '—'} /><Fact label="Most played track" value={data?.topTrack?.name || '—'} /></div>
    <section className="panel chart-panel large-chart"><div className="panel-heading"><div><p className="eyebrow">{data?.period || 'today'} · UTC</p><h2>Hourly listening</h2></div><span className="chart-unit">MINUTES</span></div>{hours.some(row => row.tracks) ? <div className="daily-chart"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#202723', titleColor: '#aab5ae', bodyColor: '#f2f4f2', callbacks: { label: context => `${number(context.parsed.y)} min · ${number(hours[context.dataIndex].tracks)} tracks · ${number(hours[context.dataIndex].artists)} artists` } } }, scales: { x: { grid: { display: false }, ticks: { color: '#737e77', maxRotation: 0, autoSkip: false, callback: (value, index) => index % 3 === 0 ? labels[index] : '' }, border: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.055)' }, ticks: { color: '#737e77' }, border: { display: false } } } }} /></div> : <EmptyState title="No plays recorded for this day" text="Spotify API history is limited. Import Extended Streaming History to view older plays." />}</section>
    <div className="coverage-note"><CircleHelp size={15} /><p>Today is measured in UTC. Spotify API play time is estimated from track duration; imported Extended History provides exact msPlayed values.</p><Link to="/history">View history</Link></div>
  </>;
}
function Fact({ label, value }) { return <div className="daily-fact"><span>{label}</span><strong>{value}</strong></div>; }

function DiscoveryView({ data }) {
  const artists = data?.artists || []; const tracks = data?.tracks || [];
  return <><div className="callout-strip"><Sparkles size={16} /><span>First seen means the earliest play in your stored history. An imported archive extends what Sonora can know about prior discoveries.</span></div>
    {data?.metadataNote && <div className="callout-strip"><CircleHelp size={16} /><span>{data.metadataNote}</span></div>}
    <div className="split-grid"><section className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">ARTISTS FIRST SEEN</p><h2>{number(artists.length)} artists</h2></div></div>{artists.length ? <div className="discovery-list">{artists.map((item, i) => <div className="discovery-row" key={item._id || item.name}><span className="discovery-date">{humanDate(item.firstPlayedAt)}</span><Artwork src={item.image} className="data-art discovery-art" artist /><div className="data-row-main"><strong>{item.name || 'Unknown artist'}</strong><span>{number(item.plays)} plays in available history</span></div></div>)}</div> : <EmptyState title="No new artists yet" text="First-seen artists will appear as your listening history grows." />}</section>
    <section className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">TRACKS FIRST SEEN</p><h2>{number(tracks.length)} tracks</h2></div></div>{tracks.length ? <div className="discovery-list">{tracks.map((item, i) => <div className="discovery-row" key={item._id || item.name}><span className="discovery-date">{humanDate(item.firstPlayedAt)}</span><Artwork src={item.image} className="data-art discovery-art" /><div className="data-row-main"><strong>{item.name || 'Unknown track'}</strong><span>{item.artist || 'Unknown artist'} · {number(item.plays)} plays</span></div></div>)}</div> : <EmptyState title="No new tracks yet" text="First-seen tracks will appear as your listening history grows." />}</section></div>
    <div className="coverage-note"><CircleHelp size={15} /><p>{data?.note}</p><Link to="/settings">Import history</Link></div>
  </>;
}

function LifetimeView({ data }) {
  const overview = data?.overview || {};
  const totals = overview.totals || {};
  const records = data?.records || {};
  const genres = data?.genres?.genres || [];
  const cells = data?.patterns?.cells || [];
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: cells.filter(cell => cell.hour === hour).reduce((sum, cell) => sum + cell.minutes, 0) }));
  const peak = byHour.reduce((best, item) => !best || item.minutes > best.minutes ? item : best, null);
  const activeDays = records.days || 0;
  const sources = overview.coverage?.sources || [];
  return <>
    <div className="callout-strip"><Clock3 size={16} /><span>This is lifetime data currently stored for your account. Spotify API history begins when the app can capture your recent plays; imported Extended Streaming History may extend that range.</span></div>
    <div className="metric-grid compact-metrics">
      <Metric icon={Clock3} value={formatMinutes(totals.totalMinutes)} label="Listening time" />
      <Metric icon={Headphones} value={number(totals.tracksPlayed)} label="Captured plays" />
      <Metric icon={Music2} value={number(totals.uniqueTracks)} label="Unique tracks" />
      <Metric icon={Users2} value={number(totals.uniqueArtists)} label="Unique artists" />
    </div>
    <div className="lifetime-grid">
      <LifetimeFact label="Total hours" value={number(totals.totalHours)} detail={`${number(totals.totalDays)} days equivalent`} icon={Clock3} />
      <LifetimeFact label="Unique albums" value={number(totals.uniqueAlbums)} detail="In available history" icon={Disc3} />
      <LifetimeFact label="Most active day" value={records.highestMinutesDay ? humanDate(records.highestMinutesDay.date) : 'No records yet'} detail={records.highestMinutesDay ? formatMinutes(records.highestMinutesDay.minutes) : 'A listening date will appear here.'} icon={CalendarDays} />
      <LifetimeFact label="Most active hour" value={peak?.minutes ? `${String(peak.hour).padStart(2, '0')}:00 UTC` : 'No records yet'} detail={peak?.minutes ? `${formatMinutes(peak.minutes)} across all weekdays` : 'An active hour will appear here.'} icon={Clock3} />
      <LifetimeFact label="Longest streak" value={activeDays ? `${number(records.longestStreak)} days` : 'No records yet'} detail={activeDays ? `${number(activeDays)} active days` : 'A consecutive run of listening days.'} icon={Activity} />
      <LifetimeFact label="Average per active day" value={activeDays ? formatMinutes(totals.totalMinutes / activeDays) : '—'} detail={activeDays ? `${number(totals.tracksPlayed / activeDays)} tracks per active day` : 'Calculated from days with captured plays.'} icon={BarChart3} />
    </div>
    <div className="split-grid lifetime-highlights">
      <LifetimeHighlight label="TOP ARTIST OF ALL TIME" item={overview.topArtists?.[0]} icon={Users2} />
      <LifetimeHighlight label="TOP TRACK OF ALL TIME" item={overview.topTracks?.[0]} icon={Music2} />
      <LifetimeHighlight label="TOP ALBUM OF ALL TIME" item={overview.topAlbums?.[0]} icon={Disc3} />
      <LifetimeFact label="MOST LISTENED GENRE" value={genres[0]?.name || 'Genre data unavailable'} detail={genres[0] ? `${formatMinutes(genres[0].minutes)} attributed · ${number(genres[0].plays)} plays` : data?.genres?.note || 'Spotify genre metadata is not available for these records.'} icon={Sparkles} />
    </div>
    <div className="coverage-note"><CircleHelp size={15} /><p><strong>Data coverage.</strong> {overview.coverage?.note} Available sources: {sources.length ? sources.map(source => source === 'extended-history' ? 'Extended Streaming History' : 'Spotify API').join(' and ') : 'none yet'}. First stored play: {humanDate(overview.coverage?.firstPlayedAt)}. No claim is made about listening before the earliest stored record.</p><Link to="/settings">Import history</Link></div>
  </>;
}

function LifetimeFact({ label, value, detail, icon: Icon }) {
  return <div className="record-card panel"><span className="record-icon"><Icon size={17} /></span><p className="eyebrow">{label.toUpperCase()}</p><strong>{value}</strong><span>{detail}</span></div>;
}
function LifetimeHighlight({ label, item, icon: Icon }) {
  return <div className="lifetime-highlight panel"><span className="record-icon"><Icon size={17} /></span><p className="eyebrow">{label}</p><strong>{item?.name || 'No records yet'}</strong><span>{item ? `${number(item.plays)} plays · ${formatMinutes(item.minutes)}` : 'This ranking will appear when listening data is available.'}</span></div>;
}

function LibraryView({ data, offset, setOffset }) {
  const items = data?.items || [];
  return <div className="panel data-panel"><div className="panel-heading"><div><p className="eyebrow">SAVED SPOTIFY TRACKS</p><h2>{data?.total ? `${number(data.total)} saved tracks` : 'Your saved tracks'}</h2></div><span className="chart-unit">SPOTIFY LIBRARY</span></div>
    {items.length ? <div className="ranked-list">{items.map((item, i) => { const track = item.track || {}; return <div className="data-row" key={track.id || `${track.name}-${offset}-${i}`}>
      <span className="data-rank">{String(offset + i + 1).padStart(2, '0')}</span><Artwork src={track.album?.images?.[0]?.url} className="data-art" />
      <div className="data-row-main"><strong>{track.name || 'Unavailable track'}</strong><span>{(track.artists || []).map(artist => artist.name).join(', ')}{track.album?.name ? ` · ${track.album.name}` : ''}</span></div><span className="data-detail">{track.duration_ms ? `${Math.round(track.duration_ms / 60000)} min` : '—'}</span>
    </div>; })}</div> : <EmptyState title="No saved tracks found" text={data?.message || 'Reconnect and approve saved library access to browse saved music.'} />}
    <div className="pagination"><span>Showing {items.length ? offset + 1 : 0}–{offset + items.length} of {number(data?.total)} saved tracks</span><div><button className="icon-button" disabled={offset <= 0} onClick={() => setOffset(Math.max(0, offset - 30))} aria-label="Previous saved tracks"><ChevronLeft size={17} /></button><button className="icon-button" disabled={!data?.next} onClick={() => setOffset(offset + 30)} aria-label="Next saved tracks"><ChevronRight size={17} /></button></div></div>
  </div>;
}

function EmptyState({ title, text }) { return <div className="empty-state"><span className="empty-icon"><BarChart3 size={19} /></span><strong>{title}</strong><p>{text}</p></div>; }
