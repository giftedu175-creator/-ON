import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 5500);
const endpoint = 'https://apis.data.go.kr/1192136/twRecent/GetTWRecentApiService';
// 이 값은 서버 프로세스에서만 읽으며, API 응답이나 정적 파일에 포함하지 않는다.
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;
const stations = [
  { code: 'TW_0086', name: '부산항신항' }, { code: 'TW_0087', name: '부산항' },
  { code: 'TW_0088', name: '감천항' }, { code: 'TW_0090', name: '송정해수욕장' },
  { code: 'TW_0092', name: '임랑해수욕장' }, { code: 'TW_0062', name: '해운대해수욕장' }
];
const restaurantFallbacks = {
  TW_0062: [['해운대암소갈비집','한식','0.7km','부산 해운대구 중동2로10번길 32-10'],['속씨원한대구탕','한식','0.8km','부산 해운대구 달맞이길62번길 28'],['해운대기와집대구탕','한식','1.0km','부산 해운대구 달맞이길104번길 46'],['금수복국 해운대본점','한식','1.2km','부산 해운대구 중동1로43번길 23']],
  TW_0090: [['문토스트 송정점','분식','0.3km','부산 해운대구 송정해변로 50'],['송정집','한식','0.5km','부산 해운대구 송정중앙로36번길 22'],['카페 윤','카페','0.8km','부산 해운대구 송정구덕포길 170'],['송정해녀촌','해산물','1.1km','부산 해운대구 송정해변로 86']]
};
const stationCoordinates = { TW_0086:[35.0833,128.8316], TW_0087:[35.1035,129.0403], TW_0088:[35.0757,129.0158], TW_0090:[35.1794,129.1997], TW_0092:[35.3180,129.2642], TW_0062:[35.1587,129.1604] };

const errorMessages = {
  '1': '애플리케이션 오류', '3': '데이터가 없습니다.', '4': 'HTTP 통신 오류', '5': '서비스 연결 시간 초과',
  '10': '잘못된 요청 파라미터입니다.', '11': '필수 요청 파라미터가 없습니다.', '12': '등록되지 않은 OpenAPI 서비스입니다.',
  '20': '서비스 접근이 거부되었습니다.', '22': '서비스 요청 제한 횟수를 초과했습니다.', '30': '등록되지 않은 서비스키입니다.',
  '31': '기한이 만료된 서비스키입니다.', '32': '등록되지 않은 IP입니다.', '33': '서명되지 않은 호출입니다.',
  '40': '관측소가 일시적으로 이용 불가합니다.', '41': '관측 항목 서비스가 일시 중지되었습니다.', '99': '알 수 없는 API 오류입니다.'
};

function koreaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}${get('month')}${get('day')}`;
}

function apiKeyOnceEncoded(value) {
  let key = value.trim();
  try {
    while (/%[0-9A-Fa-f]{2}/.test(key)) {
      const decoded = decodeURIComponent(key);
      if (decoded === key) break;
      key = decoded;
    }
  } catch { /* 원문 키는 그대로 한 번만 URLSearchParams가 인코딩한다. */ }
  return key;
}

function nullable(value) {
  if (value === undefined || value === null || String(value).trim() === '-' || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function recordsFromPayload(payload) {
  const candidates = [payload?.response?.body?.items?.item, payload?.body?.items?.item, payload?.items?.item, payload?.items, payload?.data];
  const unwrap = (candidate) => {
    if (Array.isArray(candidate)) return candidate.filter((row) => row && typeof row === 'object');
    if (!candidate || typeof candidate !== 'object') return [];
    if (candidate.item) return unwrap(candidate.item);
    if (candidate.items) return unwrap(candidate.items);
    if (candidate.data) return unwrap(candidate.data);
    return ['obsvtrNm', 'obsrvnDt', 'wspd', 'wvhgt', 'wtem'].some((field) => Object.prototype.hasOwnProperty.call(candidate, field)) ? [candidate] : [];
  };
  for (const candidate of candidates) {
    const records = unwrap(candidate);
    if (records.length) return { records, parseError: false };
  }
  return { records: [], parseError: true };
}

function orderedRecords(items) { return [...items].sort((a, b) => String(b.obsrvnDt || '').localeCompare(String(a.obsrvnDt || ''))); }
function fieldResult(items, field, parseError) {
  if (parseError) return { value: null, state: 'parse_error' };
  const hasField = items.some((item) => Object.prototype.hasOwnProperty.call(item, field));
  if (!hasField) return { value: null, state: 'unsupported' };
  const source = orderedRecords(items).find((item) => item[field] !== undefined && item[field] !== null && String(item[field]).trim() !== '' && String(item[field]).trim() !== '-');
  return source ? { value: nullable(source[field]), state: 'observed' } : { value: null, state: 'unobserved' };
}

function normalizeObservation(station, item) {
  return {
    obsCode: station.code, obsvtrNm: item?.obsvtrNm ?? station.name, obsrvnDt: item?.obsrvnDt ?? null,
    lat: nullable(item?.lat), lot: nullable(item?.lot), wspd: nullable(item?.wspd), wndrct: nullable(item?.wndrct),
    wvhgt: nullable(item?.wvhgt), wvpd: nullable(item?.wvpd), wtem: nullable(item?.wtem), artmp: nullable(item?.artmp),
    crsp: nullable(item?.crsp), slnty: nullable(item?.slnty)
  };
}

function getItems(payload) {
  const item = payload?.response?.body?.items?.item;
  return Array.isArray(item) ? item : item ? [item] : [];
}

async function fetchStation(station, serviceKey) {
  const query = new URLSearchParams({ serviceKey: apiKeyOnceEncoded(serviceKey), obsCode: station.code, type: 'json', reqDate: koreaDate(), min: '60', numOfRows: '300', pageNo: '1' });
  const requestUrl = `${endpoint}?${query.toString()}`;
  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { response = await fetch(requestUrl, { headers: { Accept: 'application/json' } }); break; }
    catch (error) {
      const detail = error.cause?.code || error.cause?.message || error.message;
      console.error(`[KHOA NETWORK ERROR] obsCode=${station.code} attempt=${attempt} reason=${detail}`);
      if (attempt === 3) throw new Error(`국립해양조사원 API 연결 실패: ${detail}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  const payload = await response.json();
  console.log('[KHOA raw]', station.code, JSON.stringify(payload, (key, value) => /servicekey/i.test(key) ? '[REDACTED]' : value));
  const error = payload?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (!response.ok || error) {
    const code = String(error?.returnReasonCode || response.status);
    throw new Error(errorMessages[code] || error?.errMsg || `API 요청 실패 (${code})`);
  }
  const { records: items, parseError } = recordsFromPayload(payload);
  const item = orderedRecords(items)[0] || null;
  const normalized = normalizeObservation(station, item);
  const fields = ['obsvtrNm', 'obsrvnDt', 'lat', 'lot', 'wspd', 'wndrct', 'wvhgt', 'wvpd', 'wtem', 'artmp', 'crsp', 'slnty'];
  normalized.parseError = parseError;
  normalized.fieldState = {};
  normalized.fieldAvailability = {};
  fields.forEach((field) => { const result = fieldResult(items, field, parseError); if (field !== 'obsvtrNm' && field !== 'obsrvnDt') normalized[field] = result.value; normalized.fieldState[field] = result.state; normalized.fieldAvailability[field] = result.state !== 'unsupported'; });
  return normalized;
}

async function oceanHandler(response) {
  const serviceKey = process.env.KHOA_SERVICE_KEY;
  if (!serviceKey) return json(response, 500, { message: 'KHOA_SERVICE_KEY 환경변수가 설정되지 않았습니다.', data: [], failures: [] });
  const results = await Promise.allSettled(stations.map((station) => fetchStation(station, serviceKey)));
  const data = [], failures = [];
  results.forEach((result, index) => result.status === 'fulfilled' ? data.push(result.value) : failures.push({ obsCode: stations[index].code, obsvtrNm: stations[index].name, message: result.reason.message }));
  json(response, 200, { requestedAt: new Date().toISOString(), reqDate: koreaDate(), data, failures });
}

async function restaurantsHandler(response, obsCode) {
  const fallback = (restaurantFallbacks[obsCode] || [['부산 바다식당','해산물','1.0km','부산 해안 관광지 인근'],['부산항 국밥','한식','1.6km','부산 해안 관광지 인근'],['부산 로컬카페','카페','2.0km','부산 해안 관광지 인근']]).map(([name, category, distance, address]) => ({ name, category, distance, address, coordinateSource: 'fallback', siteUrl: `https://map.naver.com/p/search/${encodeURIComponent(name)}` }));
  if (!kakaoRestApiKey) { console.log('[KAKAO] KAKAO_REST_API_KEY configured: false'); return json(response, 200, { status: 'missing_key', data: fallback }); }
  if (!stationCoordinates[obsCode]) return json(response, 200, { status: 'empty', data: [] });
  try {
    const [lat, lot] = stationCoordinates[obsCode];
    const query = new URLSearchParams({ category_group_code: 'FD6', x: String(lot), y: String(lat), radius: '3000', sort: 'distance', size: '5' });
    console.log(`[KAKAO] request obsCode=${obsCode} x=${lot} y=${lat} key_configured=true`);
    const result = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${query}`, { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } });
    const text = await result.text();
    if (!result.ok) {
      console.error(`[KAKAO ERROR] status=${result.status} body=${text}`);
      let reason = `카카오 API 오류 (${result.status})`;
      try { const errorBody = JSON.parse(text); reason = errorBody.msg || errorBody.message || errorBody.errorType || reason; } catch { if (text) reason = text.slice(0, 240); }
      return json(response, 200, { status: result.status === 401 || result.status === 403 ? 'auth_error' : 'api_error', data: fallback, message: reason });
    }
    const payload = JSON.parse(text); const data = (payload.documents || []).map((row) => ({ name: row.place_name, category: row.category_name?.split(' > ').at(-1), distance: `${row.distance}m`, address: row.road_address_name || row.address_name, lat: Number(row.y), lot: Number(row.x), coordinateSource: 'kakao', siteUrl: row.place_url || `https://map.naver.com/p/search/${encodeURIComponent(row.place_name)}` }));
    fallback.forEach((place) => { if (data.length < 3 && !data.some((item) => item.name === place.name)) data.push(place); });
    console.log(`[KAKAO] response status=${result.status} documents=${data.length}`);
    json(response, 200, { status: data.length ? 'ok' : 'empty', data });
  } catch (error) { console.error('[KAKAO ERROR]', error.message); json(response, 200, { status: 'api_error', data: fallback, message: '카카오 API 연결 오류' }); }
}

function json(response, status, body) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); }
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  console.log('[HTTP]', request.method, pathname);
  if (pathname === '/api/health') return json(response, 200, { ok: true });
  if (pathname === '/api/ocean/buoys') return oceanHandler(response).catch((error) => { console.error('[OCEAN API ERROR]', error.message); json(response, 500, { message: error.message, data: [], failures: [] }); });
  if (pathname === '/api/restaurants') return restaurantsHandler(response, url.searchParams.get('obsCode')).catch((error) => { console.error('[RESTAURANT API ERROR]', error.message); json(response, 500, { message: error.message, data: [] }); });
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) return response.writeHead(403).end();
  try {
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(content);
  } catch {
    if (!response.headersSent) response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`부산바다ON: http://localhost:${port}`);
  console.log(`[KAKAO] KAKAO_REST_API_KEY configured: ${Boolean(kakaoRestApiKey)}`);
});
