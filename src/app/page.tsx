"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import VideoPlayer from "@/components/VideoPlayer";
import { Stream } from "@/types/stream";
import { tmdbService } from "@/lib/services/tmdb";
import { scraperService } from "@/lib/services/scraper";
import { providerConfig } from "@/lib/services/providerConfig";
import { MediaInfo } from "@/types/tmdb";
import { TVShowInfo } from "@/components/ui";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Loading03Icon,
  ArrowLeft01Icon,
  Search01Icon,
  Film01Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons";

export default function StreamPlayerPage() {
  const [stream, setStream] = useState<Stream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false); // New state for stream readiness
  const [isPreloadingMetadata, setIsPreloadingMetadata] = useState(false); // New state for metadata preloading
  const [metadataReady, setMetadataReady] = useState(false); // Track if metadata is loaded
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
      originalId: string; // Store the original provider ID for mapping
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

  // Initialize the scraper service
  useEffect(() => {
    const initPlayer = async () => {
      try {
        // Just initialize the scraper service
        console.log("Initializing player...");
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    initPlayer();
  }, []);

  const searchTMDB = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const results = await tmdbService.searchMulti(searchQuery);
      setSearchResults(results);
    } catch (err) {
      setError("Failed to search TMDB");
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectMedia = async (media: MediaInfo) => {
    setSelectedMedia(media);
    setSearchResults([]);
    setSearchQuery("");

    // Create TV show info if it's a TV show
    if (media.type === "tv") {
      setIsLoading(true);
      try {
        // Fetch real TV show data from TMDB
        const seasons = await tmdbService.getTVSeasons(parseInt(media.tmdbId));

        // Filter out specials (season 0) and get actual seasons
        const actualSeasons = seasons.filter(
          (season) => season.season_number > 0
        );

        if (actualSeasons.length > 0) {
          // Create episode count mapping for each season
          const seasonEpisodes: Record<number, number> = {};

          // Get episode counts for each season
          for (const season of actualSeasons) {
            seasonEpisodes[season.season_number] = season.episode_count;
          }

          const tvInfo: TVShowInfo = {
            currentSeason: media.season || 1,
            currentEpisode: media.episode || 1,
            totalSeasons: actualSeasons.length,
            totalEpisodes:
              seasonEpisodes[media.season || 1] ||
              actualSeasons[0]?.episode_count ||
              1,
            seasonEpisodes,
          };
          setTvShowInfo(tvInfo);
        } else {
          // Fallback if no seasons found
          setTvShowInfo(undefined);
        }
      } catch (error) {
        console.error("Failed to fetch TV show data:", error);
        // Fallback to basic info if TMDB fetch fails
        const tvInfo: TVShowInfo = {
          currentSeason: media.season || 1,
          currentEpisode: media.episode || 1,
          totalSeasons: 1,
          totalEpisodes: 1,
          seasonEpisodes: { 1: 1 },
        };
        setTvShowInfo(tvInfo);
      } finally {
        setIsLoading(false);
      }
    } else {
      setTvShowInfo(undefined);
    }

    await fetchStream(media);
  };

  const fetchStream = async (media: MediaInfo) => {
    setIsLoading(true);
    setError(null);
    setStreamSourceInfo(null);
    setOriginalStream(null);
    setOriginalSourceInfo(null);
    setIsStreamReady(false); // Reset stream readiness
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
        isWorking: true, // For now, assume all are working - can be updated based on actual status
        originalId: source.name, // Store original display name for mapping back to real provider ID
      }));

      setAvailableSources(mappedSources);

      // Prepare the media object for scraping
      const mediaType = media.type === "movie" ? "movie" : "show";
      const scraperMedia = {
        type: mediaType === "movie" ? ("movie" as const) : ("show" as const),
        title: media.title,
        releaseYear: media.year || new Date().getFullYear(),
        tmdbId: media.tmdbId,
        ...(mediaType === "show" && {
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
        }),
      };

      // Let the scraper try all sources internally - this is how the scraper-test does it
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
          }, 800); // Shorter delay - VideoPlayer will handle actual readiness
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
      const mediaType = selectedMedia.type === "movie" ? "movie" : "show";
      const scraperMedia = {
        type: mediaType === "movie" ? ("movie" as const) : ("show" as const),
        title: selectedMedia.title,
        releaseYear: selectedMedia.year || new Date().getFullYear(),
        tmdbId: selectedMedia.tmdbId,
        ...(mediaType === "show" && {
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
        }),
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

  const resetPlayer = () => {
    setStream(null);
    setSelectedMedia(null);
    setError(null);
    setTvShowInfo(undefined);
    setIsStreamReady(false); // Reset stream readiness
    setIsPreloadingMetadata(false);
    setMetadataReady(false);
  };

  // TV Show navigation handlers
  const handleEpisodeChange = async (season: number, episode: number) => {
    if (!selectedMedia || selectedMedia.type !== "tv") return;

    setIsLoadingTVContent(true);

    try {
      // Create updated media info with new season/episode
      const updatedMedia: MediaInfo = {
        ...selectedMedia,
        season,
        episode,
      };

      // Update TV show info
      if (tvShowInfo) {
        const updatedTvInfo: TVShowInfo = {
          ...tvShowInfo,
          currentSeason: season,
          currentEpisode: episode,
        };
        setTvShowInfo(updatedTvInfo);
      }

      // Update selected media for future operations
      setSelectedMedia(updatedMedia);

      // Fetch new stream for the episode
      await fetchStream(updatedMedia);
    } catch (error) {
      console.error("Failed to change episode:", error);
      setError(`Failed to load S${season}E${episode}`);
    } finally {
      setIsLoadingTVContent(false);
    }
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Search Section */}
          {!stream && !selectedMedia && (
            <div className="text-center mb-8">
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && searchTMDB()}
                    placeholder="Search movies and TV shows..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={searchTMDB}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSearching ? (
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={20}
                      color="currentColor"
                      strokeWidth={1.5}
                      className="animate-spin"
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={Search01Icon}
                      size={20}
                      color="currentColor"
                      strokeWidth={1.5}
                    />
                  )}
                  Search
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {searchResults.slice(0, 9).map((media) => (
                    <button
                      key={media.id}
                      onClick={() => selectMedia(media)}
                      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-start gap-3">
                        {media.poster ? (
                          <Image
                            src={media.poster}
                            alt={media.title}
                            width={48}
                            height={72}
                            className="w-12 h-18 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-18 bg-gray-600 rounded flex items-center justify-center">
                            {media.type === "movie" ? (
                              <HugeiconsIcon
                                icon={Film01Icon}
                                size={24}
                                color="#9CA3AF"
                                strokeWidth={1.5}
                              />
                            ) : (
                              <HugeiconsIcon
                                icon={Tv01Icon}
                                size={24}
                                color="#9CA3AF"
                                strokeWidth={1.5}
                              />
                            )}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium text-sm line-clamp-2">
                            {media.title}
                          </h3>
                          <p className="text-gray-400 text-xs">
                            {media.type === "movie" ? "Movie" : "TV Show"} •{" "}
                            {media.year}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-600/20 border border-red-600/50 rounded-lg">
                  <p className="text-red-200">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Loading/Selected Media Section - Show until stream is ready */}
          {selectedMedia && (!stream || !metadataReady || !isStreamReady) && (
            <div className="space-y-6">
              {/* Backdrop with Loading */}
              <div
                className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center"
                style={{
                  backgroundImage: selectedMedia.backdrop
                    ? `url(${selectedMedia.backdrop})`
                    : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-10 text-center">
                  {isLoading || !stream ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        size={64}
                        color="currentColor"
                        strokeWidth={1.5}
                        className="mx-auto mb-4 animate-spin"
                      />
                      <h3 className="text-xl font-semibold mb-2">
                        Fetching Content...
                      </h3>
                      {streamSourceInfo && !stream && (
                        <p className="text-gray-300">
                          {streamSourceInfo.sourceId === "auto" ? (
                            ""
                          ) : (
                            <>
                              Trying source:{" "}
                              <span className="font-semibold">
                                {streamSourceInfo.sourceId}
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </>
                  ) : stream && !metadataReady ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        size={64}
                        color="currentColor"
                        strokeWidth={1.5}
                        className="mx-auto mb-4 animate-spin"
                      />
                      <h3 className="text-xl font-semibold mb-2">
                        Loading Content...
                      </h3>
                    </>
                  ) : stream && metadataReady && !isStreamReady ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-bold mb-2">
                        {selectedMedia.title}
                      </h3>
                      <p className="text-gray-300 mb-4">
                        {selectedMedia.overview}
                      </p>
                      <button
                        onClick={resetPlayer}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
                      >
                        Search Again
                      </button>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-600/20 border border-red-600/50 rounded-lg">
                  <p className="text-red-200 mb-2">{error}</p>

                  <button
                    onClick={resetPlayer}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                  >
                    Try Another Search
                  </button>
                </div>
              )}
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
                mediaType={selectedMedia?.type || "movie"}
                onVideoReady={handleVideoReady}
                isHiddenPreloader={true}
              />
            </div>
          )}

          {/* Video Player - Only show when stream and metadata are ready */}
          {stream && selectedMedia && metadataReady && isStreamReady && (
            <div className="space-y-6">
              <div className=" rounded-lg">
                <button
                  onClick={resetPlayer}
                  className="px-2 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors flex items-center gap-2"
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={24}
                    color="currentColor"
                    strokeWidth={1.5}
                  />
                  Back to Search
                </button>
              </div>

              <VideoPlayer
                stream={stream}
                className="w-full aspect-video"
                availableSources={availableSources}
                currentSourceId={streamSourceInfo?.sourceId}
                onSwitchServer={switchServer}
                isLoadingServer={isLoading}
                mediaType={selectedMedia?.type || "movie"}
                tvShowInfo={tvShowInfo}
                onEpisodeChange={handleEpisodeChange}
                isLoadingTVContent={isLoadingTVContent}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
