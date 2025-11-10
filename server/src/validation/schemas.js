import { z } from "zod";


export const signupSchema = z.object({
email: z.string().email(),
password: z.string().min(8, "Password must be at least 8 chars")
});


export const loginSchema = z.object({
email: z.string().email(),
password: z.string().min(1)
});


export const haveCreateSchema = z.object({
name: z.string().min(1),
qty: z.number().int().min(1).default(1),
notes: z.string().optional()
});


export const haveUpdateSchema = z.object({
name: z.string().min(1).optional(),
qty: z.number().int().min(1).optional(),
notes: z.string().nullable().optional()
});