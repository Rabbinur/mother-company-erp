"use client";

import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps {
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

/**
 * Reusable SearchInput Component (Single Responsibility: Filter text input with debounce)
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value: initialValue = "",
  onChange,
  placeholder = "Search records...",
  debounceMs = 300,
  className = "",
}) => {
  const [innerVal, setInnerVal] = useState(initialValue);

  useEffect(() => {
    setInnerVal(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (innerVal !== initialValue) {
        onChange(innerVal);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [innerVal, debounceMs, onChange, initialValue]);

  const handleClear = () => {
    setInnerVal("");
    onChange("");
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={innerVal}
        onChange={(e) => setInnerVal(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-slate-50/75 py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-hidden transition-all shadow-2xs"
      />
      {innerVal && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 rounded-full p-0.5"
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
