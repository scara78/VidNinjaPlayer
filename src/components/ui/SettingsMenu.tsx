"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { DropdownHeader, SelectableItem } from "./DropdownMenu";

// Settings tab type
export type SettingsTab = "quality" | "subtitles" | "speed";

// Settings menu header with tabs
interface SettingsMenuHeaderProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsMenuHeader({
  activeTab,
  onTabChange,
}: SettingsMenuHeaderProps) {
  return (
    <div className="flex border-b border-gray-600">
      <button
        onClick={() => onTabChange("quality")}
        className={cn(
          "flex-1 px-4 py-2 text-sm font-medium transition-colors",
          activeTab === "quality"
            ? "bg-blue-600 text-white"
            : "text-gray-300 hover:bg-white/10"
        )}
      >
        Quality
      </button>
      <button
        onClick={() => onTabChange("subtitles")}
        className={cn(
          "flex-1 px-4 py-2 text-sm font-medium transition-colors",
          activeTab === "subtitles"
            ? "bg-blue-600 text-white"
            : "text-gray-300 hover:bg-white/10"
        )}
      >
        Subtitles
      </button>
      <button
        onClick={() => onTabChange("speed")}
        className={cn(
          "flex-1 px-4 py-2 text-sm font-medium transition-colors",
          activeTab === "speed"
            ? "bg-blue-600 text-white"
            : "text-gray-300 hover:bg-white/10"
        )}
      >
        Speed
      </button>
    </div>
  );
}

// Complete settings menu
interface SettingsMenuProps {
  isOpen: boolean;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  children: React.ReactNode;
}

export function SettingsMenu({
  isOpen,
  activeTab,
  onTabChange,
  children,
}: SettingsMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg min-w-64 max-h-80 overflow-hidden">
      <SettingsMenuHeader activeTab={activeTab} onTabChange={onTabChange} />
      <div className="max-h-64 overflow-y-auto">{children}</div>
    </div>
  );
}

// Quality tab content
interface QualityTabProps {
  streamType: string;
  qualities: string[];
  selectedQuality: string;
  onQualityChange: (quality: string) => void;
  onClose: () => void;
  getQualityLabel: (quality: string) => string;
}

export function QualityTab({
  streamType,
  qualities,
  selectedQuality,
  onQualityChange,
  onClose,
  getQualityLabel,
}: QualityTabProps) {
  return (
    <div className="py-2">
      {streamType === "hls" && (
        <div className="px-4 py-2 text-sm text-gray-400">
          Quality is automatically adjusted for HLS streams
        </div>
      )}
      {streamType === "file" && qualities.length > 0 && (
        <>
          <DropdownHeader>Video Quality</DropdownHeader>
          {qualities.map((quality) => (
            <SelectableItem
              key={quality}
              onClick={() => {
                onQualityChange(quality);
                onClose();
              }}
              isSelected={selectedQuality === quality}
            >
              {getQualityLabel(quality)}
            </SelectableItem>
          ))}
        </>
      )}
    </div>
  );
}

// Subtitles tab content
interface SubtitlesTabProps {
  captions: Array<{ display?: string; language: string }>;
  selectedCaption: string | null;
  onCaptionChange: (index: number | null) => void;
  onClose: () => void;
}

export function SubtitlesTab({
  captions,
  selectedCaption,
  onCaptionChange,
  onClose,
}: SubtitlesTabProps) {
  return (
    <div className="py-2">
      <DropdownHeader>English Subtitles</DropdownHeader>
      <SelectableItem
        onClick={() => {
          onCaptionChange(null);
          onClose();
        }}
        isSelected={selectedCaption === null}
      >
        Off
      </SelectableItem>
      {captions.map((caption, index) => (
        <SelectableItem
          key={index}
          onClick={() => {
            onCaptionChange(index);
            onClose();
          }}
          isSelected={selectedCaption === index.toString()}
        >
          {caption.display || caption.language}
        </SelectableItem>
      ))}
      {captions.length === 0 && (
        <div className="px-4 py-2 text-sm text-gray-400">
          No English subtitles available
        </div>
      )}
    </div>
  );
}

// Speed tab content
interface SpeedTabProps {
  speeds: number[];
  selectedSpeed: number;
  onSpeedChange: (speed: number) => void;
  onClose: () => void;
}

export function SpeedTab({
  speeds,
  selectedSpeed,
  onSpeedChange,
  onClose,
}: SpeedTabProps) {
  return (
    <div className="py-2">
      <DropdownHeader>Playback Speed</DropdownHeader>
      {speeds.map((speed) => (
        <SelectableItem
          key={speed}
          onClick={() => {
            onSpeedChange(speed);
            onClose();
          }}
          isSelected={selectedSpeed === speed}
        >
          {speed === 1 ? "Normal" : `${speed}x`}
        </SelectableItem>
      ))}
    </div>
  );
}
