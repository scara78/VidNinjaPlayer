import React, { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import { Stream } from "@/types/stream";
import { cn, formatTime, getQualityLabel } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import {
  PlayPauseButton,
  VolumeButton,
  VolumeSlider,
  ProgressBar,
  TimeDisplay,
  ServerButton,
  ServerMenu,
  SubtitlesButton,
  CaptionsMenu,
  SettingsButton,
  SettingsMenu,
  QualityTab,
  SubtitlesTab,
  SpeedTab,
  FullscreenButton,
  SkipBackwardButton,
  SkipForwardButton,
  PictureInPictureButton,
  EpisodeNavigation,
  type SettingsTab,
  type TVShowInfo,
} from "./ui";

interface VideoPlayerProps {
  stream: Stream;
  className?: string;
  availableSources?: Array<{
    id: string;
    name: string;
    rank: number;
  }>;
  currentSourceId?: string;
  onSwitchServer?: (sourceId: string) => void;
  isLoadingServer?: boolean;
  // TV Show specific props
  mediaType?: "movie" | "tv";
  tvShowInfo?: TVShowInfo;
  onEpisodeChange?: (season: number, episode: number) => void;
  isLoadingTVContent?: boolean;
  // Metadata preloading callback
  onVideoReady?: () => void;
  // Hidden mode for preloading only
  isHiddenPreloader?: boolean;
}

export default function VideoPlayer({
  stream,
  className,
  availableSources = [],
  currentSourceId,
  onSwitchServer,
  isLoadingServer = false,
  mediaType = "movie",
  tvShowInfo,
  onEpisodeChange,
  isLoadingTVContent = false,
  onVideoReady,
  isHiddenPreloader = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null); // Hidden video for preloading

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferedRanges, setBufferedRanges] = useState<TimeRanges | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);

  // Quality and captions state
  const [selectedQuality, setSelectedQuality] = useState<string>("720");
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [showCaptionMenu, setShowCaptionMenu] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);

  // Settings menu state
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("quality");

  // Playback speed options
  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false); // Track if video is preloaded

  // Track recovery attempts outside of HLS instance
  const networkErrorCount = useRef(0);
  const mediaErrorCount = useRef(0);

  // Smart buffer monitoring - only show loading for real issues
  const [isNetworkSlow, setIsNetworkSlow] = useState(false);
  const [bufferHealthy, setBufferHealthy] = useState(false);
  const [bufferedAhead, setBufferedAhead] = useState(0); // Track buffered ahead amount
  const networkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced buffer health monitoring - Silent background buffering
  const checkBufferHealth = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.buffered.length) return;

    const currentTime = video.currentTime;
    const buffered = video.buffered;

    // Calculate how much is buffered ahead
    let bufferedAheadAmount = 0;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && buffered.end(i) > currentTime) {
        bufferedAheadAmount = buffered.end(i) - currentTime;
        break;
      }
    }

    // Update state
    setBufferedAhead(bufferedAheadAmount);

    // With unlimited buffering, we're always healthy unless buffer is completely empty
    const isHealthy = bufferedAheadAmount >= 1;
    setBufferHealthy(isHealthy);

    // ONLY show buffering if buffer is completely empty (0 seconds) and video is playing
    if (bufferedAheadAmount === 0 && isPlaying && !video.paused) {
      setIsBuffering(true);
      console.log("Buffer completely empty - showing critical loading");
    } else {
      setIsBuffering(false);
    }

    // Silent background buffering - no UI indication for normal buffering
    console.log(
      `Silent buffering: ${bufferedAheadAmount.toFixed(
        1
      )}s ahead, background download active`
    );
  }, [isPlaying]);

  // Enhanced waiting handler - only for real network issues
  const handleWaiting = useCallback(() => {
    console.log("Video waiting for data - checking if critical...");

    // Clear any existing timeout
    if (networkTimeoutRef.current) {
      clearTimeout(networkTimeoutRef.current);
    }

    // Only show loading if waiting persists for more than 5 seconds (real network issue)
    networkTimeoutRef.current = setTimeout(() => {
      setIsNetworkSlow(true);
      setIsBuffering(true);
      console.log(
        "Critical network issue detected - showing loading indicator"
      );
    }, 5000); // Increased from 3 to 5 seconds

    // Don't immediately show buffering - let background buffering work silently
  }, []);

  // Enhanced can play handler
  const handleCanPlay = useCallback(() => {
    console.log("Video can play - clearing network issues");

    // Clear network timeout
    if (networkTimeoutRef.current) {
      clearTimeout(networkTimeoutRef.current);
    }

    setIsNetworkSlow(false);
    setIsBuffering(false);
    setIsLoading(false);

    // Start continuous buffer monitoring
    if (bufferCheckRef.current) {
      clearInterval(bufferCheckRef.current);
    }

    bufferCheckRef.current = setInterval(checkBufferHealth, 1000);
  }, [checkBufferHealth]);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    hideControlsAfterDelay();
  }, [hideControlsAfterDelay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);

      // Call the onVideoReady callback if provided (for metadata preloading coordination)
      if (onVideoReady) {
        onVideoReady();
      }

      // Try to start playback immediately when metadata is loaded
      // This helps avoid the "play() request interrupted" errors
      setTimeout(() => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            // Auto-play was prevented, show a UI element to let the user start playback
            console.log("Auto-play prevented:", error);
            // We don't force play here, as browser policies may block it
          });
        }
      }, 300);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Update buffered ranges
      if (video.buffered && video.buffered.length > 0) {
        setBufferedRanges(video.buffered);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      hideControlsAfterDelay();
    };

    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    const handleSeeking = () => {
      // Don't show buffering for seeks - let it happen silently
      console.log("Video seeking started - silent operation");
    };

    const handleSeeked = () => {
      setIsBuffering(false);
      console.log("Video seeking completed");
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      // Don't set buffering for load start - only for initial loading
      console.log("Video loading started");
    };

    const handleProgress = () => {
      // Update buffered ranges during loading
      if (video.buffered && video.buffered.length > 0) {
        setBufferedRanges(video.buffered);
      }
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleError = () => {
      setError("Failed to load video");
      setIsLoading(false);
      setIsBuffering(false);
    };

    const handleEnterPiP = () => {
      setIsPictureInPicture(true);
      console.log("Entered Picture-in-Picture mode");
    };

    const handleLeavePiP = () => {
      setIsPictureInPicture(false);
      console.log("Left Picture-in-Picture mode");
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("progress", handleProgress);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("error", handleError);
    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("progress", handleProgress);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("error", handleError);
      video.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, [hideControlsAfterDelay, onVideoReady, handleCanPlay, handleWaiting]);

  // Intersection Observer to trigger preloading when video becomes visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !stream) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isPreloaded) {
            console.log("Video player visible - starting aggressive preload");
            setIsPreloaded(true);

            // Try to trigger metadata loading through hidden video
            const hiddenVideo = hiddenVideoRef.current;
            if (hiddenVideo && stream.type === "hls") {
              hiddenVideo.muted = true;
              hiddenVideo.volume = 0;
              hiddenVideo.src = stream.playlist || "";

              // Try to play/pause the hidden video to trigger metadata loading
              hiddenVideo
                .play()
                .then(() => {
                  setTimeout(() => {
                    hiddenVideo.pause();
                    hiddenVideo.currentTime = 0;
                    console.log("Hidden video triggered metadata loading");
                  }, 100);
                })
                .catch(() => {
                  console.log(
                    "Hidden video play failed, but metadata may still load"
                  );
                });
            }
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% visible
        rootMargin: "50px", // Start 50px before becoming visible
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [stream, isPreloaded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    // Reset error counters for new stream
    networkErrorCount.current = 0;
    mediaErrorCount.current = 0;

    setIsLoading(true);
    setError(null);

    if (stream.type === "hls" && stream.playlist) {
      if (Hls.isSupported()) {
        // Use custom HLS configuration with unlimited buffering
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: false, // Disable low latency mode for better stability
          liveSyncDuration: 3,
          liveMaxLatencyDuration: 10,

          // UNLIMITED BUFFERING - Remove all buffer limits
          maxBufferLength: Infinity, // Unlimited buffer length
          maxMaxBufferLength: Infinity, // Unlimited max buffer length
          maxBufferSize: Infinity, // Unlimited buffer size
          maxBufferHole: Infinity, // Tolerate any gaps
          backBufferLength: Infinity, // Keep all previous segments

          startLevel: -1, // Auto level selection

          // Much more aggressive retry settings for robustness
          fragLoadingMaxRetry: 15, // Increased from 8
          manifestLoadingMaxRetry: 12, // Increased from 8
          levelLoadingMaxRetry: 12, // Increased from 8

          // Progressive retry delays with exponential backoff
          fragLoadingRetryDelay: 500, // Start faster, then backoff
          manifestLoadingRetryDelay: 500,
          levelLoadingRetryDelay: 500,

          // More timeout tolerance for poor connections
          fragLoadingTimeOut: 20000, // Increased from 10000
          manifestLoadingTimeOut: 15000, // Increased from 8000
          levelLoadingTimeOut: 15000, // Added explicit level timeout

          // Aggressive preloading settings for instant playback
          autoStartLoad: true, // Start loading immediately when attached
          startFragPrefetch: true, // Prefetch first fragments for instant start
          testBandwidth: true, // Test bandwidth for better quality selection

          // Buffer settings optimized for unlimited buffering
          nudgeOffset: 0.05, // Reduced from 0.1 - start even quicker
          nudgeMaxRetry: 10, // Increased from 5

          // Additional robustness settings
          capLevelToPlayerSize: false, // Don't limit quality based on player size
          startPosition: 0, // Always start from beginning
          enableCEA708Captions: false, // Disable to reduce processing overhead

          // Network resilience
          abrEwmaFastLive: 3.0, // Faster adaptation for live content
          abrEwmaSlowLive: 9.0,
          abrEwmaFastVoD: 3.0, // Faster adaptation for VoD
          abrEwmaSlowVoD: 9.0,
          abrEwmaDefaultEstimate: 500000, // Default bandwidth estimate (500kbps)
          abrBandWidthFactor: 0.95, // More conservative bandwidth usage
          abrBandWidthUpFactor: 0.7, // Even more conservative for upgrades
          xhrSetup: (xhr, url) => {
            // Intercept all requests from HLS.js and route through appropriate proxies
            if (!url.startsWith("http")) return; // Skip if not a URL

            // Choose the right proxy based on file type
            let proxyPath = "/api/proxy/m3u8"; // Default for manifests

            // If it's a TS file, use the TS proxy
            if (url.includes(".ts")) {
              proxyPath = "/api/proxy/ts";
            }

            const proxyUrl = new URL(proxyPath, window.location.origin);
            proxyUrl.searchParams.set("url", url);

            console.log(`Proxying HLS request via ${proxyPath}:`, {
              original: url,
              proxied: proxyUrl.toString(),
            });

            // Override the URL to use our proxy
            xhr.open("GET", proxyUrl.toString(), true);
          },
        });

        hlsRef.current = hls;

        console.log("Loading HLS source:", stream.playlist);
        hls.loadSource(stream.playlist);
        hls.attachMedia(video);

        // HLS.js will handle loading automatically - don't interfere with video.load()

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log("HLS manifest successfully parsed", {
            levels: data.levels?.length || 0,
            firstLevel: data.firstLevel,
            audioTracks: data.audioTracks?.length || 0,
          });

          // HLS.js handles loading automatically - no manual intervention needed
          console.log("HLS ready for instant playback");

          // Use requestIdleCallback to trigger preloading during browser idle time
          if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
              const video = videoRef.current;
              if (video && video.readyState < 2) {
                console.log("Browser idle - attempting metadata preload");
                // Try a very brief muted play to trigger metadata loading
                const originalMuted = video.muted;
                video.muted = true;
                video
                  .play()
                  .then(() => {
                    setTimeout(() => {
                      video.pause();
                      video.muted = originalMuted;
                      video.currentTime = 0;
                      console.log("Idle preload completed");
                    }, 50);
                  })
                  .catch(() => {
                    video.muted = originalMuted;
                    console.log(
                      "Idle preload failed, but may have triggered metadata load"
                    );
                  });
              }
            });
          }

          setIsLoading(false);
        });

        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          console.log("HLS level loaded", {
            level: data.level,
            live: data.details?.live,
            segments: data.details?.fragments?.length || 0,
          });
        });

        // Enhanced HLS fragment loading monitoring
        hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
          console.log("Loading fragment:", {
            url: data.frag?.url,
            level: data.frag?.level,
            sn: data.frag?.sn,
          });

          // Fragment started loading - reset network timeout
          if (networkTimeoutRef.current) {
            clearTimeout(networkTimeoutRef.current);
          }
          setIsNetworkSlow(false);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          console.log("Fragment loaded:", {
            url: data.frag?.url,
            duration: data.frag?.duration,
          });

          // Trigger buffer health check
          setTimeout(checkBufferHealth, 100);
        });

        // Buffer append monitoring for unlimited buffering
        hls.on(Hls.Events.BUFFER_APPENDED, (event, data) => {
          console.log("Buffer appended:", {
            type: data.type,
            timeRanges: data.timeRanges,
          });

          // Check buffer health after append
          setTimeout(checkBufferHealth, 100);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          // Enhanced logging for fragment/network errors with more detail
          if (
            data.details === "fragLoadError" ||
            data.type === "networkError" ||
            data.details === "fragLoadTimeOut"
          ) {
            console.error("Fragment/Network load error:", {
              url: data.frag?.url || data.url,
              response: data.response,
              error: data.error,
              details: data.details,
              fatal: data.fatal,
              networkErrorCode: data.response?.code,
              level: data.frag?.level,
              fragmentNumber: data.frag?.sn,
            });
          }

          // Handle non-fatal errors more gracefully with better recovery
          if (!data.fatal) {
            switch (data.details) {
              case Hls.ErrorDetails.FRAG_LOAD_ERROR:
              case Hls.ErrorDetails.FRAG_LOAD_TIMEOUT:
                console.log("Fragment load error - silent retry in background");
                // Don't show buffering for single fragment errors - let background recovery handle it
                // Only log the issue, don't interrupt user experience
                return;

              case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
                console.log(
                  "Manifest load error - silent retry in background..."
                );
                // Only show loading for critical manifest errors (4xx/5xx responses)
                if (data.response?.code && data.response.code >= 400) {
                  setIsBuffering(true);
                }

                // Progressive backoff for manifest errors (simple exponential backoff)
                const manifestRetryDelay = Math.min(
                  5000,
                  1000 * Math.pow(2, Math.min(3, networkErrorCount.current))
                );
                setTimeout(() => {
                  try {
                    hls.startLoad();
                    setIsBuffering(false);
                  } catch (e) {
                    console.log("Manifest retry failed:", e);
                    setIsBuffering(false);
                  }
                }, manifestRetryDelay);
                return;

              case Hls.ErrorDetails.BUFFER_STALLED_ERROR:
                console.log("Buffer stalled - silent recovery attempt");
                // Don't show buffering for stalls - let recovery happen silently
                setTimeout(() => {
                  try {
                    hls.recoverMediaError();
                  } catch (error) {
                    console.log("Buffer retry failed:", error);
                  }
                }, 2000);
                return;

              case Hls.ErrorDetails.BUFFER_APPEND_ERROR:
                console.log("Buffer append error - silent clear and retry");
                // Don't show buffering for append errors - handle silently
                try {
                  // Clear buffer and restart
                  hls.stopLoad();
                  setTimeout(() => {
                    hls.startLoad();
                  }, 1000);
                } catch (error) {
                  console.log("Buffer append retry failed:", error);
                }
                return;

              default:
                // Enhanced non-fatal error detection
                const tolerableErrors = [
                  "bufferStalledError",
                  "bufferAppendError",
                  "bufferFullError",
                  "internalException",
                  "fragParsingError",
                  "remuxAllocError",
                  "bufferIncompatibleCodecsError",
                ];

                if (!tolerableErrors.includes(data.details)) {
                  console.log("Non-fatal HLS issue:", {
                    type: data.type,
                    details: data.details,
                    level: data.level,
                    url: data.url,
                  });
                }

                // Brief loading indicator only for serious unhandled errors
                if (!tolerableErrors.includes(data.details)) {
                  setIsBuffering(true);
                  setTimeout(() => setIsBuffering(false), 1500);
                }
                return;
            }
          }

          // Handle fatal errors with enhanced recovery mechanisms
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log(
                  "Fatal HLS network error - implementing background recovery"
                );
                // Only show loading for repeated fatal network errors
                if (networkErrorCount.current > 2) {
                  setIsBuffering(true);
                }

                // Use ref-based tracking for recovery attempts
                networkErrorCount.current++;
                const networkRecoveryAttempt = networkErrorCount.current;
                console.log(
                  `Network recovery attempt ${networkRecoveryAttempt}/5`
                );

                if (networkRecoveryAttempt <= 5) {
                  // Progressive backoff with each attempt
                  const recoveryDelay = Math.min(
                    10000,
                    1000 * Math.pow(1.5, networkRecoveryAttempt)
                  );

                  setTimeout(() => {
                    try {
                      // Destroy and recreate with more conservative settings
                      hls.destroy();
                      const newHls = new Hls({
                        enableWorker: false,
                        lowLatencyMode: false,
                        liveSyncDuration: 3,
                        liveMaxLatencyDuration: 10,

                        // UNLIMITED BUFFERING for recovery too
                        maxBufferLength: Infinity, // Unlimited buffer length
                        maxMaxBufferLength: Infinity, // Unlimited max buffer length
                        maxBufferSize: Infinity, // Unlimited buffer size
                        maxBufferHole: Infinity, // Tolerate any gaps
                        backBufferLength: Infinity, // Keep all previous segments

                        startLevel: Math.max(0, (hls.currentLevel || 1) - 1), // Start lower quality

                        // Maximum retry settings
                        fragLoadingMaxRetry: 20,
                        manifestLoadingMaxRetry: 15,
                        levelLoadingMaxRetry: 15,

                        // Longer delays for unstable connections
                        fragLoadingRetryDelay: 1000 * networkRecoveryAttempt,
                        manifestLoadingRetryDelay:
                          1000 * networkRecoveryAttempt,
                        levelLoadingRetryDelay: 1000 * networkRecoveryAttempt,

                        // Extended timeouts
                        fragLoadingTimeOut: 30000,
                        manifestLoadingTimeOut: 25000,
                        levelLoadingTimeOut: 25000,

                        autoStartLoad: true,
                        startFragPrefetch: true,
                        testBandwidth: false, // Disable bandwidth testing during recovery

                        // More conservative bandwidth settings
                        abrBandWidthFactor: 0.8, // Even more conservative
                        abrBandWidthUpFactor: 0.5, // Very conservative upgrades
                      });

                      hlsRef.current = newHls;
                      newHls.loadSource(stream.playlist || "");
                      newHls.attachMedia(video);

                      // Restore position
                      const currentTime = video.currentTime;
                      newHls.on(Hls.Events.MANIFEST_PARSED, () => {
                        if (currentTime > 0) {
                          video.currentTime = currentTime;
                        }
                      });

                      setIsBuffering(false);
                      console.log(
                        `Network recovery attempt ${networkRecoveryAttempt} initiated`
                      );
                    } catch (e) {
                      console.error(
                        `Network recovery attempt ${networkRecoveryAttempt} failed:`,
                        e
                      );
                      if (networkRecoveryAttempt >= 5) {
                        setError(
                          "Network connection is too unstable. Please check your internet or try another server."
                        );
                      }
                      setIsLoading(false);
                      setIsBuffering(false);
                    }
                  }, recoveryDelay);
                } else {
                  setError(
                    "Network connection is too unstable. Please check your internet or try another server."
                  );
                  setIsLoading(false);
                  setIsBuffering(false);
                }
                break;

              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log(
                  "Fatal HLS media error - implementing background recovery"
                );
                // Only show loading for repeated media errors
                if (mediaErrorCount.current > 1) {
                  setIsBuffering(true);
                }

                // Use ref-based tracking for media recovery attempts
                mediaErrorCount.current++;
                const mediaRecoveryAttempt = mediaErrorCount.current;
                console.log(`Media recovery attempt ${mediaRecoveryAttempt}/3`);

                if (mediaRecoveryAttempt <= 3) {
                  try {
                    // Try different recovery strategies based on attempt
                    if (mediaRecoveryAttempt === 1) {
                      hls.recoverMediaError();
                    } else if (mediaRecoveryAttempt === 2) {
                      // More aggressive recovery - swap audio codec
                      hls.swapAudioCodec();
                      hls.recoverMediaError();
                    } else {
                      // Last resort - full restart with unlimited buffering
                      hls.destroy();
                      const newHls = new Hls({
                        enableWorker: false,
                        startLevel: 0, // Force lowest quality
                        capLevelToPlayerSize: true, // Limit quality
                        // UNLIMITED BUFFERING even in recovery
                        maxBufferLength: Infinity,
                        maxMaxBufferLength: Infinity,
                        maxBufferSize: Infinity,
                        maxBufferHole: Infinity,
                        backBufferLength: Infinity,
                      });
                      hlsRef.current = newHls;
                      newHls.loadSource(stream.playlist || "");
                      newHls.attachMedia(video);
                    }

                    setTimeout(() => setIsBuffering(false), 3000);
                  } catch (e) {
                    console.error(
                      `Media recovery attempt ${mediaRecoveryAttempt} failed:`,
                      e
                    );
                    if (mediaRecoveryAttempt >= 3) {
                      setError(
                        "Media decoding error. Please try switching servers or refresh the page."
                      );
                    }
                    setIsLoading(false);
                    setIsBuffering(false);
                  }
                } else {
                  setError(
                    "Media decoding error. Please try switching servers or refresh the page."
                  );
                  setIsLoading(false);
                  setIsBuffering(false);
                }
                break;

              default:
                // Enhanced error messages for different scenarios
                let errorMessage = "Stream error occurred";

                if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
                  errorMessage =
                    "Network connection issue. Please check your internet or try another server.";
                } else if (
                  data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR
                ) {
                  errorMessage =
                    "Unable to load stream. Please try another server.";
                } else if (data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR) {
                  errorMessage =
                    "Quality level unavailable. Trying to recover...";

                  // Try to recover from level load error by switching quality
                  setIsBuffering(true);
                  setTimeout(() => {
                    try {
                      if (hls.levels && hls.levels.length > 1) {
                        hls.currentLevel = 0; // Switch to lowest quality
                        hls.startLoad();
                        setIsBuffering(false);
                        return;
                      }
                    } catch (e) {
                      console.error("Level recovery failed:", e);
                    }
                    setError(
                      "Quality level unavailable. Please try another server."
                    );
                    setIsLoading(false);
                    setIsBuffering(false);
                  }, 2000);
                  return;
                } else {
                  errorMessage = `Stream error: ${
                    data.details || "Unknown error"
                  }. Try another source.`;
                }

                setError(errorMessage);
                setIsLoading(false);
                setIsBuffering(false);
                break;
            }
          }
        });

        // Add more handling for common HLS events with robustness monitoring
        hls.on(Hls.Events.MANIFEST_LOADING, () => {
          console.log("HLS manifest loading started");
        });

        hls.on(Hls.Events.LEVEL_LOADED, () => {
          // Successfully loaded a level/quality
          setIsLoading(false);
        });

        hls.on(Hls.Events.BUFFER_CREATED, () => {
          console.log("HLS buffer created");
        });

        // Monitor fragment load failures for adaptive quality using ERROR event
        let consecutiveFragFailures = 0;

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (
            data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT
          ) {
            consecutiveFragFailures++;
            console.log(`Fragment failure count: ${consecutiveFragFailures}`);

            // After 3 consecutive failures, try downgrading quality
            if (consecutiveFragFailures >= 3 && hls.currentLevel > 0) {
              console.log(
                "Multiple fragment failures - downgrading quality for stability"
              );
              hls.currentLevel = Math.max(0, hls.currentLevel - 1);
              consecutiveFragFailures = 0; // Reset counter after quality change
            }
          }
        });

        // Reset failure counter on successful fragment load
        hls.on(Hls.Events.FRAG_LOADED, () => {
          consecutiveFragFailures = 0;
        });

        // Monitor buffer health for proactive management
        hls.on(Hls.Events.BUFFER_APPENDED, () => {
          const video = videoRef.current;
          if (video && video.buffered.length > 0) {
            const currentTime = video.currentTime;
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const bufferHealth = bufferedEnd - currentTime;

            // If buffer is getting low, proactively show buffering indicator
            if (bufferHealth < 5 && !isBuffering) {
              console.log(`Buffer health low: ${bufferHealth.toFixed(1)}s`);
              setIsBuffering(true);

              // Clear buffering indicator once buffer improves
              const bufferCheckInterval = setInterval(() => {
                if (video.buffered.length > 0) {
                  const newBufferHealth =
                    video.buffered.end(video.buffered.length - 1) -
                    video.currentTime;
                  if (newBufferHealth > 10) {
                    setIsBuffering(false);
                    clearInterval(bufferCheckInterval);
                  }
                }
              }, 1000);

              // Clear interval after 10 seconds to prevent memory leaks
              setTimeout(() => clearInterval(bufferCheckInterval), 10000);
            }
          }
        });

        // Configure automatic level selection for best quality
        hls.autoLevelCapping = -1; // No capping (best quality)
        hls.startLevel = -1; // Auto start level

        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          console.log("HLS level loaded:", data);
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        // For Safari, we need to use our universal proxy for the entire stream
        // Safari will handle sub-requests internally, so we need to proxy the main playlist

        // Create universal proxy URL for the entire HLS stream
        const proxyUrl = new URL(
          "/api/universal-proxy",
          window.location.origin
        );
        proxyUrl.searchParams.set("destination", stream.playlist);
        const playlistUrl = proxyUrl.toString();

        console.log("Loading native HLS source:", {
          original: stream.playlist,
          proxied: playlistUrl,
        });
        video.src = playlistUrl;

        // Force Safari to load metadata immediately
        video.load();
        console.log("Safari HLS source set and loading started");
      } else {
        setError("HLS not supported in this browser");
        setIsLoading(false);
      }
    } else if (stream.type === "file" && stream.qualities) {
      // Use file stream with quality selection
      const quality =
        stream.qualities[selectedQuality as keyof typeof stream.qualities];
      if (quality) {
        video.src = quality.url;

        // Force preload for file streams
        video.load();
        console.log("File stream preload started:", quality.url);
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, selectedQuality]); // isBuffering is only used for state updates, not as dependency

  // Handle captions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Clear existing tracks
    const tracks = video.querySelectorAll("track");
    tracks.forEach((track) => track.remove());

    // Add caption tracks
    stream.captions.forEach((caption, index) => {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.src = caption.url;
      track.srclang = caption.language;
      track.label = caption.display || caption.language;
      track.default = index === 0;
      video.appendChild(track);
    });
  }, [stream.captions]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    video.muted = newVolume === 0;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    const wasPlaying = isPlaying;

    // Pause video before seeking to prevent interruption errors
    if (wasPlaying) {
      video.pause();
    }

    // Set the new time
    video.currentTime = newTime;

    // Resume playback after seeking if it was playing before
    if (wasPlaying) {
      // Wait a bit for the seek to complete before resuming
      setTimeout(() => {
        if (video && !video.seeking) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.log("Play after seek failed:", error);
              // Don't force play if autoplay is blocked
            });
          }
        }
      }, 100);
    }
  };

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(0, video.currentTime - 10);
    video.currentTime = newTime;
    console.log(`Skipped backward 10s to ${newTime.toFixed(1)}s`);
  }, []);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.min(video.duration || 0, video.currentTime + 10);
    video.currentTime = newTime;
    console.log(`Skipped forward 10s to ${newTime.toFixed(1)}s`);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (!document.pictureInPictureElement) {
        // Check if PiP is supported
        if (
          "pictureInPictureEnabled" in document &&
          document.pictureInPictureEnabled
        ) {
          await video.requestPictureInPicture();
          setIsPictureInPicture(true);
          console.log("Entered Picture-in-Picture mode");
        } else {
          console.warn("Picture-in-Picture is not supported in this browser");
        }
      } else {
        await document.exitPictureInPicture();
        setIsPictureInPicture(false);
        console.log("Exited Picture-in-Picture mode");
      }
    } catch (error) {
      console.error("Picture-in-Picture error:", error);
    }
  }, []);

  const handleQualityChange = (quality: string) => {
    setSelectedQuality(quality);
  };

  const handleCaptionChange = (captionIndex: number | null) => {
    const video = videoRef.current;
    if (!video) return;

    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = i === captionIndex ? "showing" : "hidden";
    }

    setSelectedCaption(captionIndex?.toString() || null);
    setShowCaptionMenu(false);
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleSettingsToggle = () => {
    setShowSettingsMenu(!showSettingsMenu);
    // Close other menus when opening settings
    if (!showSettingsMenu) {
      setShowCaptionMenu(false);
      setShowServerMenu(false);
    }
  };

  const handleNextEpisode = () => {
    if (!tvShowInfo || !onEpisodeChange) return;

    const { currentSeason, currentEpisode, totalSeasons } = tvShowInfo;
    const episodesInCurrentSeason =
      tvShowInfo.seasonEpisodes?.[currentSeason] || tvShowInfo.totalEpisodes;

    if (currentEpisode < episodesInCurrentSeason) {
      // Go to next episode in same season
      onEpisodeChange(currentSeason, currentEpisode + 1);
    } else if (currentSeason < totalSeasons) {
      // Go to first episode of next season
      onEpisodeChange(currentSeason + 1, 1);
    }
  };

  // Keyboard shortcuts for video controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts when the video player is focused or active
      const container = containerRef.current;
      if (!container || !duration) return;

      // Ignore if user is typing in an input field
      if (
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipBackward();
          break;
        case "ArrowRight":
          e.preventDefault();
          skipForward();
          break;
        case "j":
        case "J":
          e.preventDefault();
          skipBackward();
          break;
        case "l":
        case "L":
          e.preventDefault();
          skipForward();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    // Add event listener to the container
    const container = containerRef.current;
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
      // Make container focusable
      container.tabIndex = 0;
    }

    return () => {
      if (container) {
        container.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [
    duration,
    togglePlay,
    skipBackward,
    skipForward,
    toggleMute,
    toggleFullscreen,
  ]);

  // Get available qualities from the stream
  const getAvailableQualities = () => {
    if (stream.type === "file" && stream.qualities) {
      return Object.keys(stream.qualities).sort((a, b) => {
        const qualityOrder = {
          "360": 1,
          "480": 2,
          "720": 3,
          "1080": 4,
          "4k": 5,
        };
        return (
          (qualityOrder[b as keyof typeof qualityOrder] || 0) -
          (qualityOrder[a as keyof typeof qualityOrder] || 0)
        );
      });
    }
    return [];
  };

  // Get English captions from the stream
  const getEnglishCaptions = () => {
    return stream.captions.filter(
      (caption) =>
        caption.language.toLowerCase().includes("en") ||
        caption.display?.toLowerCase().includes("english") ||
        caption.language.toLowerCase() === "eng"
    );
  };

  if (error) {
    return (
      <div
        className={cn(
          "relative bg-black rounded-lg overflow-hidden",
          className
        )}
      >
        <div className="flex items-center justify-center h-64 text-white">
          <div className="text-center">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={48}
              color="#ef4444"
              strokeWidth={1.5}
              className="mx-auto mb-4"
            />
            <p className="text-lg font-semibold">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Hidden preloader mode - only render video element for metadata loading
  if (isHiddenPreloader) {
    return (
      <video
        ref={videoRef}
        style={{ display: "none" }}
        muted
        playsInline
        preload="auto"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden group",
        className
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => {
        if (isPlaying) {
          hideControlsAfterDelay();
        }
      }}
    >
      {/* Hidden video for preloading metadata */}
      <video
        ref={hiddenVideoRef}
        style={{ display: "none" }}
        muted
        playsInline
        preload="auto"
      />

      <video
        ref={videoRef}
        className="w-full h-full"
        onClick={togglePlay}
        playsInline
        preload="auto"
        onLoadStart={() => {
          console.log("Video load started");
        }}
        onProgress={() => {
          console.log("Video loading progress");
        }}
        onCanPlay={() => {
          console.log("Video can play - ready for playback");
        }}
        onCanPlayThrough={() => {
          console.log(
            "Video can play through - fully buffered and ready for instant playback"
          );
        }}
        onLoadedData={() => {
          console.log("Video data loaded - enough buffered to start playback");
        }}
        onLoadedMetadata={() => {
          console.log(
            "Video metadata loaded - duration and dimensions available"
          );
        }}
        onError={(e) => {
          const video = e.currentTarget;
          const error = video.error;
          if (error) {
            console.error("Video element error:", {
              code: error.code,
              message: error.message,
              MEDIA_ERR_ABORTED: error.code === 1,
              MEDIA_ERR_NETWORK: error.code === 2,
              MEDIA_ERR_DECODE: error.code === 3,
              MEDIA_ERR_SRC_NOT_SUPPORTED: error.code === 4,
            });
            setError(
              `Video failed to load: ${
                error.message || `Error code ${error.code}`
              }`
            );
          }
        }}
      />

      {/* Critical loading overlay - only for real issues or empty buffer */}
      {(isLoading ||
        (isBuffering && (isNetworkSlow || bufferedAhead === 0))) && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <HugeiconsIcon
              icon={Loading03Icon}
              size={48}
              color="currentColor"
              strokeWidth={1.5}
              className="mx-auto mb-4 animate-spin"
            />
            <p className="text-white text-lg">
              {isNetworkSlow
                ? "Network issue detected..."
                : "Loading content..."}
            </p>
            {bufferHealthy && (
              <p className="text-green-400 text-sm mt-2">
                Buffer healthy - this should resolve quickly
              </p>
            )}
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          {/* Progress bar */}
          <div className="mb-2">
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              bufferedRanges={bufferedRanges || undefined}
            />
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              {/* Compact playback controls group */}
              <div className="flex items-center space-x-1">
                <SkipBackwardButton
                  onSkip={skipBackward}
                  disabled={!duration || currentTime <= 0}
                />

                {/* Centered larger Play/Pause button */}
                <PlayPauseButton isPlaying={isPlaying} onToggle={togglePlay} />

                <SkipForwardButton
                  onSkip={skipForward}
                  disabled={!duration || currentTime >= duration}
                />
              </div>

              <div className="flex items-center space-x-2">
                <VolumeButton
                  isMuted={isMuted}
                  volume={volume}
                  onToggleMute={toggleMute}
                />
                <VolumeSlider
                  volume={volume}
                  isMuted={isMuted}
                  onChange={handleVolumeChange}
                />
              </div>

              <TimeDisplay
                currentTime={currentTime}
                duration={duration}
                formatTime={formatTime}
              />
            </div>

            <div className="flex items-center space-x-2">
              {/* Server/Source selector */}
              {availableSources.length > 0 && (
                <div className="relative">
                  <ServerButton
                    onToggle={() => setShowServerMenu(!showServerMenu)}
                    isLoading={isLoadingServer}
                  />
                  <ServerMenu
                    isOpen={showServerMenu}
                    sources={availableSources}
                    currentSourceId={currentSourceId}
                    onSourceSelect={(sourceId) => {
                      if (onSwitchServer && sourceId !== currentSourceId) {
                        onSwitchServer(sourceId);
                      }
                    }}
                    onClose={() => setShowServerMenu(false)}
                    isLoading={isLoadingServer}
                  />
                </div>
              )}

              {/* Caption menu */}
              {stream.captions.length > 0 && (
                <div className="relative">
                  <SubtitlesButton
                    onToggle={() => setShowCaptionMenu(!showCaptionMenu)}
                  />
                  <CaptionsMenu
                    isOpen={showCaptionMenu}
                    captions={stream.captions}
                    onCaptionSelect={handleCaptionChange}
                    onClose={() => setShowCaptionMenu(false)}
                  />
                </div>
              )}

              {/* Settings menu */}
              <div className="relative">
                <SettingsButton onToggle={handleSettingsToggle} />
                <SettingsMenu
                  isOpen={showSettingsMenu}
                  activeTab={settingsTab}
                  onTabChange={setSettingsTab}
                >
                  {settingsTab === "quality" && (
                    <QualityTab
                      streamType={stream.type}
                      qualities={getAvailableQualities()}
                      selectedQuality={selectedQuality}
                      onQualityChange={handleQualityChange}
                      onClose={() => setShowSettingsMenu(false)}
                      getQualityLabel={getQualityLabel}
                    />
                  )}
                  {settingsTab === "subtitles" && (
                    <SubtitlesTab
                      captions={getEnglishCaptions()}
                      selectedCaption={selectedCaption}
                      onCaptionChange={handleCaptionChange}
                      onClose={() => setShowSettingsMenu(false)}
                    />
                  )}
                  {settingsTab === "speed" && (
                    <SpeedTab
                      speeds={playbackSpeeds}
                      selectedSpeed={playbackSpeed}
                      onSpeedChange={handlePlaybackSpeedChange}
                      onClose={() => setShowSettingsMenu(false)}
                    />
                  )}
                </SettingsMenu>
              </div>

              {/* Next Episode Button for TV shows */}
              {mediaType === "tv" && tvShowInfo && (
                <EpisodeNavigation
                  tvInfo={tvShowInfo}
                  onNextEpisode={handleNextEpisode}
                  isLoading={isLoadingTVContent}
                />
              )}

              <PictureInPictureButton
                onToggle={togglePictureInPicture}
                isPictureInPicture={isPictureInPicture}
                disabled={
                  !(
                    "pictureInPictureEnabled" in document &&
                    document.pictureInPictureEnabled
                  )
                }
              />
              <FullscreenButton onToggle={toggleFullscreen} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
