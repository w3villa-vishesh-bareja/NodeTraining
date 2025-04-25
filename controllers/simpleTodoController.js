import pool from "../config/dbService.js";
import { ApiError } from "../utils/ApiError.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import {
  createSimpleTaskSchema,
  editSimpleTaskSchema,
  getSimpleTaskSchema,
  deleteSimpleTaskSchema,
} from "../validators/simpleTask.validator.js";
import responseHandler from "../handler/responseHandler.js";

// Protected routes

export async function createSimpleTask(req, res, next) {
 
  const { error } = createSimpleTaskSchema.validate(req.body);
  if (error) {
    return next(new ApiError(400, errorMessages.validationError));
  }
  const { userId, title } = req.body;
  let { deadline, description } = req.body;

  if (!deadline) deadline = null;
  if (!description) description = null;

  const created_by = userId;
  const type = "simple";

  //create task
  try {
    const result = await pool.query(nativeQueries.createSimpleTask, [
      title,
      created_by,
      deadline,
      description,
      type,
    ]);
    const [rows] = await pool.execute("SELECT * FROM tasks WHERE id = ?", [
      result[0].insertId,
    ]);
    return responseHandler(200, true, "Task created", [rows[0]], res);
  } catch (error) {
    console.error(error);
    return next(new ApiError(500));
  }
}

export async function editSimpleTask(req, res, next) {

  const { error } = editSimpleTaskSchema.validate(req.body);
  if (error) {
    return next(new ApiError(400, errorMessages.validationError));
  }
  const { taskId, userId, deadline, description, status ,type } = req.body;

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
    return next(new ApiError(400, "No fields provided to update."));
  }
  values.push(taskId, userId , type);

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
        new ApiError(404, "Task not found or you're not authorized to edit it.")
      );
    }
    const [updatedRows] = await pool.execute(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId]
    );
    return responseHandler(200, true, "success", [updatedRows[0]], res);
  } catch (err) {
    console.error("Error updating task:", err);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}
export async function deleteSimpleTaskSingle(req, res, next) {
  //required - userId , type , taskId

  const { error } = deleteSimpleTaskSchema.validate(req.body);
  if (error) {
    return next(new ApiError(400, errorMessages.validationError));
  }
  const { taskId, userId, type } = req.body;

  try {
    const [result] = await pool.query(nativeQueries.deleteSimpleTaskSingle, [
      taskId,
      userId,
      type
    ]);
    console.log(result);
    if (result.affectedRows === 0) {
      return next(
        new ApiError(404, "Task not found or you're not authorized to edit it.")
      );
    }
    return responseHandler(200, true, "Task Deleted", [], res);
  } catch (error) {
    console.error("Error Deleting task:", err);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}
export async function getSimpleTasks(req, res, next) {
  console.log("body",req.body)
  const { error } = getSimpleTaskSchema.validate(req.body);
  if (error) {
    return next(new ApiError(400, errorMessages.validationError));
  }
  const { userId, type } = req.body;
  try {
    const result = await pool.query(nativeQueries.getSimpleTasks, [
      userId,
      type,
    ]);
    return responseHandler(200, true, "Tasks fetched", [result[0]], res);
  } catch (error) {
    console.error("Error Deleting task:", err);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}
