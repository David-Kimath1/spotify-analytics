const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const statsService = require('../services/statsService');
const spotifyService = require('../services/spotifyService');
const analyticsService = require('../services/analyticsService');
const ListeningActivity = require('../models/ListeningActivity');

router.use(authenticateToken);

function getRequestedRange(req, fallback = '30d') {
  const range = analyticsService.getRange(req.query.period || fallback, new Date(), req.query.from, req.query.to);
  if (Number.isNaN(new Date(range.start).getTime()) || Number.isNaN(new Date(range.end).getTime()) || new Date(range.start) >= new Date(range.end)) {
    const error = new Error('Choose a valid start and end date for the selected range.'); error.status = 400; throw error;
  }
  return range;
}

function sendError(res, error, message) {
  const status = error.status || 500;
  if (status === 429) res.set('Retry-After', String(error.retryAfter || 1));
  res.status(status).json({ error: status === 429 ? error.message : message });
}

async function optionalSpotifyMetadata(kind, load) {
  try {
    return { items: await load(), note: null };
  } catch (error) {
    console.error(`Spotify ${kind} metadata unavailable:`, error.response?.status || error.message);
    return {
      items: [],
      note: `Spotify ${kind} details could not be loaded right now. Listening history and totals are still available.`
    };
  }
}

async function withArtistArtwork(userId, rows) {
  const ids = rows.map(row => row.artistId).filter(Boolean);
  const result = await optionalSpotifyMetadata('artist', () => ids.length ? spotifyService.getArtistsByIds(userId, ids) : []);
  const artistsById = new Map(result.items.map(artist => [artist.id, artist]));
  return rows.map(row => {
    const artist = artistsById.get(row.artistId);
    return {
      ...row,
      image: artist?.images?.[0]?.url || null,
      genres: artist?.genres || [],
      followers: artist?.followers?.total ?? null,
      popularity: artist?.popularity ?? null,
      metadataNote: result.note
    };
  });
}

async function withTrackArtwork(userId, rows) {
  const getTrackId = row => row.trackId || row.trackIds?.find(Boolean);
  const ids = rows.filter(row => !row.image).map(getTrackId).filter(Boolean);
  const result = await optionalSpotifyMetadata('track artwork', () => ids.length ? spotifyService.getTracksByIds(userId, ids) : []);
  const tracksById = new Map(result.items.map(track => [track.id, track]));
  return rows.map(row => {
    const track = tracksById.get(getTrackId(row));
    return {
      ...row,
      image: row.image || track?.album?.images?.[0]?.url || null,
      metadataNote: !row.image && !track ? result.note : null
    };
  });
}

router.get('/overview', async (req, res) => {
  try {
    const period = req.query.period || '30d';
    const result = await analyticsService.overview(req.userId, getRequestedRange(req), period);
    const [topArtists, topTracks, topAlbums] = await Promise.all([
      withArtistArtwork(req.userId, result.topArtists),
      withTrackArtwork(req.userId, result.topTracks),
      withTrackArtwork(req.userId, result.topAlbums)
    ]);
    res.json({ ...result, topArtists, topTracks, topAlbums });
  } catch (error) { sendError(res, error, 'Failed to fetch analytics overview'); }
});

router.get('/stats', async (req, res) => {
  try { res.json(await statsService.getUserStats(req.userId, req.query.period)); }
  catch (error) { sendError(res, error, 'Failed to fetch listening statistics'); }
});

router.get('/lifetime', async (req, res) => {
  try { res.json(await analyticsService.overview(req.userId, analyticsService.getRange('lifetime'), 'lifetime')); }
  catch (error) { sendError(res, error, 'Failed to fetch lifetime analytics'); }
});

router.get('/daily', async (req, res) => {
  try {
    const day = req.query.date ? new Date(`${req.query.date}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(day.getTime())) return res.status(400).json({ error: 'Choose a valid day.' });
    const range = { start: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())), end: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1)) };
    const [summary, hours] = await Promise.all([
      analyticsService.overview(req.userId, range, req.query.date || 'today'),
      analyticsService.hourly(req.userId, range)
    ]);
    res.json({ ...summary, hours, firstListeningAt: summary.coverage.firstPlayedAt, lastListeningAt: summary.coverage.lastPlayedAt, peakListeningHour: hours.reduce((peak, hour) => hour.minutes > (peak?.minutes || -1) ? hour : peak, null)?.hour ?? null, topArtist: summary.topArtists[0] || null, topTrack: summary.topTracks[0] || null });
  } catch (error) { sendError(res, error, 'Failed to fetch daily analytics'); }
});

router.get('/weekly', async (req, res) => {
  try {
    const currentRange = analyticsService.getRange('week');
    const previousRange = { start: new Date(currentRange.start.getTime() - 7 * 24 * 60 * 60 * 1000), end: new Date(currentRange.end.getTime() - 7 * 24 * 60 * 60 * 1000) };
    const [current, previous] = await Promise.all([
      analyticsService.overview(req.userId, currentRange, 'week'),
      analyticsService.overview(req.userId, previousRange, 'previous-week')
    ]);
    const previousMinutes = previous.totals.totalMinutes;
    const changePercent = previousMinutes ? Number(((current.totals.totalMinutes - previousMinutes) / previousMinutes * 100).toFixed(1)) : null;
    res.json({ ...current, comparison: { previousMinutes, changePercent, previousWeek: previous } });
  } catch (error) { sendError(res, error, 'Failed to fetch weekly analytics'); }
});

router.get('/monthly', async (req, res) => {
  try {
    const month = req.query.month ? new Date(`${req.query.month}-01T00:00:00.000Z`) : new Date();
    if (Number.isNaN(month.getTime())) return res.status(400).json({ error: 'Choose a valid month.' });
    if (Number.isNaN(month.getTime())) return res.status(400).json({ error: 'Choose a valid month.' });
    const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const current = await analyticsService.overview(req.userId, { start, end }, req.query.month || 'current-month');
    const elapsed = Math.max(0, Math.min(Date.now(), end.getTime()) - start.getTime());
    const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
    const previousEnd = new Date(Math.min(previousStart.getTime() + (elapsed || end.getTime() - start.getTime()), start.getTime()));
    const previous = await analyticsService.overview(req.userId, { start: previousStart, end: previousEnd }, 'previous-month');
    const prior = previous.totals.totalMinutes;
    current.comparison = { previousMinutes: prior, changePercent: prior ? Number(((current.totals.totalMinutes - prior) / prior * 100).toFixed(1)) : null };
    res.json(current);
  } catch (error) { sendError(res, error, 'Failed to fetch monthly analytics'); }
});

router.get('/yearly', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    if (year < 1970 || year > new Date().getUTCFullYear() + 1) return res.status(400).json({ error: 'Choose an available year.' });
    const start = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const end = year === new Date().getUTCFullYear() ? new Date(Math.min(Date.now(), yearEnd.getTime())) : yearEnd;
    const result = await analyticsService.overview(req.userId, { start, end }, String(year));
    const previousStart = new Date(Date.UTC(year - 1, 0, 1));
    const previousEnd = new Date(Math.min(previousStart.getTime() + (end.getTime() - start.getTime()), start.getTime()));
    const previous = await analyticsService.overview(req.userId, { start: previousStart, end: previousEnd }, String(year - 1));
    const prior = previous.totals.totalMinutes;
    result.comparison = { previousYear: year - 1, previousMinutes: prior, changePercent: prior ? Number(((result.totals.totalMinutes - prior) / prior * 100).toFixed(1)) : null };
    res.json(result);
  } catch (error) { sendError(res, error, 'Failed to fetch yearly analytics'); }
});

router.get('/artists', async (req, res) => {
  try {
    const rows = await analyticsService.aggregateTop(analyticsService.matchFor(req.userId, getRequestedRange(req)), 'artists', req.query.limit || 50);
    res.json(await withArtistArtwork(req.userId, rows));
  } catch (error) { sendError(res, error, 'Failed to fetch artists'); }
});

router.get('/artists/:artistKey', async (req, res) => {
  try {
    const key = req.params.artistKey;
    const match = { userId: req.userId, $or: [{ 'artists.id': key }, { 'artists.name': key }, { artistName: key }] };
    const duration = analyticsService.listeningDurationExpression();
    const [stats, tracks, albums, timeline, history] = await Promise.all([
      ListeningActivity.aggregate([{ $match: match }, { $group: { _id: null, plays: { $sum: 1 }, durationMs: { $sum: duration }, exactMs: { $sum: { $cond: [{ $eq: ['$durationAccuracy', 'exact'] }, duration, 0] } }, firstPlayedAt: { $min: '$playedAt' }, lastPlayedAt: { $max: '$playedAt' } } }]).option({ allowDiskUse: true }),
      analyticsService.aggregateTop(match, 'tracks', 10),
      analyticsService.aggregateTop(match, 'albums', 10),
      ListeningActivity.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { date: '$playedAt', format: '%Y-%m', timezone: 'UTC' } }, minutes: { $sum: { $divide: [duration, 60000] } }, plays: { $sum: 1 } } }, { $sort: { _id: 1 } }]).option({ allowDiskUse: true }),
      ListeningActivity.find(match).sort({ playedAt: -1 }).limit(20).lean()
    ]);
    const row = stats[0];
    if (!row) return res.status(404).json({ error: 'No plays for this artist are available in your history.' });
    const artist = tracks[0]?.artist ? { name: tracks[0].artist } : { name: key };
    const metadataResult = /^[a-zA-Z0-9]{22}$/.test(key)
      ? await optionalSpotifyMetadata('artist', () => spotifyService.getArtistsByIds(req.userId, [key]))
      : { items: [], note: null };
    const metadata = metadataResult.items[0];
    const [artworkTracks, artworkAlbums] = await Promise.all([
      withTrackArtwork(req.userId, tracks),
      withTrackArtwork(req.userId, albums)
    ]);
    const uniqueTracks = await analyticsService.countUniqueTracks(match);
    res.json({
      id: key, name: metadata?.name || artist.name, image: metadata?.images?.[0]?.url || null,
      genres: metadata?.genres || [], popularity: metadata?.popularity ?? null, followers: metadata?.followers?.total ?? null,
      metadataNote: [metadataResult.note, artworkTracks.find(track => track.metadataNote)?.metadataNote, artworkAlbums.find(album => album.metadataNote)?.metadataNote].filter(Boolean).join(' ') || null,
      plays: row.plays, minutes: Number((row.durationMs / 60000).toFixed(1)), exactMinutes: Number((row.exactMs / 60000).toFixed(1)),
      firstPlayedAt: row.firstPlayedAt, lastPlayedAt: row.lastPlayedAt,
      uniqueTracks,
      topTracks: artworkTracks, albums: artworkAlbums, timeline: timeline.map(item => ({ month: item._id, minutes: Number(item.minutes.toFixed(1)), plays: item.plays })),
      history, coverage: await analyticsService.coverage(req.userId, match)
    });
  } catch (error) { sendError(res, error, 'Failed to fetch artist details'); }
});

router.get('/tracks', async (req, res) => {
  try {
    const rows = await analyticsService.aggregateTop(analyticsService.matchFor(req.userId, getRequestedRange(req)), 'tracks', req.query.limit || 50);
    const sort = req.query.sort;
    if (sort === 'minutes') rows.sort((a, b) => b.minutes - a.minutes);
    else if (sort === 'recent') rows.sort((a, b) => new Date(b.latest) - new Date(a.latest));
    else if (sort === 'artist') rows.sort((a, b) => String(a.artist).localeCompare(String(b.artist)));
    else if (sort === 'album') rows.sort((a, b) => String(a.album).localeCompare(String(b.album)));
    res.json(await withTrackArtwork(req.userId, rows));
  } catch (error) { sendError(res, error, 'Failed to fetch tracks'); }
});

router.get('/tracks/:trackKey', async (req, res) => {
  try {
    const key = req.params.trackKey;
    const match = { userId: req.userId, $or: [{ trackId: key }, { trackName: key }] };
    const duration = analyticsService.listeningDurationExpression();
    const [stats, timeline, history] = await Promise.all([
      ListeningActivity.aggregate([{ $match: match }, { $group: { _id: null, plays: { $sum: 1 }, durationMs: { $sum: duration }, firstPlayedAt: { $min: '$playedAt' }, lastPlayedAt: { $max: '$playedAt' }, name: { $first: '$trackName' }, artist: { $first: '$artistName' }, artistIds: { $first: '$artistIds' }, album: { $first: '$albumName' }, image: { $first: '$albumImage' }, trackDurationMs: { $max: '$trackDurationMs' }, exactPlays: { $sum: { $cond: [{ $eq: ['$durationAccuracy', 'exact'] }, 1, 0] } } } }]).option({ allowDiskUse: true }),
      ListeningActivity.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { date: '$playedAt', format: '%Y-%m', timezone: 'UTC' } }, minutes: { $sum: { $divide: [duration, 60000] } }, plays: { $sum: 1 } } }, { $sort: { _id: 1 } }]).option({ allowDiskUse: true }),
      ListeningActivity.find(match).sort({ playedAt: -1 }).limit(20).lean()
    ]);
    const row = stats[0];
    if (!row) return res.status(404).json({ error: 'No plays for this track are available in your history.' });
    let metadata = null;
    let metadataNote = null;
    if (/^[a-zA-Z0-9]{22}$/.test(key)) {
      const metadataResult = await optionalSpotifyMetadata('track', async () => {
        const track = await spotifyService.getTrackById(req.userId, key);
        return track ? [track] : [];
      });
      metadata = metadataResult.items[0] || null;
      metadataNote = metadataResult.note;
    }
    res.json({
      id: key, name: metadata?.name || row.name, artist: metadata?.artists?.map(item => item.name).join(', ') || row.artist,
      album: metadata?.album?.name || row.album, image: metadata?.album?.images?.[0]?.url || row.image || null,
      metadataNote,
      trackDurationMs: metadata?.duration_ms || row.trackDurationMs || null, plays: row.plays,
      minutes: Number((row.durationMs / 60000).toFixed(1)), exactPlays: row.exactPlays,
      firstPlayedAt: row.firstPlayedAt, lastPlayedAt: row.lastPlayedAt,
      listeningFrequency: timeline.map(item => ({ month: item._id, plays: item.plays, minutes: Number(item.minutes.toFixed(1)) })),
      history, coverage: await analyticsService.coverage(req.userId, match)
    });
  } catch (error) { sendError(res, error, 'Failed to fetch track details'); }
});

router.get('/albums', async (req, res) => {
  try {
    const rows = await analyticsService.aggregateTop(analyticsService.matchFor(req.userId, getRequestedRange(req)), 'albums', req.query.limit || 50);
    const artworkRows = await withTrackArtwork(req.userId, rows);
    res.json(artworkRows.map(row => {
      const { trackIds, ...album } = row;
      return album;
    }));
  }
  catch (error) { sendError(res, error, 'Failed to fetch albums'); }
});

router.get('/genres', async (req, res) => {
  try {
    const match = analyticsService.matchFor(req.userId, getRequestedRange(req));
    const [artists, summary] = await Promise.all([
      analyticsService.aggregateTop(match, 'artists', 50),
      analyticsService.overview(req.userId, getRequestedRange(req), req.query.period || '30d')
    ]);
    const artistIds = artists.map(row => row.artistId).filter(Boolean);
    const metadataResult = await optionalSpotifyMetadata('artist genre', () => artistIds.length ? spotifyService.getArtistsByIds(req.userId, artistIds) : []);
    const genres = new Map();
    for (const artist of artists) {
      const artistGenres = metadataResult.items.find(item => item.id === artist.artistId)?.genres || [];
      for (const genre of artistGenres) {
        const item = genres.get(genre) || { name: genre, plays: 0, minutes: 0 };
        item.plays += artist.plays / Math.max(artistGenres.length, 1);
        item.minutes += artist.minutes / Math.max(artistGenres.length, 1);
        genres.set(genre, item);
      }
    }
    const result = [...genres.values()].sort((a, b) => b.plays - a.plays).map(item => ({ ...item, plays: Math.round(item.plays), minutes: Number(item.minutes.toFixed(1)) }));
    const total = result.reduce((sum, item) => sum + item.plays, 0);
    res.json({ genres: result, totalAttributedPlays: total, summary: summary.totals, coverage: summary.coverage, metadataNote: metadataResult.note, note: result.length ? 'Genres come from current Spotify artist metadata and are attributed across each artist’s listed genres.' : metadataResult.note || 'Spotify genre metadata is not available for these plays. Listening totals are still available.' });
  } catch (error) { sendError(res, error, 'Failed to fetch genres'); }
});

router.get('/patterns', async (req, res) => {
  try {
    const range = getRequestedRange(req, 'lifetime');
    const [patterns, summary] = await Promise.all([analyticsService.patterns(req.userId, range), analyticsService.overview(req.userId, range, req.query.period || 'lifetime')]);
    res.json({ ...patterns, summary: summary.totals, coverage: summary.coverage });
  } catch (error) { sendError(res, error, 'Failed to fetch listening patterns'); }
});

router.get('/records', async (req, res) => {
  try { res.json(await analyticsService.records(req.userId, getRequestedRange(req, 'lifetime'))); }
  catch (error) { sendError(res, error, 'Failed to fetch listening records'); }
});

router.get('/discovery', async (req, res) => {
  try {
    const data = await analyticsService.discovery(req.userId, getRequestedRange(req, 'lifetime'));
    const [artists, tracks] = await Promise.all([
      withArtistArtwork(req.userId, data.artists),
      withTrackArtwork(req.userId, data.tracks)
    ]);
    res.json({
      ...data,
      artists,
      tracks,
      metadataNote: [artists.find(artist => artist.metadataNote)?.metadataNote, tracks.find(track => track.metadataNote)?.metadataNote].filter(Boolean).join(' ')
    });
  }
  catch (error) { sendError(res, error, 'Failed to fetch discovery data'); }
});

router.get('/top-artists', async (req, res) => {
  try { res.json(await spotifyService.getTopItems(req.userId, 'artists', req.query.limit || 20, req.query.timeRange || 'medium_term')); }
  catch (error) { sendError(res, error, 'Failed to fetch Spotify top artists'); }
});

router.get('/top-tracks', async (req, res) => {
  try { res.json(await spotifyService.getTopItems(req.userId, 'tracks', req.query.limit || 20, req.query.timeRange || 'medium_term')); }
  catch (error) { sendError(res, error, 'Failed to fetch Spotify top tracks'); }
});

router.get('/recently-played', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const activities = await ListeningActivity.find({ userId: req.userId }).sort({ playedAt: -1 }).limit(limit).lean();
    res.json(activities);
  } catch (error) { sendError(res, error, 'Failed to fetch recent activity'); }
});

router.get('/currently-playing', async (req, res) => {
  try { res.json(await spotifyService.getCurrentPlaying(req.userId)); }
  catch (error) { sendError(res, error, 'Failed to fetch current playback'); }
});

router.get('/listening-history', async (req, res) => {
  try {
    const range = getRequestedRange(req, 'lifetime');
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const match = analyticsService.matchFor(req.userId, range);
    const [history, total] = await Promise.all([
      ListeningActivity.find(match).sort({ playedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ListeningActivity.countDocuments(match)
    ]);
    res.json({ items: history, page, limit, total, pages: Math.ceil(total / limit), coverage: await analyticsService.coverage(req.userId, match) });
  } catch (error) { sendError(res, error, 'Failed to fetch listening history'); }
});

function getRecordValue(record, keys) {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  return null;
}

function spotifyIdFromUri(uri) {
  if (typeof uri !== 'string') return undefined;
  const match = uri.match(/spotify:(?:track|artist|album):([a-zA-Z0-9]+)/) || uri.match(/open\.spotify\.com\/(?:track|artist|album)\/([a-zA-Z0-9]+)/);
  return match?.[1];
}

function normalizeImportRecord(input, userId) {
  const playedAtRaw = getRecordValue(input, ['endTime', 'ts', 'playedAt', 'played_at']);
  const playedAt = playedAtRaw ? new Date(playedAtRaw) : null;
  const trackName = getRecordValue(input, ['trackName', 'master_metadata_track_name', 'track_name', 'name']);
  const artistValue = getRecordValue(input, ['artistName', 'master_metadata_album_artist_name', 'artist_name', 'artist']);
  const artistName = Array.isArray(artistValue) ? artistValue.map(x => typeof x === 'string' ? x : x.name).filter(Boolean).join(', ') : artistValue;
  const albumName = getRecordValue(input, ['albumName', 'master_metadata_album_album_name', 'album_name']);
  const trackUri = getRecordValue(input, ['spotify_track_uri', 'trackUri', 'uri']);
  const trackId = getRecordValue(input, ['trackId', 'track_id']) || spotifyIdFromUri(trackUri);
  const duration = Number(getRecordValue(input, ['msPlayed', 'ms_played', 'playedDurationMs'])) || 0;
  if (!playedAt || Number.isNaN(playedAt.getTime()) || !trackName || !artistName) return null;
  const dedupeKey = crypto.createHash('sha256').update(`${trackId || `${trackName}|${artistName}`}|${playedAt.toISOString()}`).digest('hex');
  const artistIds = Array.isArray(input.artistIds) ? input.artistIds : (Array.isArray(input.artist_uris) ? input.artist_uris.map(spotifyIdFromUri).filter(Boolean) : []);
  return {
    userId,
    trackId: trackId || undefined,
    trackName: String(trackName),
    artistName: String(artistName),
    artistIds,
    artists: artistIds.length ? artistIds.map((id, index) => ({ id, name: String(artistName).split(',')[index]?.trim() || String(artistName) })) : [{ name: String(artistName) }],
    albumId: spotifyIdFromUri(getRecordValue(input, ['spotify_album_uri', 'albumUri'])),
    albumName: albumName ? String(albumName) : undefined,
    playedAt,
    playedDurationMs: duration,
    duration: duration,
    durationAccuracy: 'exact',
    platform: getRecordValue(input, ['platform', 'Platform']) || undefined,
    skipped: typeof input.skipped === 'boolean' ? input.skipped : (input.reason_end === 'fwdbtn' || input.reason_end === 'trackdone' ? input.reason_end === 'fwdbtn' : undefined),
    source: 'extended-history',
    dedupeKey
  };
}

router.post('/import', async (req, res) => {
  try {
    const records = req.body?.records || req.body?.history;
    if (!Array.isArray(records) || !records.length) return res.status(400).json({ error: 'Send a non-empty array of Spotify Extended History records.' });
    if (records.length > 2000) return res.status(413).json({ error: 'Import batches can contain at most 2,000 records.' });
    const normalized = records.map(record => normalizeImportRecord(record, req.userId)).filter(Boolean);
    if (!normalized.length) return res.status(400).json({ error: 'No valid play records were found. Check that the file contains Spotify Extended Streaming History JSON.' });
    const operations = normalized.map(record => {
      const { sources, dedupeKey, playedDurationMs, duration, durationAccuracy, platform, skipped, ...insert } = record;
      const legacyEvent = record.trackId
        ? { dedupeKey: { $exists: false }, trackId: record.trackId, playedAt: record.playedAt }
        : { dedupeKey: { $exists: false }, trackName: record.trackName, artistName: record.artistName, playedAt: record.playedAt };
      return { updateOne: {
        filter: { userId: req.userId, $or: [{ dedupeKey: record.dedupeKey }, legacyEvent] },
        update: {
          $setOnInsert: insert,
          $set: { dedupeKey: record.dedupeKey, playedDurationMs: record.playedDurationMs, duration: record.duration, durationAccuracy: 'exact', ...(record.platform ? { platform: record.platform } : {}), ...(record.skipped !== undefined ? { skipped: record.skipped } : {}) },
          $addToSet: { sources: 'extended-history' }
        },
        upsert: true
      } };
    });
    const result = await ListeningActivity.bulkWrite(operations, { ordered: false });
    res.json({ received: records.length, valid: normalized.length, inserted: result.upsertedCount || 0, merged: (result.modifiedCount || 0), invalid: records.length - normalized.length });
  } catch (error) { sendError(res, error, 'Failed to import listening history'); }
});

router.delete('/data', async (req, res) => {
  try {
    const result = await ListeningActivity.deleteMany({ userId: req.userId });
    res.json({ deleted: result.deletedCount || 0 });
  } catch (error) { sendError(res, error, 'Failed to delete analytics data'); }
});

router.get('/export', async (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const range = getRequestedRange(req, 'lifetime');
  const cursor = ListeningActivity.find(analyticsService.matchFor(req.userId, range)).sort({ playedAt: -1 }).lean().cursor();
  res.set('Content-Disposition', `attachment; filename="spotify-analytics-${new Date().toISOString().slice(0, 10)}.${format}"`);
  res.set('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8');
  const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  if (format === 'csv') res.write('playedAt,trackName,artistName,albumName,playedDurationMs,durationAccuracy,platform,source\n');
  else res.write('[');
  let first = true;
  try {
    for await (const row of cursor) {
      const output = format === 'csv'
        ? [row.playedAt?.toISOString(), row.trackName, row.artistName, row.albumName, row.playedDurationMs ?? row.duration ?? 0, row.durationAccuracy || 'estimated', row.platform, (row.sources || [row.source]).filter(Boolean).join('|')].map(escapeCsv).join(',') + '\n'
        : `${first ? '' : ','}${JSON.stringify({ playedAt: row.playedAt, trackId: row.trackId, trackName: row.trackName, artistName: row.artistName, albumName: row.albumName, playedDurationMs: row.playedDurationMs ?? row.duration ?? 0, durationAccuracy: row.durationAccuracy || 'estimated', platform: row.platform, sources: row.sources || [row.source] })}`;
      res.write(output);
      first = false;
    }
    if (format === 'json') res.write(']');
    res.end();
  } catch (error) {
    if (!res.headersSent) sendError(res, error, 'Failed to export analytics');
    else res.end();
  }
});

module.exports = router;
