"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlayIcon,
  PauseIcon,
  Settings02Icon,
  ServerStack02Icon,
  Loading03Icon,
  GoBackward10SecIcon,
  GoForward10SecIcon,
  ArrowExpand01Icon,
  SubtitleIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeOffIcon,
  PictureInPictureOnIcon,
  PictureInPictureExitIcon,
} from "@hugeicons/core-free-icons";

// Base control button component
interface ControlButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function ControlButton({
  onClick,
  children,
  className,
  disabled,
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-lg hover:bg-white/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/30",
        "flex items-center justify-center min-w-[40px] min-h-[40px]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}

// Play/Pause button
interface PlayPauseButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
  size?: number;
}

export function PlayPauseButton({ isPlaying, onToggle }: PlayPauseButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="p-3 rounded-full  hover:bg-white/20 transition-colors duration-200"
    >
      {isPlaying ? (
        <HugeiconsIcon
          icon={PauseIcon}
          size={36}
          color="currentColor"
          strokeWidth={1.5}
        />
      ) : (
        <HugeiconsIcon
          icon={PlayIcon}
          size={36}
          color="currentColor"
          strokeWidth={1.5}
        />
      )}
    </button>
  );
}

// Volume button with mute toggle
interface VolumeButtonProps {
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
}

export function VolumeButton({
  isMuted,
  volume,
  onToggleMute,
}: VolumeButtonProps) {
  const [animationKey, setAnimationKey] = useState(0);
  const [previousVolume, setPreviousVolume] = useState(volume);

  // Trigger animation when volume changes
  useEffect(() => {
    if (volume !== previousVolume) {
      setAnimationKey((prev) => prev + 1);
      setPreviousVolume(volume);
    }
  }, [volume, previousVolume]);

  // Determine which icon to show based on volume level
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return VolumeOffIcon;
    } else if (volume <= 0.3) {
      return VolumeLowIcon;
    } else {
      return VolumeHighIcon;
    }
  };

  // Get color based on volume level for subtle visual feedback
  const getVolumeColor = () => {
    return "currentColor"; // Use default color instead of custom colors
  };

  const currentIcon = getVolumeIcon();

  return (
    <ControlButton onClick={onToggleMute}>
      <div className="relative">
        {/* Animated volume icon with key-based animation */}
        <div
          key={animationKey}
          className="transition-all duration-300 ease-in-out transform"
          style={{
            transform: `scale(${isMuted ? 0.9 : 1})`,
            opacity: isMuted ? 0.7 : 1,
          }}
        >
          <HugeiconsIcon
            icon={currentIcon}
            size={24}
            color={getVolumeColor()}
            strokeWidth={1.5}
            className="transition-all duration-200 ease-in-out animate-pulse-once"
          />
        </div>
      </div>
    </ControlButton>
  );
}

// Fullscreen button
interface FullscreenButtonProps {
  onToggle: () => void;
}

export function FullscreenButton({ onToggle }: FullscreenButtonProps) {
  return (
    <ControlButton onClick={onToggle}>
      <HugeiconsIcon
        icon={ArrowExpand01Icon}
        size={24}
        color="currentColor"
        strokeWidth={1.5}
      />
    </ControlButton>
  );
}

// Skip backward button (10 seconds)
interface SkipBackwardButtonProps {
  onSkip: () => void;
  disabled?: boolean;
}

export function SkipBackwardButton({
  onSkip,
  disabled,
}: SkipBackwardButtonProps) {
  return (
    <ControlButton onClick={onSkip} disabled={disabled} className="relative">
      <HugeiconsIcon
        icon={GoBackward10SecIcon}
        size={24}
        color="currentColor"
        strokeWidth={1.5}
      />
    </ControlButton>
  );
}

// Skip forward button (10 seconds)
interface SkipForwardButtonProps {
  onSkip: () => void;
  disabled?: boolean;
}

export function SkipForwardButton({
  onSkip,
  disabled,
}: SkipForwardButtonProps) {
  return (
    <ControlButton onClick={onSkip} disabled={disabled} className="relative">
      <HugeiconsIcon
        icon={GoForward10SecIcon}
        size={24}
        color="currentColor"
        strokeWidth={1.5}
      />
    </ControlButton>
  );
}

// Settings button
interface SettingsButtonProps {
  onToggle: () => void;
}

export function SettingsButton({ onToggle }: SettingsButtonProps) {
  return (
    <ControlButton onClick={onToggle}>
      <HugeiconsIcon
        icon={Settings02Icon}
        size={24}
        color="currentColor"
        strokeWidth={1.5}
      />
    </ControlButton>
  );
}

// Subtitles button
interface SubtitlesButtonProps {
  onToggle: () => void;
}

export function SubtitlesButton({ onToggle }: SubtitlesButtonProps) {
  return (
    <ControlButton onClick={onToggle}>
      <HugeiconsIcon
        icon={SubtitleIcon}
        size={24}
        color="currentColor"
        strokeWidth={1.5}
      />
    </ControlButton>
  );
}

// Server selector button
interface ServerButtonProps {
  onToggle: () => void;
  isLoading?: boolean;
}

export function ServerButton({
  onToggle,
  isLoading = false,
}: ServerButtonProps) {
  return (
    <ControlButton onClick={onToggle} disabled={isLoading}>
      {isLoading ? (
        <HugeiconsIcon
          icon={Loading03Icon}
          size={24}
          color="currentColor"
          strokeWidth={1.5}
          className="animate-spin"
        />
      ) : (
        <HugeiconsIcon
          icon={ServerStack02Icon}
          size={24}
          color="currentColor"
          strokeWidth={1.5}
        />
      )}
    </ControlButton>
  );
}

// Center play button (larger for overlay)
interface CenterPlayButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function CenterPlayButton({
  isPlaying,
  onToggle,
  disabled = false,
}: CenterPlayButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "p-4 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors",
        "flex items-center justify-center min-w-[64px] min-h-[64px]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {isPlaying ? (
        <HugeiconsIcon
          icon={PauseIcon}
          size={40}
          color="currentColor"
          strokeWidth={1.5}
        />
      ) : (
        <HugeiconsIcon
          icon={PlayIcon}
          size={40}
          color="currentColor"
          strokeWidth={1.5}
        />
      )}
    </button>
  );
}

// Picture-in-Picture button
interface PictureInPictureButtonProps {
  onToggle: () => void;
  disabled?: boolean;
  isPictureInPicture?: boolean;
}

export function PictureInPictureButton({
  onToggle,
  disabled = false,
  isPictureInPicture = false,
}: PictureInPictureButtonProps) {
  return (
    <ControlButton onClick={onToggle} disabled={disabled}>
      <HugeiconsIcon
        icon={
          isPictureInPicture ? PictureInPictureExitIcon : PictureInPictureOnIcon
        }
        size={24}
        color="currentColor"
        strokeWidth={1.5}
      />
    </ControlButton>
  );
}
