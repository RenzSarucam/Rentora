"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileText, ImagePlus, X } from "lucide-react";
import { prepareUpload } from "./image";

/** Picks a file, shrinks large photos, previews it, and hands the prepared File to the parent. */
export function FilePicker({
  label,
  accept,
  required,
  error,
  onChange,
}: {
  label: string;
  accept: string;
  required?: boolean;
  error?: string;
  onChange: (file: File | null) => void;
}) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewRef = useRef<string | null>(null);
  function showPreview(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next && next.type.startsWith("image/") ? URL.createObjectURL(next) : null;
    setPreview(previewRef.current);
  }
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  async function choose(selected: File | undefined) {
    setLocalError(null);
    showPreview(null);
    if (!selected) return;
    setBusy(true);
    const result = await prepareUpload(selected);
    setBusy(false);
    if ("error" in result) {
      setLocalError(result.error);
      setFile(null);
      onChange(null);
      return;
    }
    setFile(result.file);
    showPreview(result.file);
    onChange(result.file);
  }

  function clear() {
    setFile(null);
    showPreview(null);
    onChange(null);
  }

  const message = localError ?? error;
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium" id={`${id}-label`}>
        {label}
        {!required && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </span>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-border p-2.5">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="Selected file preview" className="size-16 rounded-lg object-cover" />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-lg bg-raised text-muted-foreground">
              <FileText className="size-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="num text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <button type="button" onClick={clear} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-raised" aria-label="Remove file">
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-control px-4 py-5 text-center text-sm text-muted-foreground active:bg-raised"
        >
          <ImagePlus className="size-6" aria-hidden />
          <span className="font-medium text-foreground">{busy ? "Preparing…" : "Choose a photo or file"}</span>
          <span className="text-xs">{accept.includes("pdf") ? "JPG, PNG, WEBP or PDF · up to 4 MB" : "JPG, PNG or WEBP · up to 4 MB"}</span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        aria-labelledby={`${id}-label`}
        aria-describedby={message ? `${id}-error` : undefined}
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {message && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-negative">
          {message}
        </p>
      )}
    </div>
  );
}
