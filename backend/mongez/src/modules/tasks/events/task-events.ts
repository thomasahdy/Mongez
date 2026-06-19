export class TaskCreatedEvent {
  constructor(public readonly task: any) {}
}

export class TaskUpdatedEvent {
  constructor(
    public readonly id: string,
    public readonly changes: any,
    public readonly boardId: string,
    public readonly userId: string,
  ) {}
}

export class TaskMovedEvent {
  constructor(
    public readonly id: string,
    public readonly columnId: string,
    public readonly position: number,
    public readonly boardId: string,
    public readonly userId: string,
  ) {}
}

export class TaskArchivedEvent {
  constructor(
    public readonly id: string,
    public readonly boardId: string,
    public readonly userId: string,
  ) {}
}

export class CommentAddedEvent {
  constructor(
    public readonly comment: any,
    public readonly spaceId: string,
  ) {}
}
