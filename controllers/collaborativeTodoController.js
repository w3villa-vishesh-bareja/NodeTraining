import pool from "../config/dbService.js";
import { ApiError } from "../utils/ApiError.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import responseHandler from "../handler/responseHandler.js";
import { ensureCollaborativeProject, ensureProjectOwner, taskCreator } from "../handler/projectHandler.js";
import {inviteUserSchema , fetchInvitationsSchema , acceptNotificationSchema} from "../validators/collabProject.validator.js"
import { tierCheckHandler } from "../utils/tierCheckHandler.js";
import { TASK_TYPE, TIER } from "../config/appConstants.js";
import { createTaskSchema } from "../validators/project.validator.js";

export async function inviteUsers(req,res,next){
    const {error} = inviteUserSchema.validate(req.body)
    if(error){
        console.log(error)
        return next(new ApiError(400,errorMessages.validationError))
    }
    const {userId , receiverId , projectId} = req.body;
    try {
        await ensureCollaborativeProject(projectId);
        await ensureProjectOwner(userId , projectId);
        const isAuthorised = await tierCheckHandler(receiverId ,3);
        if(!isAuthorised){
            return next(new ApiError(403 , "The user does not have a tier 3 subscription"));
        }
        const insert = await pool.query(nativeQueries.createInvitation , [userId ,receiverId , projectId]);
        return responseHandler(201 , true , "invitation sent",[],res);
    } catch (error) {
        console.log(error);
        return next(new ApiError(500,error.message))
    }
}

export async function fetchInvitations(req,res,next){
    const {error} = fetchInvitationsSchema.validate(req.body)
    if(error){
        console.log(error)
        return next(new ApiError(400,errorMessages.validationError))
    }
    const {userId} = req.body;
    try {
        const invitations =  await pool.query(nativeQueries.fetchInviations,[userId]);
        return responseHandler(200 , true , "invitations fetched",[invitations[0]],res);
    } catch (error) {
        console.log(error);
        return next(new ApiError(500,error));
    }
}

export async function acceptNotification(req, res, next) {
    const {error} = acceptNotificationSchema.validate(req.body);
    if(error) {
        console.log(error);
        return next(new ApiError(400, errorMessages.validationError));
    }
    const {userId, projectId} = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        await ensureCollaborativeProject(projectId);
        const isAuthorised = await tierCheckHandler(userId, 3);
        if(!isAuthorised) {
            return next(new ApiError(403, "You do not have a tier 3 subscription"));
        }
        const [isAccepted] = await connection.query(nativeQueries.getAcceptedStatus, [userId, projectId]);
        if(isAccepted.length == 0) {
            return next(new ApiError(400, "You are not invited to this project"));
        }
        if(isAccepted[0].is_accepted) {
            return next(new ApiError(409, "Invitation already accepted"));
        }

        await connection.query(nativeQueries.acceptNotifications, [userId, projectId]);
        await connection.query(nativeQueries.addUserInProject, [userId, userId, projectId]);
        await connection.query(nativeQueries.addUserLevel, [userId, projectId]);
        
        await connection.commit();
        connection.release();
        return responseHandler(200, true, "invitation accepted", [{projectId: projectId}], res);
    } catch (error) {
        console.log(error);
        await connection.rollback();
        connection.release();
        return next(new ApiError(500, "error in while accepting Notification" + error));
    }
}

export async function createTask(req,res,next){   
    const {error} = createTaskSchema.validate(req.body);
    if(error){
        return next(new ApiError(400,errorMessages.validationError));
    }
    
    const {userId, projectId, taskName, description, type, deadline} = req.body;
    let {assigned_to} = req.body;

    if(!assigned_to){
        assigned_to = null
    }
    if(assigned_to){
        try {
            const [members] = await pool.query(nativeQueries.getProjectMembers, [projectId]);
            if (!members || members.length === 0) {
                throw new ApiError(400, "No members found in the project");
            }
            const isMember = members.some(member => member.user_id === assigned_to[0]);
            if (!isMember) {
                throw new ApiError(400, "Assigned user is not a member of the project");
            }
        } catch (error) {
            console.error(error);
            return next(new ApiError(500, error));
        }
    }
    try {
        if(type == TASK_TYPE.GROUP){
            const isAuthorised = await tierCheckHandler(userId , 2);
            if(!isAuthorised){
                return next(new ApiError(403 , "The user does not have a tier 2 subscription"));
            }
        }
        if(type == TASK_TYPE.COLLABORATIVE){
            const isAuthorised = await tierCheckHandler(userId ,3);
            if(!isAuthorised){
                return next(new ApiError(403 , "The user does not have a tier 3 subscription"));
            }
        }
        const id = await taskCreator(userId, projectId, taskName, deadline, description, assigned_to, type);
        if(id){
            return responseHandler(201 , true , "task created" , [{taskId:id}] , res)
        }
    } catch (error) {
            console.log(error);
            return next(new ApiError(500 , error));
    }
    
}

export async function changeStatus(req,res,next){
     
    const {userId, projectId, status, taskId, } = req.body;

    try {   
        const [userType] = await pool.query(nativeQueries.getUserRole, [projectId, userId]);
    
        if (!userType || userType.length === 0) {
            return next(new ApiError(400, "User is not part of the project"));
        }
        if (userType[0].role !== "owner" && userType[0].role !== "admin") {
            const [assigned_to] = await pool.query(nativeQueries.checkIfAssigned ,[taskId]);
            if (!assigned_to || assigned_to.length === 0) {
                return next( new ApiError(400, "This action is only allowed for project owner or admin or assigned user"));
            }else {
                const assignedUsers = JSON.parse(assigned_to[0].assigned_to || '[]');

                if(assignedUsers != userId){
                    return next( new ApiError(400, "This action is only allowed for project owner, admin or assigned user"));
                }
            }
        }
        await pool.query(nativeQueries.changeStatus , [status , taskId]);
        return responseHandler(200 , true , "status changed" , [] , res); 
    } catch (error) {
        console.log(error);
        return next(new ApiError(500 , error));
    }
}
export async function changeAssignedTo(req, res, next) {
    const {userId, projectId, taskId, assigned_to} = req.body;

    try {   
        const [members] = await pool.query(nativeQueries.getProjectMembers, [projectId]);
        if (!members || members.length === 0) {
            throw new ApiError(400, "No members found in the project");
        }

        const isMember = members.some(member => member.user_id === assigned_to[0]);
        if (!isMember) {
            throw new ApiError(400, "Assigned user is not a member of the project");
        }

        const [userType] = await pool.query(nativeQueries.getUserRole, [projectId, userId]);
        if (!userType || userType.length === 0) {
            throw new ApiError(400, "User is not part of the project");
        }

        if (userType[0].role !== "owner" && userType[0].role !== "admin") {
            const [currentAssignment] = await pool.query(nativeQueries.checkIfAssigned, [taskId]);
            if (!currentAssignment || currentAssignment.length === 0) {
                throw new ApiError(400, "Task not found");
            }

            const currentAssignedUsers = JSON.parse(currentAssignment[0].assigned_to || '[]');
            
            if (!currentAssignedUsers.includes(userId)) {
                throw new ApiError(400, "This action is only allowed for project owner, admin or assigned user");
            }
        }

        await pool.query(nativeQueries.changeAssignedUser, [JSON.stringify(assigned_to), taskId]);
        return responseHandler(200, true, "assigned user changed", [], res); 
    } catch (error) {
        console.log(error);
        return next(new ApiError(500, error));
    }
}
export async function getTask(req,res,next){
    const {projectId} = req.body;
    try {
        const [tasks] = await pool.query(nativeQueries.getTasks , [projectId]);
        return responseHandler(200 , true , "tasks fetched" , [tasks] , res);
    } catch (error) {
        console.log(error);
        return next(new ApiError(500 , error));
    }
}

export async function deleteTask(req,res,next){
    const {taskId, userId, projectId} = req.body;
    try {
        const [userType] = await pool.query(nativeQueries.getUserRole, [projectId, userId]);
        if(!userType || userType.length === 0) {
            throw new ApiError(400, "User is not part of the project");
        }
        if(userType[0].role !== "owner" && userType[0].role !== "admin") {
            throw new ApiError(400, "This action is only allowed for project owner or admin ");
        }
        const [subTasks]=await pool.query(nativeQueries.checkIfParent,[taskId]);
        if(subTasks.length > 0){
            return next(new ApiError(400 , "This task has subtasks, please delete them first",[subTasks]));
        }
        await pool.query(nativeQueries.deleteTask , [taskId]);
        return responseHandler(200 , true , "task deleted" , [] , res);
    } catch (error) {
        console.error(error);
        return next(new ApiError(500 , error));
    }
}



 