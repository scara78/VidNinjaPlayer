"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import VideoPlayer from "@/components/VideoPlayer";
import { Stream } from "@/types/stream";
import { tmdbService } from "@/lib/services/tmdb";
import { scraperService } from "@/lib/services/scraper";
import { providerConfig } from "@/lib/services/providerConfig";
import { MediaInfo } from "@/types/tmdb";
import { TVShowInfo } from "@/components/ui";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, AlertCircleIcon } from "@hugeicons/core-free-icons";

export default function TVShowPlayerPage() {
  const params = useParams();
  const tmdbId = params.tmdbId as string;
  const season = parseInt(params.s as string);
  const episode = parseInt(params.e as string);

  const [stream, setStream] = useState<Stream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isPreloadingMetadata, setIsPreloadingMetadata] = useState(false);
  const [metadataReady, setMetadataReady] = useState(false);
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

  // TV Show state
  const [tvShowInfo, setTvShowInfo] = useState<TVShowInfo | undefined>(
    undefined
  );
  const [isLoadingTVContent, setIsLoadingTVContent] = useState(false);

  // Initialize the player and fetch TV show data
  useEffect(() => {
    const initPlayer = async () => {
      if (!tmdbId || !season || !episode) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch TV show details from TMDB
        const tvShowData = await tmdbService.getTVShowDetails(
          parseInt(tmdbId),
          season,
          episode
        );

        // Add season and episode to the media info
        const tvShowWithEpisode: MediaInfo = {
          ...tvShowData,
          season,
          episode,
        };

        setSelectedMedia(tvShowWithEpisode);

        // Create TV show info
        try {
          // Fetch real TV show data from TMDB
          const seasons = await tmdbService.getTVSeasons(parseInt(tmdbId));

          // Filter out specials (season 0) and get actual seasons
          const actualSeasons = seasons.filter(
            (seasonData) => seasonData.season_number > 0
          );

          if (actualSeasons.length > 0) {
            // Create episode count mapping for each season
            const seasonEpisodes: Record<number, number> = {};

            // Get episode counts for each season
            for (const seasonData of actualSeasons) {
              seasonEpisodes[seasonData.season_number] =
                seasonData.episode_count;
            }

            const tvInfo: TVShowInfo = {
              currentSeason: season,
              currentEpisode: episode,
              totalSeasons: actualSeasons.length,
              totalEpisodes:
                seasonEpisodes[season] || actualSeasons[0]?.episode_count || 1,
              seasonEpisodes,
            };
            setTvShowInfo(tvInfo);
          } else {
            // Fallback if no seasons found
            const tvInfo: TVShowInfo = {
              currentSeason: season,
              currentEpisode: episode,
              totalSeasons: 1,
              totalEpisodes: 1,
              seasonEpisodes: { 1: 1 },
            };
            setTvShowInfo(tvInfo);
          }
        } catch (error) {
          console.error("Failed to fetch TV show data:", error);
          // Fallback to basic info if TMDB fetch fails
          const tvInfo: TVShowInfo = {
            currentSeason: season,
            currentEpisode: episode,
            totalSeasons: 1,
            totalEpisodes: 1,
            seasonEpisodes: { [season]: 1 },
          };
          setTvShowInfo(tvInfo);
        }

        // Start fetching stream
        await fetchStream(tvShowWithEpisode);
      } catch (err) {
        console.error("Initialization error:", err);
        setError(
          "Failed to load TV show. Please check the TMDB ID and episode parameters."
        );
        setIsLoading(false);
      }
    };

    initPlayer();
  }, [tmdbId, season, episode]);

  const fetchStream = async (media: MediaInfo) => {
    setIsLoading(true);
    setError(null);
    setStreamSourceInfo(null);
    setOriginalStream(null);
    setOriginalSourceInfo(null);
    setIsStreamReady(false);
    setIsPreloadingMetadata(false);
    setMetadataReady(false);

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
        type: "show" as const,
        title: media.title,
        releaseYear: media.year || new Date().getFullYear(),
        tmdbId: media.tmdbId,
        season: {
          number: media.season || 1,
          tmdbId: `${media.tmdbId}-s${media.season || 1}`,
        },
        episode: {
          number: media.episode || 1,
          tmdbId: `${media.tmdbId}-s${media.season || 1}-e${
            media.episode || 1
          }`,
        },
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

          // Show "Loading stream..." briefly, VideoPlayer will notify when ready
          setTimeout(() => {
            setIsStreamReady(true);
          }, 800);
        } else {
          setError(
            `No stream found for ${media.title} S${media.season}E${media.episode}. This may happen if the content is not available on any of our providers.`
          );
        }
      } catch (err: unknown) {
        console.error("Error searching streams:", err);
        setError(
          err instanceof Error
            ? err.message
            : `No stream found for ${media.title} S${media.season}E${media.episode} after trying all sources.`
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
        type: "show" as const,
        title: selectedMedia.title,
        releaseYear: selectedMedia.year || new Date().getFullYear(),
        tmdbId: selectedMedia.tmdbId,
        season: {
          number: selectedMedia.season || 1,
          tmdbId: `${selectedMedia.tmdbId}-s${selectedMedia.season || 1}`,
        },
        episode: {
          number: selectedMedia.episode || 1,
          tmdbId: `${selectedMedia.tmdbId}-s${selectedMedia.season || 1}-e${
            selectedMedia.episode || 1
          }`,
        },
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

  // TV Show navigation handlers
  const handleEpisodeChange = async (newSeason: number, newEpisode: number) => {
    if (!selectedMedia || selectedMedia.type !== "tv") return;

    setIsLoadingTVContent(true);

    // Navigate to new URL instead of updating state
    const newUrl = `/tv/${tmdbId}/${newSeason}/${newEpisode}`;
    window.location.href = newUrl;
  };

  // Handle when video is ready for instant playback
  const handleVideoReady = useCallback(() => {
    console.log("Video is ready for instant playback!");
    setMetadataReady(true);
    setIsStreamReady(true);
  }, []);

  // Effect to preload metadata when stream is available
  useEffect(() => {
    if (stream && !metadataReady && !isPreloadingMetadata) {
      console.log("Starting metadata preloading in background...");
      setIsPreloadingMetadata(true);

      // Give the backdrop loading screen time to show, then start preloading
      setTimeout(() => {
        console.log("Metadata preload phase completed, ready to show player");
        setMetadataReady(true);

        // Short delay to show "Ready to play" state
        setTimeout(() => {
          setIsStreamReady(true);
        }, 800);
      }, 1500); // 1.5 seconds for metadata preloading simulation
    }
  }, [stream, metadataReady, isPreloadingMetadata]);

  // Validation error
  if (!tmdbId || !season || !episode || isNaN(season) || isNaN(episode)) {
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
          <h1 className="text-2xl font-bold mb-2">Invalid URL Format</h1>
          <p className="text-gray-300 mb-4">
            Please use the format: /tv/tmdbId/season/episode
          </p>
          <p className="text-sm text-gray-400">
            Example: /tv/1399/1/1 for Game of Thrones S1E1
          </p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold mb-2">Error Loading TV Show</h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <p className="text-sm text-gray-400">
            TV Show TMDB ID: {tmdbId}, Season: {season}, Episode: {episode}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Loading overlay - Show until stream is ready */}
      {(!stream || !metadataReady || !isStreamReady) && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-center">
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

      {/* Hidden VideoPlayer for metadata preloading */}
      {stream && !metadataReady && (
        <div
          style={{
            position: "fixed",
            top: "-9999px",
            left: "-9999px",
            width: "1px",
            height: "1px",
            visibility: "hidden",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1000,
          }}
        >
          <VideoPlayer
            stream={stream}
            className="w-64 aspect-video"
            availableSources={[]}
            onSwitchServer={() => {}}
            isLoadingServer={false}
            mediaType="tv"
            onVideoReady={handleVideoReady}
            isHiddenPreloader={true}
          />
        </div>
      )}

      {/* Video Player - Full screen when ready */}
      {stream && metadataReady && isStreamReady && (
        <VideoPlayer
          stream={stream}
          className="w-full h-full"
          availableSources={availableSources}
          currentSourceId={streamSourceInfo?.sourceId}
          onSwitchServer={switchServer}
          isLoadingServer={isLoading}
          mediaType="tv"
          tvShowInfo={tvShowInfo}
          onEpisodeChange={handleEpisodeChange}
          isLoadingTVContent={isLoadingTVContent}
        />
      )}
    </div>
  );
}
