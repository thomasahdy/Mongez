export class WorkflowInitiatedEvent {
  constructor(public readonly instance: any) {}
}

export class WorkflowTimeoutEvent {
  constructor(
    public readonly instanceId: string,
    public readonly stepOrder: number,
    public readonly spaceId: string,
    public readonly requesterId: string,
    public readonly title: string,
  ) {}
}

export class WorkflowResolvedEvent {
  constructor(
    public readonly instance: any,
    public readonly outcome: 'APPROVED' | 'REJECTED',
  ) {}
}

