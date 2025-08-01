"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import VideoPlayer from "@/components/VideoPlayer";
import { Stream } from "@/types/stream";
import { tmdbService } from "@/lib/services/tmdb";
import { scraperService } from "@/lib/services/scraper";
import { providerConfig } from "@/lib/services/providerConfig";
import { MediaInfo } from "@/types/tmdb";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, AlertCircleIcon } from "@hugeicons/core-free-icons";

export default function MoviePlayerPage() {
  const params = useParams();
  const tmdbId = params.tmdbId as string;

  const [stream, setStream] = useState<Stream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaInfo | null>(null);
  const [streamSourceInfo, setStreamSourceInfo] = useState<{
    sourceId: string;
    embedId: string;
  } | null>(null);
  const [availableSources, setAvailableSources] = useState<
    Array<{
      id: string;
      name: string;
      rank: number;
      isWorking?: boolean;
      originalId: string;
    }>
  >([]);
  const [originalStream, setOriginalStream] = useState<Stream | null>(null);
  const [originalSourceInfo, setOriginalSourceInfo] = useState<{
    sourceId: string;
    embedId: string;
  } | null>(null);
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);

  // Initialize the player and fetch movie data
  useEffect(() => {
    const initPlayer = async () => {
      if (!tmdbId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch movie details from TMDB
        const movieData = await tmdbService.getMovieDetails(parseInt(tmdbId));
        setSelectedMedia(movieData);

        // Load backdrop from TMDB (already proxied)
        if (movieData.backdrop) {
          console.log("Generated backdrop URL:", movieData.backdrop);
          setBackdropUrl(movieData.backdrop);
        } else {
          console.log("No backdrop available for this movie");
        }

        // Start fetching stream
        await fetchStream(movieData);
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Failed to load movie. Please check the TMDB ID.");
        setIsLoading(false);
      }
    };

    initPlayer();
  }, [tmdbId]);

  const fetchStream = async (media: MediaInfo) => {
    setIsLoading(true);
    setError(null);
    setStreamSourceInfo(null);
    setOriginalStream(null);
    setOriginalSourceInfo(null);

    try {
      // Get all available sources
      const availableSources = await scraperService.listAvailableSources();
      console.log("Available sources:", availableSources);
      if (!availableSources || availableSources.length === 0) {
        setError("No sources available to fetch streams");
        setIsLoading(false);
        return;
      }

      // Store available sources for server selector with simple names
      const mappedSources = availableSources.map((source, index) => ({
        id: `server-${index + 1}`, // Simple ID for UI
        name: `Server ${index + 1}`, // Simple display name
        rank: source.rank,
        isWorking: true,
        originalId: source.name, // Store original display name for mapping back to real provider ID
      }));

      setAvailableSources(mappedSources);

      // Prepare the media object for scraping
      const scraperMedia = {
        type: "movie" as const,
        title: media.title,
        releaseYear: media.year || new Date().getFullYear(),
        tmdbId: media.tmdbId,
      };

      // Let the scraper try all sources internally
      setStreamSourceInfo({ sourceId: "auto", embedId: "searching" });
      console.log("Trying all available sources for:", scraperMedia);

      try {
        const result = await scraperService.scrapeStream(scraperMedia);

        if (result && result.stream) {
          setStream(result.stream);

          // Find the simple server name for this provider
          const providerDisplayName = providerConfig.getProviderDisplayName(
            result.sourceId
          );

          // Use the mapped sources to find the matching source
          const matchingSource = mappedSources.find(
            (source) => source.originalId === providerDisplayName
          );
          const serverName = matchingSource?.name || "Server 1";

          setStreamSourceInfo({
            sourceId: serverName,
            embedId: result.embedId,
          });
          // Store the original working stream for fallback
          setOriginalStream(result.stream);
          setOriginalSourceInfo({
            sourceId: serverName,
            embedId: result.embedId,
          });
          console.log(
            `Stream found from source: ${result.sourceId} (displayed as: ${serverName})`
          );

          // Stream found successfully
        } else {
          setError(
            `No stream found for ${media.title}. This may happen if the content is not available on any of our providers.`
          );
        }
      } catch (err: unknown) {
        console.error("Error searching streams:", err);
        setError(
          err instanceof Error
            ? err.message
            : `No stream found for ${media.title} after trying all sources.`
        );
      }
    } catch (err) {
      setError("Network error occurred");
      console.error("Stream fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const switchServer = async (sourceId: string) => {
    if (!selectedMedia) return;

    // Find the original provider ID from our simple server mapping
    const selectedSource = availableSources.find(
      (source) => source.id === sourceId
    );
    if (!selectedSource || !selectedSource.originalId) {
      console.error("Could not find original provider ID for:", sourceId);
      return;
    }

    // Map original display name back to real provider ID
    const realProviderId = providerConfig.getProviderIdFromDisplayName(
      selectedSource.originalId
    );
    console.log(
      `Switching to ${selectedSource.name} (original: ${selectedSource.originalId}, real ID: ${realProviderId})`
    );

    setIsLoading(true);
    setError(null);
    setStreamSourceInfo({ sourceId: selectedSource.name, embedId: "loading" });

    try {
      // Prepare the media object for scraping
      const scraperMedia = {
        type: "movie" as const,
        title: selectedMedia.title,
        releaseYear: selectedMedia.year || new Date().getFullYear(),
        tmdbId: selectedMedia.tmdbId,
      };

      console.log(
        `Trying specific source: ${realProviderId} for:`,
        scraperMedia
      );

      try {
        const result = await scraperService.scrapeStream(
          scraperMedia,
          realProviderId
        );

        if (result && result.stream) {
          setStream(result.stream);
          setStreamSourceInfo({
            sourceId: sourceId, // Keep the display name for UI
            embedId: result.embedId,
          });
          console.log(`Stream found from source: ${result.sourceId}`);
        } else {
          // Failed to get stream from this source, fallback to original
          console.log(
            `Source ${realProviderId} failed, falling back to original`
          );
          if (originalStream && originalSourceInfo) {
            setStream(originalStream);
            setStreamSourceInfo(originalSourceInfo);
            setError(
              `Source ${sourceId} didn't work, reverted to working source: ${originalSourceInfo.sourceId}`
            );
          } else {
            setError(`Source ${sourceId} failed and no fallback available`);
          }
        }
      } catch (err: unknown) {
        // Failed to get stream from this source, fallback to original
        console.error(`Error with source ${realProviderId}:`, err);
        if (originalStream && originalSourceInfo) {
          setStream(originalStream);
          setStreamSourceInfo(originalSourceInfo);
          setError(
            `Source ${sourceId} failed, reverted to working source: ${originalSourceInfo.sourceId}`
          );
        } else {
          setError(`Source ${sourceId} failed and no fallback available`);
        }
      }
    } catch (err) {
      setError("Network error occurred during server switch");
      console.error("Server switch error:", err);
      // Fallback to original if available
      if (originalStream && originalSourceInfo) {
        setStream(originalStream);
        setStreamSourceInfo(originalSourceInfo);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Error state
  if (error && !selectedMedia) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={64}
            color="#ef4444"
            strokeWidth={1.5}
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold mb-2">Error Loading Movie</h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <p className="text-sm text-gray-400">Movie TMDB ID: {tmdbId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Loading overlay - Show until stream is found */}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          {/* Backdrop image */}
          {backdropUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${backdropUrl})`,
                filter: "blur(8px) brightness(0.3)",
              }}
            />
          )}

          {/* Loading content */}
          <div className="relative z-10 text-center">
            <HugeiconsIcon
              icon={Loading03Icon}
              size={64}
              color="white"
              strokeWidth={1.5}
              className="mx-auto mb-4 animate-spin"
            />
            <h3 className="text-white text-xl font-semibold mb-2">
              {isLoading || !stream
                ? "Fetching Content..."
                : "Loading Content..."}
            </h3>
            {streamSourceInfo &&
              !stream &&
              streamSourceInfo.sourceId !== "auto" && (
                <p className="text-gray-300">
                  Trying source:{" "}
                  <span className="font-semibold">
                    {streamSourceInfo.sourceId}
                  </span>
                </p>
              )}
            {error && <p className="text-red-400 mt-2">{error}</p>}
          </div>
        </div>
      )}

      {/* Video Player - Show when stream is available, let it handle loading */}
      {stream && (
        <VideoPlayer
          stream={stream}
          className="w-full h-full"
          availableSources={availableSources}
          currentSourceId={streamSourceInfo?.sourceId}
          onSwitchServer={switchServer}
          isLoadingServer={isLoading}
          mediaType="movie"
          backdropUrl={backdropUrl}
        />
      )}
    </div>
  );
}
