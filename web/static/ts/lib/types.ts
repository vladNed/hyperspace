export interface SessionResponse<T> {
  type: "ok" | "error";
  payload: T;
}

export interface Response {
  message: string;
}

export interface OfferDataResponse {
  offerSDP: string;
}

export interface AnswerDataResponse {
  answerSDP: string;
  sessionId: string;
  timestamp: string;
}

export interface FileMetadata {
  totalSize: number;
  name: string;
  fileType: string;
  hash: string;
}

export enum PeerMessageType {
  INIT = 0,
  PAYLOAD = 1,
  DONE = 2,
  OK = 200,
  ERROR = 400,
}

export interface FilePayload {
  data: Blob;
  hash: string;
}

export interface FileError {
  msg: string;
}

export interface PeerMessage {
  type: PeerMessageType;
  body: FileMetadata | FilePayload | FileError | null;
}

export interface TransferSession {
  metadata: FileMetadata;
  file: File | null;
  dataSent: number;
  totalData: number;
  chunks?: Blob[];
}
