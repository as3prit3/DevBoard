import type { FastifyReply, FastifyRequest } from "fastify";
import { supabase } from "./supabase.js";

export async function authenticateSupabase(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authorization = request.headers.authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return reply.code(401).send({
      message: "Authentication required",
    });
  }

  const { data, error } = await supabase.auth.getUser(match[1]);

  if (error || !data.user) {
    return reply.code(401).send({
      message: "Invalid or expired Supabase token",
    });
  }

  request.supabaseUser = data.user;
  const accessToken = match[1];

  if (!accessToken) {
	return reply.code(401).send({
		message: "Authentication required",
	});
  }

  request.supabaseAccessToken = accessToken;
}
