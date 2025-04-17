import pool from "../config/dbService.js";
import { ApiError } from "../utils/ApiError.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert { type: "json" };
import responseHandler from "../handler/responseHandler.js";
import { frameguard } from "helmet";
import { ensureCollaborativeProject, ensureProjectOwner } from "../handler/projectHandler.js";

//socket use
export async function inviteUsers(req,res,next){
    const {userId , receiverId , projectId} = req.body;
    try {
        await ensureCollaborativeProject(projectId);
        await ensureProjectOwner(userId , projectId);
        await pool.query(nativeQueries.createInvitation , [userId ,receiverId , projectId]);
        return responseHandler(201 , true , "invitation sent",[],res);
    } catch (error) {
        console.log(error);
        return next(new ApiError(500,error))
    }
}

export async function fetchInvitations(req,res,next){
    const {userId} = req.body;
    try {
        const invitations =  await pool.query(nativeQueries.fetchInviations,[userId]);
        await ensureCollaborativeProject(invitations[0][0].project_id);
        return responseHandler(200 , true , "invitations fetched",[invitations[0]],res);
    } catch (error) {
        console.log(error);
        return next(new ApiError(500,error));
    }
}

export async function acceptNotification(req,res,next){
    const {userId , projectId} = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        await ensureCollaborativeProject(projectId);
        try {
            const [isAccepted] = await connection.query(nativeQueries.getAcceptedStatus , [userId]);
            if(isAccepted.length == 0){
                return next(new ApiError(400 , "You are not invited to this project"))
            }
            if(isAccepted[0].is_accepted){
                return next(new ApiError(409 , "Invitation already accepted"))
            }
            await connection.query(nativeQueries.acceptNotifications , [userId]);
            await connection.query(nativeQueries.addUserInProject , [JSON.stringify(userId) , projectId]);
            await connection.query(nativeQueries.addUserLevel , [userId , projectId])
            connection.commit;
            connection.release();
            return responseHandler(200, true,  "invitation accepted" ,[{projectId:projectId}],res);
        } catch (error) {
            console.log(error);
            await connection.rollback();
            await connection.release()
            return next(new ApiError(500,"error in while accepting Notification" + error));
        }
    } catch (error){
        console.log(error);
        return next(new ApiError(500,errorMessages.internalServerError));
    }
}

export async function setUserPermission(req,res,next){
    
}
