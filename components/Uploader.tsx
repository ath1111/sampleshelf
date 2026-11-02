"use client";

import { useEffect, useState, type DragEvent } from "react";
import { ALLOWED_TYPES, MAX_SIZE_BYTES } from "@/lib/upload-rules";

type Status = "queued" | "preparing" | "uploading" | "finishing" | "done" | "error";

type UploadItem = {
  key: string;
  name: string;
  status: Status;
  progress: number;
  message: string | null;
};

const MAX_PARALLEL = 3;

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (status ${xhr.status}).`));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Upload failed. Check your connection and try again."));

    xhr.send(file);
  });
}

// Quick browser-side checks; the server checks again.
function validate(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!file.name.includes(".") || !(ext in ALLOWED_TYPES)) {
    return "Unsupported file type. Please upload a WAV, AIFF or FLAC file.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File is too large. The maximum size is 100 MB.";
  }
  return null;
}

// The full flow for one file: get URL -> upload -> mark complete
async function uploadOne(
  file: File,
  update: (changes: Partial<UploadItem>) => void
) {
  update({ status: "preparing" });
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, size: file.size }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Could not start the upload.");
  }

  update({ status: "uploading" });
  await uploadWithProgress(data.uploadUrl, file, data.contentType, (progress) =>
    update({ progress })
  );

  update({ status: "finishing", progress: 100 });
  const completeRes = await fetch(`/api/uploads/${data.sampleId}/complete`, {
    method: "POST",
  });
  if (!completeRes.ok) {
    const completeData = await completeRes.json().catch(() => ({}));
    throw new Error(completeData.error ?? "Could not finish the upload.");
  }

  update({ status: "done", message: null });
}

function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case "queued":
      return "Waiting…";
    case "preparing":
      return "Preparing…";
    case "uploading":
      return `${item.progress}%`;
    case "finishing":
      return "Finishing…";
    case "done":
      return "Done";
    case "error":
      return "Failed";
  }
}

export function Uploader() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);

  // Stop the browser from opening a file dropped outside the drop zone
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  function updateItem(key: string, changes: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...changes } : item))
    );
  }

  async function handleFiles(fileList: FileList) {
    const entries = Array.from(fileList).map((file) => {
      const error = validate(file);
      const item: UploadItem = {
        key: crypto.randomUUID(),
        name: file.name,
        status: error ? "error" : "queued",
        progress: 0,
        message: error,
      };
      return { file, item };
    });
    if (entries.length === 0) return;

    // Newest uploads at the top
    setItems((prev) => [...entries.map((e) => e.item), ...prev]);

    // Upload valid files, at most MAX_PARALLEL at a time
    const queue = entries.filter((e) => e.item.status === "queued");

    async function worker() {
      while (queue.length > 0) {
        const entry = queue.shift()!;
        try {
          await uploadOne(entry.file, (changes) =>
            updateItem(entry.item.key, changes)
          );
        } catch (err) {
          updateItem(entry.item.key, {
            status: "error",
            message: err instanceof Error ? err.message : "Something went wrong.",
          });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, worker)
    );
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const hasFinished = items.some(
    (item) => item.status === "done" || item.status === "error"
  );

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDragging(false);
          }
        }}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragging
            ? "border-gray-800 bg-gray-100"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className="font-medium">Drag and drop audio files here</span>
        <span className="mt-1 text-sm text-gray-500">
          or click to choose · WAV, AIFF or FLAC · up to 100 MB each
        </span>
        <input
          type="file"
          multiple
          accept=".wav,.aif,.aiff,.flac"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.key} className="space-y-2 rounded border p-3">
              <div className="flex justify-between gap-4 text-sm">
                <span className="truncate">{item.name}</span>
                <span
                  className={
                    item.status === "error"
                      ? "text-red-600"
                      : item.status === "done"
                        ? "text-green-700"
                        : "text-gray-600"
                  }
                >
                  {statusLabel(item)}
                </span>
              </div>

              {["uploading", "finishing", "done"].includes(item.status) && (
                <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
                  <div
                    className={`h-full transition-all ${
                      item.status === "done" ? "bg-green-600" : "bg-gray-800"
                    }`}
                    style={{
                      width: `${item.status === "uploading" ? item.progress : 100}%`,
                    }}
                  />
                </div>
              )}

              {item.message && (
                <p className="text-sm text-red-600">{item.message}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasFinished && (
        <button
          type="button"
          onClick={() =>
            setItems((prev) =>
              prev.filter((item) => item.status !== "done" && item.status !== "error")
            )
          }
          className="text-sm text-gray-600 hover:underline"
        >
          Clear finished
        </button>
      )}
    </div>
  );
}