#!/usr/bin/env python3
"""Render a page, run script in it, and report every console message.

`shot.js` does the same thing with Playwright. This is the no-Node fallback: it
drives a headless Google Chrome over the DevTools Protocol using nothing but the
Python standard library, so a machine with a browser and Python can still run
the review loop — render, look, check the console.

    python3 tools/shot.py play/index.html out.png
    python3 tools/shot.py play/index.html out.png --size 1280x800 --wait 2
    python3 tools/shot.py play/index.html out.png --eval "CC.gate.close()" --wait 3
    python3 tools/shot.py play/index.html out.png --click "#closeBtn" --wait 2

Exit code is 1 if the page logged an error or warning, so it doubles as a check.
"""
import argparse
import base64
import json
import os
import pathlib
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request

CHROME_CANDIDATES = [
    os.environ.get('CHROMIUM_PATH', ''),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
]


def find_chrome():
    for c in CHROME_CANDIDATES:
        if c and pathlib.Path(c).exists():
            return c
    sys.exit('No Chrome/Chromium found. Set CHROMIUM_PATH.')


class WS:
    """The smallest WebSocket client that can talk to Chrome (RFC 6455, text only)."""

    def __init__(self, url):
        _, rest = url.split('://', 1)
        hostport, path = rest.split('/', 1)
        host, port = hostport.split(':')
        self.sock = socket.create_connection((host, int(port)))
        self.sock.settimeout(30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((
            'GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
            'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n'
            % (path, hostport, key)).encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.sock.recv(4096)
        self.buf = buf.split(b'\r\n\r\n', 1)[1]

    def send(self, payload):
        data = payload.encode()
        header = bytearray([0x81])
        mask = os.urandom(4)
        n = len(data)
        if n < 126:
            header.append(0x80 | n)
        elif n < 1 << 16:
            header.append(0x80 | 126)
            header += struct.pack('>H', n)
        else:
            header.append(0x80 | 127)
            header += struct.pack('>Q', n)
        header += mask
        self.sock.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise EOFError('socket closed')
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        while True:
            b0, b1 = self._read(2)
            opcode, n = b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack('>H', self._read(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._read(8))[0]
            payload = self._read(n)
            if opcode == 0x1:
                return payload.decode('utf-8', 'replace')
            if opcode == 0x8:
                raise EOFError('closed by peer')


class Page:
    def __init__(self, ws_url):
        self.ws = WS(ws_url)
        self.id = 0
        self.events = []

    def call(self, method, **params):
        self.id += 1
        want = self.id
        self.ws.send(json.dumps({'id': want, 'method': method, 'params': params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == want:
                if 'error' in msg:
                    raise RuntimeError('%s: %s' % (method, msg['error']))
                return msg.get('result', {})
            if 'method' in msg:
                self.events.append(msg)

    def pump(self, seconds):
        """Let the page run, collecting events."""
        end = time.time() + seconds
        self.ws.sock.settimeout(0.2)
        while time.time() < end:
            try:
                msg = json.loads(self.ws.recv())
            except (socket.timeout, TimeoutError):
                continue
            if 'method' in msg:
                self.events.append(msg)
        self.ws.sock.settimeout(30)


def describe(arg):
    if 'value' in arg:
        return json.dumps(arg['value']) if not isinstance(arg['value'], str) else arg['value']
    return arg.get('description', arg.get('type', '?'))


def main():
    class Step(argparse.Action):
        """Collect --eval/--click/--tap into ONE list, in the order given on the
        command line. Separate lists would silently reorder the steps, and a tap
        that happens before the eval that was meant to set it up is a test that
        quietly lies to you."""
        def __call__(self, parser, ns, value, option_string=None):
            ns.steps = getattr(ns, 'steps', None) or []
            ns.steps.append((option_string.lstrip('-'), value))

    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('output', nargs='?')
    ap.add_argument('--size', default='1280x800')
    ap.add_argument('--wait', type=float, action=Step,
                    help='let the page run for N seconds at this point in the sequence')
    ap.add_argument('--load-wait', type=float, default=1.5,
                    help='seconds to settle after navigation, before the first step')
    ap.add_argument('--eval', action=Step, help='JS to run, in command-line order')
    ap.add_argument('--click', action=Step, help='CSS selector to click (synthetic)')
    ap.add_argument('--key', action=Step,
                    help='press a key for real, e.g. Space or Escape (a real gesture, like --tap)')
    ap.add_argument('--tap', action=Step,
                    help='CSS selector to tap with a REAL input event. Unlike --click this '
                         'counts as a user gesture, so audio and speech are allowed to start — '
                         'which is the only way to check the console the way a child would see it.')
    ap.add_argument('--serve', action='store_true', help='serve over http instead of file://')
    args = ap.parse_args()

    width, height = (int(v) for v in args.size.lower().split('x'))
    root = pathlib.Path(__file__).resolve().parent.parent
    target = pathlib.Path(args.input).resolve()
    out = pathlib.Path(args.output or (str(target).rsplit('.', 1)[0] + '.png'))

    server = None
    if args.serve:
        server = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'],
                                  cwd=str(root), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.8)
        url = 'http://127.0.0.1:8765/' + str(target.relative_to(root))
    else:
        url = target.as_uri()

    profile = tempfile.mkdtemp(prefix='cc-shot-')
    port = 9223
    chrome = subprocess.Popen([
        find_chrome(), '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--remote-debugging-port=%d' % port, '--user-data-dir=' + profile,
        '--window-size=%d,%d' % (width, height), '--no-first-run', '--no-default-browser-check',
        '--allow-file-access-from-files', 'about:blank',
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    ws_url = None
    for _ in range(80):
        try:
            tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/json' % port, timeout=1).read())
            pages = [t for t in tabs if t.get('type') == 'page']
            if pages:
                ws_url = pages[0]['webSocketDebuggerUrl']
                break
        except Exception:
            time.sleep(0.25)
    if not ws_url:
        chrome.kill()
        sys.exit('could not reach Chrome DevTools')

    code = 0
    try:
        page = Page(ws_url)
        page.call('Runtime.enable')
        page.call('Log.enable')
        page.call('Page.enable')
        page.call('Emulation.setDeviceMetricsOverride', width=width, height=height,
                  deviceScaleFactor=2, mobile=False)
        page.call('Page.navigate', url=url)
        page.pump(max(args.load_wait, 0.6))

        for kind, value in getattr(args, 'steps', None) or []:
            if kind == 'wait':
                page.pump(value)
            elif kind == 'tap':
                box = page.call('Runtime.evaluate', returnByValue=True, expression=(
                    "(function(){var e=document.querySelector(%s); if(!e) return null;"
                    "var r=e.getBoundingClientRect();"
                    "return {x:r.left+r.width/2, y:r.top+r.height/2}})()" % json.dumps(value)))
                pos = box.get('result', {}).get('value')
                if not pos:
                    print('no element to tap for ' + value, file=sys.stderr)
                    code = 1
                    continue
                for ev in ('mousePressed', 'mouseReleased'):
                    page.call('Input.dispatchMouseEvent', type=ev, x=pos['x'], y=pos['y'],
                              button='left', clickCount=1,
                              buttons=1 if ev == 'mousePressed' else 0)
                page.pump(0.7)
            elif kind == 'key':
                keys = {'Space': (32, ' '), 'Escape': (27, ''), 'Enter': (13, '\r')}
                vk, text = keys.get(value, (0, ''))   # not `code` — that is the exit status
                for ev in ('keyDown', 'keyUp'):
                    page.call('Input.dispatchKeyEvent', type=ev, code=value, key=value,
                              windowsVirtualKeyCode=vk,
                              **({'text': text} if ev == 'keyDown' and text else {}))
                page.pump(0.5)
            elif kind == 'click':
                page.call('Runtime.evaluate', awaitPromise=True, expression=(
                    "(function(){var e=document.querySelector(%s);"
                    "if(!e) throw new Error('no element for %s');"
                    "e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));"
                    "e.click();return true})()" % (json.dumps(value), value)))
                page.pump(0.7)
            else:
                r = page.call('Runtime.evaluate', expression=value,
                              awaitPromise=True, returnByValue=True)
                if r.get('exceptionDetails'):
                    print('eval threw:', r['exceptionDetails'].get('text'), file=sys.stderr)
                    code = 1
                elif 'result' in r and 'value' in r['result']:
                    print('eval:', json.dumps(r['result']['value'])[:2000])
                page.pump(0.5)

        page.pump(0.6)
        shot = page.call('Page.captureScreenshot', format='png')
        out.write_bytes(base64.b64decode(shot['data']))
        print('wrote %s (%dx%d)' % (out, width, height))

        problems = []
        for ev in page.events:
            if ev['method'] == 'Runtime.consoleAPICalled':
                kind = ev['params']['type']
                text = ' '.join(describe(a) for a in ev['params'].get('args', []))
                if kind in ('error', 'warning', 'assert'):
                    problems.append('console.%s: %s' % (kind, text))
                else:
                    print('log:', text[:400])
            elif ev['method'] == 'Runtime.exceptionThrown':
                d = ev['params']['exceptionDetails']
                problems.append('uncaught: %s' % (d.get('exception', {}).get('description') or d.get('text')))
            elif ev['method'] == 'Log.entryAdded':
                e = ev['params']['entry']
                if e['level'] in ('error', 'warning'):
                    problems.append('%s [%s]: %s' % (e['level'], e.get('source'), e['text']))
        if problems:
            code = 1
            print('\n%d console problem(s):' % len(problems), file=sys.stderr)
            for p in problems:
                print('  ' + p, file=sys.stderr)
        else:
            print('console clean')
    finally:
        chrome.kill()
        if server:
            server.kill()
        shutil.rmtree(profile, ignore_errors=True)
    sys.exit(code)


if __name__ == '__main__':
    main()
