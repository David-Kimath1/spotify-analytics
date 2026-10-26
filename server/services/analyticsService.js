const ListeningActivity = require('../models/ListeningActivity');
const User = require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function subtractMonths(date, amount) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - amount);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function getRange(period = '30d', now = new Date(), customFrom, customTo) {
  const end = customTo ? new Date(customTo) : new Date(now);
  if (customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo)) end.setUTCDate(end.getUTCDate() + 1);
  const start = customFrom ? new Date(customFrom) : new Date(end);
  if (customFrom || customTo) {
    if (!customFrom) start.setTime(end.getTime() - 30 * DAY_MS);
    if (!customTo) end.setTime(now.getTime());
    return { start, end };
  }
  switch (period) {
    case 'today': return { start: startOfUtcDay(now), end: new Date(now) };
    case 'yesterday': {
      const endOfYesterday = startOfUtcDay(now);
      return { start: new Date(endOfYesterday.getTime() - DAY_MS), end: endOfYesterday };
    }
    case '7d': return { start: new Date(end.getTime() - 7 * DAY_MS), end };
    case 'week': {
      const start = startOfUtcDay(now);
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      return { start, end };
    }
    case 'previous-week': {
      const end = startOfUtcDay(now);
      end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7));
      const start = new Date(end.getTime() - 7 * DAY_MS);
      return { start, end };
    }
    case '30d': case 'month': return { start: new Date(end.getTime() - 30 * DAY_MS), end };
    case '3m': return { start: subtractMonths(end, 3), end };
    case '6m': return { start: subtractMonths(end, 6), end };
    case '12m': case 'year': return { start: subtractMonths(end, 12), end };
    case 'lifetime': case 'all': return { start: new Date(0), end };
    default: return { start: new Date(end.getTime() - 30 * DAY_MS), end };
  }
}

function matchFor(userId, range) {
  const match = { userId };
  if (range) match.playedAt = { $gte: new Date(range.start), $lt: new Date(range.end) };
  return match;
}

function listeningDurationExpression() {
  const exactDuration = { $ifNull: ['$playedDurationMs', { $ifNull: ['$duration', 0] }] };
  return {
    $cond: [
      { $eq: ['$durationAccuracy', 'exact'] },
      exactDuration,
      {
        $cond: [
          { $gt: [{ $ifNull: ['$playedDurationMs', 0] }, 0] },
          '$playedDurationMs',
          {
            $cond: [
              { $gt: [{ $ifNull: ['$duration', 0] }, 0] },
              '$duration',
              { $ifNull: ['$trackDurationMs', 0] }
            ]
          }
        ]
      }
    ]
  };
}

async function countDistinct(match, field) {
  const rows = await ListeningActivity.aggregate([
    { $match: match },
    { $match: { [field]: { $nin: [null, ''] } } },
    { $group: { _id: `$${field}` } },
    { $count: 'count' }
  ]).option({ allowDiskUse: true });
  return rows[0]?.count || 0;
}

async function countUniqueTracks(match) {
  const rows = await ListeningActivity.aggregate([
    { $match: match },
    { $group: { _id: { $ifNull: ['$trackId', { $concat: [{ $ifNull: ['$trackName', 'Unknown track'] }, '|', { $ifNull: ['$artistName', ''] }] }] } } },
    { $count: 'count' }
  ]).option({ allowDiskUse: true });
  return rows[0]?.count || 0;
}

async function coverage(userId, match) {
  const [totals, user, mergedSources, legacySources] = await Promise.all([
    ListeningActivity.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalRecords: { $sum: 1 },
        exactRecords: { $sum: { $cond: [{ $eq: ['$durationAccuracy', 'exact'] }, 1, 0] } },
        estimatedRecords: { $sum: { $cond: [{ $eq: ['$durationAccuracy', 'exact'] }, 0, 1] } },
        firstPlayedAt: { $min: '$playedAt' },
        lastPlayedAt: { $max: '$playedAt' },
        sources: { $addToSet: { $ifNull: ['$source', 'spotify-api'] } }
      } }
    ]).option({ allowDiskUse: true }),
    User.findById(userId).select('createdAt lastSyncAt').lean(),
    ListeningActivity.distinct('sources', match),
    ListeningActivity.distinct('source', match)
  ]);
  const row = totals[0] || {};
  const sources = [...new Set([...mergedSources.flat(Infinity), ...legacySources].filter(Boolean))];
  return {
    totalRecords: row.totalRecords || 0,
    exactRecords: row.exactRecords || 0,
    estimatedRecords: row.estimatedRecords || 0,
    firstPlayedAt: row.firstPlayedAt || null,
    lastPlayedAt: row.lastPlayedAt || null,
    sources: sources.length ? sources : row.sources || [],
    lastSyncAt: user?.lastSyncAt || null,
    accountCreatedAt: user?.createdAt || null,
    note: row.totalRecords
      ? 'Spotify API history only includes plays captured by this app and recent history currently available from Spotify. Imported Extended Streaming History can provide older records. Listening time from Spotify API records is estimated from track length.'
      : 'No listening records are available yet. Sync recent Spotify activity or import Spotify Extended Streaming History.'
  };
}

async function aggregateTop(match, kind, limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const duration = listeningDurationExpression();
  let pipeline;
  if (kind === 'artists') {
    pipeline = [
      { $match: match },
      { $unwind: { path: '$artists', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: { $ifNull: ['$artists.id', { $ifNull: ['$artistName', 'Unknown artist'] }] },
        name: { $first: { $ifNull: ['$artists.name', { $ifNull: ['$artistName', 'Unknown artist'] }] } },
        artistId: { $first: '$artists.id' },
        plays: { $sum: 1 },
        minutes: { $sum: { $divide: [duration, 60000] } },
        trackIds: { $addToSet: { $ifNull: ['$trackId', { $concat: [{ $ifNull: ['$trackName', 'Unknown track'] }, '|', { $ifNull: ['$artistName', ''] }] }] } },
        albumNames: { $addToSet: '$albumName' }
      } },
      { $project: { _id: 0, id: '$_id', name: 1, artistId: 1, plays: 1, minutes: { $round: ['$minutes', 1] }, tracks: { $size: '$trackIds' }, albums: { $size: '$albumNames' } } },
      { $sort: { plays: -1, minutes: -1 } }, { $limit: safeLimit }
    ];
  } else if (kind === 'tracks') {
    pipeline = [
      { $match: match },
      { $group: {
        _id: { $ifNull: ['$trackId', { $concat: [{ $ifNull: ['$trackName', 'Unknown track'] }, '|', { $ifNull: ['$artistName', ''] }] }] },
        trackId: { $first: '$trackId' }, name: { $first: '$trackName' }, artist: { $first: '$artistName' },
        album: { $first: '$albumName' }, image: { $first: '$albumImage' },
        plays: { $sum: 1 }, minutes: { $sum: { $divide: [duration, 60000] } }, latest: { $max: '$playedAt' }
      } },
      { $project: { _id: 0, id: { $ifNull: ['$trackId', '$_id'] }, trackId: 1, name: 1, artist: 1, album: 1, image: 1, plays: 1, minutes: { $round: ['$minutes', 1] }, latest: 1 } },
      { $sort: { plays: -1, minutes: -1 } }, { $limit: safeLimit }
    ];
  } else {
    pipeline = [
      { $match: match },
      { $group: { _id: { album: { $ifNull: ['$albumId', '$albumName'] }, artist: '$artistName' }, name: { $first: '$albumName' }, artist: { $first: '$artistName' }, image: { $first: '$albumImage' }, tracks: { $addToSet: { $ifNull: ['$trackId', '$trackName'] } }, trackIds: { $addToSet: '$trackId' }, plays: { $sum: 1 }, minutes: { $sum: { $divide: [duration, 60000] } } } },
      { $project: { _id: 0, id: { $toString: '$_id.album' }, name: 1, artist: 1, image: 1, trackIds: 1, tracks: { $size: '$tracks' }, plays: 1, minutes: { $round: ['$minutes', 1] } } },
      { $sort: { plays: -1, minutes: -1 } }, { $limit: safeLimit }
    ];
  }
  return ListeningActivity.aggregate(pipeline).option({ allowDiskUse: true });
}

async function overview(userId, range, period) {
  const match = matchFor(userId, range);
  const duration = listeningDurationExpression();
  const [totals, uniqueTracks, uniqueArtists, uniqueAlbums, artists, tracks, albums, byDay, dataCoverage] = await Promise.all([
    ListeningActivity.aggregate([{ $match: match }, { $group: { _id: null, plays: { $sum: 1 }, playedDurationMs: { $sum: duration }, exactDurationMs: { $sum: { $cond: [{ $eq: ['$durationAccuracy', 'exact'] }, duration, 0] } }, estimatedDurationMs: { $sum: { $cond: [{ $eq: ['$durationAccuracy', 'exact'] }, 0, duration] } } } }]).option({ allowDiskUse: true }),
    countUniqueTracks(match),
    ListeningActivity.aggregate([{ $match: match }, { $unwind: { path: '$artists', preserveNullAndEmptyArrays: true } }, { $group: { _id: { $ifNull: ['$artists.id', '$artistName'] } } }, { $count: 'count' }]).option({ allowDiskUse: true }),
    countDistinct(match, 'albumName'),
    aggregateTop(match, 'artists', 8),
    aggregateTop(match, 'tracks', 8),
    aggregateTop(match, 'albums', 8),
    ListeningActivity.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { date: '$playedAt', format: '%Y-%m-%d', timezone: 'UTC' } }, minutes: { $sum: { $divide: [duration, 60000] } }, tracks: { $sum: 1 } } },
      { $sort: { _id: 1 } }, { $limit: 5000 }
    ]).option({ allowDiskUse: true }),
    coverage(userId, match)
  ]);
  const totalsRow = totals[0] || {};
  const minutes = Math.round((totalsRow.playedDurationMs || 0) / 60000);
  return {
    period,
    range: { start: range.start, end: range.end },
    totals: {
      totalMinutes: minutes,
      totalHours: Number((minutes / 60).toFixed(1)),
      totalDays: Number((minutes / 1440).toFixed(1)),
      tracksPlayed: totalsRow.plays || 0,
      uniqueTracks,
      uniqueArtists: uniqueArtists[0]?.count || 0,
      uniqueAlbums,
      exactMinutes: Math.round((totalsRow.exactDurationMs || 0) / 60000),
      estimatedMinutes: Math.round((totalsRow.estimatedDurationMs || 0) / 60000)
    },
    topArtists: artists,
    topTracks: tracks,
    topAlbums: albums,
    timeline: byDay.map(row => ({ date: row._id, minutes: Number(row.minutes.toFixed(1)), tracks: row.tracks })),
    coverage: dataCoverage
  };
}

async function patterns(userId, range) {
  const match = matchFor(userId, range);
  const duration = listeningDurationExpression();
  const rows = await ListeningActivity.aggregate([
    { $match: match },
    { $group: { _id: { day: { $subtract: [{ $dayOfWeek: { date: '$playedAt', timezone: 'UTC' } }, 1] }, hour: { $hour: { date: '$playedAt', timezone: 'UTC' } } }, minutes: { $sum: { $divide: [duration, 60000] } }, tracks: { $sum: 1 }, artists: { $addToSet: '$artistName' } } }
  ]).option({ allowDiskUse: true });
  const cells = Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => ({ day, hour, minutes: 0, tracks: 0, artists: 0 })));
  for (const row of rows) {
    const cell = cells[row._id.day][row._id.hour];
    cell.minutes = Number(row.minutes.toFixed(1)); cell.tracks = row.tracks; cell.artists = row.artists.filter(Boolean).length;
  }
  return { cells: cells.flat(), timezone: 'UTC' };
}

async function hourly(userId, range) {
  const rows = await ListeningActivity.aggregate([
    { $match: matchFor(userId, range) },
    { $group: { _id: { $hour: { date: '$playedAt', timezone: 'UTC' } }, minutes: { $sum: { $divide: [listeningDurationExpression(), 60000] } }, tracks: { $sum: 1 }, artists: { $addToSet: '$artistName' } } }
  ]).option({ allowDiskUse: true });
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: 0, tracks: 0, artists: 0 }));
  for (const row of rows) byHour[row._id] = { hour: row._id, minutes: Number(row.minutes.toFixed(1)), tracks: row.tracks, artists: row.artists.filter(Boolean).length };
  return byHour;
}

async function discovery(userId, range) {
  const match = matchFor(userId);
  const inRange = range ? { $match: { firstPlayedAt: { $gte: new Date(range.start), $lt: new Date(range.end) } } } : null;
  const artistPipeline = [
    { $match: match }, { $unwind: { path: '$artists', preserveNullAndEmptyArrays: true } },
    { $group: { _id: { $ifNull: ['$artists.id', '$artistName'] }, name: { $first: { $ifNull: ['$artists.name', '$artistName'] } }, artistId: { $first: '$artists.id' }, firstPlayedAt: { $min: '$playedAt' }, plays: { $sum: 1 } } },
    ...(inRange ? [inRange] : []), { $sort: { firstPlayedAt: -1 } }, { $limit: 50 }
  ];
  const trackPipeline = [
    { $match: match },
    { $group: { _id: { $ifNull: ['$trackId', { $concat: [{ $ifNull: ['$trackName', 'Unknown track'] }, '|', { $ifNull: ['$artistName', ''] }] }] }, trackId: { $first: '$trackId' }, name: { $first: '$trackName' }, artist: { $first: '$artistName' }, album: { $first: '$albumName' }, image: { $first: '$albumImage' }, firstPlayedAt: { $min: '$playedAt' }, plays: { $sum: 1 } } },
    ...(inRange ? [inRange] : []), { $sort: { firstPlayedAt: -1 } }, { $limit: 50 }
  ];
  const [artists, tracks] = await Promise.all([ListeningActivity.aggregate(artistPipeline).option({ allowDiskUse: true }), ListeningActivity.aggregate(trackPipeline).option({ allowDiskUse: true })]);
  return { artists, tracks, note: 'First seen is based on the earliest play currently stored for this account. It can predate app connection when Extended Streaming History is imported.' };
}

async function records(userId, range) {
  const match = matchFor(userId, range);
  const duration = listeningDurationExpression();
  const [daily, sessions] = await Promise.all([
    ListeningActivity.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { date: '$playedAt', format: '%Y-%m-%d', timezone: 'UTC' } }, minutes: { $sum: { $divide: [duration, 60000] } }, tracks: { $sum: 1 }, artists: { $addToSet: '$artistName' } } },
      { $sort: { _id: 1 } }
    ]).option({ allowDiskUse: true }),
    ListeningActivity.aggregate([
      { $match: match }, { $sort: { playedAt: 1 } },
      { $setWindowFields: { sortBy: { playedAt: 1 }, output: { previousPlayedAt: { $shift: { output: '$playedAt', by: -1 } } } } },
      { $set: { newSession: { $cond: [{ $or: [{ $eq: ['$previousPlayedAt', null] }, { $gt: [{ $subtract: ['$playedAt', '$previousPlayedAt'] }, 30 * 60 * 1000] }] }, 1, 0] } } },
      { $setWindowFields: { sortBy: { playedAt: 1 }, output: { sessionId: { $sum: '$newSession', window: { documents: ['unbounded', 'current'] } } } } },
      { $group: { _id: '$sessionId', startedAt: { $min: '$playedAt' }, endedAt: { $max: '$playedAt' }, tracks: { $sum: 1 }, recordedDurationMs: { $sum: duration } } },
      { $facet: {
        summary: [{ $group: { _id: null, sessions: { $sum: 1 }, durationMs: { $sum: '$recordedDurationMs' } } }],
        longest: [{ $sort: { recordedDurationMs: -1 } }, { $limit: 1 }]
      } }
    ]).option({ allowDiskUse: true })
  ]);
  let longestStreak = 0; let streak = 0; let previous = null;
  for (const day of daily) {
    const current = new Date(`${day._id}T00:00:00.000Z`).getTime();
    streak = previous !== null && current - previous === DAY_MS ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak); previous = current;
  }
  const highestMinutesDay = daily.reduce((best, day) => !best || day.minutes > best.minutes ? { date: day._id, minutes: Math.round(day.minutes) } : best, null);
  const highestTracksDay = daily.reduce((best, day) => !best || day.tracks > best.tracks ? { date: day._id, tracks: day.tracks } : best, null);
  const topArtists = await aggregateTop(match, 'artists', 1);
  const topTracks = await aggregateTop(match, 'tracks', 1);
  const sessionSummary = sessions[0]?.summary?.[0] || {};
  const longestSession = sessions[0]?.longest?.[0] || null;
  return {
    longestStreak, highestMinutesDay, highestTracksDay,
    mostPlayedArtist: topArtists[0] || null,
    mostPlayedTrack: topTracks[0] || null,
    days: daily.length,
    sessionCount: sessionSummary.sessions || 0,
    averageSessionMinutes: sessionSummary.sessions ? Number((sessionSummary.durationMs / sessionSummary.sessions / 60000).toFixed(1)) : 0,
    longestSession: longestSession ? { startedAt: longestSession.startedAt, endedAt: longestSession.endedAt, minutes: Number((longestSession.recordedDurationMs / 60000).toFixed(1)), tracks: longestSession.tracks } : null,
    sessionDefinition: 'Adjacent play records less than 30 minutes apart are grouped into one session. Session duration sums recorded play durations, so Spotify API time is estimated.'
  };
}

module.exports = { getRange, matchFor, overview, aggregateTop, countUniqueTracks, patterns, hourly, discovery, records, coverage, listeningDurationExpression };
