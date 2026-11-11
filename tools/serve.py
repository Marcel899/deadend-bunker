"""Static dev server that never caches (so edits show up on reload). Usage: python tools/serve.py [port]"""
import sys, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate'); self.send_header('Expires', '0'); super().end_headers()
    def log_message(self, *a): pass
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
print('serving on http://127.0.0.1:%d/' % port, flush=True)
ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
