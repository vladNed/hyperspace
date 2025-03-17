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
