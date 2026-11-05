import fastify from "fastify";
import { db } from "./db.js";
import { Type } from "typebox";
import { type TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { CreateProjectBodySchema, CreateProjectResponseSchema, RegisterBodySchema, LoginBodySchema,
    SupabaseParams, CreateSupabaseTaskBodySchema, UpdateSupabaseTaskBodySchema } from "./types.js"
import { hashPassword, verifyPassword  } from "./password.js";
import fastifyJwt from "@fastify/jwt";
import { authenticate } from "./authenticate.js"
import { requireProjectOwner, requireProjectMember } from "./authorization.js"
import { authenticateSupabase } from "./authenticate-supabase.js";
import { createUserSupabaseClient } from "./supabase.js";

const app = fastify({
	logger: true,
	ajv: {
    	customOptions: {
    	  coerceTypes: false,
		    removeAdditional: false,
    },
  },
}).withTypeProvider<TypeBoxTypeProvider>()

app.decorateRequest("supabaseUser", null);
app.decorateRequest("supabaseAccessToken", null);

await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET!,
});


app.get("/auth/supabase/me", { onRequest: [authenticateSupabase] }, async (request) => {
    const user = request.supabaseUser!;

    return {
      id: user.id,
      email: user.email,
    };
  },
);


app.get("/auth/supabase/projects",{
  onRequest: [authenticateSupabase]
}, async (request, reply) => {
    const accessToken = request.supabaseAccessToken;

    if (!accessToken) {
      return reply.code(401).send({
        message: "Authentication required",
      });
    }

    const userSupabase = createUserSupabaseClient(accessToken);

    const { data, error } = await userSupabase
      .from("projects")
      .select("id, name, description, created_at");

    if (error) {
      request.log.error({ err: error }, "Failed to fetch Supabase projects");

      return reply.code(500).send({
        message: "Failed to fetch projects",
      });
    }

    return { projects: data };
  },
);



app.post(
  "/auth/supabase/projects",
  {
    onRequest: [authenticateSupabase],
    schema: {
      body: CreateProjectBodySchema,
    },
  },
  async (request, reply) => {
    const accessToken = request.supabaseAccessToken;

    if (!accessToken) {
      return reply.code(401).send({
        message: "Authentication required",
      });
    }

    const { name, description } = request.body;
    const userSupabase = createUserSupabaseClient(accessToken);

    const { data: projectId, error } = await userSupabase.rpc(
      "create_project",
      {
        p_name: name,
        p_description: description ?? null,
      },
    );

    if (error) {
      request.log.error(
        { err: error },
        "Failed to create Supabase project",
      );

      if (error.code === "22023") {
        return reply.code(400).send({
          message: "Project name is required",
        });
      }

      if (error.code === "28000") {
        return reply.code(401).send({
          message: "Authentication required",
        });
      }

      return reply.code(500).send({
        message: "Failed to create project",
      });
    }

    return reply.code(201).send({
      project: {
        id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });
  },
);


app.get<{
  Params: { projectId: string };
}>(
  "/auth/supabase/projects/:projectId/tasks",
  { onRequest: [authenticateSupabase] },
  async (request, reply) => {
    const accessToken = request.supabaseAccessToken;

    if (!accessToken) {
      return reply.code(401).send({
        message: "Authentication required",
      });
    }

    const { projectId } = request.params;
    const userSupabase = createUserSupabaseClient(accessToken);

    const { data, error } = await userSupabase
      .from("tasks")
      .select("id, project_id, title, status, created_at, created_by")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      request.log.error({ err: error }, "Failed to fetch Supabase tasks");

      return reply.code(500).send({
        message: "Failed to fetch tasks",
      });
    }

    return { tasks: data };
  },
);

app.post(
  "/auth/supabase/projects/:projectId/tasks",
  {
    onRequest: [authenticateSupabase],
    schema: {
      params: SupabaseParams,
      body: CreateSupabaseTaskBodySchema,
    },
  },
  async (request, reply) => {
    const accessToken = request.supabaseAccessToken;

    if (!accessToken) {
      return reply.code(401).send({
        message: "Authentication required",
      });
    }

    const { projectId } = request.params;
    const { title } = request.body;
    const userSupabase = createUserSupabaseClient(accessToken);

    const { data, error } = await userSupabase
      .from("tasks")
      .insert({
        project_id: projectId,
        title: title.trim(),
      })
      .select("id, project_id, title, status, created_at, created_by")
      .single();

    if (error) {
      request.log.error({ err: error }, "Failed to create Supabase task");

      if (error.code === "42501") {
        return reply.code(403).send({
          message: "You are not allowed to create a task in this project",
        });
      }

      if (error.code === "23503") {
        return reply.code(400).send({
          message: "The specified project does not exist",
        });
      }

      return reply.code(500).send({
        message: "Failed to create task",
      });
    }

    return reply.code(201).send({ task: data });
  },
);


app.patch(
  "/auth/supabase/projects/:projectId/tasks/:taskId",
  {
    onRequest: [authenticateSupabase],
    schema: {
      params: Type.Object({
        projectId: Type.String({ format: "uuid" }),
        taskId: Type.String({ format: "uuid" }),
      }),
      body: UpdateSupabaseTaskBodySchema,
    },
  },
  async (request, reply) => {
    const accessToken = request.supabaseAccessToken;

    if (!accessToken) {
      return reply.code(401).send({
        message: "Authentication required",
      });
    }

    const { projectId, taskId } = request.params;
    const updates = request.body;
    const userSupabase = createUserSupabaseClient(accessToken);

    const { data, error } = await userSupabase
      .from("tasks")
      .update(updates)
      .eq("project_id", projectId)
      .eq("id", taskId)
      .select("id, project_id, title, status, created_at, created_by")
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, "Failed to update Supabase task");

      if (error.code === "42501") {
        return reply.code(403).send({
          message: "You are not allowed to update this task",
        });
      }

      return reply.code(500).send({
        message: "Failed to update task",
      });
    }

    if (!data) {
      return reply.code(404).send({
        message: "Task not found or you are not allowed to update it",
      });
    }

    return { task: data };
  },
);

app.delete("/auth/supabase/projects/:projectId/tasks/:taskId",
  {
    onRequest: [authenticateSupabase],
    schema: {
      params: Type.Object({
        projectId: Type.String({format: "uuid"}),
        taskId: Type.String({format: "uuid"})
      }),
    }
  }, async (req, res) => {
   const accessToken = req.supabaseAccessToken

   if (!accessToken) {
      return res.code(401).send({
        message: "Authentication required!"
      })
   }

   const { projectId, taskId } = req.params
   const userSupabase = createUserSupabaseClient(accessToken)

   const { data, error } = await userSupabase
    .from("tasks")
    .delete()
    .eq("project_id", projectId)
    .eq("id", taskId)
    .select("id")
    .maybeSingle();

    if (error) {
      req.log.error({ err: error }, "Failed to delete Supabase task");

      if (error.code === "42501") {
        return res.code(403).send({
          message: "You are not allowed to delete this task",
        });
      }

      return res.code(500).send({
        message: "Failed to delete task",
      })
    }

    if (!data) {
      return res.code(404).send({
        message: "Task not found or you are not allowed to delete it",
      });
    }

    return res.code(204).send({
      messgae: "Task deleted"
    })
})











app.get("/", async (_req, res) => {
	return res.send({
    message: "DevBoard API is running",
    description: "This is my first api"
  })
})


app.post("/auth/register", {
    schema: {
      body: RegisterBodySchema,
    },
  }, async (req, reply) => {
    const { username, email, password } = req.body;

    const passwordHash = await hashPassword(password);

    try {
      const result = await db.query(
        `
          INSERT INTO users (username, email, password_hash)
          VALUES ($1, $2, $3)
          RETURNING id, username, email, created_at
        `,
        [username, email, passwordHash],
      );

      return reply.code(201).send({
        user: result.rows[0],
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "23505"
      ) {
        return reply.code(409).send({
          message: "Username or email already exists",
        });
      }

      throw error;
    }
  },
);


app.post("/auth/login", {
    schema: {
      body: LoginBodySchema,
    },
  }, async (req, reply) => {
    const { username, password } = req.body;

    const result = await db.query(
      `
        SELECT id, username, email, password_hash
        FROM users
        WHERE username = $1
      `,
      [username],
    );

    if (result.rowCount === 0) {
      return reply.code(401).send({
        message: "Invalid credentials",
      });
    }

    const user = result.rows[0];

    const validPassword = await verifyPassword(user.password_hash, password);

    if (!validPassword) {
      return reply.code(401).send({
        message: "Invalid credentials",
      });
    }

    const token = await reply.jwtSign({
      userId: user.id,
    });

    return reply.send({
      message: "Login successful",
      token,
    });
  },
);


app.get("/projects", {
    onRequest: [authenticate],
  }, async (req, reply) => {
    const userId = (req.user as { userId: number }).userId;

    const result = await db.query(
      `
        SELECT id, name, description, created_at
        FROM projects
        ORDER BY created_at DESC
      `,
    );

    return reply.send({
      userId,
      projects: result.rows,
    });
  },
);

app.delete("/projects/:id",{
    onRequest: [authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const projectId = Number(id);
    const userId = (req.user as { userId: number }).userId;

    const isOwner = await requireProjectOwner(
      projectId,
      userId,
    );

    if (!isOwner) {
      return reply.code(403).send({
        message: "You do not have permission to delete this project",
      });
    }

    const result = await db.query(
      `
        DELETE FROM projects
        WHERE id = $1
        RETURNING id
      `,
      [projectId],
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({
        message: "Project not found",
      });
    }

    return reply.send({
      message: "Project deleted",
    });
  },
);


app.get("/projects/:id/members", async (req, res) => {
  const { id } = req.params as { id: string };

  const result = await db.query(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        pm.role
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY u.username
    `,
    [id],
  );
  return res.send({
    projectId: Number(id),
    members: result.rows,
  });
});

app.post("/projects/:projectId/members", async (req, res) => {
  const { projectId } = req.params as { projectId: string };

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, $3)
      `,
      [projectId, 4, "member"],
    );

    await client.query(
      `
        INSERT INTO audit_logs (user_id, action)
        VALUES ($1, $2)
      `,
      [4, `joined project ${projectId}`],
    );

    await client.query("COMMIT");

    return res.code(201).send({
      message: "Member added",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});


app.post("/tasks/:id/claim-unsafe", {
    onRequest: [authenticate],
  },async (req, reply) => {
  const { id } = req.params as { id: string };
  const taskId = Number(id);
  const userId = (req.user as { userId: number }).userId;


  if (!Number.isSafeInteger(taskId) || taskId <= 0) {
    return reply.code(400).send({
      message: "Invalid task ID",
    });
  }

  const taskResult = await db.query(
    "SELECT project_id FROM tasks WHERE id = $1",
    [taskId],
  );

  if (taskResult.rowCount === 0) {
    return reply.code(404).send({
      message: "Task not found",
    });
  }

  const projectId = Number(taskResult.rows[0].project_id);

  const isMember = await requireProjectMember(
    projectId,
    userId,
  );

  if (!isMember) {
    return reply.code(403).send({
      message: "You are not a member of this project",
    });
  }

  const result = await db.query(
    `
      UPDATE tasks
      SET assignee_id = $1
      WHERE id = $2
        AND assignee_id IS NULL
      RETURNING id, project_id, title, status, assignee_id
    `,
    [userId, taskId],
  );

  if (result.rowCount === 0) {
    return reply.code(409).send({
      message: "Task is already claimed",
    });
  }

  return reply.send({
    message: "Task claimed",
    userId,
    task: result.rows[0],
  });
});


app.post("/projects", {
  schema: {
    body: CreateProjectBodySchema,
	response: {
		201: CreateProjectResponseSchema
	}
  },
},async (req, res) => {
	const { name, description} = req.body

	const result = await db.query(
		`
			INSERT INTO projects (name, description)
			VALUES ($1, $2)
			RETURNING id, name, description, created_at
		`, [name, description ?? null]
	)

	const project = result.rows[0];

	return res.code(201).send({
		message: "Project created",
		project
	})
})

const port = Number(process.env.PORT)

try {
	await app.listen({
		port,
    host: "0.0.0.0",
	})
} catch (error) {
	app.log.error(error)
	process.exit(1)
}
