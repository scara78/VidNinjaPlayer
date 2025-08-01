"use client";

import React from "react";
import { DropdownMenu, DropdownItem } from "./DropdownMenu";

// Caption interface
interface Caption {
  display?: string;
  language: string;
}

// Captions menu component
interface CaptionsMenuProps {
  isOpen: boolean;
  captions: Caption[];
  onCaptionSelect: (index: number | null) => void;
  onClose: () => void;
}

export function CaptionsMenu({
  isOpen,
  captions,
  onCaptionSelect,
  onClose,
}: CaptionsMenuProps) {
  if (!isOpen) return null;

  return (
    <DropdownMenu isOpen={isOpen} className="min-w-32">
      <DropdownItem
        onClick={() => {
          onCaptionSelect(null);
          onClose();
        }}
      >
        Off
      </DropdownItem>
      {captions.map((caption, index) => (
        <DropdownItem
          key={index}
          onClick={() => {
            onCaptionSelect(index);
            onClose();
          }}
        >
          {caption.display || caption.language}
        </DropdownItem>
      ))}
    </DropdownMenu>
  );
}
