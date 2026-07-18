/**
 * Giphy's /v1/gifs/search endpoint, confirmed current as of this build
 * (checked developers.giphy.com docs directly). NOT run against the
 * real API though - api.giphy.com isn't reachable from the sandbox this
 * was built in, so this is written correctly-to-spec but unverified by
 * execution, same caveat as the RN native modules elsewhere in this repo.
 *
 * Get a key at https://developers.giphy.com/ and put it in src/config.ts.
 */
import { GIPHY_API_KEY } from "../config";

export interface GifResult {
  id: string;
  url: string;        // full-quality original - what actually gets sent
  previewUrl: string;  // smaller "fixed_width" rendition - what the picker grid shows
  width: number;
  height: number;
}

interface GiphyImageRendition {
  url: string;
  width: string;
  height: string;
}

interface GiphyGif {
  id: string;
  images: {
    original: GiphyImageRendition;
    fixed_width: GiphyImageRendition;
  };
}

interface GiphySearchResponse {
  data: GiphyGif[];
}

export async function searchGifs(query: string, limit: number = 25): Promise<GifResult[]> {
  if (!GIPHY_API_KEY) {
    throw new Error("GIPHY_API_KEY is not set in src/config.ts - get one at developers.giphy.com");
  }

  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", GIPHY_API_KEY);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("rating", "pg-13");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Giphy search failed: ${res.status}`);

  const body = (await res.json()) as GiphySearchResponse;
  return body.data.map((g) => ({
    id: g.id,
    url: g.images.original.url,
    previewUrl: g.images.fixed_width.url,
    width: parseInt(g.images.original.width, 10),
    height: parseInt(g.images.original.height, 10),
  }));
}

export async function trendingGifs(limit: number = 25): Promise<GifResult[]> {
  if (!GIPHY_API_KEY) {
    throw new Error("GIPHY_API_KEY is not set in src/config.ts - get one at developers.giphy.com");
  }

  const url = new URL("https://api.giphy.com/v1/gifs/trending");
  url.searchParams.set("api_key", GIPHY_API_KEY);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("rating", "pg-13");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Giphy trending failed: ${res.status}`);

  const body = (await res.json()) as GiphySearchResponse;
  return body.data.map((g) => ({
    id: g.id,
    url: g.images.original.url,
    previewUrl: g.images.fixed_width.url,
    width: parseInt(g.images.original.width, 10),
    height: parseInt(g.images.original.height, 10),
  }));
}
