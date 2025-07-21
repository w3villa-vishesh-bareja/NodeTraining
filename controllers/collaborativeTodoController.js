import pool from "../config/dbService.js";
import { ApiError } from "../utils/ApiError.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert { type: "json" };
import responseHandler from "../handler/responseHandler.js";
import { ensureCollaborativeProject, ensureProjectOwner, taskCreator } from "../handler/projectHandler.js";
import {inviteUserSchema , fetchInvitationsSchema , acceptNotificationSchema} from "../validators/collabProject.validator.js"
import { tierCheckHandler } from "../utils/tierCheckHandler.js";
import { TASK_TYPE, USER_ROLE } from "../config/appConstants.js";
import { createTaskSchema } from "../validators/project.validator.js";

export async function inviteUsers(req,res,next){
    const {error} = inviteUserSchema.validate(req.body)
    if(error){
        console.log(error)
        return next(new ApiError(400,errorMessages.validationError))
    }
    const {userId , receiverId , projectId} = req.body;
    if(userId == receiverId){
        return next(new ApiError(400 , errorMessages.inviteSelf))
    }
    try {
        await ensureCollaborativeProject(projectId);
        await ensureProjectOwner(userId , projectId);
        const isAuthorised = await tierCheckHandler(receiverId ,3);
        if(!isAuthorised){
            return next(new ApiError(403 , errorMessages.tierAuthorizationFailed));
        }
        const insert = await pool.query(nativeQueries.createInvitation , [userId ,receiverId , projectId]);
        return responseHandler(201 , true , successMessages.invitationSent,[],res);
    } catch (error) {
        console.log(error);
        return next(new ApiError(500,error.message))
    }
}

export async function fetchInvitations(req,res,next){
    console.log(req.body)
    const {error} = fetchInvitationsSchema.validate(req.body)
    if(error){
        console.log(error)
        return next(new ApiError(400,errorMessages.validationError))
    }
    const {userId} = req.body;
    try {
        const invitations =  await pool.query(nativeQueries.fetchInviations,[userId]);
        return responseHandler(200 , true , successMessages.invitationsFetched,[invitations[0]],res);
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
            return next(new ApiError(403, errorMessages.tierAuthorizationFailed));
        }
        const [isAccepted] = await connection.query(nativeQueries.getAcceptedStatus, [userId, projectId]);
        if(isAccepted.length == 0) {
            return next(new ApiError(400, errorMessages.invitationNotFound));
        }
        if(isAccepted[0].is_accepted) {
            return next(new ApiError(409, errorMessages.invitationAlreadyAccepted));
        }

        await connection.query(nativeQueries.acceptNotifications, [userId, projectId]);
        await connection.query(nativeQueries.addUserInProject, [userId, userId, projectId]);
        await connection.query(nativeQueries.addUserLevel, [userId, projectId]);
        
        await connection.commit();
        connection.release();
        return responseHandler(200, true, successMessages.invitationAccepted, [{projectId: projectId}], res);
    } catch (error) {
        console.log(error);
        await connection.rollback();
        connection.release();
        return next(new ApiError(500, errorMessages.internalServerError ));
    }
}
export async function rejectNotification(req, res, next) {
    const {error} = acceptNotificationSchema.validate(req.body);
    if(error) {
        console.log(error);
        return next(new ApiError(400, errorMessages.validationError));
    }
    const {userId, projectId} = req.body;
    try {
        const [isAccepted] = await pool.query(nativeQueries.getAcceptedStatus, [userId, projectId]);
        if(isAccepted.length == 0) {
            return next(new ApiError(400, errorMessages.invitationNotFound));
        }
        if(isAccepted[0].is_accepted) {
            return next(new ApiError(409, errorMessages.invitationAlreadyAccepted));
        }
        await pool.query(nativeQueries.rejectInvitation, [userId, projectId]);
        return responseHandler(200, true, successMessages.invitationAccepted, [{projectId: projectId}], res);
    } catch (error) {
        console.log(error);
        return next(new ApiError(500, errorMessages.internalServerError ));
    }
}

export async function createTask(req,res,next){   
    console.log(req.body)
    const {error} = createTaskSchema.validate(req.body);
    if(error){
        console.log(error);
        return next(new ApiError(400,errorMessages.validationError));
    }
    
    const {userId, projectId, taskName, description, type, deadline} = req.body;
    let {assigned_to} = req.body;


    console.log("project is assigned to",assigned_to);
    if(!assigned_to){
        assigned_to = null
    }

    try {
        if(type == TASK_TYPE.GROUP){
            const isAuthorised = await tierCheckHandler(userId , 2);
            const isgroupProject = await pool.query(nativeQueries.getProjectType , [projectId]);

            if(isgroupProject[0][0].type != TASK_TYPE.GROUP){
                return next(new ApiError(400 , errorMessages.invalidTaskType));
            }
            if(isgroupProject[0][0].owner != userId){
                return next(new ApiError(400 , errorMessages.userNotInProject));
            }
            if(!isAuthorised){
                return next(new ApiError(403 , errorMessages.tierAuthorizationFailed));
            }
        }
        if(type == TASK_TYPE.COLLABORATIVE){
            const isAuthorised = await tierCheckHandler(userId ,3);
            if(!isAuthorised){
                return next(new ApiError(403 , errorMessages.tierAuthorizationFailed));
            }
        }
        const id = await taskCreator(userId, projectId, taskName, deadline, description, assigned_to, type);
        if(id){
            return responseHandler(201 , true , successMessages.taskCreated , [{taskId:id}] , res)
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
            return next(new ApiError(400, errorMessages.userNotInProject));
        }
        if (userType[0].role !== USER_ROLE.OWNER && userType[0].role !== USER_ROLE.ADMIN) {
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
            throw new ApiError(400, errorMessages.noMembersFound);
        }

        const isMember = members.some(member => member.user_id === assigned_to[0]);
        if (!isMember) {
            throw new ApiError(400, errorMessages.assignedUserNotMember);
        }

        const [userType] = await pool.query(nativeQueries.getUserRole, [projectId, userId]);
        if (!userType || userType.length === 0) {
            throw new ApiError(400, errorMessages.userNotInProject);
        }

        if (userType[0].role !== USER_ROLE.OWNER && userType[0].role !== USER_ROLE.ADMIN) {
            const [currentAssignment] = await pool.query(nativeQueries.checkIfAssigned, [taskId]);
            if (!currentAssignment || currentAssignment.length === 0) {
                throw new ApiError(400,errorMessages.taskNotFoundOrUnauthorized);
            }

            const currentAssignedUsers = JSON.parse(currentAssignment[0].assigned_to || '[]');
            
            if (currentAssignedUsers !== userId) {
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
        return responseHandler(200 , true , successMessages.tasksFetched , [tasks] , res);
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
            throw new ApiError(400, errorMessages.userNotInProject);
        }
        if (userType[0].role !== USER_ROLE.OWNER && userType[0].role !== USER_ROLE.ADMIN) {
            throw new ApiError(400, "This action is only allowed for project owner or admin ");
        }
        const [subTasks]=await pool.query(nativeQueries.checkIfParent,[taskId]);
        if(subTasks.length > 0){
            return next(new ApiError(400 , "This task has subtasks, please delete them first",[subTasks]));
        }
        await pool.query(nativeQueries.deleteTask , [taskId]);
        return responseHandler(200 , true , successMessages.taskDeleted , [] , res);
    } catch (error) {
        console.error(error);
        return next(new ApiError(500 , error));
    }
}



 