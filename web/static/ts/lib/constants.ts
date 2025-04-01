export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
  ],
  iceTransportPolicy: "all",
};

/**
 * Standard WebRTC message size
 */
export const MAX_CHUNK_SIZE = 512 * 1024; // 512KB

export enum PeerState {
  IDLE,
  OFFER_CREATED,
  OFFER_SET,
  OFFER_ACCEPTED,
  ANSWER_CREATED,
  ANSWER_SET,
  CONNECTING,
  CONNECTED,
  RECEIVING,
  SENDING,
  CANCEL,
}

export enum PeerEvent {
  OFFER_CREATED = "offerCreated",
  OFFER_ACCEPTED = "offerAccepted",
  ANSWER_CREATED = "answerCreated",
  PEER_CONNECTED = "peerConnected",
  INIT_TRANSFER = "initTransfer",
  CONNECTION_STATUS_CHANGED = "connectionStatusChanged",
  FILE_UPDATE = "fileUpdate",
  TRANSFER_INITIATED = "transferInitiated",
  PEER_STATUS_CHANGED = "peerStatusChanged",
  CANCEL_TRANSFER = "cancelTransfer",
}

export enum SignalingEvent {
  CONNECTED = "connected",
  CLOSE = "close",
  PROMPT_PIN = "prompt_pin",
  PIN_RECEIVED = "pin_received",
  OFFER_FETCHED = "offerFetched",
  REQUEST_ANSWER_WITH_PIN = "request_answer_with_pin",
}

export enum FileStatus {
  PROCESSING = "Waiting to transfer",
  TRANSFERRING = "Transferring",
  DONE = "Ready to download",
  SENT = "Sent",
  FAILED = "Failed",
  CANCEL = "Cancelled by peer",
}

export enum SignalingState {
  IDLE,
  OFFER_SENT,
  WAITING_FOR_CONNECTION,
  WAITING_FOR_ANSWER,
  GATHERING,
  ANSWER_SENT,
}

export enum PeerMessageType {
  INIT = 0,
  PAYLOAD = 1,
  DONE = 2,
  CANCEL = 3,
  OK = 200,
  ERROR = 400,
}
