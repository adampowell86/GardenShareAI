import { z } from "zod";

function optionalNumber(schema) {
  return z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  }, schema.nullable().optional());
}

export const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 chars"),
});


export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  location: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(400).optional(),
  interests: z.string().trim().max(200).optional(),
  zip: z.string().trim().max(20).nullable().optional(),
  radiusKm: optionalNumber(z.coerce.number().int().min(1).max(500)),
  latitude: optionalNumber(z.coerce.number().min(-90).max(90)),
  longitude: optionalNumber(z.coerce.number().min(-180).max(180)),
});


export const haveCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.number().int().min(1).default(1),
  notes: z.string().trim().max(400).optional(),
  plantId: z.string().cuid().nullable().optional(),
});


export const haveUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  qty: z.number().int().min(1).optional(),
  notes: z.string().trim().max(400).nullable().optional(),
  plantId: z.string().cuid().nullable().optional(),
});

export const gardenCreateSchema = z.object({
  name: z.string().trim().max(80).optional(),
  usdaZone: z.string().trim().max(12).optional(),
  bedAreaSqFt: optionalNumber(z.coerce.number().min(0).max(500000)),
});

export const gardenUpdateSchema = z.object({
  name: z.string().trim().max(80).optional(),
  usdaZone: z.string().trim().max(12).optional(),
  bedAreaSqFt: optionalNumber(z.coerce.number().min(0).max(500000)),
});

export const plantCreateSchema = z.object({
  commonName: z.string().trim().min(1).max(120),
  tags: z.string().trim().max(200).optional(),
  frostSensitivity: z.string().trim().max(120).optional(),
  daysToMaturity: optionalNumber(z.coerce.number().int().min(1).max(365)),
  season: z.string().trim().max(40).optional(),
});

export const plantUpdateSchema = z.object({
  commonName: z.string().trim().min(1).max(120).optional(),
  tags: z.string().trim().max(200).optional(),
  frostSensitivity: z.string().trim().max(120).optional(),
  daysToMaturity: optionalNumber(z.coerce.number().int().min(1).max(365)),
  season: z.string().trim().max(40).optional(),
});
