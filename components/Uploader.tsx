"use client";

import { useState } from "react";
import { ALLOWED_TYPES, MAX_SIZE_BYTES } from "@/lib/upload-rules";

type Status = "idle" | "preparing" | "uploading" | "done" | "error";

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

export function Uploader() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setProgress(0);
    setMessage(null);

    // Quick checks in the browser for instant feedback.
    // The server checks again, since browser checks can be bypassed.
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!file.name.includes(".") || !(ext in ALLOWED_TYPES)) {
      setStatus("error");
      setMessage("Unsupported file type. Please upload a WAV, AIFF or FLAC file.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setStatus("error");
      setMessage("File is too large. The maximum size is 100 MB.");
      return;
    }

    try {
      // 1. Ask our server for a presigned upload URL
      setStatus("preparing");
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not start the upload.");
      }

      // 2. Upload the file straight to storage
      setStatus("uploading");
      await uploadWithProgress(data.uploadUrl, file, data.contentType, setProgress);

      // 3. (Step 5) Tell our server the upload is finished

      setStatus("done");
      setMessage("Upload complete.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const busy = status === "preparing" || status === "uploading";

  return (
    <div className="space-y-4 rounded-lg border p-6">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Upload a sample</span>
        <input
          type="file"
          accept=".wav,.aif,.aiff,.flac"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          className="block text-sm file:mr-4 file:rounded file:border-0 file:bg-gray-800 file:px-4 file:py-2 file:text-white hover:file:bg-gray-700 disabled:opacity-50"
        />
      </label>

      {status !== "idle" && (
        <div className="space-y-2">
          <div className="flex justify-between gap-4 text-sm">
            <span className="truncate">{fileName}</span>
            <span>
              {status === "preparing" && "Preparing…"}
              {status === "uploading" && `${progress}%`}
            </span>
          </div>

          {(status === "uploading" || status === "done") && (
            <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
              <div
                className="h-full bg-gray-800 transition-all"
                style={{ width: `${status === "done" ? 100 : progress}%` }}
              />
            </div>
          )}

          {message && (
            <p
              className={
                status === "error" ? "text-sm text-red-600" : "text-sm text-green-700"
              }
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}