/**
 * FRIDGEBOARD — the Google side.
 *
 * One small script, bound to one Google Sheet, that the fridge talks to:
 *   - reads your Google Calendars live (Google expands repeating events, moved and cancelled
 *     instances, and time zones for us),
 *   - fetches the weather from Open-Meteo (no API key),
 *   - lists tonight's NFL, NBA and college football games on TV from ESPN's public scoreboard
 *     (no key),
 *   - runs the "We're out" kitchen list stored in this Sheet.
 *
 * Nothing personal lives in this file. The access key sits in Script Properties, and your
 * choices (which calendars, your town for weather) sit in the Sheet's Settings and Calendars tabs.
 *
 * Setup: paste into Extensions → Apps Script, run setup(), then Deploy → Web app
 * (Execute as: Me, Who has access: Anyone). Full steps: PROGRESS.md in the repo.
 */

var FB = {
  version: 1,
  defaultTz: 'America/New_York',
  // Sports calendars whose name contains one of these start ticked on. Edit freely.
  defaultOnTeams: ['Steelers'],
  inks: {
    personal: '#2A54B0', family: '#21663D', sports: '#FFB612',
    holidays: '#6A3EA6', travel: '#5F5E5A', other: '#5F5E5A'
  },
  sportsAccent: '#101820',
  kinds: ['personal', 'family', 'sports', 'holidays', 'travel', 'other'],
  undoSeconds: 30,
  boardCacheSeconds: 120,
  weatherCacheSeconds: 1200,
  keepGotItHours: 24,
  tripJoinHours: 18,
  maxNameLength: 60,
  // "On TV tonight": NFL and NBA games show when one of these networks carries them. The Sheet's
  // tvNetworks row replaces this list when it's filled in.
  tvNetworks: ['ABC', 'CBS', 'NBC', 'FOX', 'ESPN', 'ESPN2', 'TNT', 'TBS', 'truTV', 'NFL Network', 'NBA TV',
    'Prime Video', 'Peacock', 'Netflix', 'FS1'],
  // College football shows a game on one of these even when neither team is ranked.
  tvBigNetworks: ['ABC', 'CBS', 'NBC', 'FOX'],
  // A ranked college game also counts as on TV on these.
  tvCollegeNetworks: ['ESPNU', 'SEC Network', 'BTN', 'ACC Network', 'CBS Sports Network', 'FS2', 'The CW'],
  tvMax: 8,
  tvCacheSeconds: 1200
};

// ESPN's free scoreboard JSON (unofficial, no key). The fridge never calls it; this script does.
var TV_LEAGUES = {
  nfl: { path: 'football/nfl', extra: '' },
  nba: { path: 'basketball/nba', extra: '' },
  cfb: { path: 'football/college-football', extra: '&groups=80&limit=300' }
};

// How ESPN (and people typing in the Sheet) spell the networks, squashed to letters and digits.
var TV_ALIASES = {
  nflnet: 'NFL Network', nflnetwork: 'NFL Network', nfln: 'NFL Network',
  prime: 'Prime Video', primevideo: 'Prime Video', amazon: 'Prime Video', amazonprime: 'Prime Video', amazonprimevideo: 'Prime Video',
  nbatv: 'NBA TV', trutv: 'truTV', fox: 'FOX', foxsports1: 'FS1', fs1: 'FS1', fs2: 'FS2',
  secn: 'SEC Network', secnetwork: 'SEC Network', btn: 'BTN', bigtennetwork: 'BTN',
  accn: 'ACC Network', accnetwork: 'ACC Network', cbssn: 'CBS Sports Network', cbssportsnetwork: 'CBS Sports Network',
  cw: 'The CW', thecw: 'The CW', cwnetwork: 'The CW', espnu: 'ESPNU', espn2: 'ESPN2', espn: 'ESPN',
  abc: 'ABC', cbs: 'CBS', nbc: 'NBC', tnt: 'TNT', tbs: 'TBS', peacock: 'Peacock', netflix: 'Netflix'
};

var TAB = { settings: 'Settings', calendars: 'Calendars', items: 'Items', needed: 'Needed', log: 'Log' };

var SETTINGS_DEFAULTS = [
  ['weatherPlace', '', 'Your town or ZIP, e.g. Pittsburgh. setup() looks up lat/lon from it.'],
  ['lat', '', 'Filled in for you from weatherPlace (or type your own).'],
  ['lon', '', ''],
  ['timezone', FB.defaultTz, 'Everything on the fridge shows in this time zone.'],
  ['daysAhead', 14, 'How many days of events to send.'],
  ['jacketBelowF', 55, '"Jacket weather" when it gets colder than this in the next 12 hours.'],
  ['rainGearAbovePct', 50, '"Rain gear" when the chance of rain in the next 12 hours reaches this.'],
  ['hideObservances', true, 'Hide holiday observances like Black Friday; keep public holidays.'],
  ['awayLabel', "Dad's away", 'What the fridge says during a trip.'],
  ['travelKeywords', 'flight, hotel', 'On personal calendars, events with these words become a trip. Their details never leave this Sheet.'],
  ['hideKeywords', '', 'Events with these words stay off the fridge (for example work words).'],
  ['nightStartHour', 22, 'Night mode starts at this hour (0-23): dim clock and tomorrow\'s first event.'],
  ['nightEndHour', 6, 'Night mode ends at this hour.'],
  ['tomorrowPeekHour', 18, 'After this hour, Tomorrow gets more room than Today.'],
  ['staleAfterMinutes', 120, 'Show an amber "old data" banner after this long without fresh data.'],
  ['tvLeagues', 'nfl, nba, cfb', 'On TV tonight: which leagues to list (nfl, nba, cfb). Type none to hide the card.'],
  ['tvNetworks', '', 'Optional: the NFL/NBA networks to list, comma separated. Blank = ' + FB.tvNetworks.join(', ') + '.']
];

var CAL_HEADERS = ['On', 'Label', 'Kind', 'Show', 'Color', 'Calendar name', 'Calendar ID'];
var ITEM_HEADERS = ['id', 'name', 'category', 'emoji', 'sortOrder', 'active'];
var NEEDED_HEADERS = ['itemId', 'name', 'addedAt', 'source', 'Got it', 'gotAt'];
var LOG_HEADERS = ['at', 'action', 'itemId', 'name', 'source'];

var CATEGORIES = ['Dairy', 'Produce', 'Meat', 'Pantry', 'Snacks', 'Drinks', 'Frozen', 'Household'];
var STARTER_ITEMS = [
  ['Dairy', [['Milk', '🥛'], ['Eggs', '🥚'], ['Butter', '🧈'], ['Cheese', '🧀'], ['Yogurt', '🥣']]],
  ['Produce', [['Bananas', '🍌'], ['Apples', '🍎'], ['Berries', '🫐'], ['Lettuce', '🥬'], ['Onions', '🧅']]],
  ['Pantry', [['Bread', '🍞'], ['Cereal', '🥣'], ['Peanut butter', '🥜'], ['Pasta', '🍝'], ['Rice', '🍚']]],
  ['Snacks', [["Kids' snacks", '🧃'], ['Chips', '🥔'], ['Granola bars', '🍫']]],
  ['Drinks', [['Juice', '🧃'], ['Coffee', '☕'], ['Water', '💧']]],
  ['Frozen', [['Waffles', '🧇'], ['Chicken nuggets', '🍗'], ['Ice cream', '🍨']]],
  ['Household', [['Paper towels', '🧻'], ['Toilet paper', '🧻'], ['Dish soap', '🧼'], ['Trash bags', '🗑️']]]
];

/* =========================================================================================
 * Web app entry points
 * ======================================================================================= */

function doGet(e) {
  return handle_((e && e.parameter) || {}, Date.now());
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return out_({ ok: false, error: 'bad_json' }, '');
  }
  var p = {};
  var q = (e && e.parameter) || {};
  Object.keys(q).forEach(function (k) { p[k] = q[k]; });
  Object.keys(body).forEach(function (k) { p[k] = body[k]; });
  return handle_(p, Date.now());
}

function handle_(p, now) {
  var cb = (typeof p.callback === 'string' && /^[A-Za-z_$][\w$]{0,40}$/.test(p.callback)) ? p.callback : '';
  if (!checkKey_(p.k)) return out_({ ok: false, error: 'bad_key' }, cb);
  try {
    switch (p.action) {
      case 'ping': return out_({ ok: true, v: FB.version, serverTime: now }, cb);
      case 'board': return out_(board_(p, now), cb);
      case 'state': return out_(withLock_(function () { return kitchenState_(now); }), cb);
      case 'need': return out_(need_(p, now), cb);
      case 'undo': return out_(undo_(p, now), cb);
      case 'gotit': return out_(gotIt_(p, now), cb);
      default: return out_({ ok: false, error: 'unknown_action' }, cb);
    }
  } catch (err) {
    console.error('fridgeboard ' + p.action + ' failed: ' + (err && err.message));
    return out_({ ok: false, error: 'server_error' }, cb);
  }
}

function out_(obj, cb) {
  var json = JSON.stringify(obj);
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(k) {
  var key = PropertiesService.getScriptProperties().getProperty('FB_KEY');
  if (!key || typeof k !== 'string' || k.length !== key.length) return false;
  var diff = 0;
  for (var i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ k.charCodeAt(i);
  return diff === 0;
}

/* =========================================================================================
 * Board: calendar + weather + kitchen summary
 * ======================================================================================= */

function board_(p, now) {
  var cache = CacheService.getScriptCache();
  var board = null;
  if (!p.fresh) {
    var hit = cache.get('fb_board');
    if (hit) board = JSON.parse(hit);
  }
  if (!board) {
    board = buildBoard_(now);
    try { cache.put('fb_board', JSON.stringify(board), FB.boardCacheSeconds); } catch (err) { /* too big to cache: fine */ }
  }
  board.kitchen = kitchenSummary_(now);
  board.serverTime = now;
  return board;
}

function buildBoard_(now) {
  var s = getSettings_();
  var tz = s.timezone || FB.defaultTz;
  var todayKey = fmt_(new Date(now), tz, 'yyyy-MM-dd');
  var start = localMidnight_(todayKey, tz);
  var end = localMidnight_(addDays_(todayKey, s.daysAhead), tz);
  var rows = readCalendarRows_().filter(function (r) { return r.on; });
  var cal = collectEvents_(rows, start, end, s, tz);
  return {
    ok: true,
    schemaVersion: 1,
    generatedAt: now,
    timezone: tz,
    tzOffsetMin: offsetMinutes_(new Date(now), tz),
    today: todayKey,
    calendars: rows.filter(function (r) { return r.kind !== 'travel'; }).map(function (r) {
      return { key: r.key, label: r.label, kind: r.kind, color: r.color, accent: r.kind === 'sports' ? FB.sportsAccent : '' };
    }),
    events: cal.events,
    away: cal.away,
    weather: getWeather_(s, now, tz),
    tv: safeTv_(s, now, tz, rows),
    display: {
      nightStartHour: hour_(s.nightStartHour, 22),
      nightEndHour: hour_(s.nightEndHour, 6),
      tomorrowPeekHour: hour_(s.tomorrowPeekHour, 18),
      staleAfterMinutes: Math.max(10, Number(s.staleAfterMinutes) || 120)
    },
    errors: cal.errors
  };
}

/**
 * Turns calendar rows into fridge events. Pure apart from the CalendarApp reads, so tests can
 * drive it with fake calendars.
 */
function collectEvents_(rows, start, end, s, tz) {
  var merged = {};
  var order = [];
  var trips = [];
  var errors = [];
  var travelWords = words_(s.travelKeywords);
  var hideWords = words_(s.hideKeywords);

  rows.forEach(function (row) {
    var cal = null;
    try { cal = CalendarApp.getCalendarById(row.id); } catch (err) { cal = null; }
    if (!cal) { errors.push({ cal: row.key, error: 'not_found' }); return; }
    var calTz = cal.getTimeZone() || tz;
    var evs;
    try { evs = cal.getEvents(start, end); } catch (err) { errors.push({ cal: row.key, error: 'read_failed' }); return; }

    evs.forEach(function (ev) {
      var title = String(ev.getTitle() || '').trim();
      var allDay = ev.isAllDayEvent();
      var s0 = allDay ? ev.getAllDayStartDate() : ev.getStartTime();
      var e0 = allDay ? ev.getAllDayEndDate() : ev.getEndTime();
      var lower = title.toLowerCase();

      // Travel: keep only when, never what or where.
      if (row.kind === 'travel' || (row.kind === 'personal' && hasWord_(lower, travelWords))) {
        trips.push(allDay
          ? { s: localMidnight_(dateKey_(s0, [calTz, tz]), tz).getTime(), e: localMidnight_(dateKey_(e0, [calTz, tz]), tz).getTime(), allDay: true }
          : { s: s0.getTime(), e: e0.getTime(), allDay: false });
        return;
      }
      if (hasWord_(lower, hideWords)) return;
      if (row.kind === 'holidays' && s.hideObservances && /observance/i.test(String(ev.getDescription() || ''))) return;

      var transparent = false;
      if (typeof ev.getTransparency === 'function') {
        transparent = String(ev.getTransparency()) === 'TRANSPARENT';
      }
      var item = {
        title: row.show === 'busy' ? 'Busy' : title,
        cals: [row.key],
        kind: row.kind,
        allDay: allDay,
        busy: row.kind !== 'sports' && row.kind !== 'holidays' && !transparent
      };
      if (allDay) {
        item.day = dateKey_(s0, [calTz, tz]);
        item.endDay = dateKey_(e0, [calTz, tz]); // exclusive, like iCal
        item.start = null;
        item.end = null;
      } else {
        item.start = s0.getTime();
        item.end = e0.getTime();
        item.day = fmt_(s0, tz, 'yyyy-MM-dd');
        item.endDay = fmt_(e0, tz, 'yyyy-MM-dd');
        item.time = fmt_(s0, tz, 'h:mm');
        item.ampm = fmt_(s0, tz, 'a').toLowerCase();
        item.endTime = fmt_(e0, tz, 'h:mm');
        if (row.kind === 'sports' && Number(fmt_(s0, tz, 'H')) >= 20) item.late = true;
      }
      var mk = item.title.toLowerCase() + '|' + (allDay ? item.day + '/' + item.endDay : item.start + '/' + item.end);
      if (merged[mk]) {
        if (merged[mk].cals.indexOf(row.key) < 0) merged[mk].cals.push(row.key);
        merged[mk].busy = merged[mk].busy || item.busy;
      } else {
        merged[mk] = item;
        order.push(mk);
      }
    });
  });

  var events = order.map(function (k) { return merged[k]; });
  events.sort(function (a, b) {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.start || 0) - (b.start || 0);
  });
  return { events: events, away: tripsFrom_(trips, tz, s.awayLabel), errors: errors };
}

/** Joins travel blocks that touch (flight + hotel + flight) into trips with only dates. */
function tripsFrom_(blocks, tz, label) {
  if (!blocks.length) return [];
  blocks.sort(function (a, b) { return a.s - b.s; });
  var gap = FB.tripJoinHours * 3600000;
  var trips = [];
  var cur = { s: blocks[0].s, e: blocks[0].e, lastTimed: !blocks[0].allDay };
  for (var i = 1; i < blocks.length; i++) {
    var b = blocks[i];
    if (b.s <= cur.e + gap) {
      if (b.e >= cur.e) { cur.e = b.e; cur.lastTimed = !b.allDay; }
    } else {
      trips.push(cur);
      cur = { s: b.s, e: b.e, lastTimed: !b.allDay };
    }
  }
  trips.push(cur);
  return trips.map(function (t) {
    var back = new Date(t.e - (t.lastTimed ? 0 : 1));
    return {
      start: t.s,
      end: t.e,
      firstDay: fmt_(new Date(t.s), tz, 'yyyy-MM-dd'),
      lastDay: fmt_(back, tz, 'yyyy-MM-dd'),
      backTime: t.lastTimed ? fmt_(back, tz, 'h:mm a').toLowerCase() : '',
      label: label || "Dad's away"
    };
  });
}

/* =========================================================================================
 * Weather (Open-Meteo, no key)
 * ======================================================================================= */

function getWeather_(s, now, tz) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('fb_weather');
  if (hit) return JSON.parse(hit);
  var loc = ensureLatLon_(s);
  if (!loc) return { error: 'no_location' };
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day' +
    '&hourly=temperature_2m,precipitation_probability,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
    '&temperature_unit=fahrenheit&timeformat=unixtime&forecast_days=5&timezone=' + encodeURIComponent(tz);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { error: 'weather_http_' + res.getResponseCode() };
  var w = shapeWeather_(JSON.parse(res.getContentText()), s, now, tz);
  try { cache.put('fb_weather', JSON.stringify(w), FB.weatherCacheSeconds); } catch (err) { /* fine */ }
  return w;
}

function shapeWeather_(api, s, now, tz) {
  var cur = api.current || {};
  var h = api.hourly || {};
  var d = api.daily || {};
  var hours = [];
  var times = h.time || [];
  var first = 0;
  while (first < times.length && times[first] * 1000 <= now - 3600000) first++;
  for (var i = first; i < times.length && hours.length < 12; i++) {
    var code = h.weather_code[i];
    hours.push({ t: times[i] * 1000, label: fmt_(new Date(times[i] * 1000), tz, 'ha').toLowerCase().replace('m', ''), temp: Math.round(h.temperature_2m[i]), pop: h.precipitation_probability[i] || 0, icon: wmo_(code).icon });
  }
  var todayKey = fmt_(new Date(now), tz, 'yyyy-MM-dd');
  var days = [];
  var today = null;
  for (var j = 0; j < (d.time || []).length; j++) {
    var key = fmt_(new Date(d.time[j] * 1000), tz, 'yyyy-MM-dd');
    var info = wmo_(d.weather_code[j]);
    var day = {
      day: key,
      dow: fmt_(new Date(d.time[j] * 1000), tz, 'EEE'),
      hi: Math.round(d.temperature_2m_max[j]),
      lo: Math.round(d.temperature_2m_min[j]),
      pop: d.precipitation_probability_max[j] || 0,
      icon: info.icon,
      text: info.text
    };
    if (key === todayKey) {
      today = day;
      today.sunrise = fmt_(new Date(d.sunrise[j] * 1000), tz, 'h:mm');
      today.sunset = fmt_(new Date(d.sunset[j] * 1000), tz, 'h:mm');
    } else if (key > todayKey && days.length < 3) {
      days.push(day);
    }
  }
  var nowInfo = wmo_(cur.weather_code);
  var icon = nowInfo.icon;
  if (cur.is_day === 0 && (icon === 'sun' || icon === 'partly')) icon = icon === 'sun' ? 'moon' : 'partly-night';
  var temps = hours.map(function (x) { return x.temp; });
  if (typeof cur.apparent_temperature === 'number') temps.push(Math.round(cur.apparent_temperature));
  var minTemp = temps.length ? Math.min.apply(null, temps) : null;
  var maxPop = hours.length ? Math.max.apply(null, hours.map(function (x) { return x.pop; })) : 0;
  return {
    now: { temp: Math.round(cur.temperature_2m), feels: Math.round(cur.apparent_temperature), text: nowInfo.text, icon: icon },
    today: today,
    hours: hours,
    days: days,
    call: wearCall_(minTemp, maxPop, s)
  };
}

function wearCall_(minTemp, maxPop, s) {
  var cold = minTemp !== null && minTemp < Number(s.jacketBelowF);
  var wet = maxPop >= Number(s.rainGearAbovePct);
  if (cold && wet) return { kind: 'jacket-rain', text: 'Jacket + rain gear' };
  if (wet) return { kind: 'rain', text: 'Rain gear' };
  if (cold) return { kind: 'jacket', text: 'Jacket weather' };
  return { kind: 'tshirt', text: 'T-shirt day' };
}

function wmo_(code) {
  var c = Number(code);
  if (c === 0) return { text: 'Clear', icon: 'sun' };
  if (c === 1) return { text: 'Mostly clear', icon: 'sun' };
  if (c === 2) return { text: 'Partly cloudy', icon: 'partly' };
  if (c === 3) return { text: 'Cloudy', icon: 'cloud' };
  if (c === 45 || c === 48) return { text: 'Fog', icon: 'fog' };
  if (c >= 51 && c <= 57) return { text: 'Drizzle', icon: 'rain' };
  if (c >= 61 && c <= 67) return { text: 'Rain', icon: 'rain' };
  if (c >= 71 && c <= 77) return { text: 'Snow', icon: 'snow' };
  if (c >= 80 && c <= 82) return { text: 'Showers', icon: 'rain' };
  if (c === 85 || c === 86) return { text: 'Snow showers', icon: 'snow' };
  if (c >= 95) return { text: 'Thunderstorms', icon: 'storm' };
  return { text: '', icon: 'cloud' };
}

function ensureLatLon_(s) {
  var lat = parseFloat(s.lat);
  var lon = parseFloat(s.lon);
  if (isFinite(lat) && isFinite(lon)) return { lat: lat, lon: lon };
  var place = String(s.weatherPlace || '').trim();
  if (!place) return null;
  var name = place.split(',')[0].trim();
  var url = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=' + encodeURIComponent(name) +
    (/^\d{5}$/.test(name) ? '&countryCode=US' : '');
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  var hit = (JSON.parse(res.getContentText()).results || [])[0];
  if (!hit) return null;
  var loc = { lat: Math.round(hit.latitude * 1000) / 1000, lon: Math.round(hit.longitude * 1000) / 1000 };
  setSetting_('lat', loc.lat);
  setSetting_('lon', loc.lon);
  return loc;
}

/* =========================================================================================
 * On TV tonight (ESPN's public scoreboard, no key)
 * ======================================================================================= */

/** The TV list never breaks the board: anything unexpected becomes tv.error. */
function safeTv_(s, now, tz, rows) {
  try {
    return getTv_(s, now, tz, rows);
  } catch (err) {
    return { error: 'tv_failed', games: [], more: 0 };
  }
}

function getTv_(s, now, tz, rows) {
  var leagues = tvLeagues_(s.tvLeagues);
  if (!leagues.length) return { games: [], more: 0 };
  var day = fmt_(new Date(now), tz, 'yyyy-MM-dd');
  var cache = CacheService.getScriptCache();
  var key = 'fb_tv_' + day + '_' + leagues.join('');
  var raw = null;
  var hit = cache.get(key);
  if (hit) raw = JSON.parse(hit);
  if (!raw) {
    raw = { games: [], failed: [], error: '' };
    leagues.forEach(function (lg) {
      var r = fetchLeague_(lg, day.replace(/-/g, ''));
      if (r.error) {
        raw.failed.push(lg);
        raw.error = raw.error || r.error;
      } else {
        raw.games = raw.games.concat(r.games);
      }
    });
    // Only a complete answer is cached, so a league that failed is tried again on the next board.
    if (!raw.failed.length) {
      try { cache.put(key, JSON.stringify(raw), FB.tvCacheSeconds); } catch (err) { /* fine */ }
    }
  }
  if (raw.failed.length === leagues.length) return { error: raw.error, games: [], more: 0 };
  var out = pickTv_(raw.games, s, now, day, tz, tvFavs_(rows));
  if (raw.failed.length) out.failed = raw.failed;
  return out;
}

function tvLeagues_(text) {
  var out = [];
  words_(text).forEach(function (w) {
    var lg = w === 'ncaaf' || w === 'college football' || w === 'college' ? 'cfb' : w;
    if (TV_LEAGUES[lg] && out.indexOf(lg) < 0) out.push(lg);
  });
  return out;
}

/** One league's scoreboard for a local date (YYYYMMDD). Never logs what ESPN sends. */
function fetchLeague_(lg, ymd) {
  var url = 'https://site.api.espn.com/apis/site/v2/sports/' + TV_LEAGUES[lg].path + '/scoreboard?dates=' + ymd + TV_LEAGUES[lg].extra;
  var res;
  try {
    res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (err) {
    return { error: 'espn_unreachable' };
  }
  if (res.getResponseCode() !== 200) return { error: 'espn_http_' + res.getResponseCode() };
  var api;
  try {
    api = JSON.parse(res.getContentText());
  } catch (err) {
    return { error: 'espn_bad_json' };
  }
  if (!api || !Array.isArray(api.events)) return { error: 'espn_shape' };
  var games = [];
  api.events.forEach(function (ev) {
    var g = null;
    try { g = shapeGame_(ev, lg); } catch (err) { g = null; }
    if (g) games.push(g);
  });
  // Games listed but none readable: ESPN changed its JSON.
  if (api.events.length && !games.length) return { error: 'espn_shape' };
  return { games: games };
}

function shapeGame_(ev, lg) {
  var comp = ev && ev.competitions && ev.competitions[0];
  if (!comp || !Array.isArray(comp.competitors)) return null;
  var start = Date.parse(ev.date || comp.date);
  if (!isFinite(start)) return null;
  var home = null;
  var away = null;
  comp.competitors.forEach(function (c) {
    if (c && c.homeAway === 'home') home = c;
    else if (c && c.homeAway === 'away') away = c;
  });
  if (!home || !away || !home.team || !away.team) return null;
  var st = (ev.status && ev.status.type) || (comp.status && comp.status.type) || {};
  return {
    league: lg,
    start: start,
    state: String(st.state || 'pre'),
    away: teamName_(away.team),
    home: teamName_(home.team),
    awayFull: String(away.team.displayName || ''),
    homeFull: String(home.team.displayName || ''),
    awayRank: rank_(away),
    homeRank: rank_(home),
    nets: networksOf_(comp)
  };
}

function teamName_(t) {
  return String(t.shortDisplayName || t.name || t.abbreviation || t.displayName || '?');
}

/** AP rank 1-25, or 0 (ESPN sends 99 or nothing for unranked). */
function rank_(c) {
  var r = Number(c.curatedRank && c.curatedRank.current);
  return r >= 1 && r <= 25 ? r : 0;
}

/** Network names from broadcasts[].names and geoBroadcasts[].media.shortName, deduplicated. */
function networksOf_(comp) {
  var out = [];
  var seen = {};
  function add(name) {
    var c = tvCanon_(name);
    if (!c || seen[squash_(c)]) return;
    seen[squash_(c)] = true;
    out.push(c);
  }
  (comp.broadcasts || []).forEach(function (b) { (b && b.names || []).forEach(add); });
  (comp.geoBroadcasts || []).forEach(function (g) {
    if (!g || /radio/i.test(String(g.type && g.type.shortName || ''))) return;
    add(g.media && g.media.shortName);
  });
  return out;
}

/** Letters and digits only, but "+" stays meaningful: ESPN+ is streaming, not ESPN. */
function squash_(s) {
  return String(s || '').toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]/g, '');
}

/** "NFL Net" → "NFL Network", "fox" → "FOX"; names we don't know stay as written. */
function tvCanon_(name) {
  var s = String(name || '').trim();
  if (!s) return '';
  return TV_ALIASES[squash_(s)] || s;
}

/** Ticked sports calendars, for highlighting their teams' games. */
function tvFavs_(rows) {
  var favs = [];
  (rows || []).forEach(function (r) {
    if (!r.on || r.kind !== 'sports') return;
    var id = String(r.id || '');
    var league = /^nfl_/.test(id) ? 'nfl' : /^nba_/.test(id) ? 'nba' : /^(ncaaf|cfb)_/.test(id) ? 'cfb' : '';
    favs.push({ key: r.key, name: String(r.name || '').toLowerCase().trim(), label: String(r.label || '').toLowerCase().trim(), league: league });
  });
  return favs;
}

function favOf_(g, favs) {
  for (var i = 0; i < favs.length; i++) {
    var f = favs[i];
    if (f.league && f.league !== g.league) continue;
    var teams = [[g.awayFull, g.away], [g.homeFull, g.home]];
    for (var j = 0; j < teams.length; j++) {
      var full = teams[j][0].toLowerCase();
      var short = teams[j][1].toLowerCase();
      if (f.name && full && (f.name === full || f.name.indexOf(full) >= 0 || (f.name.length >= 6 && full.indexOf(f.name) >= 0))) return f.key;
      if (f.label && f.label === short) return f.key;
    }
  }
  return '';
}

/**
 * Filters, highlights and caps the list. NFL/NBA: a national network. College: a big broadcast
 * network, or a ranked team on any TV network we know. Finished games drop; live ones stay.
 */
function pickTv_(games, s, now, day, tz, favs) {
  var custom = words_(s.tvNetworks);
  var national = (custom.length ? custom.map(tvCanon_) : FB.tvNetworks).map(squash_);
  var big = FB.tvBigNetworks.map(squash_);
  var college = national.concat(big, FB.tvCollegeNetworks.map(squash_));
  var list = [];
  games.forEach(function (g) {
    if (g.state === 'post') return;
    var live = g.state === 'in' || g.start <= now;
    if (!live && fmt_(new Date(g.start), tz, 'yyyy-MM-dd') !== day) return;
    var ok = g.league === 'cfb' ? college : national;
    var nets = g.nets.filter(function (n) { return ok.indexOf(squash_(n)) >= 0; });
    if (!nets.length) return;
    if (g.league === 'cfb') {
      var onBig = nets.some(function (n) { return big.indexOf(squash_(n)) >= 0; });
      if (!onBig && !g.awayRank && !g.homeRank) return;
    }
    var item = {
      league: g.league,
      away: g.away,
      home: g.home,
      start: g.start,
      day: fmt_(new Date(g.start), tz, 'yyyy-MM-dd'),
      time: fmt_(new Date(g.start), tz, 'h:mm'),
      ampm: fmt_(new Date(g.start), tz, 'a').toLowerCase(),
      network: nets.slice(0, 2).join(' / '),
      live: live
    };
    if (g.league === 'cfb') {
      if (g.awayRank) item.awayRank = g.awayRank;
      if (g.homeRank) item.homeRank = g.homeRank;
    }
    var fav = favOf_(g, favs);
    if (fav) item.fav = fav;
    list.push(item);
  });
  list.sort(function (a, b) { return a.start - b.start; });
  // Cap the list, but never cut a game of a team the family follows.
  var keep = list.filter(function (g) { return g.fav; }).slice(0, FB.tvMax);
  list.forEach(function (g) { if (!g.fav && keep.length < FB.tvMax) keep.push(g); });
  keep.sort(function (a, b) { return a.start - b.start; });
  return { games: keep, more: list.length - keep.length };
}

/* =========================================================================================
 * Kitchen list ("We're out")
 * ======================================================================================= */

/** Call only while holding the script lock: it tidies away old "Got it" rows. */
function kitchenState_(now) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  clearOldGotIt_(ss, now);
  return {
    ok: true,
    items: readItems_(ss),
    needed: readNeeded_(ss).filter(function (n) { return !n.gotIt; }).map(publicNeed_),
    serverTime: now
  };
}

function kitchenSummary_(now) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var open = readNeeded_(ss).filter(function (n) { return !n.gotIt; });
  open.sort(function (a, b) { return b.addedAt - a.addedAt; });
  return { count: open.length, names: open.slice(0, 6).map(function (n) { return n.name; }) };
}

function need_(p, now) {
  return withLock_(function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var items = readItems_(ss);
    var item = null;
    if (p.itemId) item = find_(items, function (i) { return i.id === String(p.itemId); });
    var name = item ? item.name : cleanName_(p.name);
    if (!item && !name) return { ok: false, error: 'missing_item' };
    if (!item) item = find_(items, function (i) { return i.name.toLowerCase() === name.toLowerCase(); });
    var id = item ? item.id : 'x-' + (slug_(name) || 'item');
    if (item) name = item.name;
    var source = p.source === 'phone' ? 'phone' : 'fridge';
    var open = find_(readNeeded_(ss), function (n) { return !n.gotIt && n.itemId === id; });
    var added = false;
    if (!open) {
      var sh = ss.getSheetByName(TAB.needed);
      sh.appendRow([id, name, new Date(now), source, false, '']);
      sh.getRange(sh.getLastRow(), 5).insertCheckboxes();
      log_(ss, now, 'need', id, name, source);
      added = true;
    }
    var st = kitchenState_(now);
    st.added = added;
    st.itemId = id;
    return st;
  });
}

function undo_(p, now) {
  return withLock_(function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var id = String(p.itemId || '');
    var open = find_(readNeeded_(ss), function (n) { return !n.gotIt && n.itemId === id; });
    if (!open) { var st0 = kitchenState_(now); st0.undone = false; st0.error = 'not_open'; return st0; }
    if (now - open.addedAt > FB.undoSeconds * 1000) { var st1 = kitchenState_(now); st1.undone = false; st1.error = 'undo_expired'; return st1; }
    ss.getSheetByName(TAB.needed).deleteRow(open.row);
    log_(ss, now, 'undo', id, open.name, p.source === 'phone' ? 'phone' : 'fridge');
    var st = kitchenState_(now);
    st.undone = true;
    return st;
  });
}

function gotIt_(p, now) {
  return withLock_(function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var id = String(p.itemId || '');
    var open = find_(readNeeded_(ss), function (n) { return !n.gotIt && n.itemId === id; });
    if (open) {
      var sh = ss.getSheetByName(TAB.needed);
      sh.getRange(open.row, 5).setValue(true);
      sh.getRange(open.row, 6).setValue(new Date(now));
      log_(ss, now, 'gotit', id, open.name, p.source === 'phone' ? 'phone' : 'fridge');
    }
    var st = kitchenState_(now);
    st.cleared = !!open;
    return st;
  });
}

/** Ticking "Got it" on a phone stamps the time, so the row tidies itself away a day later. */
function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== TAB.needed || e.range.getColumn() !== 5 || e.range.getRow() < 2) return;
    var row = e.range.getRow();
    var checked = e.range.getValue() === true;
    sh.getRange(row, 6).setValue(checked ? new Date() : '');
    if (checked) {
      var vals = sh.getRange(row, 1, 1, 2).getValues()[0];
      log_(e.source, Date.now(), 'gotit', vals[0], vals[1], 'phone');
    }
  } catch (err) { /* never block typing in the Sheet */ }
}

function readItems_(ss) {
  var vals = values_(ss.getSheetByName(TAB.items));
  var items = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (!r[0] || !r[1]) continue;
    if (r[5] === false || String(r[5]).toLowerCase() === 'false') continue;
    items.push({ id: String(r[0]), name: String(r[1]), category: String(r[2] || 'Other'), emoji: String(r[3] || ''), sortOrder: Number(r[4]) || 0 });
  }
  items.sort(function (a, b) {
    var ca = CATEGORIES.indexOf(a.category), cb = CATEGORIES.indexOf(b.category);
    if (ca < 0) ca = 99;
    if (cb < 0) cb = 99;
    return ca !== cb ? ca - cb : a.sortOrder - b.sortOrder;
  });
  return items;
}

function readNeeded_(ss) {
  var vals = values_(ss.getSheetByName(TAB.needed));
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (!r[0]) continue;
    out.push({
      row: i + 1,
      itemId: String(r[0]),
      name: String(r[1]),
      addedAt: r[2] instanceof Date ? r[2].getTime() : (Number(new Date(r[2])) || 0),
      source: String(r[3] || ''),
      gotIt: r[4] === true || String(r[4]).toUpperCase() === 'TRUE',
      gotAt: r[5] instanceof Date ? r[5].getTime() : 0
    });
  }
  return out;
}

function publicNeed_(n) {
  return { itemId: n.itemId, name: n.name, addedAt: n.addedAt, source: n.source };
}

function clearOldGotIt_(ss, now) {
  var sh = ss.getSheetByName(TAB.needed);
  var rows = readNeeded_(ss);
  for (var i = rows.length - 1; i >= 0; i--) {
    var n = rows[i];
    if (n.gotIt && n.gotAt && now - n.gotAt > FB.keepGotItHours * 3600000) sh.deleteRow(n.row);
  }
}

function log_(ss, now, action, itemId, name, source) {
  var sh = ss.getSheetByName(TAB.log);
  if (sh) sh.appendRow([new Date(now), action, itemId, name, source]);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* =========================================================================================
 * Setup (run once from the editor; safe to run again)
 * ======================================================================================= */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSettings_(ss);
  setupCalendars_(ss);
  setupItems_(ss);
  setupNeeded_(ss);
  setupLog_(ss);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FB_KEY')) {
    props.setProperty('FB_KEY', newKey_());
    console.log('Fridge key created. Run showKey() to see it, then put it in DASH_CONFIG.');
  } else {
    console.log('Fridge key already set (run showKey() to see it).');
  }
  var loc = ensureLatLon_(getSettings_());
  console.log(loc ? 'Weather location set.' : 'Type your town in Settings → weatherPlace, then run setup() again.');
  console.log('Setup done. Next: Deploy → New deployment → Web app.');
}

/** Prints the fridge key to the execution log. Only you can see this log. */
function showKey() {
  console.log('Fridge key: ' + PropertiesService.getScriptProperties().getProperty('FB_KEY'));
}

/** Makes a new key (the old one stops working). Update DASH_CONFIG afterwards. */
function rotateKey() {
  PropertiesService.getScriptProperties().setProperty('FB_KEY', newKey_());
  showKey();
}

function newKey_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function setupSettings_(ss) {
  var sh = sheet_(ss, TAB.settings);
  var vals = values_(sh);
  if (vals.length <= 1) {
    sh.getRange(1, 1, 1, 3).setValues([['setting', 'value', 'what it does']]);
  }
  var have = {};
  for (var i = 1; i < vals.length; i++) have[String(vals[i][0])] = true;
  SETTINGS_DEFAULTS.forEach(function (row) { if (!have[row[0]]) sh.appendRow(row); });
  styleHeader_(sh, 3, [200, 260, 520]);
}

function setupCalendars_(ss) {
  var sh = sheet_(ss, TAB.calendars);
  var vals = values_(sh);
  var have = {};
  for (var i = 1; i < vals.length; i++) have[String(vals[i][6])] = true;
  if (vals.length <= 1) sh.getRange(1, 1, 1, CAL_HEADERS.length).setValues([CAL_HEADERS]);
  CalendarApp.getAllCalendars().forEach(function (cal) {
    var id = cal.getId();
    if (have[id]) return;
    var name = cal.getName();
    var kind = guessKind_(id, name);
    var primary = typeof cal.isMyPrimaryCalendar === 'function' && cal.isMyPrimaryCalendar();
    var on = primary || kind === 'family' || kind === 'holidays' ||
      (kind === 'sports' && FB.defaultOnTeams.some(function (t) { return name.indexOf(t) >= 0; }));
    var label = primary ? 'Me' : kind === 'holidays' ? 'Holidays' : kind === 'sports' ? name.split(' ').pop() : name;
    sh.appendRow([on, label, kind, 'full', FB.inks[kind] || FB.inks.other, name, id]);
  });
  var last = Math.max(sh.getLastRow(), 2);
  sh.getRange(2, 1, last - 1, 1).insertCheckboxes();
  sh.getRange(2, 3, last - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(FB.kinds, true).build());
  sh.getRange(2, 4, last - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['full', 'busy'], true).build());
  styleHeader_(sh, CAL_HEADERS.length, [60, 180, 120, 90, 100, 260, 420]);
}

function guessKind_(id, name) {
  if (/#holiday@/.test(id)) return 'holidays';
  if (/#sports@/.test(id)) return 'sports';
  if (/^travel$/i.test(name)) return 'travel';
  if (/family/i.test(name)) return 'family';
  if (/#contacts@|#weather@|#sunrise@/.test(id)) return 'other';
  return 'personal';
}

function setupItems_(ss) {
  var sh = sheet_(ss, TAB.items);
  if (values_(sh).length <= 1) {
    var rows = [ITEM_HEADERS];
    STARTER_ITEMS.forEach(function (group) {
      group[1].forEach(function (it, i) { rows.push([slug_(it[0]), it[0], group[0], it[1], (i + 1) * 10, true]); });
    });
    sh.getRange(1, 1, rows.length, ITEM_HEADERS.length).setValues(rows);
    sh.getRange(2, 6, rows.length - 1, 1).insertCheckboxes();
  }
  styleHeader_(sh, ITEM_HEADERS.length, [150, 260, 130, 80, 100, 80]);
}

function setupNeeded_(ss) {
  var sh = sheet_(ss, TAB.needed);
  // Checkboxes go on each new row as it's added (pre-filling the column would push new rows
  // to the bottom of the sheet).
  if (values_(sh).length === 0) sh.getRange(1, 1, 1, NEEDED_HEADERS.length).setValues([NEEDED_HEADERS]);
  styleHeader_(sh, NEEDED_HEADERS.length, [120, 300, 160, 90, 90, 160]);
  // Phones show the name and the checkbox first: hide the id column.
  sh.hideColumns(1);
}

function setupLog_(ss) {
  var sh = sheet_(ss, TAB.log);
  if (values_(sh).length === 0) sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
  styleHeader_(sh, LOG_HEADERS.length, [170, 90, 150, 260, 90]);
}

function styleHeader_(sh, cols, widths) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#F5EFE1');
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

/* =========================================================================================
 * Small helpers
 * ======================================================================================= */

function getSettings_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.settings);
  var s = {};
  SETTINGS_DEFAULTS.forEach(function (r) { s[r[0]] = r[1]; });
  var vals = sh ? values_(sh) : [];
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] !== '' && vals[i][1] !== '' && vals[i][1] !== null) s[String(vals[i][0])] = vals[i][1];
  }
  s.daysAhead = Math.max(1, Math.min(31, Number(s.daysAhead) || 14));
  s.hideObservances = s.hideObservances === true || String(s.hideObservances).toUpperCase() === 'TRUE';
  return s;
}

function setSetting_(key, value) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.settings);
  if (!sh) return;
  var vals = values_(sh);
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value, '']);
}

function readCalendarRows_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.calendars);
  var vals = sh ? values_(sh) : [];
  var rows = [];
  var used = {};
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (!r[6]) continue;
    var kind = FB.kinds.indexOf(String(r[2])) >= 0 ? String(r[2]) : 'personal';
    var base = slug_(r[1] || r[5] || 'cal') || 'cal';
    var key = base;
    var n = 2;
    while (used[key]) key = base + '-' + (n++);
    used[key] = true;
    rows.push({
      on: r[0] === true || String(r[0]).toUpperCase() === 'TRUE',
      key: key,
      label: String(r[1] || r[5]),
      name: String(r[5] || ''),
      kind: kind,
      show: String(r[3]) === 'busy' ? 'busy' : 'full',
      color: /^#[0-9a-fA-F]{6}$/.test(String(r[4])) ? String(r[4]) : (FB.inks[kind] || FB.inks.other),
      id: String(r[6])
    });
  }
  return rows;
}

function sheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function values_(sh) {
  if (!sh || sh.getLastRow() < 1) return [];
  return sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), 1)).getValues();
}

function find_(arr, fn) {
  for (var i = 0; i < arr.length; i++) if (fn(arr[i])) return arr[i];
  return null;
}

function words_(s) {
  return String(s || '').split(',').map(function (w) { return w.trim().toLowerCase(); }).filter(function (w) { return w; });
}

function hasWord_(lowerText, list) {
  for (var i = 0; i < list.length; i++) {
    var w = list[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('(^|[^a-z0-9])' + w + '([^a-z0-9]|$)').test(lowerText)) return true;
  }
  return false;
}

function cleanName_(name) {
  return String(name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, FB.maxNameLength);
}

function slug_(s) {
  return String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function fmt_(date, tz, pattern) {
  return Utilities.formatDate(date, tz, pattern);
}

/** Calendar date of an all-day boundary: whichever zone puts it at exactly midnight. */
function dateKey_(date, zones) {
  for (var i = 0; i < zones.length; i++) {
    if (zones[i] && fmt_(date, zones[i], 'HH:mm') === '00:00') return fmt_(date, zones[i], 'yyyy-MM-dd');
  }
  return fmt_(date, zones[zones.length - 1], 'yyyy-MM-dd');
}

function addDays_(ymd, n) {
  var p = ymd.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n, 12));
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}

/** Midnight at the start of a local calendar day, correct on DST-change days. */
function localMidnight_(ymd, tz) {
  var p = ymd.split('-');
  var guess = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  for (var tries = 0; tries < 3; tries++) {
    var d = new Date(guess);
    var off = offsetMinutes_(d, tz);
    var cand = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) - off * 60000);
    if (fmt_(cand, tz, 'yyyy-MM-dd HH:mm') === ymd + ' 00:00') return cand;
    guess = cand.getTime();
  }
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) - offsetMinutes_(new Date(guess), tz) * 60000);
}

function offsetMinutes_(date, tz) {
  var z = fmt_(date, tz, 'Z'); // like -0500
  var sign = z.charAt(0) === '-' ? -1 : 1;
  return sign * (Number(z.substr(1, 2)) * 60 + Number(z.substr(3, 2)));
}

function hour_(v, dflt) {
  var n = Number(v);
  return isFinite(n) && n >= 0 && n <= 23 ? Math.floor(n) : dflt;
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}
