import io
import requests

class HttpRangeFile(io.RawIOBase):
    def __init__(self, url, session=None, timeout=120):
        self.url = url
        self.s = session or requests.Session()
        self.timeout = timeout
        r = self.s.head(url, timeout=timeout, allow_redirects=True)
        if r.status_code not in (200, 206):
            r = self.s.get(url, headers={"Range": "bytes=0-0"}, timeout=timeout)
        if r.status_code not in (200, 206):
            raise IOError(f"HTTP {r.status_code}: {r.text[:200]}")
        self.size = int(r.headers.get("Content-Length") or 0)
        cr = r.headers.get("Content-Range")
        if cr and "/" in cr:
            self.size = int(cr.rsplit("/", 1)[1])
        self.pos = 0

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, offset, whence=0):
        if whence == 0: self.pos = offset
        elif whence == 1: self.pos += offset
        elif whence == 2: self.pos = self.size + offset
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        if n <= 0 or self.pos >= self.size:
            return b""
        end = min(self.pos + n, self.size) - 1
        r = self.s.get(self.url, headers={"Range": f"bytes={self.pos}-{end}"}, timeout=self.timeout)
        if r.status_code not in (200, 206):
            raise IOError(f"HTTP {r.status_code}: {r.text[:200]}")
        data = r.content
        self.pos += len(data)
        return data

    def readinto(self, b):
        data = self.read(len(b))
        b[:len(data)] = data
        return len(data)

def open_zip(url):
    f = HttpRangeFile(url)
    return __import__("zipfile").ZipFile(io.BufferedReader(f, buffer_size=256 * 1024))
