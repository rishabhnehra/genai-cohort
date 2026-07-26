import dns from "node:dns/promises";
import net from "node:net";
import { AppError, ErrorCodes } from "@/lib/errors";
import { limits } from "@/lib/limits";

const METADATA_IPS = new Set(["169.254.169.254", "fd00:ec2::254"]);

/**
 * Returns true if `ip` is a private, loopback, link-local, multicast, or
 * cloud-metadata address that must never be reachable from the ingestion
 * worker's URL fetcher (SSRF protection).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (METADATA_IPS.has(ip)) return true;

  const kind = net.isIP(ip);

  if (kind === 4) {
    const octets = ip.split(".").map(Number);
    const [a, b] = octets;

    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 0) return true; // 0.0.0.0/8
    if (a >= 224) return true; // multicast/reserved (224.0.0.0+)

    return false;
  }

  if (kind === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    if (normalized.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 — re-check the embedded IPv4 address.
      const mapped = normalized.split(":").pop();
      if (mapped && net.isIP(mapped) === 4) {
        return isPrivateOrReservedIp(mapped);
      }
    }
    return false;
  }

  // Not a valid IP literal — treat conservatively as unsafe.
  return true;
}

export type SafeFetchResult = {
  buffer: Buffer;
  contentType: string | null;
  finalUrl: string;
};

/**
 * Validates a candidate URL and, if it's not obviously unsafe, resolves it.
 * Throws `AppError` (code `FETCH_BLOCKED`) for anything that isn't a public
 * http(s) host.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(ErrorCodes.VALIDATION, "That doesn't look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(
      ErrorCodes.FETCH_BLOCKED,
      "Only http:// and https:// URLs are supported.",
    );
  }

  if (!url.hostname || url.hostname === "localhost") {
    throw new AppError(ErrorCodes.FETCH_BLOCKED, "That host isn't reachable.");
  }

  // Reject bare IP-literal hosts that are already private/reserved.
  if (net.isIP(url.hostname) && isPrivateOrReservedIp(url.hostname)) {
    throw new AppError(ErrorCodes.FETCH_BLOCKED, "That host isn't reachable.");
  }

  let addresses: string[];
  try {
    const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
    addresses = records.map((record) => record.address);
  } catch {
    throw new AppError(ErrorCodes.FETCH_BLOCKED, "That host couldn't be resolved.");
  }

  if (addresses.length === 0 || addresses.some(isPrivateOrReservedIp)) {
    throw new AppError(ErrorCodes.FETCH_BLOCKED, "That host isn't reachable.");
  }

  return url;
}

/**
 * Fetches a URL with SSRF protections: validates the URL + resolved IPs
 * before every hop, follows redirects manually (re-validating each target),
 * and enforces byte and time limits.
 */
export async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= limits.ssrf.maxRedirects; redirectCount++) {
    const url = await assertPublicHttpUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), limits.ssrf.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "MochaLM-Ingestion/1.0 (+https://mocha-lm.local)",
          Accept: "text/html,application/pdf,*/*",
        },
      });
    } catch (error) {
      throw new AppError(ErrorCodes.FETCH_FAILED, "Failed to fetch that URL.", {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new AppError(ErrorCodes.FETCH_FAILED, "Redirect response was missing a location.");
      }
      currentUrl = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) {
      throw new AppError(
        ErrorCodes.FETCH_FAILED,
        `Fetching that URL failed (HTTP ${response.status}).`,
      );
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > limits.ssrf.maxBytes) {
      throw new AppError(ErrorCodes.FETCH_FAILED, "That resource is too large to fetch.");
    }

    const buffer = await readBodyWithLimit(response, limits.ssrf.maxBytes);

    return {
      buffer,
      contentType: response.headers.get("content-type"),
      finalUrl: url.toString(),
    };
  }

  throw new AppError(ErrorCodes.FETCH_FAILED, "Too many redirects.");
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new AppError(ErrorCodes.FETCH_FAILED, "That resource is too large to fetch.");
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AppError(ErrorCodes.FETCH_FAILED, "That resource is too large to fetch.");
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks);
}
