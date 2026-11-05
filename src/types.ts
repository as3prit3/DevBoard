import { Type } from "typebox";
import type { User } from "@supabase/supabase-js";

export const CreateProjectBodySchema = Type.Object({
	name: Type.String(),
	description: Type.Optional(Type.String())
}, {
	additionalProperties: false,
})

const ProjectResponseSchema = Type.Object({
  id: Type.Integer(),
  name: Type.String(),
  description: Type.Union([
    Type.String(),
    Type.Null(),
  ]),
  created_at: Type.String(),
}, {
  additionalProperties: false,
});

export const CreateProjectResponseSchema = Type.Object(
  {
	message: Type.String(),
	project: ProjectResponseSchema,
  },
  {
	additionalProperties: false,
  },
);

export const RegisterBodySchema = Type.Object(
  {
    username: Type.String({ minLength: 3, maxLength: 50 }),
    email: Type.String({ minLength: 3, maxLength: 255 }),
    password: Type.String({ minLength: 8, maxLength: 128 }),
  },
  {
    additionalProperties: false,
  },
);

export const LoginBodySchema = Type.Object(
  {
    username: Type.String({ minLength: 3, maxLength: 50 }),
    password: Type.String({ minLength: 8, maxLength: 128 }),
  },
  {
    additionalProperties: false,
  },
);

declare module "fastify" {
  interface FastifyRequest {
    supabaseUser: User | null;
    supabaseAccessToken: string | null;
  }
}

export const CreateSupabaseTaskBodySchema = Type.Object({
    title: Type.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export const SupabaseParams = Type.Object({
    projectId: Type.String(),
  });

export
const UpdateSupabaseTaskBodySchema = Type.Object(
  {
    title: Type.Optional(
      Type.String({ minLength: 1, maxLength: 200 }),
    ),
    status: Type.Optional(
      Type.Union([
        Type.Literal("todo"),
        Type.Literal("in_progress"),
        Type.Literal("done"),
      ]),
    ),
  },
  {
    additionalProperties: false,
    minProperties: 1,
  },
);
