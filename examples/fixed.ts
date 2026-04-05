import { z } from "zod";

export interface User {
  name: string;
  email?: string;
  age: number;
}

export const UserSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  age: z.number(),
});
