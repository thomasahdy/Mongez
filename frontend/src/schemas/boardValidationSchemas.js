import { z } from 'zod';


export const createColumnSchema = z.object({
  name: z.string()
    .min(1)
    .max(50),

  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex code' })
    .optional(),

  wipLimit: z.number()
    .int()
    .min(0)
    .optional(), // 0 = no limit

  position: z.number()
    .int()
    .min(0)
    .optional()
});