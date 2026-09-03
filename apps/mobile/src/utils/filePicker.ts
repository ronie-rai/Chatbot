import { Platform } from "react-native";

export type FilePickerType = "image" | "document" | "audio";

const MIME_MAP: Record<FilePickerType, string> = {
  image: "image/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
  audio: "audio/*",
};

/**
 * Opens a native/web file picker for images, documents, or audio.
 */
export function pickFile(type: FilePickerType): Promise<File | null> {
  return new Promise((resolve) => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = MIME_MAP[type];
      input.style.display = "none";

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          document.body.removeChild(input);
          resolve(file);
        } else {
          document.body.removeChild(input);
          resolve(null);
        }
      };

      input.oncancel = () => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
        resolve(null);
      };

      document.body.appendChild(input);
      input.click();
    } else {
      resolve(null);
    }
  });
}

/**
 * Format bytes to readable string (e.g. 1.2 MB, 350 KB)
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format audio seconds to mm:ss format (e.g. 0:05, 1:24)
 */
export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
