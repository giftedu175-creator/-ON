import concurrent.futures
import datetime as dt
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENDPOINT = 'https://apis.data.go.kr/1192136/twRecent/GetTWRecentApiService'
STATIONS = [('TW_0086', '부산항신항'), ('TW_0087', '부산항'), ('TW_0088', '감천항'), ('TW_0090', '송정해수욕장'), ('TW_0092', '임랑해수욕장'), ('TW_0062', '해운대해수욕장')]
COORDS = {'TW_0086':(35.0833,128.8316),'TW_0087':(35.1035,129.0403),'TW_0088':(35.0757,129.0158),'TW_0090':(35.1794,129.1997),'TW_0092':(35.3180,129.2642),'TW_0062':(35.1587,129.1604)}
RESTAURANTS = {
  'TW_0062':[('해운대암소갈비집','한식','0.7km','부산 해운대구 중동2로10번길 32-10'),('속씨원한대구탕','한식','0.8km','부산 해운대구 달맞이길62번길 28'),('해운대기와집대구탕','한식','1.0km','부산 해운대구 달맞이길104번길 46')],
  'TW_0090':[('문토스트 송정점','분식','0.3km','부산 해운대구 송정해변로 50'),('송정집','한식','0.5km','부산 해운대구 송정중앙로36번길 22'),('카페 윤','카페','0.8km','부산 해운대구 송정구덕포길 170')],
  'TW_0092':[('임랑해녀촌','해산물','0.4km','부산 기장군 장안읍 임랑해안길 69'),('월내횟집','횟집','1.1km','부산 기장군 장안읍 월내해안길 22')],
  'TW_0086':[('신항만횟집','횟집','1.2km','부산 강서구 신항남로 454'),('명지국밥','한식','2.4km','부산 강서구 명지국제8로 240')],
  'TW_0087':[('초량밀면','한식','1.0km','부산 동구 중앙대로 225'),('본전돼지국밥','한식','1.3km','부산 동구 중앙대로214번길 3-8')],
  'TW_0088':[('감천문화마을 맛집거리','한식','1.4km','부산 사하구 감내2로 203'),('송도해상케이블카 맛집','해산물','2.1km','부산 서구 송도해변로 171')]
}
ERRORS = {'1':'애플리케이션 오류','3':'데이터가 없습니다.','4':'HTTP 통신 오류','5':'서비스 연결 시간 초과','10':'잘못된 요청 파라미터입니다.','11':'필수 요청 파라미터가 없습니다.','12':'등록되지 않은 OpenAPI 서비스입니다.','20':'서비스 접근이 거부되었습니다.','22':'서비스 요청 제한 횟수를 초과했습니다.','30':'등록되지 않은 서비스키입니다.','31':'기한이 만료된 서비스키입니다.','32':'등록되지 않은 IP입니다.','33':'서명되지 않은 호출입니다.','40':'관측소가 일시적으로 이용 불가합니다.','41':'관측 항목 서비스가 일시 중지되었습니다.','99':'알 수 없는 API 오류입니다.'}

def service_key_once_encoded(key):
    key = key.strip()
    while '%' in key:
        try:
            decoded = urllib.parse.unquote(key)
            if decoded == key: break
            key = decoded
        except Exception: break
    return key

def null_value(value):
    if value is None or str(value).strip() in ('', '-'): return None
    try: return float(value)
    except (ValueError, TypeError): return value

def redact_keys(value):
    if isinstance(value, dict): return {key: ('[REDACTED]' if 'servicekey' in key.lower() else redact_keys(child)) for key, child in value.items()}
    if isinstance(value, list): return [redact_keys(child) for child in value]
    return value

def usable(value): return value is not None and str(value).strip() not in ('', '-')

def records_from_payload(payload):
    candidates = [payload.get('response', {}).get('body', {}).get('items', {}).get('item'), payload.get('body', {}).get('items', {}).get('item'), payload.get('items', {}).get('item') if isinstance(payload.get('items'), dict) else None, payload.get('items'), payload.get('data')]
    def unwrap(candidate):
        if isinstance(candidate, list): return [row for row in candidate if isinstance(row, dict)]
        if not isinstance(candidate, dict): return []
        for key in ('item', 'items', 'data'):
            if key in candidate:
                records = unwrap(candidate[key])
                if records: return records
        return [candidate] if any(field in candidate for field in ('obsvtrNm','obsrvnDt','wspd','wvhgt','wtem')) else []
    for candidate in candidates:
        records = unwrap(candidate)
        if records: return records, False
    return [], True

def latest_field(items, field, parse_error):
    if parse_error: return None, 'parse_error'
    if not any(field in row for row in items): return None, 'unsupported'
    ordered = sorted(items, key=lambda row: str(row.get('obsrvnDt', '')), reverse=True)
    value = next((row.get(field) for row in ordered if usable(row.get(field))), None)
    return (null_value(value), 'observed') if usable(value) else (None, 'unobserved')

def request_station(station):
    code, fallback_name = station
    key = os.environ['KHOA_SERVICE_KEY']
    params = {'serviceKey': service_key_once_encoded(key), 'obsCode': code, 'type': 'json', 'reqDate': dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime('%Y%m%d'), 'min': '60', 'numOfRows': '300', 'pageNo': '1'}
    url = f'{ENDPOINT}?{urllib.parse.urlencode(params)}'
    payload = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(url, timeout=15) as response:
                payload = json.loads(response.read().decode('utf-8'))
                break
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'HTTP 통신 오류 ({error.code})')
        except Exception as error:
            print(f'[KHOA NETWORK ERROR] obsCode={code} attempt={attempt} reason={str(error)}')
            if attempt == 3: raise RuntimeError(f'국립해양조사원 API 연결 실패: {str(error)}')
    error = payload.get('OpenAPI_ServiceResponse', {}).get('cmmMsgHeader')
    if error:
        error_code = str(error.get('returnReasonCode', '99'))
        raise RuntimeError(ERRORS.get(error_code, error.get('errMsg', 'API 오류')))
    print('[KHOA raw]', code, json.dumps(redact_keys(payload), ensure_ascii=False))
    item, parse_error = records_from_payload(payload)
    latest = max(item, key=lambda row: str(row.get('obsrvnDt', '')), default={})
    fields = ('obsvtrNm','obsrvnDt','lat','lot','wspd','wndrct','wvhgt','wvpd','wtem','artmp','crsp','slnty')
    results = {field: latest_field(item, field, parse_error) for field in fields}
    values = {field: results[field][0] for field in fields if field not in ('obsvtrNm','obsrvnDt')}
    states = {field: results[field][1] for field in fields}
    return {'obsCode':code, 'obsvtrNm':latest.get('obsvtrNm', fallback_name), 'obsrvnDt':latest.get('obsrvnDt'), **values, 'parseError':parse_error, 'fieldState':states, 'fieldAvailability':{field: state != 'unsupported' for field,state in states.items()}}

def restaurants(code):
    fallback = [{'name':name,'category':category,'distance':distance,'address':address,'coordinateSource':'fallback','siteUrl':f'https://map.naver.com/p/search/{urllib.parse.quote(name)}'} for name,category,distance,address in RESTAURANTS.get(code, [])]
    while len(fallback) < 3:
        name = f'부산 로컬 맛집 {len(fallback) + 1}'
        fallback.append({'name':name, 'category':'한식', 'distance':f'{len(fallback) + 1}.0km', 'address':'부산 해안 관광지 인근', 'coordinateSource':'fallback','siteUrl':f'https://map.naver.com/p/search/{urllib.parse.quote(name)}'})
    key = os.environ.get('KAKAO_REST_API_KEY')
    if not key:
        print('[KAKAO] KAKAO_REST_API_KEY configured: false')
        return {'status':'missing_key', 'data':fallback}
    lat, lot = COORDS[code]
    query = urllib.parse.urlencode({'category_group_code':'FD6','x':lot,'y':lat,'radius':'3000','sort':'distance','size':'5'})
    print(f'[KAKAO] request obsCode={code} x={lot} y={lat} key_configured=true')
    request = urllib.request.Request(f'https://dapi.kakao.com/v2/local/search/category.json?{query}', headers={'Authorization':f'KakaoAK {key}'})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode('utf-8'))
            print(f'[KAKAO] response status={response.status} documents={len(payload.get("documents", []))}')
    except urllib.error.HTTPError as error:
        body = error.read().decode('utf-8', errors='replace')
        print(f'[KAKAO ERROR] status={error.code} body={body}')
        try: reason = json.loads(body).get('msg') or json.loads(body).get('message') or json.loads(body).get('errorType') or f'카카오 API 오류 ({error.code})'
        except Exception: reason = body[:240] or f'카카오 API 오류 ({error.code})'
        return {'status':'auth_error' if error.code in (401,403) else 'api_error', 'data':fallback, 'message':reason}
    except Exception as error:
        print(f'[KAKAO ERROR] {str(error)}')
        return {'status':'api_error', 'data':fallback, 'message':'카카오 API 연결 오류'}
    data = [{'name':row.get('place_name'),'category':row.get('category_name','').split(' > ')[-1],'distance':f"{row.get('distance','?')}m",'address':row.get('road_address_name') or row.get('address_name'),'lat':null_value(row.get('y')),'lot':null_value(row.get('x')),'coordinateSource':'kakao','siteUrl':row.get('place_url') or f"https://map.naver.com/p/search/{urllib.parse.quote(row.get('place_name',''))}"} for row in payload.get('documents', [])]
    for place in fallback:
        if len(data) >= 3: break
        if not any(item['name'] == place['name'] for item in data): data.append(place)
    return {'status':'ok' if data else 'empty', 'data':data}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_GET(self):
        path = self.path.split('?')[0].rstrip('/') or '/'
        print('[HTTP]', self.command, path)
        if path == '/api/health': return self.send_json(200, {'ok':True})
        if path == '/api/restaurants':
            code = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('obsCode', [''])[0]
            try: return self.send_json(200, restaurants(code) if code in COORDS else {'status':'empty', 'data':[]})
            except Exception as error:
                print('[RESTAURANT API ERROR]', str(error))
                return self.send_json(500, {'message':str(error), 'data':[]})
        if path != '/api/ocean/buoys': return super().do_GET()
        if not os.environ.get('KHOA_SERVICE_KEY'): return self.send_json(500, {'message':'KHOA_SERVICE_KEY 환경변수가 설정되지 않았습니다.','data':[],'failures':[]})
        data, failures = [], []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            futures = {executor.submit(request_station, station): station for station in STATIONS}
            for future in concurrent.futures.as_completed(futures):
                station = futures[future]
                try: data.append(future.result())
                except Exception as error: failures.append({'obsCode':station[0], 'obsvtrNm':station[1], 'message':str(error)})
        self.send_json(200, {'requestedAt':dt.datetime.now(dt.timezone.utc).isoformat(), 'data':data, 'failures':failures})
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5500'))
    print(f'부산바다ON: http://localhost:{port}')
    print(f"[KAKAO] KAKAO_REST_API_KEY configured: {bool(os.environ.get('KAKAO_REST_API_KEY'))}")
    ThreadingHTTPServer(('', port), Handler).serve_forever()
