"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownHeader } from "./DropdownMenu";

// Server source interface
interface ServerSource {
  id: string;
  name: string;
  rank: number;
  isWorking?: boolean; // Add working status
}

// Server menu component
interface ServerMenuProps {
  isOpen: boolean;
  sources: ServerSource[];
  currentSourceId?: string;
  onSourceSelect: (sourceId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function ServerMenu({
  isOpen,
  sources,
  currentSourceId,
  onSourceSelect,
  onClose,
  isLoading = false,
}: ServerMenuProps) {
  if (!isOpen) return null;

  return (
    <DropdownMenu isOpen={isOpen} className="min-w-48 max-h-64 overflow-y-auto">
      <DropdownHeader>Select Server</DropdownHeader>
      {sources
        .sort((a, b) => b.rank - a.rank) // Sort by rank (higher rank first)
        .map((source) => (
          <button
            key={source.id}
            onClick={() => {
              onClose();
              if (source.id !== currentSourceId) {
                onSourceSelect(source.id);
              }
            }}
            disabled={isLoading || !source.isWorking}
            className={cn(
              "block w-full px-4 py-2 text-left transition-colors",
              source.isWorking
                ? "hover:bg-white/20 cursor-pointer"
                : "opacity-50 cursor-not-allowed text-gray-500",
              currentSourceId === source.id &&
                source.isWorking &&
                "bg-blue-600/50 text-blue-100",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "font-medium",
                  !source.isWorking && "line-through"
                )}
              >
                {source.name}
              </span>
              <div className="flex items-center space-x-2">
                {currentSourceId === source.id && source.isWorking && (
                  <div className="w-2 h-2 bg-green-400 rounded-lg"></div>
                )}
                {!source.isWorking && (
                  <span className="text-xs text-red-400">offline</span>
                )}
                <span className="text-xs text-gray-400">#{source.rank}</span>
              </div>
            </div>
          </button>
        ))}
    </DropdownMenu>
  );
}
