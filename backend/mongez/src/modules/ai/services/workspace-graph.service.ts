import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class WorkspaceGraphService {
  private readonly logger = new Logger(WorkspaceGraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves task dependency connections within a space.
   */
  async getTaskDependencies(spaceId: string) {
    this.logger.log(`Fetching task dependencies for space: ${spaceId}`);
    return this.prisma.taskDependency.findMany({
      where: {
        task: {
          board: {
            department: {
              spaceId,
            },
          },
        },
      },
      select: {
        id: true,
        taskId: true,
        dependsOnId: true,
        type: true,
        task: {
          select: {
            identifier: true,
            title: true,
            status: true,
          },
        },
        dependsOn: {
          select: {
            identifier: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Computes the chain of blocked tasks in the space.
   * Traverses BLOCKS relationships recursively to output blocked nodes.
   */
  async getBlockerChain(spaceId: string) {
    this.logger.log(`Computing blocker chains for space: ${spaceId}`);
    const dependencies = await this.prisma.taskDependency.findMany({
      where: {
        type: 'BLOCKS',
        task: {
          board: {
            department: {
              spaceId,
            },
          },
        },
      },
      select: {
        taskId: true,
        dependsOnId: true,
        task: { select: { id: true, identifier: true, title: true, status: true } },
        dependsOn: { select: { id: true, identifier: true, title: true, status: true } },
      },
    });

    // Build adjacency list representation (Prerequisite -> Blocked tasks)
    const adj = new Map<string, any[]>();
    const blockedTasks = new Set<string>();

    for (const dep of dependencies) {
      const parent = dep.dependsOn;
      const child = dep.task;

      blockedTasks.add(child.id);

      let list = adj.get(parent.id);
      if (!list) {
        list = [];
        adj.set(parent.id, list);
      }
      list.push({
        id: child.id,
        identifier: child.identifier,
        title: child.title,
        status: child.status,
      });
    }

    // Identify root blockers (tasks that are blocking others but not blocked themselves)
    const blockerChains: any[] = [];
    const MAX_DEPTH = 10;

    const traverse = (nodeId: string, path: any[], pathVisited: Set<string>, depth: number) => {
      if (depth > MAX_DEPTH) {
        this.logger.warn(`Max depth (${MAX_DEPTH}) reached in blocker chain traversal.`);
        return;
      }
      if (pathVisited.has(nodeId)) {
        // Cycle detected
        this.logger.warn(`Cycle detected in blocker chains at task: ${nodeId}`);
        return;
      }

      const children = adj.get(nodeId) || [];
      
      if (children.length === 0) {
        if (path.length > 1) {
          blockerChains.push([...path]);
        }
        return;
      }

      // Add to pathVisited for children recursion
      pathVisited.add(nodeId);

      for (const child of children) {
        traverse(child.id, [...path, child], new Set(pathVisited), depth + 1);
      }
    };

    // Find all tasks that block something
    const allBlockers = Array.from(adj.keys());
    for (const blockerId of allBlockers) {
      if (!blockedTasks.has(blockerId)) {
        const rootTask = dependencies.find(d => d.dependsOnId === blockerId)?.dependsOn;
        if (rootTask) {
          traverse(blockerId, [rootTask], new Set<string>(), 0);
        }
      }
    }

    return blockerChains;
  }

  /**
   * Retrieves active workflow instances and approval stages in the space.
   */
  async getWorkflowGraph(spaceId: string) {
    this.logger.log(`Fetching workflow instances for space: ${spaceId}`);
    
    const instances = await this.prisma.workflowInstance.findMany({
      where: { spaceId, deletedAt: null },
      include: {
        definition: { select: { name: true, triggerType: true } },
        requester: { select: { id: true, name: true, email: true } },
        actions: {
          select: {
            id: true,
            stepOrder: true,
            actorId: true,
            decision: true,
            note: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const approvals = await this.prisma.approval.findMany({
      where: {
        task: {
          board: {
            department: {
              spaceId,
            },
          },
        },
      },
      include: {
        task: { select: { id: true, identifier: true, title: true, status: true } },
        requester: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });

    return {
      workflowInstances: instances,
      taskApprovals: approvals,
    };
  }

  /**
   * Retrieves organizational hierarchy (departments and memberships) for the space.
   */
  async getOrgGraph(spaceId: string) {
    this.logger.log(`Fetching organizational hierarchy for space: ${spaceId}`);
    
    const departments = await this.prisma.department.findMany({
      where: { spaceId },
      include: {
        boards: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    const memberships = await this.prisma.membership.findMany({
      where: { spaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        role: true,
      },
    });

    return {
      departments,
      members: memberships.map(m => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        status: m.user.status,
      })),
    };
  }

  /**
   * Searches decisions recorded inside a workspace space.
   */
  async getDecisions(spaceId: string) {
    this.logger.log(`Fetching decisions for space: ${spaceId}`);
    return this.prisma.decisionRecord.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
