import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SpaceRepository } from '../spaces/repositories/spaces.repositories';
import { IdentifierService } from '../../shared/services/identifier.service';
import { ONBOARDING_TEMPLATES } from './onboarding-templates.constants';
import { CreateSpaceDto } from '../spaces/dto/create-space.dto';
import { TaskStatus, Priority } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceRepo: SpaceRepository,
    private readonly identifierService: IdentifierService,
  ) {}

  async setupSpaceFromTemplate(
    userId: string,
    spaceDto: CreateSpaceDto,
    templateId: string,
  ) {
    const template = ONBOARDING_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      throw new NotFoundException(`Onboarding template with ID "${templateId}" not found.`);
    }

    // 1. Create the Space
    const space = await this.spaceRepo.create(spaceDto, userId);
    if (!space) {
      throw new BadRequestException('Failed to create space.');
    }

    // 2. Build departments, boards, columns, and workflows in transaction
    await this.prisma.$transaction(async (tx) => {
      let firstBoardId: string | null = null;
      let firstColumnId: string | null = null;

      // Create departments
      for (const deptSpec of template.departments) {
        const department = await tx.department.create({
          data: {
            name: deptSpec.name,
            description: deptSpec.description,
            color: deptSpec.color,
            spaceId: space.id,
          },
        });

        // Create boards for the department
        for (const boardSpec of deptSpec.boards) {
          const board = await tx.board.create({
            data: {
              name: boardSpec.name,
              type: boardSpec.type,
              description: boardSpec.description,
              departmentId: department.id,
            },
          });

          if (!firstBoardId) {
            firstBoardId = board.id;
          }

          // Create columns for the board
          for (const colSpec of boardSpec.columns) {
            const column = await tx.boardColumn.create({
              data: {
                name: colSpec.name,
                color: colSpec.color,
                position: colSpec.position,
                boardId: board.id,
              },
            });

            if (board.id === firstBoardId && !firstColumnId) {
              firstColumnId = column.id;
            }
          }
        }
      }

      // Create workflow definitions and steps
      for (const flowSpec of template.workflows) {
        const definition = await tx.workflowDefinition.create({
          data: {
            name: flowSpec.name,
            triggerType: flowSpec.triggerType,
            spaceId: space.id,
            createdBy: userId,
            isActive: true,
          },
        });

        for (const stepSpec of flowSpec.steps) {
          await tx.workflowStep.create({
            data: {
              definitionId: definition.id,
              order: stepSpec.order,
              name: stepSpec.name,
              approverType: stepSpec.approverType,
              approverRole: stepSpec.approverRole || null,
              isParallel: stepSpec.isParallel,
              requiresAll: stepSpec.requiresAll,
              timeoutHours: stepSpec.timeoutHours || null,
            },
          });
        }
      }

      // Create Onboarding Welcome Tasks in the first board/column
      if (firstBoardId && firstColumnId) {
        const onboardingTasks = [
          {
            title: 'Welcome to Mongez!',
            description: `Hello and welcome to your new space! 🚀\n\nMongez is a multi-tenant project management platform powered by AI governance.\n\nHere is how you get started:\n1. Switch between boards in the **Kanban view**.\n2. Invite members to your department.\n3. Try managing tasks, changing due dates, and moving cards.`,
            priority: Priority.HIGH,
          },
          {
            title: 'Explore Preconfigured Approvals',
            description: `We've preconfigured a standard approval workflow for you based on the **${template.name}** template.\n\nGo to the **Workflow** tab to inspect how steps are resolved and review timelines.`,
            priority: Priority.MEDIUM,
          },
          {
            title: 'Try Uploading Meeting Transcripts',
            description: `Go to the **Meetings** page, upload an audio recording or paste a transcript, and watch the AI automatically extract summaries and propose action items for your approval.`,
            priority: Priority.LOW,
          },
        ];

        for (const [index, taskSpec] of onboardingTasks.entries()) {
          const identifier = await this.identifierService.nextIdentifier(space.id, space.prefix);
          await tx.task.create({
            data: {
              identifier,
              title: taskSpec.title,
              description: taskSpec.description,
              status: TaskStatus.TODO,
              priority: taskSpec.priority,
              type: 'Task',
              boardId: firstBoardId,
              columnId: firstColumnId,
              position: index,
              createdById: userId,
            },
          });
        }
      }
    });

    return this.prisma.space.findUnique({
      where: { id: space.id },
      include: {
        departments: {
          include: {
            boards: {
              include: { columns: true },
            },
          },
        },
      },
    });
  }

  async getTemplates() {
    return ONBOARDING_TEMPLATES;
  }
}
