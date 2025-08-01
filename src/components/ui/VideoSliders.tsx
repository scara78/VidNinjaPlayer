"use client";

import React from "react";

// Volume slider component
interface VolumeSliderProps {
  volume: number;
  isMuted: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function VolumeSlider({ volume, isMuted, onChange }: VolumeSliderProps) {
  return (
    <div className="relative">
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={isMuted ? 0 : volume}
        onChange={onChange}
        className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider
        [&::-webkit-slider-thumb]:appearance-none 
        [&::-webkit-slider-thumb]:w-3 
        [&::-webkit-slider-thumb]:h-3 
        [&::-webkit-slider-thumb]:bg-white 
        [&::-webkit-slider-thumb]:rounded-full 
        [&::-webkit-slider-thumb]:cursor-pointer
        [&::-webkit-slider-thumb]:shadow-lg
        [&::-moz-range-thumb]:w-3
        [&::-moz-range-thumb]:h-3
        [&::-moz-range-thumb]:bg-white
        [&::-moz-range-thumb]:rounded-full
        [&::-moz-range-thumb]:border-none
        [&::-moz-range-thumb]:cursor-pointer
        [&::-moz-range-thumb]:shadow-lg"
      />
      {/* Volume fill indicator */}
      <div
        className="absolute top-0 left-0 h-1 bg-white rounded-lg pointer-events-none"
        style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
      />
    </div>
  );
}

// Progress bar component with buffer visualization
interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bufferedRanges?: TimeRanges; // Add buffered ranges for visualization
}

export function ProgressBar({
  currentTime,
  duration,
  onSeek,
  bufferedRanges,
}: ProgressBarProps) {
  // Calculate buffered segments for visualization
  const getBufferedSegments = () => {
    if (!bufferedRanges || !duration) return [];

    const segments = [];
    for (let i = 0; i < bufferedRanges.length; i++) {
      const start = (bufferedRanges.start(i) / duration) * 100;
      const end = (bufferedRanges.end(i) / duration) * 100;
      segments.push({ start, width: end - start });
    }
    return segments;
  };

  const bufferedSegments = getBufferedSegments();
  const progressPercent = (currentTime / (duration || 1)) * 100;

  return (
    <div className="relative w-full group">
      {/* Track container with fixed height (no zoom effect) */}
      <div className="relative w-full h-1 bg-white/30 rounded-lg overflow-hidden">
        {/* Buffered regions (light gray) */}
        {bufferedSegments.map((segment, index) => (
          <div
            key={index}
            className="absolute h-full bg-gray-400 opacity-60"
            style={{
              left: `${segment.start}%`,
              width: `${segment.width}%`,
            }}
          />
        ))}

        {/* Progress track background - changed to white */}
        <div
          className="absolute h-full bg-white transition-all duration-150"
          style={{
            width: `${progressPercent}%`,
          }}
        />
      </div>

      {/* Progress dot - always visible, only zooms on hover */}
      <div
        className={`absolute top-1/2 transform -translate-y-1/2 bg-white rounded-full transition-all duration-200 hover:scale-125 ${
          progressPercent > 0 ? "w-3 h-3" : "w-0 h-0"
        }`}
        style={{
          left: `calc(${progressPercent}% - 6px)`,
        }}
      />

      {/* Invisible input slider for interaction */}
      <input
        type="range"
        min="0"
        max={duration || 0}
        value={currentTime}
        onChange={onSeek}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}

// Time display component
interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  formatTime: (time: number) => string;
}

export function TimeDisplay({
  currentTime,
  duration,
  formatTime,
}: TimeDisplayProps) {
  return (
    <span className="text-sm">
      {formatTime(currentTime)} / {formatTime(duration)}
    </span>
  );
}
