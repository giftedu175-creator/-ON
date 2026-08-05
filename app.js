const $ = (selector) => document.querySelector(selector);
let activity = '산책';
let map;
let markerLayer;
let routeLayer;
let restaurantLayer;
let latestOceanData = [];
let currentRouteDestination = '';
// 현재 페이지와 같은 localhost:5500 서버에서만 호출하는 상대 경로
const API_PATHS = { ocean: '/api/ocean/buoys', restaurants: '/api/restaurants' };

const stationFallbackCoordinates = {
  TW_0086: [35.0833, 128.8316], TW_0087: [35.1035, 129.0403], TW_0088: [35.0757, 129.0158],
  TW_0090: [35.1794, 129.1997], TW_0092: [35.3180, 129.2642], TW_0062: [35.1587, 129.1604]
};

const nearbyRoutes = {
  haeundae: { safe: [['해운대 해수욕장', '해변 산책 · 안전 상태 확인'], ['동백섬 산책로', '해안 경관 · 도보 이동'], ['청사포 다릿돌전망대', '바다 조망']], scenic: [['해운대 해수욕장', '해변 풍경'], ['청사포 다릿돌전망대', '노을 · 해안 풍경'], ['송정 해수욕장', '해변 산책']], eco: [['동백섬 산책로', '보호 해안 산책'], ['해운대 해수욕장', '친환경 여행 수칙'], ['청사포 다릿돌전망대', '해안 경관']] },
  gwangalli: { safe: [['광안리 해수욕장', '안전 상태 확인 · 산책'], ['민락수변공원', '광안대교 조망'], ['F1963', '실내 대안 인접']], scenic: [['광안리 해수욕장', '광안대교 조망'], ['민락수변공원', '야경 · 산책'], ['이기대 해안산책로', '해안 절경']], eco: [['광안리 해수욕장', '해변 산책'], ['이기대 해안산책로', '보호 해안 경관'], ['F1963', '친환경 문화 공간']] },
  busan: { safe: [['용두산공원', '도심 산책'], ['국제시장', '실내·시장 관광'], ['송도 해상케이블카', '바다 조망']], scenic: [['영도 흰여울문화마을', '해안 마을 풍경'], ['송도 해상케이블카', '바다 조망'], ['용두산공원', '부산항 조망']], eco: [['국제시장', '도보 관광'], ['용두산공원', '도심 녹지'], ['송도 해상케이블카', '대중교통 접근']] },
  seomyeon: { safe: [['부산시민공원', '도심 공원 산책'], ['전포카페거리', '실내 휴식'], ['서면시장', '시장 관광']], scenic: [['전포카페거리', '도심 감성'], ['부산시민공원', '산책'], ['광안리 해수욕장', '해안 야경']], eco: [['부산시민공원', '녹지 산책'], ['전포카페거리', '도보 이동'], ['서면시장', '지역 상권']] },
  airport: { safe: [['대저생태공원', '낙동강 산책'], ['을숙도문화회관', '실내 문화'], ['다대포 해수욕장', '해안 산책']], scenic: [['대저생태공원', '강변 풍경'], ['다대포 해수욕장', '노을 조망'], ['을숙도생태공원', '자연 경관']], eco: [['대저생태공원', '생태 관광'], ['을숙도생태공원', '철새 관찰'], ['을숙도문화회관', '실내 문화']] }
};
const indoorRoutes = { haeundae: [['해운대 영화의전당', '실내 전시·공연'], ['신세계 센텀시티', '실내 쇼핑·휴식'], ['F1963', '실내 문화 공간']], gwangalli: [['F1963', '실내 문화 공간'], ['신세계 센텀시티', '실내 쇼핑·휴식'], ['해운대 영화의전당', '실내 전시·공연']], busan: [['국제시장', '실내·시장 관광'], ['부산근현대역사관', '실내 전시'], ['영도 국립해양박물관', '실내 해양 전시']], seomyeon: [['전포카페거리', '카페 휴식'], ['서면시장', '시장 관광'], ['부산시립미술관', '실내 전시']], airport: [['을숙도문화회관', '실내 문화'], ['국립해양박물관', '실내 해양 전시'], ['국제시장', '실내·시장 관광']] };
const routeCoordinates = {
  '다대포 해수욕장': [35.0462, 128.9669], '송도 해상케이블카': [35.0782, 129.0216], '감천문화마을': [35.0977, 129.0107],
  '이기대 해안산책로': [35.1216, 129.1238], '광안리 해수욕장': [35.1532, 129.1186], '청사포 다릿돌전망대': [35.1608, 129.1954],
  '오륙도 스카이워크': [35.0992, 129.1206], '송정 해수욕장': [35.1781, 129.1998]
  ,'동백섬 산책로': [35.1552, 129.1518], '민락수변공원': [35.1533, 129.1301], 'F1963': [35.1686, 129.1371], '용두산공원': [35.1008, 129.0321], '국제시장': [35.1024, 129.0260], '영도 흰여울문화마을': [35.0787, 129.0445], '부산시민공원': [35.1681, 129.0590], '전포카페거리': [35.1566, 129.0654], '서면시장': [35.1576, 129.0587], '대저생태공원': [35.2172, 128.9843], '을숙도문화회관': [35.1050, 128.9658], '을숙도생태공원': [35.1043, 128.9599], '해운대 영화의전당': [35.1711, 129.1274], '신세계 센텀시티': [35.1689, 129.1295], '부산근현대역사관': [35.1040, 129.0318], '영도 국립해양박물관': [35.0786, 129.0803], '국립해양박물관': [35.0786, 129.0803], '부산시립미술관': [35.1668, 129.1370]
};

function value(value, unit = '') { return value === null || value === undefined ? '측정값 없음' : `${value}${unit}`; }
function stationStatus(item) { return item.wvhgt !== null && item.wvhgt >= 0.8 ? 'watch' : 'good'; }
function stationLabel(status) { return status === 'watch' ? '주의' : '추천'; }
function badMarineWeather(station) { return Number(station?.wspd) >= 10 || Number(station?.wvhgt) >= 1.2; }
function preferredStationCodes(start) { return { haeundae: ['TW_0062', 'TW_0090'], gwangalli: ['TW_0087', 'TW_0088'], busan: ['TW_0087', 'TW_0088'], seomyeon: ['TW_0087', 'TW_0062'], airport: ['TW_0086', 'TW_0088'] }[start] || []; }
function chooseStops(start, style) {
  const allBad = latestOceanData.length > 0 && latestOceanData.every(badMarineWeather);
  const localBad = latestOceanData.filter((station) => preferredStationCodes(start).includes(station.obsCode)).some(badMarineWeather);
  if (allBad || localBad) return { stops: indoorRoutes[start], indoor: true, allBad };
  return { stops: nearbyRoutes[start][style], indoor: false, allBad: false };
}
function measurement(item, field, unit) {
  if (item[field] !== null && item[field] !== undefined) return `${item[field]}${unit}`;
  const state = item.fieldState?.[field];
  if (state === 'parse_error' || item.parseError) return '데이터 해석 오류';
  if (state === 'unsupported') return '해당 항목 미제공';
  return '미관측';
}
function coordinatesFor(item) {
  const lat = Number(item.lat), lot = Number(item.lot);
  return Number.isFinite(lat) && Number.isFinite(lot) && lat !== 0 && lot !== 0 ? [lat, lot] : stationFallbackCoordinates[item.obsCode] || null;
}

async function fetchApi(path) {
  if (window.location.protocol === 'file:') throw new Error('FILE_MODE');
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { response = await fetch(path, { headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' }); break; }
    catch { if (attempt === 1) throw new Error('SERVER_UNREACHABLE'); await new Promise((resolve) => setTimeout(resolve, 300)); }
  }
  let payload = {};
  try { payload = await response.json(); } catch { throw new Error('INVALID_SERVER_RESPONSE'); }
  if (!response.ok) {
    if (/KHOA_SERVICE_KEY|서비스키|인증키/i.test(payload.message || '')) throw new Error('MISSING_KHOA_KEY');
    throw new Error(`SERVER_API_ERROR:${payload.message || response.status}`);
  }
  return payload;
}

function connectionMessage(error) {
  if (error.message === 'FILE_MODE') return '서버 연결 실패 · file://가 아닌 http://localhost:5500에서 여세요';
  if (error.message === 'SERVER_UNREACHABLE') return '서버 연결 실패 · localhost:5500 서버 상태를 확인하세요';
  if (error.message === 'MISSING_KHOA_KEY') return '인증키 없음 · KHOA_SERVICE_KEY를 설정하세요';
  if (error.message === 'INVALID_SERVER_RESPONSE') return '서버 연결 실패 · JSON 응답을 받지 못했습니다';
  return `공공데이터 API 오류 · ${error.message.replace('SERVER_API_ERROR:', '')}`;
}

function restaurantMessage(error) {
  if (error.message === 'SERVER_UNREACHABLE' || error.message === 'INVALID_SERVER_RESPONSE') return '맛집 API 호출 실패';
  if (error.message === 'FILE_MODE') return '맛집 API 호출 실패 · http://localhost:5500에서 실행하세요';
  if (error.message === 'MISSING_KHOA_KEY') return '맛집 API 호출 실패';
  return '맛집 API 호출 실패';
}

function popup(item) {
  const status = stationStatus(item);
  return `<div class="ocean-popup"><small>${stationLabel(status)} · ${item.obsCode}</small><h3>${item.obsvtrNm}</h3><p>관측 ${item.obsrvnDt || '정보 없음'}</p><b>풍속 ${value(item.wspd, 'm/s')} · 파고 ${value(item.wvhgt, 'm')} · 수온 ${value(item.wtem, '°C')}</b><a href="#route">이곳으로 경로 만들기 →</a></div>`;
}

async function openStationPanel(item) {
  const panel = $('#stationPanel');
  restaurantLayer?.clearLayers();
  panel.classList.add('open');
  const observedAt = item.obsrvnDt || (item.fieldState?.obsrvnDt === 'parse_error' ? '데이터 해석 오류' : item.fieldState?.obsrvnDt === 'unsupported' ? '해당 항목 미제공' : '미관측');
  panel.innerHTML = `<button id="closePanel" type="button" aria-label="상세 패널 닫기">×</button><small>OCEAN OBSERVATION</small><h3>${item.obsvtrNm}</h3><p class="observed-at">관측 ${observedAt}</p><dl><div><dt>풍속</dt><dd>${measurement(item, 'wspd', 'm/s')}</dd></div><div><dt>파고</dt><dd>${measurement(item, 'wvhgt', 'm')}</dd></div><div><dt>파주기</dt><dd>${measurement(item, 'wvpd', 's')}</dd></div><div><dt>수온</dt><dd>${measurement(item, 'wtem', '°C')}</dd></div><div><dt>기온</dt><dd>${measurement(item, 'artmp', '°C')}</dd></div></dl><h4>주변 맛집</h4><p class="restaurant-loading">맛집 정보를 불러오는 중…</p>`;
  $('#closePanel').onclick = () => { panel.classList.remove('open'); restaurantLayer?.clearLayers(); };
  try {
    const payload = await fetchApi(`${API_PATHS.restaurants}?obsCode=${encodeURIComponent(item.obsCode)}`);
    const restaurants = payload.data || [];
    showRestaurantMarkers(restaurants);
    const statusText = { missing_key: '카카오 API 키 없음 · 임시 맛집 데이터', auth_error: `카카오 인증 실패 · 카카오 개발자 콘솔에서 OPEN_MAP_AND_LOCAL 서비스를 활성화하세요. (${payload.message || '인증 정보 확인 필요'})`, api_error: `맛집 API 호출 실패 · ${payload.message || '카카오 API 오류'}`, empty: '맛집 검색 결과 없음' }[payload.status];
    const list = restaurants.length ? `<ul class="restaurant-list">${restaurants.map((restaurant) => `<li><a href="${restaurant.siteUrl || `https://map.naver.com/p/search/${encodeURIComponent(restaurant.name)}`}" target="_blank" rel="noopener"><b>${restaurant.name}</b><span>${restaurant.category} · ${restaurant.distance}</span><small>${restaurant.address}</small><em>네이버지도에서 보기 ↗</em></a></li>`).join('')}</ul>` : '<p class="restaurant-loading">표시할 맛집 정보가 없습니다.</p>';
    panel.querySelector('.restaurant-loading').outerHTML = `${statusText ? `<p class="restaurant-loading">${statusText}</p>` : ''}${list}`;
  } catch (error) { panel.querySelector('.restaurant-loading').textContent = restaurantMessage(error); }
}

function showRestaurantMarkers(restaurants) {
  if (!restaurantLayer) return;
  restaurantLayer.clearLayers();
  const mappedRestaurants = restaurants.filter((restaurant) => {
    if (restaurant.coordinateSource !== 'kakao') return false;
    const lat = Number(restaurant.lat);
    const lot = Number(restaurant.lot);
    return Number.isFinite(lat) && Number.isFinite(lot) && lat !== 0 && lot !== 0;
  });
  const sameBuilding = new Map();
  mappedRestaurants.forEach((restaurant) => {
    const key = `${Number(restaurant.lat).toFixed(5)},${Number(restaurant.lot).toFixed(5)}`;
    const places = sameBuilding.get(key) || [];
    places.push(restaurant);
    sameBuilding.set(key, places);
  });
  const labelOffsets = [[0, -10], [32, -20], [-32, -20], [42, 4], [-42, 4], [0, -38]];
  mappedRestaurants.forEach((restaurant) => {
    const lat = Number(restaurant.lat);
    const lot = Number(restaurant.lot);
    const key = `${lat.toFixed(5)},${lot.toFixed(5)}`;
    const positionInBuilding = sameBuilding.get(key).indexOf(restaurant);
    const link = restaurant.siteUrl || `https://map.naver.com/p/search/${encodeURIComponent(restaurant.name)}`;
    L.circleMarker([lat, lot], {
      radius: 8, weight: 2, color: '#ffffff', fillColor: '#ff7a45', fillOpacity: 1, pane: 'markerPane'
    }).addTo(restaurantLayer).bindPopup(
      `<b>${restaurant.name}</b><br>${restaurant.category} · ${restaurant.distance}<br><a href="${link}" target="_blank" rel="noopener">지도에서 보기 ↗</a>`
    ).bindTooltip(restaurant.name, { permanent: true, direction: 'top', offset: labelOffsets[positionInBuilding % labelOffsets.length], className: 'restaurant-name-tooltip' });
  });
  requestAnimationFrame(() => requestAnimationFrame(layoutRestaurantLabels));
}

function layoutRestaurantLabels() {
  if (!map) return;
  const labels = [...map.getContainer().querySelectorAll('.restaurant-name-tooltip')];
  const placed = [];
  const candidates = [[0, 0], [38, -18], [-38, -18], [52, 8], [-52, 8], [0, -42], [68, -42], [-68, -42], [82, 20], [-82, 20]];
  const overlaps = (first, second) => !(first.right + 5 < second.left || first.left - 5 > second.right || first.bottom + 5 < second.top || first.top - 5 > second.bottom);
  labels.forEach((label, index) => {
    label.style.marginLeft = '0px';
    label.style.marginTop = '0px';
    const start = index % candidates.length;
    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const [x, y] = candidates[(start + attempt) % candidates.length];
      label.style.marginLeft = `${x}px`;
      label.style.marginTop = `${y}px`;
      const rect = label.getBoundingClientRect();
      if (!placed.some((other) => overlaps(rect, other))) { placed.push(rect); return; }
    }
    placed.push(label.getBoundingClientRect());
  });
}

function showStations(stations) {
  markerLayer.clearLayers();
  const bounds = [];
  stations.forEach((station, index) => {
    const coordinates = coordinatesFor(station);
    if (!coordinates) return;
    const status = stationStatus(station);
    const marker = L.circleMarker(coordinates, { radius: 10, weight: 3, color: '#ffffff', fillColor: status === 'watch' ? '#ffcf58' : '#18bd9c', fillOpacity: 1, pane: 'markerPane' })
      .addTo(markerLayer).bindPopup(popup(station), { closeButton: false, offset: [0, -10] })
      .bindTooltip(station.obsvtrNm, { permanent: true, direction: 'top', offset: [index % 2 ? 24 : -24, -14 - (index % 3) * 8], className: 'station-name-tooltip' });
    marker.on('click', () => openStationPanel(station));
    bounds.push(coordinates);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
  requestAnimationFrame(() => map.invalidateSize());
}

function mapFallback() {
  return [
    { obsCode: 'TW_0062', obsvtrNm: '해운대해수욕장', lat: 35.1587, lot: 129.1604, wspd: null, wvhgt: null, wtem: null, obsrvnDt: null },
    { obsCode: 'TW_0090', obsvtrNm: '송정해수욕장', lat: 35.1781, lot: 129.1998, wspd: null, wvhgt: null, wtem: null, obsrvnDt: null },
    { obsCode: 'TW_0087', obsvtrNm: '부산항', lat: 35.103, lot: 129.039, wspd: null, wvhgt: null, wtem: null, obsrvnDt: null },
    { obsCode: 'TW_0088', obsvtrNm: '감천항', lat: 35.075, lot: 129.012, wspd: null, wvhgt: null, wtem: null, obsrvnDt: null }
  ];
}

async function loadOceanData() {
  const state = $('.map-overlay');
  try {
    const payload = await fetchApi(API_PATHS.ocean);
    if (!payload.data?.length) {
      const reason = payload.failures?.[0]?.message;
      throw new Error(reason ? `SERVER_API_ERROR:${reason}` : 'SERVER_API_ERROR:데이터 없음');
    }
    latestOceanData = payload.data;
    showStations(payload.data);
    const failures = payload.failures?.length ? ` · ${payload.failures.length}곳 조회 실패` : '';
    state.innerHTML = `<span class="live-dot"></span>LIVE · ${payload.data.length}개 관측소 최신 데이터${failures}`;
    const latest = payload.data[0];
    $('#summaryTitle').textContent = `해양관측부이 ${payload.data.length}곳 최신 데이터`;
    $('#summaryDetail').textContent = latest ? `${latest.obsvtrNm} · 풍속 ${value(latest.wspd, 'm/s')} · 파고 ${value(latest.wvhgt, 'm')}` : '관측값이 없습니다.';
  } catch (error) {
    showStations(mapFallback());
    state.textContent = connectionMessage(error);
    state.classList.add('error');
    $('#summaryTitle').textContent = '해양관측부이 데이터 연결 필요';
    $('#summaryDetail').textContent = connectionMessage(error);
  }
}

function buildMap() {
  map = L.map('busanMap', { zoomControl: false }).setView([35.137, 129.075], 11);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  restaurantLayer = L.layerGroup().addTo(map);
  map.on('zoomend moveend', () => requestAnimationFrame(layoutRestaurantLabels));
  requestAnimationFrame(() => map.invalidateSize());
  setTimeout(() => map.invalidateSize(), 150);
  loadOceanData();
}

function showRoute(stops) {
  const coordinates = stops.map(([name]) => routeCoordinates[name]).filter(Boolean);
  if (!coordinates.length) return;
  routeLayer.clearLayers();
  L.polyline(coordinates, { color: '#0879d9', weight: 5, opacity: .9, dashArray: '8 7' }).addTo(routeLayer);
  coordinates.forEach((coordinate, index) => L.circleMarker(coordinate, { radius: 12, color: '#fff', weight: 3, fillColor: '#0879d9', fillOpacity: 1 }).addTo(routeLayer).bindPopup(`<b>STOP ${index + 1}</b><br>${stops[index][0]}`).bindTooltip(String(index + 1), { permanent: true, direction: 'center', className: 'route-number-tooltip' }));
  map.fitBounds(coordinates, { padding: [55, 55], maxZoom: 12 });
  map.getContainer().scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('#visitDate').value = new Date().toISOString().slice(0, 10);
document.querySelectorAll('.chip').forEach((button) => button.onclick = () => { document.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('active')); button.classList.add('active'); activity = button.dataset.activity; });
$('#routeForm').onsubmit = (event) => {
  event.preventDefault(); const type = $('#style').value, start = $('#start').value, recommendation = chooseStops(start, type), stops = recommendation.stops, names = stops.map((stop) => stop[0]).join(' → ');
  $('#routeTitle').textContent = recommendation.indoor ? `${activity}에 알맞은 실내 중심 코스` : `${activity}에 알맞은 ${stops[0][0]} 코스`; $('.status').textContent = recommendation.indoor ? '실내 코스 추천' : '추천 완료';
  $('#routeDescription').textContent = recommendation.indoor ? `${$('#visitDate').value} 기준 ${recommendation.allBad ? '부산 전 해상 상태가 좋지 않아' : '출발지 인근 해상 상태가 좋지 않아'} 실내 관광지 위주로 추천합니다. ${names}` : `${$('#visitDate').value} 기준 출발 위치 주변의 해양 상태를 종합했습니다. ${names} 순서로 약 4시간 여행을 추천합니다.`;
  $('#routeStops').classList.remove('empty'); $('#routeStops').innerHTML = stops.map((stop, index) => `<div class="stop"><span>STOP 0${index + 1}</span><b>${stop[0]}</b><span>${stop[1]}</span></div>`).join('');
  const score = type === 'safe' ? [92, 81, 75] : type === 'eco' ? [84, 94, 78] : [78, 76, 95]; ['safeScore', 'ecoScore', 'viewScore'].forEach((id, index) => { $(`#${id}`).textContent = score[index]; });
  currentRouteDestination = stops[0][0];
  $('#transitDestination').textContent = `목적지: ${currentRouteDestination} (첫 번째 추천 장소)`;
  $('#directionsBtn').hidden = false;
  showRoute(stops);
};

$('#directionsBtn').onclick = () => $('#transit').scrollIntoView({ behavior: 'smooth', block: 'start' });
$('#transitForm').onsubmit = (event) => {
  event.preventDefault();
  const origin = $('#transitOrigin').value.trim();
  const result = $('#transitResult');
  if (!currentRouteDestination) { result.textContent = '먼저 부산 여행 경로를 분석해 주세요.'; return; }
  const destination = `${currentRouteDestination}, 부산광역시`;
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`;
  result.innerHTML = `<p><b>${origin}</b>에서 <b>${currentRouteDestination}</b>까지 대중교통 경로를 확인합니다.</p><a class="button dark" href="${url}" target="_blank" rel="noopener">대중교통 경로 보기 ↗</a>`;
};
buildMap();
