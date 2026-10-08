#!/usr/bin/env python3
"""Move gifos.app between GitHub Pages and Cloudflare Pages.

Modes, from the MODE environment variable:

  inspect   Print apex and www records, the SSL mode, Pages domains, and
            the GIF routes. Changes nothing.
  apply     Attach gifos.app and www.gifos.app when the records are still
            the GitHub Pages ones. Restore those records if the live checks
            fail.
  rollback  Put the GitHub Pages records back, detach the Pages domains,
            and delete the two GIF routes.
  verify    Public checks only. No token and no changes.
  dns       Print authoritative answers. No token and no changes.

The token, the account id, and the zone id are never printed.
"""

import gzip
import hashlib
import http.client
import ipaddress
import json
import os
import random
import socket
import ssl
import struct
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cloudflare.com/client/v4"
APEX = "gifos.app"
WWW = "www.gifos.app"
PROJECT = "gifos"
WORKER = "gifos-gifs"
ROUTE_PATTERNS = ("gifos.app/apps/*", "gifos.app/_goal.gif*")
GH_A = {
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
}
GH_AAAA = {
    "2606:50c0:8000::153",
    "2606:50c0:8001::153",
    "2606:50c0:8002::153",
    "2606:50c0:8003::153",
}
WWW_CNAME = "nwcnwc.github.io"
MIN_BUILD = 2560
GIF_SHA256 = "4942aa92b36a6ded5a0393836389f51dd8fe365788f175c3c896a3198541b501"
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
OWNED_TYPES = {"A", "AAAA", "CNAME"}
KEPT_TYPES = {"TXT", "CAA", "MX"}

ACCOUNT = ""
TOKEN = ""
ZONE = ""


class GiveUp(Exception):
    """The cutover is wrong. Apply restores DNS before exiting."""


class Inconclusive(Exception):
    """The edge answered, but not in a way that proves the site."""


def scrub(text):
    text = str(text)
    for secret, label in ((TOKEN, "<token>"), (ACCOUNT, "<account>"), (ZONE, "<zone>")):
        if secret:
            text = text.replace(secret, label)
    return text


def log(line):
    print(scrub(line), flush=True)


def api(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode())
            return resp.status, payload
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"success": False, "errors": [{"code": err.code, "message": raw[:400]}]}
        return err.code, payload


def err_text(payload):
    parts = []
    for item in payload.get("errors") or []:
        parts.append(f"{item.get('code')}: {item.get('message')}")
    if not parts:
        parts.append(json.dumps(payload)[:400])
    return scrub("; ".join(parts))


def require_token():
    global ACCOUNT, TOKEN
    ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    if not ACCOUNT or not TOKEN:
        raise SystemExit("Cloudflare credentials are not set")


def load_zone():
    global ZONE
    status, payload = api("GET", "/zones?name=" + APEX)
    if status != 200 or not payload.get("success"):
        raise SystemExit("zone lookup failed: " + err_text(payload))
    zones = [item for item in payload.get("result") or [] if item.get("name") == APEX]
    if len(zones) != 1:
        raise SystemExit(f"expected one {APEX} zone, found {len(zones)}")
    ZONE = zones[0]["id"]
    return zones[0]


def list_records(name):
    out = []
    page = 1
    while True:
        query = urllib.parse.urlencode({"name": name, "per_page": 100, "page": page})
        status, payload = api("GET", f"/zones/{ZONE}/dns_records?{query}")
        if status != 200 or not payload.get("success"):
            raise SystemExit("dns list failed: " + err_text(payload))
        out.extend(payload.get("result") or [])
        info = payload.get("result_info") or {}
        if page >= info.get("total_pages", 1):
            return out
        page += 1


def norm_content(typ, content):
    content = str(content).rstrip(".")
    if typ == "A":
        return str(ipaddress.IPv4Address(content))
    if typ == "AAAA":
        return str(ipaddress.IPv6Address(content))
    return content.lower()


def record_key(rec):
    return (rec["type"], norm_content(rec["type"], rec["content"]), bool(rec.get("proxied")))


def shape(name, records):
    """Return (ok, reason). TXT, CAA, and MX may sit beside the address records."""
    unexpected = [rec for rec in records if rec["type"] not in OWNED_TYPES | KEPT_TYPES]
    if unexpected:
        return False, "unexpected type " + ",".join(sorted({rec["type"] for rec in unexpected}))
    owned = [rec for rec in records if rec["type"] in OWNED_TYPES]
    if any(rec.get("proxied") for rec in owned):
        return False, "a record is proxied"
    got = {(rec["type"], norm_content(rec["type"], rec["content"])) for rec in owned}
    if name == APEX:
        want = {("A", ip) for ip in GH_A}
        if got != want:
            return False, "apex is not the four GitHub A records"
        return True, "github A records"
    if len(owned) == 1 and owned[0]["type"] == "CNAME":
        if norm_content("CNAME", owned[0]["content"]) == WWW_CNAME:
            return True, "github pages CNAME"
        return False, "www CNAME is not " + WWW_CNAME
    want = {("A", ip) for ip in GH_A} | {("AAAA", norm_content("AAAA", ip)) for ip in GH_AAAA}
    if got == want:
        return True, "github A and AAAA"
    return False, "www is not the GitHub CNAME or the GitHub addresses"


def print_records(name, records):
    ok, reason = shape(name, records)
    log(f"SHAPE {name} {'ok' if ok else 'NO'} {reason} count={len(records)}")
    for rec in records:
        log(
            f"RECORD {rec.get('type')} {rec.get('name')} {rec.get('content')} "
            f"proxied={bool(rec.get('proxied'))} ttl={rec.get('ttl')}"
        )


def pages_project():
    status, payload = api("GET", f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}")
    if status != 200 or not payload.get("success"):
        raise SystemExit("pages project lookup failed: " + err_text(payload))
    return payload["result"]


def pages_target(project):
    sub = str(project.get("subdomain") or "").strip().rstrip(".")
    if sub.endswith(".pages.dev") and "/" not in sub:
        return sub
    if sub and "." not in sub and "/" not in sub:
        return sub + ".pages.dev"
    raise GiveUp("pages project has no subdomain label")


def domain_on_project(name):
    status, payload = api(
        "GET", f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/domains/{name}"
    )
    return status == 200 and bool(payload.get("success"))


def conflict(payload):
    text = err_text(payload).lower()
    if "already associated" in text or "already added" in text:
        return False
    return any(
        phrase in text
        for phrase in (
            "already exists",
            "already in use",
            "dns record",
            "record with that host",
            "hostname already",
        )
    )


def delete_record(rec):
    status, payload = api("DELETE", f"/zones/{ZONE}/dns_records/{rec['id']}")
    if status != 200 or not payload.get("success"):
        raise GiveUp("dns delete failed: " + err_text(payload))
    log(f"DELETED {rec['type']} {rec['name']} {rec['content']}")


def create_record(rec):
    body = {
        "type": rec["type"],
        "name": rec["name"],
        "content": rec["content"],
        "ttl": rec.get("ttl") or 1,
        "proxied": bool(rec.get("proxied")),
    }
    status, payload = api("POST", f"/zones/{ZONE}/dns_records", body)
    if status != 200 or not payload.get("success"):
        raise GiveUp("dns create failed: " + err_text(payload))
    log(f"CREATED {body['type']} {body['name']} {body['content']} proxied={body['proxied']}")


def delete_owned(name):
    for rec in list_records(name):
        if rec["type"] in OWNED_TYPES:
            delete_record(rec)


def points_at_pages(records, target):
    target = target.lower()
    for rec in records:
        if rec["type"] not in OWNED_TYPES or not rec.get("proxied"):
            continue
        content = norm_content(rec["type"], rec["content"])
        if rec["type"] == "CNAME" and content == target:
            return True
        if rec["type"] == "A" and content not in GH_A:
            return True
    return False


def attach(name, target):
    status, payload = api(
        "POST",
        f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/domains",
        {"name": name},
    )
    if not (status == 200 and payload.get("success")):
        if domain_on_project(name):
            log(f"DOMAIN {name} already on the project")
        elif conflict(payload):
            log(f"DOMAIN {name} blocked by the existing records; clearing them")
            delete_owned(name)
            status, payload = api(
                "POST",
                f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/domains",
                {"name": name},
            )
            if not (status == 200 and payload.get("success")) and not domain_on_project(name):
                raise GiveUp(f"domain attach failed for {name}: " + err_text(payload))
        else:
            raise GiveUp(f"domain attach failed for {name}: " + err_text(payload))
    else:
        result = payload.get("result") or {}
        log(f"DOMAIN {name} status={result.get('status')}")
    for _ in range(8):
        current = list_records(name)
        if points_at_pages(current, target):
            log(f"DNS {name} points at {target}")
            return
        time.sleep(5)
    log(f"DNS {name} was not moved by the domain attach; writing the CNAME")
    delete_owned(name)
    create_record({"type": "CNAME", "name": name, "content": target, "ttl": 1, "proxied": True})
    if not points_at_pages(list_records(name), target):
        raise GiveUp(f"DNS for {name} does not point at {target}")
    # The domain answers 522 until Pages has finished attaching the hostname.
    deadline = time.time() + 180
    while True:
        status, payload = api(
            "GET", f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/domains/{name}"
        )
        value = (payload.get("result") or {}).get("status") if payload.get("success") else "unreadable"
        log(f"DOMAIN {name} status={value}")
        if value == "active":
            return
        if value in ("error", "blocked", "deactivated"):
            raise GiveUp(f"{name} domain {value} " + err_text(payload))
        if time.time() > deadline:
            log(f"DOMAIN {name} still {value}; HTTPS checks will keep waiting")
            return
        time.sleep(10)


def restore(snapshot):
    for name, wanted in snapshot.items():
        wanted_owned = [rec for rec in wanted if rec["type"] in OWNED_TYPES]
        for rec in list_records(name):
            if rec["type"] not in OWNED_TYPES:
                continue
            if not any(record_key(rec) == record_key(old) for old in wanted_owned):
                delete_record(rec)
        current = list_records(name)
        for old in wanted_owned:
            old = dict(old)
            old["proxied"] = False
            if any(record_key(rec) == record_key(old) for rec in current):
                continue
            create_record(old)
    for name in (WWW, APEX):
        status, payload = api(
            "DELETE", f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/domains/{name}"
        )
        if status == 200 and payload.get("success"):
            log(f"DOMAIN {name} removed")
        elif status == 404:
            log(f"DOMAIN {name} was not attached")
        else:
            log(f"DOMAIN {name} remove failed: " + err_text(payload))
    status, payload = api("GET", f"/zones/{ZONE}/workers/routes")
    if status != 200 or not payload.get("success"):
        log("ROUTE list failed: " + err_text(payload))
        return
    for route in payload.get("result") or []:
        if route.get("script") != WORKER or route.get("pattern") not in ROUTE_PATTERNS:
            continue
        code, body = api("DELETE", f"/zones/{ZONE}/workers/routes/{route['id']}")
        if code == 200 and body.get("success"):
            log(f"ROUTE deleted {route.get('pattern')}")
        else:
            log(f"ROUTE delete failed {route.get('pattern')}: " + err_text(body))


def read_ssl():
    status, payload = api("GET", f"/zones/{ZONE}/settings/ssl")
    if status == 200 and payload.get("success"):
        value = (payload.get("result") or {}).get("value")
        log(f"SSL {value}")
        return value
    log(f"SSL unreadable {status} " + err_text(payload))
    return None


def ensure_ssl(value):
    if value in ("full", "strict"):
        return
    if value in ("flexible", "off"):
        status, payload = api("PATCH", f"/zones/{ZONE}/settings/ssl", {"value": "strict"})
        if status != 200 or not payload.get("success"):
            raise GiveUp("SSL is " + value + " and could not be set to strict: " + err_text(payload))
        log("SSL set to strict")
        return
    log("SSL mode was not readable; a redirect loop restores the GitHub records")


def doh(name, qtype):
    url = f"https://cloudflare-dns.com/dns-query?name={name}&type={qtype}"
    req = urllib.request.Request(url, headers={"Accept": "application/dns-json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def parse_name(data, offset):
    labels = []
    jumped = False
    end = offset
    seen = set()
    while offset < len(data):
        length = data[offset]
        if length == 0:
            if not jumped:
                end = offset + 1
            break
        if length & 0xC0 == 0xC0:
            if offset + 1 >= len(data):
                break
            pointer = ((length & 0x3F) << 8) | data[offset + 1]
            if pointer in seen or pointer >= len(data):
                break
            seen.add(pointer)
            if not jumped:
                end = offset + 2
            offset = pointer
            jumped = True
            continue
        offset += 1
        labels.append(data[offset:offset + length].decode("ascii", "replace"))
        offset += length
        if not jumped:
            end = offset
    return ".".join(labels), end


def recvall(sock, size):
    buf = b""
    while len(buf) < size:
        chunk = sock.recv(size - len(buf))
        if not chunk:
            raise OSError("short tcp dns read")
        buf += chunk
    return buf


def dns_query(server, name, qtype):
    tid = random.randrange(0, 65536)
    header = struct.pack(">HHHHHH", tid, 0x0100, 1, 0, 0, 0)
    question = b"".join(
        bytes([len(label)]) + label.encode("ascii") for label in name.split(".") if label
    ) + b"\x00" + struct.pack(">HH", qtype, 1)
    packet = header + question
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(5)
    try:
        sock.sendto(packet, (server, 53))
        data, _ = sock.recvfrom(4096)
    finally:
        sock.close()
    if len(data) < 12:
        raise OSError("short dns reply")
    flags = struct.unpack(">H", data[2:4])[0]
    if flags & 0x0200:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        try:
            sock.connect((server, 53))
            sock.sendall(struct.pack(">H", len(packet)) + packet)
            data = recvall(sock, 2)
            data = recvall(sock, struct.unpack(">H", data)[0])
        finally:
            sock.close()
    _tid, _flags, qd, an, _ns, _ar = struct.unpack(">HHHHHH", data[:12])
    offset = 12
    for _ in range(qd):
        _, offset = parse_name(data, offset)
        offset += 4
    answers = []
    for _ in range(an):
        _owner, offset = parse_name(data, offset)
        typ, _cls, _ttl, rdlen = struct.unpack(">HHIH", data[offset:offset + 10])
        offset += 10
        rdata = data[offset:offset + rdlen]
        offset += rdlen
        if typ == 1 and len(rdata) == 4:
            answers.append(("A", socket.inet_ntoa(rdata)))
        elif typ == 28 and len(rdata) == 16:
            answers.append(("AAAA", str(ipaddress.IPv6Address(rdata))))
        elif typ == 5:
            target, _ = parse_name(data, offset - rdlen)
            answers.append(("CNAME", target))
    return answers


def authoritative(name, qtype):
    ns_payload = doh(APEX, "NS")
    servers = []
    for item in ns_payload.get("Answer") or []:
        if item.get("type") == 2:
            host = str(item.get("data") or "").rstrip(".")
            if host:
                servers.append(host)
    errors = []
    for host in servers:
        try:
            addr = socket.getaddrinfo(host, 53, socket.AF_INET, socket.SOCK_DGRAM)[0][4][0]
            return dns_query(addr, name, qtype)
        except OSError as err:
            errors.append(str(err))
    raise OSError("authoritative lookup failed: " + "; ".join(errors))


def browser_headers(host):
    return {
        "Host": host,
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
    }


class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, ip, hostname):
        context = ssl.create_default_context()
        super().__init__(hostname, 443, timeout=30, context=context)
        self._ip = ip

    def connect(self):
        sock = socket.create_connection((self._ip, 443), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def exchange(host, path, method="GET"):
    answers = authoritative(host, 1)
    addresses = [value for typ, value in answers if typ == "A"]
    if not addresses:
        cnames = [value for typ, value in answers if typ == "CNAME"]
        if not cnames:
            cnames = [value for typ, value in authoritative(host, 5) if typ == "CNAME"]
        if cnames:
            target = cnames[0].rstrip(".")
            info = socket.getaddrinfo(target, 443, socket.AF_INET, socket.SOCK_STREAM)
            addresses = [item[4][0] for item in info]
    if not addresses:
        raise OSError(f"no address for {host}")
    ip = addresses[0]
    if method == "GET" and path.startswith("http://"):
        raise ValueError(path)
    conn_cls = PinnedHTTPS
    conn = conn_cls(ip, host)
    try:
        conn.request(method, path, headers=browser_headers(host))
        resp = conn.getresponse()
        body = resp.read()
        headers = {key.lower(): value for key, value in resp.getheaders()}
        if headers.get("content-encoding") == "gzip":
            body = gzip.decompress(body)
        return resp.status, headers, body, ip
    finally:
        conn.close()


def fetch(url):
    seen = []
    hops = []
    current = urllib.parse.urlsplit(url)
    for _ in range(7):
        key = (current.hostname, current.path or "/", current.query)
        if key in seen:
            raise GiveUp("redirect loop at " + urllib.parse.urlunsplit(current))
        seen.append(key)
        path = current.path or "/"
        if current.query:
            path += "?" + current.query
        try:
            status, headers, body, ip = exchange(current.hostname, path)
        except ssl.SSLError as err:
            raise Inconclusive("tls " + scrub(err)) from err
        except (OSError, http.client.HTTPException) as err:
            raise Inconclusive("connect " + scrub(err)) from err
        server = headers.get("server", "")
        hops.append((status, server, urllib.parse.urlunsplit(current), ip))
        if "github" in server.lower() or "x-github-request-id" in headers:
            where = urllib.parse.urlunsplit(current)
            raise Inconclusive(f"{where} still served by GitHub from {ip}")
        if status in (301, 302, 303, 307, 308):
            location = headers.get("location")
            if not location:
                raise GiveUp("redirect with no location")
            current = urllib.parse.urlsplit(urllib.parse.urljoin(urllib.parse.urlunsplit(current), location))
            continue
        return status, headers, body, ip, hops
    raise GiveUp("too many redirects")


def assert_page(url, needle, status=200):
    code, headers, body, ip, _seen = fetch(url)
    server = headers.get("server", "")
    if b"error code: 1010" in body:
        raise Inconclusive(url + " blocked the check")
    if code in (520, 521, 522, 523, 525, 526):
        raise Inconclusive(f"{url} status {code}")
    if "cloudflare" not in server.lower() and "cf-ray" not in headers:
        raise Inconclusive(url + " server " + server)
    if code != status:
        raise GiveUp(f"{url} status {code}")
    if needle not in body:
        raise GiveUp(f"{url} did not contain the expected bytes")
    log(f"OK {code} {url} via {ip}")
    return headers, body


def assert_bytes(url, content_type, magic):
    code, headers, body, _ip, _seen = fetch(url)
    server = headers.get("server", "")
    if b"error code: 1010" in body:
        raise Inconclusive(url + " blocked the check")
    if code in (520, 521, 522, 523, 525, 526):
        raise Inconclusive(f"{url} status {code}")
    if code != 200:
        raise GiveUp(f"{url} status {code} type={headers.get('content-type')}")
    got = headers.get("content-type", "").split(";")[0].strip().lower()
    if got != content_type or not body.startswith(magic):
        raise GiveUp(f"{url} is {got} {body[:12]!r}, not {content_type}")
    log(f"OK 200 {url} {got} {len(body)}")
    return body


def plain_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read(), {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as err:
        return err.code, err.read(), {k.lower(): v for k, v in err.headers.items()}


def verify_public():
    home_headers, home = assert_page("https://gifos.app/", b"desktop.js")
    _headers, build = assert_page("https://gifos.app/js/build.js", b"GIFOS_BUILD")
    text = build.decode("utf-8", "replace")
    digits = ""
    marker = "GIFOS_BUILD"
    at = text.find(marker)
    if at >= 0:
        tail = text[at + len(marker):]
        digits = "".join(ch for ch in tail if ch.isdigit() or ch == "=").split("=", 1)[-1]
        digits = "".join(ch for ch in digits if ch.isdigit())
    if not digits or int(digits) < MIN_BUILD:
        raise GiveUp(f"build {digits or 'missing'} is below {MIN_BUILD}")
    log(f"OK build {digits}")
    assert_page("https://gifos.app/run.html", b"<!DOCTYPE html>")
    assert_page("https://gifos.app/store.html", b"<!DOCTYPE html>")
    assert_page("https://gifos.app/versions/0.9.19/", b"/versions/0.9.19/")
    assert_page("https://gifos.app/meet/rehearsal-check", b"Join on GifOS", status=404)
    assert_page("https://www.gifos.app/", b"desktop.js")
    assert_bytes("https://gifos.app/apps/2048/cover.jpg", "image/jpeg", b"\xff\xd8\xff")
    gif = assert_bytes("https://gifos.app/apps/2048/2048.gif", "image/gif", b"GIF8")
    digest = hashlib.sha256(gif).hexdigest()
    if digest != GIF_SHA256:
        raise GiveUp("2048 gif sha256 " + digest)
    catalog_headers, catalog = assert_page(
        "https://gifos.app/apps/2048/app.json", b'"sha256"'
    )
    if GIF_SHA256 not in catalog.decode("utf-8", "replace"):
        raise GiveUp("served app.json sha256 differs from the gif")
    log("OK 2048 sha256 matches the catalog")
    assert_bytes("https://gifos.app/_goal.gif", "image/gif", b"GIF8")
    # A datacenter address can draw a bot-challenge page from these hosts.
    # That does not say the host is down; a wrong answer does.
    check_neighbor("relay", "https://relay.gifos.app/", lambda code, body: code == 200 and body.strip() == b"gifos relay ok")
    check_neighbor("pay", "https://pay.gifos.app/", lambda code, body: code == 404 and b"no such endpoint" in body)
    check_neighbor("cors-proxy", "https://cors-proxy.gifos.app/", lambda code, body: code == 403 and b"only serves GifOS" in body)
    check_neighbor("mirror", "https://7.gifos.app/", lambda code, body: code == 200 and b"desktop.js" in body)
    del home_headers, catalog_headers


def check_neighbor(name, url, ok):
    code, body, _headers = plain_get(url)
    if b"error code: 1010" in body or b"error code: 1012" in body:
        log(f"NEIGHBOR {name} challenged the checker")
        return
    if not ok(code, body):
        raise GiveUp(f"{name} {code} {body[:80]!r}")
    log(f"OK {name}")


def inspect():
    zone = load_zone()
    log(f"ZONE status={zone.get('status')} plan={((zone.get('plan') or {}).get('name'))}")
    for name in (APEX, WWW):
        print_records(name, list_records(name))
    read_ssl()
    project = pages_project()
    log("PAGES subdomain=" + str(project.get("subdomain")))
    status, payload = api("GET", f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/domains")
    if status != 200 or not payload.get("success"):
        log("DOMAIN list failed: " + err_text(payload))
    else:
        for item in payload.get("result") or []:
            log(f"DOMAIN {item.get('name')} status={item.get('status')}")
    status, payload = api("GET", f"/zones/{ZONE}/workers/routes")
    if status != 200 or not payload.get("success"):
        log("ROUTE list failed: " + err_text(payload))
    else:
        for route in payload.get("result") or []:
            if route.get("script") == WORKER or str(route.get("pattern", "")).startswith("gifos.app/"):
                log(f"ROUTE {route.get('pattern')} script={route.get('script')}")
    for name, qtype in ((APEX, 1), (WWW, 5), (WWW, 1)):
        try:
            log(f"AUTH {name} {authoritative(name, qtype)}")
        except OSError as err:
            log(f"AUTH {name} failed {scrub(err)}")


def apply_cutover():
    load_zone()
    snapshot = {name: list_records(name) for name in (APEX, WWW)}
    for name, records in snapshot.items():
        print_records(name, records)
        ok, reason = shape(name, records)
        if not ok:
            raise SystemExit(f"refusing to change {name}: {reason}")
    ensure_ssl(read_ssl())
    target = pages_target(pages_project())
    log(f"PAGES target {target}")
    try:
        attach(APEX, target)
        attach(WWW, target)
        deadline = time.time() + 360
        while True:
            try:
                verify_public()
                log("VERDICT pass")
                return
            except Inconclusive as err:
                if time.time() > deadline:
                    raise GiveUp("checks stayed inconclusive: " + str(err)) from err
                log(f"RETRY {err}")
                time.sleep(10)
    except (GiveUp, Inconclusive, OSError, urllib.error.URLError) as err:
        log(f"VERDICT rollback {err}")
        try:
            restore(snapshot)
            log("VERDICT restored")
        except (GiveUp, OSError, urllib.error.URLError) as restore_err:
            log(f"VERDICT restore-failed {restore_err}")
        raise SystemExit(1)


def rollback():
    load_zone()
    snapshot = {}
    for name in (APEX, WWW):
        records = list_records(name)
        print_records(name, records)
        owned = [rec for rec in records if rec["type"] in OWNED_TYPES]
        if name == APEX:
            snapshot[name] = [
                {"type": "A", "name": APEX, "content": ip, "ttl": 1, "proxied": False}
                for ip in sorted(GH_A)
            ]
        else:
            github_cname = [
                rec for rec in owned
                if rec["type"] == "CNAME" and norm_content("CNAME", rec["content"]) == WWW_CNAME
            ]
            if github_cname and not any(rec.get("proxied") for rec in owned):
                log("ROLLBACK www already on GitHub")
                snapshot[name] = records
            else:
                snapshot[name] = [
                    {"type": "CNAME", "name": WWW, "content": WWW_CNAME, "ttl": 1, "proxied": False}
                ]
                extras = [rec for rec in records if rec["type"] not in OWNED_TYPES]
                if extras:
                    log("ROLLBACK leaving non-address records in place")
    restore(snapshot)
    log("VERDICT restored")


def main():
    mode = os.environ.get("MODE", "")
    if mode in ("dns", "verify"):
        if mode == "dns":
            for name, qtype in ((APEX, 1), (WWW, 5), (WWW, 1)):
                log(f"AUTH {name} {authoritative(name, qtype)}")
            return
        try:
            verify_public()
        except Inconclusive as err:
            log(f"VERDICT inconclusive {err}")
            raise SystemExit(2)
        except GiveUp as err:
            log(f"VERDICT fail {err}")
            raise SystemExit(1)
        log("VERDICT pass")
        return
    if mode not in ("inspect", "apply", "rollback"):
        raise SystemExit("MODE must be inspect, apply, rollback, verify, or dns")
    require_token()
    if mode == "inspect":
        inspect()
        log("VERDICT inspect")
        return
    if mode == "rollback":
        rollback()
        return
    apply_cutover()


if __name__ == "__main__":
    try:
        main()
    except GiveUp as err:
        log(f"VERDICT fail {err}")
        raise SystemExit(1)
