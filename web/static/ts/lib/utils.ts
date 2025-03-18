import type { FileMetadata } from "./types.js";

export function encodeSDP(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp));
}

export function decodeSDP(sdp: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(sdp));
}

export async function preProcessFile(file: File): Promise<FileMetadata> {
  const totalData = file.size;
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fileHash = btoa(String.fromCharCode(...hashArray));

  const metadata: FileMetadata = {
    totalSize: totalData,
    name: file.name,
    fileType: file.type,
    hash: fileHash,
  };

  return metadata;
}
