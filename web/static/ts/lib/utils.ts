import { CHUNK_SIZE } from "./constants.js";
import type { InitPayload } from "./types.js";

export function encodeSDP(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp));
}

export function decodeSDP(sdp: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(sdp));
}

export async function preProcessFile(file: File): Promise<InitPayload> {
  const totalData = file.size;
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fileHash = btoa(String.fromCharCode(...hashArray));

  let stages = 0;
  for (let i = 0; i < totalData; i += CHUNK_SIZE) {
    stages++;
  }

  const metadata: InitPayload = {
    fileName: file.name,
    fileType: file.type,
    fileSize: totalData,
    hash: fileHash,
    totalChunks: stages,
  };

  return metadata;
}
