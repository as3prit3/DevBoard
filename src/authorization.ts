import { db } from "./db.js";

export async function requireProjectOwner(
  projectId: number,
  userId: number,
): Promise<boolean> {
  const result = await db.query(
    `
      SELECT 1
      FROM project_members
      WHERE project_id = $1
        AND user_id = $2
        AND role = 'owner'
    `,
    [projectId, userId],
  );

  return result.rowCount !== 0;
}


export async function requireProjectMember(
  projectId: number,
  userId: number,
): Promise<boolean> {
  const result = await db.query(
    `
      SELECT 1
      FROM project_members
      WHERE project_id = $1
        AND user_id = $2
    `,
    [projectId, userId],
  );

  return result.rowCount !== 0;
}
