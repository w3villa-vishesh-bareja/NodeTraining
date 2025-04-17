import  pool, { genTokenForVerification } from "../config/dbService.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert {type :"json"}
import errorMessages from "../config/errorMessages.json" assert {type:"json"}
import { ApiError } from "../utils/ApiError.js";


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

        if (userType[0].role !== "owner") {
            throw new ApiError(400, "This action is only allowed for project owner");
        }
    } catch (error) {
        console.error(error);
        throw new ApiError(500, error);
    }
}
