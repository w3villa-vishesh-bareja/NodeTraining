import pool from "../config/dbService.js";
import { ApiError } from "../utils/ApiError.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert { type: "json" };
import responseHandler from "../handler/responseHandler.js";
import { createProjectSchema } from "../validators/project.validator.js";
import { tierCheckHandler } from "../utils/tierCheckHandler.js";
import { USER_ROLE } from "../config/appConstants.js";

export async function createProject(req, res, next) {
  const { error } = createProjectSchema.validate(req.body);
  if (error) {
    return next(new ApiError(400, errorMessages.validationError));
  }

  const { type, userId, name } = req.body;
  if (type && type == "collaborative") {
    const isAuthorised = await tierCheckHandler(userId, 3);
    if (!isAuthorised) {
      return next(new ApiError(403, errorMessages.tierAuthorizationFailed));
    }
  } else {
    const isAuthorised = await tierCheckHandler(userId, 2);
    if (!isAuthorised) {
      return next(new ApiError(403, errorMessages.tierAuthorizationFailed));
    }
  }
  let { deadline, description } = req.body;
  if (!deadline) deadline = null;

  if (new Date(deadline) < new Date(Date.now())) {
    return next(new ApiError(400, errorMessages.deadlineInvalid));
  }
  if (!description) description = null;
  let connection = await pool.getConnection();
  try {
    // Insert
    const result = await connection.query(nativeQueries.createProject, [
      name,
      type,
      userId,
      description,
      deadline,
    ]);
    if (type == "collaborative") {
      await connection.query(nativeQueries.insertInProjectMember, [
        result[0].insertId,
        userId,
        USER_ROLE.OWNER,
      ]);
    }
    const [createdProject] = await connection.query(
      "SELECT * FROM projects WHERE id=?",
      [result[0].insertId]
    );
    connection.commit();
    connection.release();
    return responseHandler(
      201,
      true,
      successMessages.projectCreated,
      [createdProject[0]],
      res
    );
  } catch (error) {
    console.log(error);
    connection.rollback();
    connection.release();
    return next(new ApiError(500, errorMessages.projectCreationFailed));
  }
}

export async function getAllProjects(req, res, next) {
  const { userId } = req.body;
  try {
    const [projects] = await pool.query(nativeQueries.getProjects, [userId]);
    return responseHandler(
      200,
      true,
      successMessages.projectsFetched,
      [projects],
      res
    );
  } catch (error) {
    console.log(error);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}

export async function getProjectDetails(req, res, next) {
  const { projectUniqueId } = req.query;
  const { userId } = req.body;

  try {
    const [projectRows] = await pool.query(nativeQueries.checkUserAndId, [
      projectUniqueId,
    ]);

    if (projectRows.length === 0) {
      return next(new ApiError(404, errorMessages.projectNotFound));
    }

    const projectDetails = projectRows[0];

    // Access check
    if (userId !== projectDetails.owner) {
      if (!projectDetails.users)
        return next(new ApiError(404, errorMessages.userNotInProject));
      else {
        const matchExists = projectDetails?.users.some(
          (row) => row === userId
        );
        if (!matchExists)
          return next(new ApiError(404, errorMessages.userNotInProject));
      }
    }

    const [users] = await pool.query(nativeQueries.getUserDetails, [
      projectDetails.id,
    ]);
    const [taskDetails] = await pool.query(nativeQueries.getTasksForProject, [
      projectDetails.id,
    ]);

    const userMap = users.reduce((acc, user) => {
      acc[user.id] = {
        name: user.name,
        profilePhoto: user.profile_image_url,
      };
      return acc;
    }, {});

    const processedTasks = taskDetails.map((task) => {
      if (task.assigned_to) {
        const assignedIds = JSON.parse(task.assigned_to);
        const assignedUsers = {
          id: assignedIds,
          name: userMap[assignedIds]?.name,
          profilePhoto: userMap[assignedIds]?.profilePhoto,
        };
        console.log(assignedUsers);
        return { ...task, assigned_to: assignedUsers };
      }
      return task;
    });

    const fullProject = {
      ...projectDetails,
      tasks: processedTasks,
      userDetails: users,
    };

    return responseHandler(
      200,
      true,
      successMessages.projectDetailsFetched,
      [fullProject],
      res
    );
  } catch (error) {
    console.error(error);
    return next(new ApiError(500, errorMessages.taskProcessingError));
  }
}

export async function searchUsers(req, res, next) {
  const name = req.query.name;
  console.log("name", name);
  try {
    const [searchResult] = await pool.query(nativeQueries.checkName, [
      `%${name}%`,
    ]);
    console.log(searchResult);
    return responseHandler(
      200,
      true,
      successMessages.usersFetched,
      [searchResult],
      res
    );
  } catch (error) {
    console.error(error);
    return next(new ApiError(500, errorMessages.userSearchFailed));
  }
}

export async function deleteProject(req, res, next)  {
  const {projectId, userId} = req.body;
  try{
    const [userType] = await pool.query(nativeQueries.getUserRole, [projectId, userId]);
    if (!userType || userType.length === 0) {
        return next(new ApiError(400, errorMessages.userNotInProject));
    }
    if (userType[0].role !== USER_ROLE.OWNER && userType[0].role !== USER_ROLE.ADMIN) {
        return next( new ApiError(400, "This action is only allowed for project owner or admin"));
    }
    const [result] = await pool.query(nativeQueries.deleteProject, [projectId]);
    if (result.affectedRows === 0) {
      return next(new ApiError(404, errorMessages.projectNotFound));
    }
    return responseHandler(
      200,
      true,
      successMessages.projectDeleted,
      [],
      res
    );
  }catch(error){
    console.error(error);
    return next(new ApiError(500, errorMessages.projectDeletionFailed));
  }
}