"use client";

import React, { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
  children: ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  helperText,
  className = "",
  children,
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      </div>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-red-600 animate-fade-in">{error}</p>
      ) : helperText ? (
        <p className="text-[10px] text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-hidden disabled:opacity-50 ${
          error
            ? "border-red-300 focus:border-red-500 ring-red-500/10"
            : "border-slate-200 focus:border-sky-500 focus:ring-sky-500/10"
        } ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options?: { value: string | number; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error, options, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs text-slate-900 transition-colors focus:bg-white focus:outline-hidden disabled:opacity-50 ${
          error
            ? "border-red-300 focus:border-red-500"
            : "border-slate-200 focus:border-sky-500"
        } ${className}`}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    );
  }
);
Select.displayName = "Select";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:outline-hidden disabled:opacity-50 ${
          error
            ? "border-red-300 focus:border-red-500"
            : "border-slate-200 focus:border-sky-500"
        } ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
