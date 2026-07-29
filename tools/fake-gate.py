#!/usr/bin/env python3
"""A pretend crossing gate, so the device link can be tested without hardware.

Speaks the same tiny HTTP API as the real gate:

    GET /status  -> {"state": "up" | "down" | "raising" | "lowering"}
    GET /open    -> raise the arm
    GET /close   -> lower the arm
    GET /press   -> what the PHYSICAL BUTTON does: toggle, device-initiated.
                    This is the one that proves two-way sync — the game should
                    follow along on screen without anyone touching the browser.

    python3 tools/fake-gate.py 8099        # then put 127.0.0.1:8099 in settings

CORS. A browser will not let the page read /status unless the device sends
`Access-Control-Allow-Origin`. The real gate firmware must send it too, or the
game can drive the gate but never hear back from it. This mock sends `*`, which
is what the device should do — it is on a home LAN serving one toy.
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

state = {'value': 'up'}


class Gate(BaseHTTPRequestHandler):
    def _send(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?')[0].rstrip('/') or '/'
        if path == '/close':
            state['value'] = 'down'
        elif path == '/open':
            state['value'] = 'up'
        elif path == '/press':
            state['value'] = 'up' if state['value'] == 'down' else 'down'
            sys.stderr.write('physical button -> %s\n' % state['value'])
        self._send({'state': state['value']})

    def log_message(self, *args):
        pass                      # the polling loop would drown everything else


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    print('fake crossing gate on http://127.0.0.1:%d  (/status /open /close /press)' % port)
    HTTPServer(('127.0.0.1', port), Gate).serve_forever()
