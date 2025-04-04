//this file will include apis for full registeration process and verifications 

import pool, {
    hash,
    compare,
    genToken,
    genTokenForVerification,
  } from "../config/db.js";
  import joi from "joi";
  import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
  import errorMessages from "../config/errorMessages.json" assert { type: "json" };
  import successMessages from "../config/successMessages.json" assert { type: "json" };
  import {
    decideEmailOperation,
    decideOtpOperation,
    insertIntoEmailVerification,
  } from "../handler/userHandler.js";
  import twilio from "twilio";
  import { ApiError } from "../utils/ApiError.js";
  import logger from "../logger/index.js";
import ApiResponse from "../utils/ApiResponse.js";
import { registerNewUser, verifyUser , updateToken } from "../handler/registerHandler.js";
import { verifyEmail } from "./userController.js";
import { NEXT_ACTIONS } from "../config/appConstants.js";


// const emailSchema = joi.object({
//     name: joi.string().min(3).required(),
//     email: joi.string().email().required(),
//     password: joi.string().min(6).required(),
//     phoneNumber: joi.string().required(),
//     verificationMethod: joi.string().required(),
//   });

const emailSchema = joi.object({
  email: joi.string().email().required(),
});
const passwordSchmea = joi.object({
    password:joi.string().min(6).required(),
    unique_id:joi.string().required(),
})
const phoneSchema = joi.object({
    phoneNumber: joi.string().required(),
    unique_id:joi.string().required(),
})

export const registerEmail = async(req,res , next)=>{
    const {error} = emailSchema.validate(req.body);
    if(error){
        logger.warn({ message: "Validation error during registration", validationError: error.message });
        return next(new ApiError(400, errorMessages.validationError, [error.message]));
    }

    const {email} = req.body;

    try {
        //check if user is present in db 
        const [existingUser] = await pool.query(nativeQueries.getUser, [email]);
        const user =  existingUser[0];
        if(existingUser.length > 0){ 
            //check if "register_complete is false or true"
            if(user.register_complete == 1){
                //if true
                logger.warn({ message: "Registration failed: User already exists", email });
                return next(new ApiError(409 ,errorMessages.userExists ,[{id:user.unique_id}]))
            }else if (user.register_complete == 0){
                //if registeration is incomplete return next_action to frontend
                if(user.next_action == NEXT_ACTIONS.EMAIL_VERIFICATION){
                    const connection = await pool.getConnection();
                    const token = await genTokenForVerification(user.email)
                    res.locals.registerData = updateToken(user.user_id, token, user.email, connection)
                }
                res.locals.registerData = new ApiResponse (200, true ,"User exists Check for next_action" , [{next_action:user.next_action , user: {email:email,id:user.unique_id}} ]);
                next()
            }
        }else{
            //enter email into the users table , set next_action to "EMAIL_VERIFICATION"
            const connection = await pool.getConnection();
             res.locals.registerData = await registerNewUser(email , connection);
            return next();
        }
    } catch (error) {
        console.error(error);
        return next()
    }
}

export async function emailVerification(req,res,next){
    const {email , token} = req.user;

    //get info on expiry dates
    const[result] = await pool.query(nativeQueries.getFromVerification , [token]);
    console.log(result);
    const user =result[0];
    console.log(new Date(Date.now()));

    if(result.length > 0){
        if(user.isVerified ==1){
            //if it was verified this shouldnt be called 
            const [action] = await pool.query(nativeQueries.getUser,[email]);
            return next(new ApiError(409,"this email already exists", [{next_action : action[0].next_action,email:email}]))
        }else if(
            user.isVerified == 0 &&
            new Date(user.expires_at) > new Date(Date.now())
        ){
            const connection = await pool.getConnection();
            res.locals.registerData = await verifyUser(user.user_id ,email , connection );
            next();
        }else if(
        user.isVerified == false &&
        new Date(user.expires_at) < new Date(Date.now())
        ){
            const token = await genTokenForVerification(email);
            const connection = await pool.getConnection();
            res.locals.registerData = updateToken(user.user_id, token, email, connection)
        }
    }else{
        return res.status(400).json({messsage:"invalid token"})
    }
        
}

export async function storePassword(req,res,next){
    const{error} = passwordSchmea.validate(req.body);
    if(error){
        logger.warn({ message: "Validation error during registration", validationError: error.message });
        return next(new ApiError(400, errorMessages.validationError, [error.message]));
    }

    const{password , unique_id} = req.body;
    if(!unique_id){
        return next(new ApiError(404,"id is needed for this operation"));
    }
    console.log(unique_id)
    try{
        const hashedPassword = await hash(password);
        await pool.query(nativeQueries.insertPassword , [hashedPassword , NEXT_ACTIONS.PHONE_VERIFICATION, String(unique_id)]);
        res.locals.registerData = new ApiResponse(200 , true , "Password Stored");
        next();
    }catch(error){
        return next(new ApiError(500 , "Internal server error" ,[error]))
    }
} 

export async function sendOtp(req,res,next){
    const {error} = phoneSchema.validate(req.body);
    if(error){
        logger.warn({ message: "Validation error during registration", validationError: error.message });
        return next(new ApiError(400, errorMessages.validationError, [error.message]));
    }

    const{number , unique_id} = req.body

    try{
        let digits = "0123456789";
        let OTP = "";
    
        for (let index = 0; index < 4; index++) {
          OTP += digits[Math.floor(Math.random() * 10)];
        }

    }catch(error){
        
    }

}