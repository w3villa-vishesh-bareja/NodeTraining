import pool from "../config/dbService.js";
import { ApiError } from "../utils/ApiError.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert { type: "json" };
import responseHandler from "../handler/responseHandler.js";
import { createProjectSchema } from "../validators/project.validator.js";


export async function createProject(req,res,next){
  //  required -  projectId , type , userId
  //  optionoal - deadline (required if type is collaborative)
  //  auto-set - status - ongoing , created_at 
  //  to-set - owner , type - simple

  const {error} = createProjectSchema.validate(req.body);
  if(error){
    return next(new ApiError(400,errorMessages.validationError));
  }

  const {type , userId , name } = req.body;
  let {deadline , description} = req.body
  if(!deadline) deadline = null
  if(!description) description = null
  let connection = await pool.getConnection();
  try {
    //insert
    const result = await connection.query(nativeQueries.createProject , [name, type, userId, description, deadline]);
    if(type == "collaborative"){
     await connection.query(nativeQueries.insertInProjectMember ,[result[0].insertId , userId, "owner"])
    }
    const [createdProject] = await connection.query("SELECT * FROM projects WHERE id=?",[result[0].insertId])
    connection.commit();
    connection.release();
    return responseHandler(201 , true , "porject created",[],res);
  } catch (error) {
    console.log(error);
    connection.rollback();
    connection.release();
    return next(new ApiError(500,errorMessages.internalServerError))
  }
  
}
//fetch all projects
export async function getAllProjects(req,res,next){
    const {userId}= req.body;
    //get the list of projects user is part of 
    try {
        const [projects] = await pool.query(nativeQueries.getProjects,[userId]);
        return responseHandler(200 , true , "projects fetched" , [projects] , res)
    } catch (error) {
        console.log(error);
        return next(new ApiError(500 , errorMessages.internalServerError + error))
    }
}