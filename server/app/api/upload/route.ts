import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let fileName = "";
    let mimeType = "application/octet-stream";
    let buffer: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { ok: false, error: { code: "NO_FILE", message: "No file provided" } },
          { status: 400 }
        );
      }

      fileName = file.name || `upload_${Date.now()}`;
      mimeType = file.type || "application/octet-stream";
      buffer = Buffer.from(await file.arrayBuffer());
    } else if (contentType.includes("application/json")) {
      const json = await request.json();
      const { base64, name, type } = json as {
        base64?: string;
        name?: string;
        type?: string;
      };

      if (!base64) {
        return NextResponse.json(
          { ok: false, error: { code: "NO_FILE", message: "base64 data is required" } },
          { status: 400 }
        );
      }

      // Strip data URL prefix if present (e.g. data:image/png;base64,...)
      const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
      buffer = Buffer.from(cleaned, "base64");
      fileName = name || `upload_${Date.now()}`;
      mimeType = type || "application/octet-stream";
    } else {
      return NextResponse.json(
        { ok: false, error: { code: "UNSUPPORTED_TYPE", message: "Unsupported content-type" } },
        { status: 400 }
      );
    }

    // Generate safe unique filename
    const ext = path.extname(fileName) || "";
    const baseNameWithoutExt = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueFileName = `${baseNameWithoutExt}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    const filePath = path.join(uploadsDir, uniqueFileName);

    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${uniqueFileName}`;
    const fileSize = buffer.length;

    return NextResponse.json({
      ok: true,
      data: {
        url: publicUrl,
        fileName: fileName || uniqueFileName,
        fileSize,
        mimeType,
      },
    });
  } catch (error) {
    console.error("[POST /api/upload]", error);
    return NextResponse.json(
      { ok: false, error: { code: "UPLOAD_FAILED", message: "Failed to upload file" } },
      { status: 500 }
    );
  }
}
