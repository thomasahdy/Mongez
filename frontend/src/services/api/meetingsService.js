import apiClient from "./apiClient";

export const listMeetings = async (spaceId) => {
  const response = await apiClient.get("/meetings", { params: { spaceId } });
  return response.data;
};

export const getMeeting = async (id, spaceId) => {
  const response = await apiClient.get(`/meetings/${id}`, { params: { spaceId } });
  return response.data;
};

export const getTranscript = async (id, spaceId) => {
  const response = await apiClient.get(`/meetings/${id}/transcript`, { params: { spaceId } });
  return response.data;
};

export const uploadMeeting = async (spaceId, title, file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  const response = await apiClient.post("/meetings/upload", formData, {
    params: { spaceId },
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const approveProposedTask = async (id, spaceId, boardId, columnId) => {
  const response = await apiClient.post(`/meetings/proposed-tasks/${id}/approve`, { boardId, columnId }, { params: { spaceId } });
  return response.data;
};

export const rejectProposedTask = async (id, spaceId) => {
  const response = await apiClient.post(`/meetings/proposed-tasks/${id}/reject`, null, { params: { spaceId } });
  return response.data;
};

const meetingsService = {
  listMeetings,
  getMeeting,
  getTranscript,
  uploadMeeting,
  approveProposedTask,
  rejectProposedTask,
};

export default meetingsService;
