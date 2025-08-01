"use client";

import React, { useState } from "react";

// Volume slider component
interface VolumeSliderProps {
  volume: number;
  isMuted: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function VolumeSlider({ volume, isMuted, onChange }: VolumeSliderProps) {
  return (
    <input
      type="range"
      min="0"
      max="1"
      step="0.1"
      value={isMuted ? 0 : volume}
      onChange={onChange}
      className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
    />
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
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsDragging(false);
  };

  return (
    <div
      className="relative w-full group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Track container with increased height on hover */}
      <div
        className={`relative w-full bg-white/30 rounded-lg overflow-hidden transition-all duration-200 ${
          isHovering || isDragging ? "h-2" : "h-1"
        }`}
      >
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

        {/* Progress track background */}
        <div
          className="absolute h-full bg-red-500 transition-all duration-150"
          style={{
            width: `${progressPercent}%`,
          }}
        />

        {/* Scrubber handle (YouTube-style dot) */}
        <div
          className={`absolute top-1/2 transform -translate-y-1/2 bg-red-500 rounded-full transition-all duration-200 ${
            isHovering || isDragging
              ? "w-4 h-4 opacity-100"
              : "w-0 h-0 opacity-0"
          }`}
          style={{
            left: `calc(${progressPercent}% - ${
              isHovering || isDragging ? "8px" : "0px"
            })`,
          }}
        />
      </div>

      {/* Invisible input slider for interaction */}
      <input
        type="range"
        min="0"
        max={duration || 0}
        value={currentTime}
        onChange={onSeek}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
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
