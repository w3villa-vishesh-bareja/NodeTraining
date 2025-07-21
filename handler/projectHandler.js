import  pool, { genTokenForVerification } from "../config/dbService.js";
import fs from 'fs'
const nativeQueries = JSON.parse(
  fs.readFileSync(new URL('../nativequeries/nativeQueries.json', import.meta.url))
);
const errorMessages = JSON.parse(
  fs.readFileSync(new URL('../config/errorMessages.json', import.meta.url))
);
const successMessages = JSON.parse(
  fs.readFileSync(new URL('../config/successMessages.json', import.meta.url))
);
import { ApiError } from "../utils/ApiError.js";
import { USER_ROLE } from "../config/appConstants.js";


export async function ensureCollaborativeProject(projectId){
    const project = await pool.query(nativeQueries.getProjectType , [projectId]);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }
      if (project[0][0].type !== "collaborative") {
        throw new ApiError(403, "This action is only allowed on collaborative projects");
    }
}
export async function ensureProjectOwner(userId, project_id) {
    try {
        const [userType] = await pool.query(nativeQueries.getUserRole, [project_id, userId]);

        if (!userType || userType.length === 0) {
            throw new ApiError(400, "This action is only allowed for project owner");
        }

        if (userType[0].role !== USER_ROLE.OWNER) {
            throw new ApiError(400, "This action is only allowed for project owner");
        }
    } catch (error) {
        console.error(error);
        throw new ApiError(500, error);
    }
}
export async function taskCreator(userId, projectId, taskName, deadline, description, assigned, type) {
    try {
        const [taskCreator] = await pool.query(nativeQueries.createProjectTask, [
            taskName,
            userId,
            deadline,
            description,
            type,
            projectId,
            JSON.stringify(assigned),
            ]);
        console.log(taskCreator);
        return taskCreator.insertId;
    } catch (error) {
        console.error(error);
        throw new ApiError(500, error);
    }
}