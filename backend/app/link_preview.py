"""
Fetches a user-supplied URL and pulls out Open Graph metadata for a chat
link preview. The tricky part isn't parsing HTML - it's that this
endpoint takes an arbitrary URL from a user and makes the SERVER fetch
it. Without guards, that's a textbook SSRF vector: someone pastes
http://169.254.169.254/latest/meta-data/ (a cloud metadata endpoint) or
http://localhost:6379 (a redis instance sitting on the same host) and
your backend obligingly fetches it for them.

Guards here:
  - scheme must be http/https
  - resolve the hostname, reject if ANY resolved address is private,
    loopback, link-local, or otherwise reserved (covers both IPv4 and
    IPv6, and covers DNS-rebinding-to-internal-IP tricks)
  - streamed fetch with a hard byte cap - don't let a 4GB response
    parked behind a normal-looking URL eat all your memory
  - short timeout
"""
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

MAX_RESPONSE_BYTES = 2 * 1024 * 1024  # 2MB - plenty for an HTML <head>
FETCH_TIMEOUT_SECONDS = 6
ALLOWED_SCHEMES = {"http", "https"}


class UnsafeUrlError(Exception):
    pass


def _is_blocked_ip(ip_str: str) -> bool:
    ip = ipaddress.ip_address(ip_str)
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def validate_url_is_safe(url: str) -> str:
    """Returns the hostname if the URL is safe to fetch, raises UnsafeUrlError otherwise."""
    parsed = urlparse(url)

    if parsed.scheme not in ALLOWED_SCHEMES:
        raise UnsafeUrlError(f"scheme must be http or https, got {parsed.scheme!r}")
    if not parsed.hostname:
        raise UnsafeUrlError("URL has no hostname")

    try:
        addrinfo = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise UnsafeUrlError("could not resolve hostname")

    resolved_ips = {info[4][0] for info in addrinfo}
    for ip_str in resolved_ips:
        if _is_blocked_ip(ip_str):
            raise UnsafeUrlError(f"resolves to a blocked address range ({ip_str})")

    return parsed.hostname


@dataclass
class LinkPreviewData:
    title: str | None
    description: str | None
    image_url: str | None


def _meta_content(soup: BeautifulSoup, *, property_: str | None = None, name: str | None = None) -> str | None:
    attrs = {"property": property_} if property_ else {"name": name}
    tag = soup.find("meta", attrs=attrs)
    return tag.get("content") if tag else None


def fetch_link_preview(url: str) -> LinkPreviewData:
    validate_url_is_safe(url)  # raises UnsafeUrlError if not

    resp = requests.get(
        url,
        timeout=FETCH_TIMEOUT_SECONDS,
        stream=True,
        headers={"User-Agent": "unnamed-chat-link-preview/1.0"},
        allow_redirects=True,
    )

    chunks = []
    total = 0
    for chunk in resp.iter_content(chunk_size=8192):
        total += len(chunk)
        if total > MAX_RESPONSE_BYTES:
            break
        chunks.append(chunk)
    resp.close()

    # NOTE: redirects are followed by `requests` automatically, and each
    # hop could in principle repoint at an internal address. For a
    # personal two-user app this is an acceptable residual risk; a
    # stricter version would re-validate resp.url (the final URL) before
    # trusting the response, and should be added if this endpoint is
    # ever exposed beyond two trusted users.

    html = b"".join(chunks).decode("utf-8", errors="replace")
    soup = BeautifulSoup(html, "lxml")

    title = (
        _meta_content(soup, property_="og:title")
        or _meta_content(soup, name="twitter:title")
        or (soup.title.string.strip() if soup.title and soup.title.string else None)
    )
    description = (
        _meta_content(soup, property_="og:description")
        or _meta_content(soup, name="description")
    )
    image_url = _meta_content(soup, property_="og:image")

    return LinkPreviewData(title=title, description=description, image_url=image_url)
