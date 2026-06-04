export interface BaseEvent {
  eventId: string;
  correlationId: string;
  occurredAt: Date;
  spaceId: string;
}

export interface TaskAssignedEvent extends BaseEvent {
  taskId: string;
  assigneeId: string;
  assignerId: string;
}

export interface TaskCreatedEvent extends BaseEvent {
  taskId: string;
  creatorId: string;
  boardId: string;
}

export interface TaskCommentedEvent extends BaseEvent {
  taskId: string;
  commentId: string;
  authorId: string;
}

// Add more event interfaces as needed for typing Outbox payloads
