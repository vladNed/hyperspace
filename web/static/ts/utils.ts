export function encodeSDP(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp));
}

export function decodeSDP(sdp: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(sdp));
}
