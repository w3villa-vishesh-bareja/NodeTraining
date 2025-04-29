import pool from "../config/dbService.js";
import { ApiError } from "../utils/ApiError.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert { type: "json" };
import responseHandler from "../handler/responseHandler.js";

// get task is same as collab
// create task is same as collab

export async function getGroupProject(req,res,next){
  const{userId , type} = req.body;
  if (type != "group") {
    return next(new ApiError(400, errorMessages.invalidProjectType || "Invalid project type."));
  }
  try {
    const [projects] = await pool.query(nativeQueries.getGroupProject, [
      userId,
      type,
    ]);
    if (projects.length === 0) {
      return next(new ApiError(404, errorMessages.projectNotFound));
    }
    return responseHandler(
      200,
      true,
      successMessages.projectFetched ,
      projects,
      res
    );
  } catch (error) {
    console.error("Error fetching projects:", error);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}
export async function editGroupTask(req, res, next) {
  const { taskId, userId, deadline, description, status, type, projectId } = req.body;
  if (type != "group") {
    return next(new ApiError(400, errorMessages.invalidTaskType || "Invalid task type."));
  }
  const isOwner = await pool.query(nativeQueries.getProjectType , [ projectId]);
  if(isOwner[0][0].type != "group"){
      return next(new ApiError(400 , errorMessages.invalidProjectType || "Invalid project type."));
  }
  if(isOwner[0][0].owner != userId){
      return next(new ApiError(403 , errorMessages.unauthorizedUser || "You are not authorized to change the status of this task."));
  }
  const fieldsToUpdate = [];
  const values = [];

  if (deadline) {
    fieldsToUpdate.push("deadline = ?");
    values.push(deadline || null);
  }
  if (description) {
    fieldsToUpdate.push("description = ?");
    values.push(description || null);
  }
  if (status) {
    fieldsToUpdate.push("status = ?");
    values.push(status);
  }
  if (fieldsToUpdate.length === 0) {
    return next(new ApiError(400, errorMessages.noFieldsToUpdate || "No fields provided to update."));
  }
  values.push(taskId, userId, type);

  const sql = `
    UPDATE tasks
    SET ${fieldsToUpdate.join(", ")}
    WHERE id = ? AND created_by = ? AND type = ?
    `;

  try {
    const [result] = await pool.query(sql, values);
    console.log(result);
    if (result.affectedRows === 0) {
      return next(
        new ApiError(404, errorMessages.taskNotFoundOrUnauthorized)
      );
    }
    const [updatedRows] = await pool.execute(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId]
    );
    return responseHandler(
      200,
      true,
      successMessages.taskUpdated ,
      [updatedRows[0]],
      res
    );
  } catch (err) {
    console.error("Error updating task:", err);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}


export async function deleteGroupTask(req, res, next) {
  const { taskId, userId, type } = req.body;
  if (type != "group") {
    return next(new ApiError(400, errorMessages.invalidTaskType));
  }
  try {
    const [result] = await pool.query(nativeQueries.deleteSimpleTaskSingle, [
      taskId,
      userId,
      type,
    ]);
    console.log(result);
    if (result.affectedRows === 0) {
      return next(
        new ApiError(404, errorMessages.taskNotFoundOrUnauthorized)
      );
    }
    return responseHandler(
      200,
      true,
      successMessages.taskDeleted ,
      [],
      res
    );
  } catch (error) {
    console.error("Error deleting task:", error);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}

export async function changeGroupTaskStatus(req,res,next){
     
  const {userId, projectId, status, taskId, } = req.body;

  try {   
      const isOwner = await pool.query(nativeQueries.getProjectType , [ projectId]);
      if(isOwner[0][0].type != "group"){
          return next(new ApiError(400 , errorMessages.invalidProjectType || "Invalid project type."));
      }
      if(isOwner[0][0].owner != userId){
          return next(new ApiError(403 , errorMessages.unauthorizedUser || "You are not authorized to change the status of this task."));
      }

      const updatedRows = await pool.query(nativeQueries.changeStatus , [status , taskId]);
      if(updatedRows[0].affectedRows === 0){
          return next(new ApiError(404 , errorMessages.taskNotFound || "Task not found."));
      }
      return responseHandler(200 , true , "status changed" , [] , res); 
  } catch (error) {
      console.log(error);
      return next(new ApiError(500 , error));
  }
}