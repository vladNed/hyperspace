export interface SessionResponse<T> {
  type: "ok" | "error";
  payload: T;
}

export interface Response {
  message: string;
}
