import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

export type FilePickerType = "image" | "document" | "audio";

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  file?: File;
}

const MIME_MAP: Record<FilePickerType, string> = {
  image: "image/*",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
  audio: "audio/*",
};

/**
 * Opens a native (Android/iOS) or web file picker for images, documents, or audio.
 */
export async function pickFile(type: FilePickerType): Promise<PickedFile | null> {
  // ── Web File Picker ───────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    return new Promise((resolve) => {
      if (typeof document === "undefined") {
        resolve(null);
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = MIME_MAP[type];
      input.style.display = "none";

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          const uri = URL.createObjectURL(file);
          document.body.removeChild(input);
          resolve({
            uri,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            file,
          });
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
    });
  }

  // ── Native Android & iOS Pickers ──────────────────────────────────────────
  try {
    if (type === "image") {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const extension = asset.mimeType?.split("/")[1] || "jpg";
      const name = asset.fileName || `image_${Date.now()}.${extension}`;

      return {
        uri: asset.uri,
        name,
        type: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      };
    }

    // Document or Audio
    const mimeType = type === "audio" ? "audio/*" : "*/*";
    const result = await DocumentPicker.getDocumentAsync({
      type: mimeType,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || (type === "audio" ? "audio/mpeg" : "application/octet-stream"),
      size: asset.size,
    };
  } catch (err) {
    console.warn("[pickFile] Native picker error:", err);
    return null;
  }
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
