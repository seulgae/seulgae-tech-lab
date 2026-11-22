"""채용 접수 전용 API로 정형 JSON을 등록한다. 토큰은 파일에서만 읽고 출력하지 않는다."""
import argparse
import json
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True, help='baseUrl, tokenFile을 담은 비공개 설정 파일')
    parser.add_argument('--input', required=True, help='분석·정형화한 공고 배열 JSON')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf-8-sig'))
    base = config['baseUrl'].rstrip('/')
    parsed = urlparse(base)
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Invalid base URL')
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', 'localhost')):
        raise ValueError('HTTPS is required')
    token = Path(config['tokenFile']).read_text(encoding='utf-8-sig').strip()
    if len(token) < 32:
        raise ValueError('Intake token is not configured')
    payload = json.loads(Path(args.input).read_text(encoding='utf-8-sig'))
    if not isinstance(payload, list) or not 1 <= len(payload) <= 10:
        raise ValueError('Expected 1-10 postings')
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    if len(body) > 600000:
        raise ValueError('Payload too large')
    request = Request(base + '/api/recruitment/intake', data=body, method='POST',
                      headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=30) as response:
            result = json.load(response)
        print(json.dumps(result, ensure_ascii=False))
    except HTTPError as error:
        print(f'Intake rejected: HTTP {error.code}. No automatic retry; check dashboard.', file=sys.stderr)
        return 1
    except URLError:
        print('Connection failed. Check dashboard before retrying; the request may have been committed.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
