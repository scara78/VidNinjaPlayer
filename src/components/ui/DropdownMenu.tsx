"use client";

import React from "react";
import { cn } from "@/lib/utils";

// Base dropdown menu component
interface DropdownMenuProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DropdownMenu({
  isOpen,
  children,
  className,
}: DropdownMenuProps) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute bottom-full right-0 mb-2 bg-black/95 rounded-xl py-2 shadow-2xl border border-white/10",
        "animate-in slide-in-from-bottom-2 fade-in-0 duration-300",
        "backdrop-blur-xl glass-morphism",
        className
      )}
      style={{
        animation: "fadeInUp 0.3s ease-out forwards",
      }}
    >
      {children}
    </div>
  );
}

// Dropdown menu item
interface DropdownItemProps {
  onClick: () => void;
  isSelected?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}

export function DropdownItem({
  onClick,
  isSelected,
  children,
  disabled,
}: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "block w-full px-4 py-2 text-left hover:bg-white/20 transition-colors",
        isSelected && "bg-blue-600/50 text-blue-100",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

// Dropdown section header
interface DropdownHeaderProps {
  children: React.ReactNode;
}

export function DropdownHeader({ children }: DropdownHeaderProps) {
  return (
    <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-700">
      {children}
    </div>
  );
}

// Selection indicator dot
interface SelectionDotProps {
  isSelected: boolean;
}

export function SelectionDot({ isSelected }: SelectionDotProps) {
  if (!isSelected) return null;

  return <div className="w-2 h-2 bg-blue-400 rounded-lg"></div>;
}

// Item with selection indicator
interface SelectableItemProps {
  onClick: () => void;
  isSelected?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}

export function SelectableItem({
  onClick,
  isSelected,
  children,
  disabled,
}: SelectableItemProps) {
  return (
    <DropdownItem onClick={onClick} isSelected={isSelected} disabled={disabled}>
      <div className="flex items-center justify-between">
        <span>{children}</span>
        <SelectionDot isSelected={!!isSelected} />
      </div>
    </DropdownItem>
  );
}
