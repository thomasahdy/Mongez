import { z } from 'zod';

/**
 * Validation Schema: createSpaceSchema
 * Enforces validation rules for workspace space creation.
 * 
 * Rules:
 * - name: Required, 1-100 characters.
 * - description: Optional, up to 500 characters.
 * - prefix: Optional, 2-5 characters, alphanumeric only, automatically transformed to uppercase.
 * - icon: Optional string (e.g. FontAwesome class name).
 * - color: Optional hex/tailwind color code.
 */
export const createSpaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Workspace name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .or(z.literal('')),
  prefix: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (val.length >= 2 && val.length <= 5 && /^[a-zA-Z0-9]+$/.test(val)),
      {
        message: 'Prefix must be between 2 and 5 alphanumeric characters',
      }
    )
    .transform((val) => {
      const clean = val?.trim().toUpperCase();
      return clean || undefined;
    }),
  icon: z.string().optional().or(z.literal('')).transform((val) => val?.trim() || undefined),
  color: z.string().optional().or(z.literal('')).transform((val) => val?.trim() || undefined),
});

/**
 * Validation Schema: updateSpaceSchema
 * Allows partial updates for workspaces (all fields optional).
 */
export const updateSpaceSchema = createSpaceSchema.partial();

/**
 * Validation Schema: inviteMemberSchema
 * Enforces email validation and role constraints for inviting users to a workspace.
 * 
 * Rules:
 * - email: Must be a valid email string.
 * - role: Must be one of the supported workspace roles: ADMIN, MEMBER, VIEWER.
 */
export const inviteMemberSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .trim(),
  role: z
    .enum(['ADMIN', 'MEMBER', 'VIEWER'], {
      errorMap: () => ({ message: 'Please select a valid role (ADMIN, MEMBER, or VIEWER)' }),
    })
    .default('MEMBER'),
});

/**
 * Validation Schema: updateMemberRoleSchema
 * Validates the role update body.
 */
export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'], {
    errorMap: () => ({ message: 'Please select a valid role (OWNER, ADMIN, MEMBER, or VIEWER)' }),
  }),
});
export const createDepartmentSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Department name must be at least 2 characters long' })
    .max(50, { message: 'Department name cannot exceed 50 characters' })
    .trim(),

  description: z
    .string()
    .max(200, { message: 'Description cannot exceed 200 characters' })
    .optional()
    .or(z.literal('')), // Allows an empty string if optional

  color: z
    .string()
    .min(2, { message: 'Department color must be at least 2 characters' })
    .max(10, { message: 'Color must be 10 characters or less' })
    .toUpperCase()
    .trim()
});


export const createBoardSchema = z.object({
  name: z.string({
    required_error: "Board name is required.",
  }).min(1, "Board name cannot be empty."),

  departmentId: z.string({
    required_error: "Department ID is required.",
  }).min(1, "Department ID cannot be empty."),

  type: z.string({
    required_error: "Board type is required.",
  }).min(1, "Board type cannot be empty."),

  description: z.string().optional(),
});
