"use client";

import { useState, useEffect } from "react";
import { scraperService } from "@/lib/services/scraper";
import VideoPlayer from "@/components/VideoPlayer";
import { Stream } from "@/types/stream";

interface SourceMeta {
  id: string;
  name: string;
}

export default function ScraperTestPage() {
  const [tmdbId, setTmdbId] = useState<string>("");
  const [type, setType] = useState<"movie" | "show">("movie");
  const [title, setTitle] = useState<string>("");
  const [year, setYear] = useState<number>(2023);
  const [season, setSeason] = useState<number>(1);
  const [episode, setEpisode] = useState<number>(1);
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string>("");
  const [embedId, setEmbedId] = useState<string>("");

  // Initialize by getting available sources
  useEffect(() => {
    const initSources = async () => {
      const availableSources = await scraperService.listAvailableSources();
      setSources(availableSources);
      if (availableSources.length > 0) {
        setSelectedSource(availableSources[0].id);
      }
    };

    initSources();
  }, []);

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setStream(null);

    try {
      // Basic validation
      if (!tmdbId || !title || !year) {
        throw new Error("TMDB ID, title, and year are required");
      }

      if (type === "show" && (!season || !episode)) {
        throw new Error("Season and episode are required for TV shows");
      }

      // Prepare the media object for scraping
      const media = {
        type,
        title,
        releaseYear: year,
        tmdbId,
        ...(type === "show" && {
          season: {
            number: season,
            tmdbId: `${tmdbId}-s${season}`, // Just a placeholder
          },
          episode: {
            number: episode,
            tmdbId: `${tmdbId}-s${season}-e${episode}`, // Just a placeholder
          },
        }),
      };

      console.log("Starting scrape with media:", media);
      console.log("Using source:", selectedSource);

      // Get the selected source from the providers
      const result = await scraperService.scrapeStream(media);

      if (!result) {
        throw new Error("No stream found. Try another source or media.");
      }

      setStream(result.stream);
      setSuccessMessage(`Stream found from source: ${result.sourceId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmbedScrape = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setStream(null);

    try {
      // Basic validation
      if (!embedUrl || !embedId) {
        throw new Error("Embed URL and ID are required");
      }

      console.log("Starting embed scrape with:", { embedId, url: embedUrl });
      const result = await scraperService.scrapeEmbed(embedId, embedUrl);

      if (!result) {
        throw new Error("No stream found from embed. Try another embed URL.");
      }

      setStream(result.stream);
      setSuccessMessage(`Stream found from embed: ${result.embedId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Universal Scraper Test</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-neutral-700 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Media Scraper</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Content Type
            </label>
            <select
              className="w-full p-2 border rounded"
              value={type}
              onChange={(e) => setType(e.target.value as "movie" | "show")}
            >
              <option value="movie">Movie</option>
              <option value="show">TV Show</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">TMDB ID</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={tmdbId}
              onChange={(e) => setTmdbId(e.target.value)}
              placeholder="e.g. 299534"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Avengers: Endgame"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Release Year
            </label>
            <input
              type="number"
              className="w-full p-2 border rounded"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || 2023)}
              placeholder="e.g. 2019"
            />
          </div>

          {type === "show" && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Season</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={season}
                  onChange={(e) => setSeason(parseInt(e.target.value) || 1)}
                  placeholder="e.g. 1"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Episode
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={episode}
                  onChange={(e) => setEpisode(parseInt(e.target.value) || 1)}
                  placeholder="e.g. 1"
                />
              </div>
            </>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Source</label>
            <select
              className="w-full p-2 border rounded"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            onClick={handleScrape}
            disabled={loading}
          >
            {loading ? "Scraping..." : "Start Scrape"}
          </button>
        </div>

        <div className="bg-neutral-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Embed Scraper</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Embed ID</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={embedId}
              onChange={(e) => setEmbedId(e.target.value)}
              placeholder="e.g. vidstream"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Embed URL</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="Full embed URL"
            />
          </div>

          <button
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
            onClick={handleEmbedScrape}
            disabled={loading}
          >
            {loading ? "Scraping..." : "Scrape Embed"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mt-6 p-4 bg-green-100 text-green-700 rounded-lg">
          <p className="font-medium">Success:</p>
          <p>{successMessage}</p>
        </div>
      )}

      {stream && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Stream Player</h2>
          <div className="w-full aspect-video">
            <VideoPlayer stream={stream} />
          </div>
        </div>
      )}
    </div>
  );
}
