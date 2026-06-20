import { BoardType } from '@prisma/client';

export interface TemplateStep {
  name: string;
  order: number;
  approverType: 'USER' | 'ROLE' | 'MANAGER_OF_REQUESTER';
  approverRole?: string;
  isParallel: boolean;
  requiresAll: boolean;
  timeoutHours?: number;
}

export interface TemplateWorkflow {
  name: string;
  triggerType: 'MANUAL' | 'AI_PROPOSED' | 'SCHEDULED';
  entityType: 'TASK' | 'BUDGET' | 'AI_ACTION' | 'CUSTOM';
  steps: TemplateStep[];
}

export interface TemplateBoard {
  name: string;
  type: BoardType;
  description: string;
  columns: {
    name: string;
    color: string;
    position: number;
  }[];
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  departments: {
    name: string;
    description: string;
    color: string;
    boards: TemplateBoard[];
  }[];
  workflows: TemplateWorkflow[];
}

export const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    id: 'software-dev',
    name: 'Software Development',
    description: 'Scrum sprint execution, bug tracking, and code-review approval chains.',
    departments: [
      {
        name: 'Engineering',
        description: 'Core product engineering and QA',
        color: '#2563EB',
        boards: [
          {
            name: 'Sprint Board',
            type: BoardType.KANBAN,
            description: 'Active sprint task execution',
            columns: [
              { name: 'Backlog', color: '#9CA3AF', position: 0 },
              { name: 'To Do', color: '#3B82F6', position: 1 },
              { name: 'In Progress', color: '#F59E0B', position: 2 },
              { name: 'Code Review', color: '#8B5CF6', position: 3 },
              { name: 'QA Testing', color: '#EC4899', position: 4 },
              { name: 'Done', color: '#10B981', position: 5 },
            ],
          },
          {
            name: 'Bug Tracker',
            type: BoardType.KANBAN,
            description: 'Defect logging and resolution pipeline',
            columns: [
              { name: 'Reported', color: '#EF4444', position: 0 },
              { name: 'Triaged', color: '#F59E0B', position: 1 },
              { name: 'Fixing', color: '#3B82F6', position: 2 },
              { name: 'Verifying', color: '#8B5CF6', position: 3 },
              { name: 'Resolved', color: '#10B981', position: 4 },
            ],
          },
        ],
      },
    ],
    workflows: [
      {
        name: 'Code Review & QA Approval',
        triggerType: 'MANUAL',
        entityType: 'TASK',
        steps: [
          {
            name: 'Peer Review',
            order: 0,
            approverType: 'ROLE',
            approverRole: 'SENIOR_ENGINEER',
            isParallel: true,
            requiresAll: false,
          },
          {
            name: 'QA Testing Verification',
            order: 1,
            approverType: 'ROLE',
            approverRole: 'QA_LEAD',
            isParallel: false,
            requiresAll: true,
            timeoutHours: 48,
          },
        ],
      },
    ],
  },
  {
    id: 'ngo-ops',
    name: 'NGO Operations',
    description: 'Grant management, proposal writing, and multi-step budget approvals.',
    departments: [
      {
        name: 'Programs',
        description: 'Field program coordination and grant tracking',
        color: '#059669',
        boards: [
          {
            name: 'Grant Proposals',
            type: BoardType.KANBAN,
            description: 'Proposal preparation and donor review stages',
            columns: [
              { name: 'Brainstorm', color: '#9CA3AF', position: 0 },
              { name: 'Drafting', color: '#3B82F6', position: 1 },
              { name: 'Internal Review', color: '#F59E0B', position: 2 },
              { name: 'Submitted to Donor', color: '#8B5CF6', position: 3 },
              { name: 'Awarded', color: '#10B981', position: 4 },
              { name: 'Rejected', color: '#EF4444', position: 5 },
            ],
          },
        ],
      },
    ],
    workflows: [
      {
        name: 'Proposal Budget Approval',
        triggerType: 'MANUAL',
        entityType: 'BUDGET',
        steps: [
          {
            name: 'Program Director Sign-off',
            order: 0,
            approverType: 'ROLE',
            approverRole: 'PROGRAM_DIRECTOR',
            isParallel: false,
            requiresAll: true,
          },
          {
            name: 'Finance Review',
            order: 1,
            approverType: 'ROLE',
            approverRole: 'FINANCE_HEAD',
            isParallel: false,
            requiresAll: true,
            timeoutHours: 24,
          },
        ],
      },
    ],
  },
  {
    id: 'marketing-agency',
    name: 'Marketing Agency',
    description: 'Content calendar boards, social media campaign pipelines, and artwork approvals.',
    departments: [
      {
        name: 'Creative & Media',
        description: 'Design, video, and social copy execution',
        color: '#DC2626',
        boards: [
          {
            name: 'Content Calendar',
            type: BoardType.KANBAN,
            description: 'Editorial pipeline',
            columns: [
              { name: 'Content Ideas', color: '#9CA3AF', position: 0 },
              { name: 'Copywriting', color: '#3B82F6', position: 1 },
              { name: 'Design/Media', color: '#F59E0B', position: 2 },
              { name: 'Client Review', color: '#8B5CF6', position: 3 },
              { name: 'Approved & Scheduled', color: '#10B981', position: 4 },
              { name: 'Published', color: '#059669', position: 5 },
            ],
          },
        ],
      },
    ],
    workflows: [
      {
        name: 'Creative Asset Approval',
        triggerType: 'MANUAL',
        entityType: 'CUSTOM',
        steps: [
          {
            name: 'Creative Director Review',
            order: 0,
            approverType: 'ROLE',
            approverRole: 'CREATIVE_DIRECTOR',
            isParallel: false,
            requiresAll: true,
            timeoutHours: 12,
          },
        ],
      },
    ],
  },
];
