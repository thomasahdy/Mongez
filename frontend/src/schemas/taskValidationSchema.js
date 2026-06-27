import { z } from 'zod';

export const createTaskValidationSchema = z.object({
  title: z.string()
    .min(1, { message: 'Title is required' })
    .max(500, { message: 'Title cannot exceed 500 characters' }),

  boardId: z.string(),
  columnId: z.string(),
  spaceId: z.string(),
  spacePrefix: z.string(),
  description: z.string().optional(),

  // Changed to a pure string with a default fallback value
  status: z.string(),

  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  type: z.enum(['Bug', 'Feature', 'Task', 'Milestone']).optional(),
  
  startDate: z.string().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
  estimatedHours: z.number().int().min(0).optional(),
  parentId: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  assigneeIds: z.array(z.string()).optional().default([])
});