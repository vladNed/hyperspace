export const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

/**
 * Standard WebRTC message size
 */
export const CHUNK_SIZE = 64 * 1024;

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
}

export enum SignalingEvent {
  OFFER_FETCHED = "offerFetched",
}

export enum SignalingState {
  IDLE,
  OFFER_SENT,
  WAITING_FOR_ANSWER,
  GATHERING,
  ANSWER_SENT,
}

export enum PeerMessageType {
  INIT = 0,
  PAYLOAD = 1,
  DONE = 2,
  OK = 200,
  ERROR = 400,
}
