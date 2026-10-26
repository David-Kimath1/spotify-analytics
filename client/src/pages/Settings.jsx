import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, CircleHelp, Copy, Download, FileJson2, FileUp, HardDriveDownload, LoaderCircle, LockKeyhole, Music2, RefreshCw, ShieldCheck, Smartphone, SunMoon, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../lib/api';

async function readZipJson(file) {
  if (typeof DecompressionStream === 'undefined') throw new Error('ZIP import needs a browser with DecompressionStream support. Extract the archive and choose the JSON files instead.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let eocd = -1;
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i++) {
    if (view.getUint32(i, true) === 0x06054b50) eocd = i;
  }
  if (eocd < 0) throw new Error(`${file.name} is not a readable ZIP archive.`);
  const entries = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const jsonFiles = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < entries; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error(`The ZIP directory in ${file.name} is damaged.`);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith('.json')) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) continue;
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let payload;
    if (method === 0) payload = compressed;
    else if (method === 8) payload = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error(`ZIP entry “${name}” uses an unsupported compression method.`);
    jsonFiles.push({ name, text: decoder.decode(payload) });
  }
  if (!jsonFiles.length) throw new Error(`No JSON history files were found in ${file.name}.`);
  return jsonFiles;
}

function extractRecords(value, fileName) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.history)) return value.history;
  const arrays = Object.entries(value || {}).filter(([key, content]) => /streaming.*history|history.*audio/i.test(key) && Array.isArray(content));
  if (arrays.length) return arrays.flatMap(([, content]) => content);
  throw new Error(`${fileName} does not contain a Spotify streaming history array.`);
}

function getInstallState() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  return { available: !!window.sonoraInstallPrompt, installed: !!window.sonoraAppInstalled || !!standalone };
}

export default function Settings() {
  const { user, login } = useAuth();
  const fileInput = useRef(null);
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [connection, setConnection] = useState('connected');
  const [working, setWorking] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('sonora-theme') || 'dark');
  const [installState, setInstallState] = useState(getInstallState);

  useEffect(() => {
    const updateInstallState = () => setInstallState(getInstallState());
    window.addEventListener('sonora-install-availability', updateInstallState);
    return () => window.removeEventListener('sonora-install-availability', updateInstallState);
  }, []);

  const verifyConnection = async () => {
    setConnection('checking');
    try { await api.get('/spotify/profile'); setConnection('connected'); toast.success('Spotify connection is active'); }
    catch (e) { setConnection('error'); toast.error(e.response?.data?.error || 'Spotify connection needs attention'); }
  };

  const uploadRecords = async records => {
    const chunkSize = 500;
    let sent = 0; let inserted = 0; let merged = 0; let invalid = 0;
    for (let start = 0; start < records.length; start += chunkSize) {
      const result = await api.post('/analytics/import', { records: records.slice(start, start + chunkSize) });
      sent += result.data.valid; inserted += result.data.inserted; merged += result.data.merged; invalid += result.data.invalid;
      setProgress({ sent: Math.min(start + chunkSize, records.length), total: records.length });
    }
    return { sent, inserted, merged, invalid };
  };

  const importFiles = async () => {
    if (!files.length) return;
    setImporting(true); setProgress({ sent: 0, total: 0 });
    try {
      const records = [];
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          const entries = await readZipJson(file);
          for (const entry of entries) records.push(...extractRecords(JSON.parse(entry.text), entry.name));
        } else {
          records.push(...extractRecords(JSON.parse(await file.text()), file.name));
        }
      }
      if (!records.length) throw new Error('The selected files contained no listening records.');
      setProgress({ sent: 0, total: records.length });
      const result = await uploadRecords(records);
      toast.success(`Imported ${result.inserted.toLocaleString()} records; merged ${result.merged.toLocaleString()} duplicates.`);
      setFiles([]); if (fileInput.current) fileInput.current.value = '';
    } catch (e) { toast.error(e.response?.data?.error || e.message || 'Import failed. Check the file format and try again.'); }
    finally { setImporting(false); window.setTimeout(() => setProgress(null), 1600); }
  };

  const exportData = async format => {
    setWorking(`export-${format}`);
    try {
      const response = await fetch(`${API_URL}/analytics/export?format=${format}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, credentials: 'include' });
      if (!response.ok) throw new Error('Analytics export failed.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `spotify-analytics.${format}`; anchor.click(); URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} export downloaded`);
    } catch (e) { toast.error(e.message); }
    finally { setWorking(''); }
  };

  const deleteHistory = async () => {
    if (!window.confirm('Delete all imported and Spotify-captured listening records? This cannot be undone.')) return;
    setWorking('delete');
    try { const response = await api.delete('/analytics/data'); toast.success(`${response.data.deleted.toLocaleString()} records deleted`); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not delete analytics data.'); }
    finally { setWorking(''); }
  };

  const changeTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next); localStorage.setItem('sonora-theme', next); document.documentElement.dataset.theme = next;
  };

  const installApp = async () => {
    const prompt = window.sonoraInstallPrompt;
    if (!prompt) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      toast(isIOS
        ? 'Use Share, then “Add to Home Screen” to install Sonora.'
        : 'Open your browser menu and choose “Install app” or “Add to Home Screen.”');
      return;
    }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstallState({ available: false, installed: true });
      window.sonoraInstallPrompt = null;
    } catch (error) {
      toast.error(error.message || 'Sonora could not start installation. Try your browser menu.');
    }
  };

  const copyAppUrl = async () => {
    const url = new URL('/', window.location.origin).href;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const field = document.createElement('textarea');
        field.value = url; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
        document.body.appendChild(field); field.select();
        const copied = document.execCommand('copy'); field.remove();
        if (!copied) throw new Error('Clipboard access is unavailable.');
      }
      toast.success('App URL copied');
    } catch (error) { toast.error('Could not copy the app URL.'); }
  };

  const statusLabel = connection === 'connected' ? 'Connected' : connection === 'checking' ? 'Checking connection' : connection === 'error' ? 'Reconnect needed' : 'Connected';

  return <div className="page-stack">
    <div className="page-heading"><p className="eyebrow">SONORA / PREFERENCES</p><h1>Settings</h1><p className="page-subtitle">Manage your Spotify connection and analytics data.</p></div>

    <section className="settings-section"><div className="settings-section-head"><div><h2>Install and share Sonora</h2><p>Install the dashboard as an app or copy its current web address.</p></div></div>
      <div className="settings-card panel"><div className="settings-card-icon"><Smartphone size={19} /></div><div className="settings-card-copy"><strong>{installState.installed ? 'Sonora is installed' : 'Use Sonora like an app'}</strong><span>On mobile, install it to your home screen. On desktop, open it in its own window.</span></div><div className="settings-actions"><button className="button button-secondary" onClick={installApp} disabled={installState.installed}>{installState.installed ? <Check size={15} /> : <Download size={15} />}{installState.installed ? 'Installed' : 'Install app'}</button><button className="button button-primary" onClick={copyAppUrl}><Copy size={15} />Copy app URL</button></div></div>
      <div className="settings-footnote"><CircleHelp size={15} /><span>Copy app URL gives you the address of this deployment. Local development addresses such as localhost only work on this computer; deploy Sonora to get a public link.</span></div>
    </section>

    <section className="settings-section"><div className="settings-section-head"><div><h2>Spotify connection</h2><p>Sonora reads listening activity through your Spotify account.</p></div><span className={`settings-state${connection === 'error' ? ' state-error' : ''}`}><span className="status-dot" />{statusLabel}</span></div>
      <div className="settings-card panel"><div className="settings-card-icon spotify-settings-icon"><Music2 size={19} /></div><div className="settings-card-copy"><strong>{user?.displayName || 'Spotify account'}</strong><span>Profile, recent history and top item permissions</span></div><div className="settings-actions"><button className="button button-secondary" onClick={verifyConnection} disabled={connection === 'checking'}><RefreshCw size={14} className={connection === 'checking' ? 'spin' : ''} />Check</button><button className="button button-primary" onClick={login}><Music2 size={14} />Reconnect</button></div></div>
    </section>

    <section className="settings-section"><div className="settings-section-head"><div><h2>Import listening history</h2><p>Use Spotify Extended Streaming History for deeper historical coverage.</p></div></div>
      <div className="import-drop panel" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setFiles(Array.from(event.dataTransfer.files)); }}>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".json,.zip,application/json,application/zip" multiple onChange={event => setFiles(Array.from(event.target.files || []))} />
        <span className="import-icon"><FileUp size={21} /></span><strong>Bring in your Spotify archive</strong><p>Choose one or more JSON history files or a ZIP archive. Files are processed in batches and duplicate plays are merged.</p>
        <div className="import-buttons"><button className="button button-secondary" onClick={() => fileInput.current?.click()} disabled={importing}><Upload size={15} />Choose files</button>{files.length > 0 && <button className="button button-primary" onClick={importFiles} disabled={importing}>{importing ? <LoaderCircle size={15} className="spin" /> : <FileJson2 size={15} />}{importing ? `Importing ${progress?.sent.toLocaleString() || 0} / ${progress?.total.toLocaleString() || 0}` : `Import ${files.length} file${files.length === 1 ? '' : 's'}`}</button>}</div>
        {files.length > 0 && <div className="selected-files">{files.map(file => <span className="file-chip" key={`${file.name}-${file.size}`}><FileJson2 size={13} />{file.name}<button onClick={() => setFiles(files.filter(item => item !== file))} aria-label={`Remove ${file.name}`}><X size={13} /></button></span>)}</div>}
        {progress && progress.total > 0 && <div className="import-progress"><div><span style={{ width: `${Math.min(progress.sent / progress.total * 100, 100)}%` }} /></div><small>{Math.round(Math.min(progress.sent / progress.total * 100, 100))}% processed</small></div>}
      </div>
      <div className="settings-footnote"><CircleHelp size={15} /><span>In Spotify, request “Extended Streaming History” from your account privacy settings. Spotify’s recent-play feed is not a complete seven-day archive. Import this file for older plays and exact msPlayed durations when comparing totals with another app.</span></div>
    </section>

    <section className="settings-section"><div className="settings-section-head"><div><h2>Export analytics</h2><p>Download your listening records for your own archive.</p></div></div>
      <div className="settings-card panel"><div className="settings-card-icon"><HardDriveDownload size={19} /></div><div className="settings-card-copy"><strong>Export available history</strong><span>Includes timestamps, tracks, duration accuracy and source information.</span></div><div className="settings-actions"><button className="button button-secondary" onClick={() => exportData('csv')} disabled={!!working}>{working === 'export-csv' ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}CSV</button><button className="button button-secondary" onClick={() => exportData('json')} disabled={!!working}>{working === 'export-json' ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}JSON</button></div></div>
    </section>

    <section className="settings-section"><div className="settings-section-head"><div><h2>Preferences</h2><p>Choose how the dashboard appears on this device.</p></div></div>
      <button className="settings-card panel settings-action-row" onClick={changeTheme}><div className="settings-card-icon"><SunMoon size={19} /></div><div className="settings-card-copy"><strong>Appearance</strong><span>{theme === 'dark' ? 'Dark' : 'Light'} theme · Click to switch</span></div><ChevronRight size={17} /></button>
      <button className="settings-card panel settings-action-row danger-row" onClick={deleteHistory} disabled={working === 'delete'}><div className="settings-card-icon danger-icon"><Trash2 size={18} /></div><div className="settings-card-copy"><strong>Delete analytics data</strong><span>Remove imported and Spotify API listening records from this account.</span></div>{working === 'delete' ? <LoaderCircle className="spin" size={16} /> : <ChevronRight size={17} />}</button>
    </section>

    <div className="privacy-note"><ShieldCheck size={16} /><span><strong>Account privacy.</strong> Spotify access and database credentials are stored on the server and are not included in dashboard responses or exports.</span><LockKeyhole size={15} /></div>
  </div>;
}
