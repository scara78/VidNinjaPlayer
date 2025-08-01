"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ListViewIcon,
  Loading03Icon,
  ArrowRight01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { DropdownMenu, DropdownHeader } from "./DropdownMenu";

// TV Show Episode/Season info
export interface TVShowInfo {
  currentSeason: number;
  currentEpisode: number;
  totalSeasons: number;
  totalEpisodes: number;
  seasonEpisodes?: Record<number, number>; // season number -> episode count
}

// TV Show Navigation Button
interface TVShowNavigationButtonProps {
  onToggle: () => void;
}

export function TVShowNavigationButton({
  onToggle,
}: TVShowNavigationButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
      title="Episode Navigation"
    >
      <HugeiconsIcon
        icon={ListViewIcon}
        size={20}
        color="currentColor"
        strokeWidth={1.5}
      />
    </button>
  );
}

// Simple Next Episode Navigation
interface EpisodeNavigationProps {
  tvInfo: TVShowInfo;
  onNextEpisode: () => void;
  isLoading?: boolean;
}

export function EpisodeNavigation({
  tvInfo,
  onNextEpisode,
  isLoading = false,
}: EpisodeNavigationProps) {
  const canGoNext =
    tvInfo.currentEpisode <
      (tvInfo.seasonEpisodes?.[tvInfo.currentSeason] || tvInfo.totalEpisodes) ||
    tvInfo.currentSeason < tvInfo.totalSeasons;

  if (!canGoNext) return null;

  return (
    <button
      onClick={onNextEpisode}
      disabled={isLoading}
      className={cn(
        "flex items-center space-x-2 px-4 py-2 hover:bg-white/20 rounded-lg transition-colors duration-200",
        isLoading && "opacity-50 cursor-not-allowed"
      )}
      title="Next Episode"
    >
      {isLoading ? (
        <>
          <HugeiconsIcon
            icon={Loading03Icon}
            size={16}
            color="currentColor"
            strokeWidth={1.5}
            className="animate-spin"
          />
          <span className="text-sm">Loading...</span>
        </>
      ) : (
        <>
          <span className="text-sm">Next Episode</span>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={16}
            color="currentColor"
            strokeWidth={1.5}
          />
        </>
      )}
    </button>
  );
}

// TV Show Menu Component
interface TVShowMenuProps {
  isOpen: boolean;
  tvInfo: TVShowInfo;
  onSeasonChange: (season: number) => void;
  onEpisodeChange: (season: number, episode: number) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function TVShowMenu({
  isOpen,
  tvInfo,
  onSeasonChange,
  onEpisodeChange,
  onClose,
  isLoading = false,
}: TVShowMenuProps) {
  const [selectedSeason, setSelectedSeason] = useState(tvInfo.currentSeason);

  if (!isOpen) return null;

  const seasons = Array.from({ length: tvInfo.totalSeasons }, (_, i) => i + 1);
  const episodesInSeason =
    tvInfo.seasonEpisodes?.[selectedSeason] || tvInfo.totalEpisodes;
  const episodes = Array.from({ length: episodesInSeason }, (_, i) => i + 1);

  return (
    <DropdownMenu
      isOpen={isOpen}
      className="min-w-72 max-h-96 overflow-hidden bg-black/95 border border-gray-600"
    >
      <DropdownHeader>
        <span className="text-white font-medium">Episodes & Seasons</span>
      </DropdownHeader>

      {/* Current Episode Display */}
      <div className="p-4 border-b border-gray-600 bg-gray-800/50">
        <div className="text-xs text-gray-400 mb-2">Currently Playing:</div>
        <div className="flex items-center space-x-3">
          <span className="text-lg font-medium text-white">
            Season {tvInfo.currentSeason}, Episode {tvInfo.currentEpisode}
          </span>
        </div>
      </div>

      <div className="flex h-64">
        {/* Seasons List */}
        <div className="w-1/2 border-r border-gray-600">
          <div className="px-4 py-3 text-xs text-gray-400 border-b border-gray-600 bg-gray-800/30">
            Seasons ({tvInfo.totalSeasons})
          </div>
          <div className="overflow-y-auto h-52">
            {seasons.map((season) => (
              <button
                key={season}
                onClick={() => setSelectedSeason(season)}
                disabled={isLoading}
                className={cn(
                  "block w-full px-4 py-3 text-left transition-colors duration-200 text-sm",
                  selectedSeason === season
                    ? "bg-white/20 text-white"
                    : "hover:bg-white/10 text-gray-300",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>Season {season}</span>
                    <span className="text-xs text-gray-400">
                      ({tvInfo.seasonEpisodes?.[season] || tvInfo.totalEpisodes}{" "}
                      episodes)
                    </span>
                  </div>
                  {tvInfo.currentSeason === season && (
                    <div className="w-2 h-2 bg-white rounded-lg"></div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Episodes List */}
        <div className="w-1/2">
          <div className="px-4 py-3 text-xs text-gray-400 border-b border-gray-600 bg-gray-800/30">
            Episodes ({episodesInSeason})
          </div>
          <div className="overflow-y-auto h-52">
            {episodes.map((episode) => (
              <button
                key={episode}
                onClick={() => {
                  onEpisodeChange(selectedSeason, episode);
                  onClose();
                }}
                disabled={isLoading}
                className={cn(
                  "block w-full px-4 py-3 text-left transition-colors duration-200 text-sm",
                  tvInfo.currentSeason === selectedSeason &&
                    tvInfo.currentEpisode === episode
                    ? "bg-white/20 text-white"
                    : "hover:bg-white/10 text-gray-300",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>Episode {episode}</span>
                  {tvInfo.currentSeason === selectedSeason &&
                    tvInfo.currentEpisode === episode && (
                      <HugeiconsIcon
                        icon={PlayIcon}
                        size={12}
                        color="currentColor"
                        strokeWidth={1.5}
                        className="text-white"
                      />
                    )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="p-4 border-t border-gray-600 bg-gray-800/50">
        <button
          onClick={() => {
            onSeasonChange(selectedSeason);
            onClose();
          }}
          disabled={isLoading || selectedSeason === tvInfo.currentSeason}
          className={cn(
            "px-4 py-2 rounded text-sm transition-colors duration-200",
            isLoading || selectedSeason === tvInfo.currentSeason
              ? "opacity-50 cursor-not-allowed bg-gray-700 text-gray-400"
              : "bg-white text-black hover:bg-gray-200"
          )}
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <HugeiconsIcon
                icon={Loading03Icon}
                size={12}
                color="currentColor"
                strokeWidth={1.5}
                className="animate-spin"
              />
              <span>Loading...</span>
            </div>
          ) : (
            `Go to Season ${selectedSeason}`
          )}
        </button>
      </div>
    </DropdownMenu>
  );
}
