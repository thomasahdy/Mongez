export function extractTextFromPayload(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload?.response === "string") return payload.response;
  if (typeof payload?.report === "string") return payload.report;
  if (typeof payload?.summary === "string") return payload.summary;
  if (typeof payload?.message === "string") return payload.message;
  if (typeof payload?.text === "string") return payload.text;
  if (typeof payload?.data?.response === "string") return payload.data.response;
  if (typeof payload?.data?.report === "string") return payload.data.report;
  if (typeof payload?.data?.summary === "string") return payload.data.summary;

  return "";
}
