import { getBoardTasks } from "./pageApi";

export async function getTasksByBoard(boardId) {
  return getBoardTasks(boardId);
}
