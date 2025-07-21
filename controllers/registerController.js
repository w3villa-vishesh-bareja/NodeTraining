//this file will include apis for full registeration process and verifications 
import pool, {
    hash,
    genTokenForVerification,
    genToken,
  } from "../config/dbService.js";
import joi from "joi";
import fs from 'fs'
const nativeQueries = JSON.parse(
  fs.readFileSync(new URL('../nativequeries/nativeQueries.json', import.meta.url))
);
const errorMessagesConfig = JSON.parse(
  fs.readFileSync(new URL('../config/errorMessages.json', import.meta.url))
);
const successMessages = JSON.parse(
  fs.readFileSync(new URL('../config/successMessages.json', import.meta.url))
);
import { ApiError } from "../utils/ApiError.js";
import logger from "../logger/index.js";
import ApiResponse from "../utils/ApiResponse.js";
import { registerNewUser, verifyUser , updateToken, insertIntoOtp, updateInOtp, verifyUserNumber, generateImageUrl } from "../handler/registerHandler.js";
import { NEXT_ACTIONS } from "../config/appConstants.js";

const emailSchema = joi.object({
  email: joi.string().email().required(),
});
const passwordSchmea = joi.object({
    password:joi.string().min(6).required(),
})
const phoneSchema = joi.object({
    number: joi.string().min(12).required(),
    unique_id:joi.string().required(),
    otp: joi.string().length(4).pattern(/^\d+$/)
});

const mergedSchema = passwordSchmea.concat(emailSchema);

const nameSchema = joi.object({
    username: joi.string().min(3).pattern(/^[a-zA-Z0-9_@ ]+$/).message({'string.pattern.base': 'Username can only contain letters, numbers, _ and @',}).required(),
    firstname: joi.string().pattern(/^[a-zA-Z0-9_@ ]+$/).min(3).required(),
    lastname: joi.string().pattern(/^[a-zA-Z0-9_@ ]+$/).required(),
    email: joi.string().email().required()
});

export const registerEmail = async(req,res , next)=>{
    const {error} = mergedSchema.validate(req.body);
    if(error){
        logger.warn({ message: "Validation error during registration", validationError: error.message });
        return next(new ApiError(400, errorMessages.validationError, [error.message]));
    }

    const {email, password} = req.body;

    try {
        const hashedPassword = await hash(password);
        //check if user is present in db 
        const [existingUser] = await pool.query(nativeQueries.getUser, [email,null,null]);
        if(existingUser.length > 0 && existingUser[0].email_verified == 1){
            next(new ApiError(409 , true , errorMessages.userExists));
        }
        else if(existingUser.length > 0 && existingUser[0].email_verified == 0){ 
            const connection = await pool.getConnection();
            const token = await genTokenForVerification({email:email , password:hashedPassword})
            res.locals.data = await updateToken(existingUser[0].unique_id, token , existingUser[0].email, connection)
            return next();
        }else if(existingUser.length > 0 && existingUser[0].next_action != NEXT_ACTIONS.EMAIL_VERIFICATION){
            return next(new ApiError(409 , errorMessages.userExists));
        }
        const connection = await pool.getConnection();
        res.locals.data = await registerNewUser(email , hashedPassword ,  connection , next);
        return next();
    } catch (error) {
        console.error(error);
        return next(new ApiError(500 , error.message));
    }
}

export async function emailVerification(req,res,next){
    // const {email} = req.body;
    const {token , password} = req.user;
    const{error} = emailSchema.validate(req.body);
    if(error){
        logger.warn({ message: "Validation error during registration", validationError: error.message });
        return next(new ApiError(400, errorMessages.validationError, [error.message]));
    }
    const { email } = req.body;
    //get info on expiry dates
    const[result] = await pool.query(nativeQueries.getFromVerification , [token]);
    console.log(result);
    const user =result[0];
    console.log(new Date(Date.now()));

    if(result.length > 0){
        if(user.isVerified == 1){
            //if it was verified this shouldnt be called 
            // get the nextAction from the users table to redirect the user to valid step
            const [action] = await pool.query(nativeQueries.getUser,[email , null , null]);
            return next(new ApiError(409,errorMessages.userExists, [{next_action : action[0].next_action,email:email}]))
        }else if(
            user.isVerified == false &&
            new Date(user.expires_at) > new Date(Date.now())
        ){
            const connection = await pool.getConnection();
            res.locals.data = await verifyUser(user.user_id ,email , password, connection );
            next();
        }else if(
        user.isVerified == false &&
        new Date(user.expires_at) < new Date(Date.now())
        ){
            const token = await genTokenForVerification({email:email,  password:password});
            const connection = await pool.getConnection();
            res.locals.data = await updateToken(user.user_id, token, email, connection)
            next();
        }
    }else{
        // return res.status(400).json({messsage:"invalid token"})
        return next(new ApiError(400, "invalid token"))

    }
        
}

// export async function storePassword(req,res,next){
//     const{error} = mergedSchema.validate(req.body);
//     if(error){
//         logger.warn({ message: "Validation error during registration", validationError: error.message });
//         return next(new ApiError(400, errorMessages.validationError, [error.message]));
//     }

//     const{password , unique_id , email} = req.body;
//     if(!unique_id){
//         return next(new ApiError(404,"id is needed for this operation"));
//     }
//     console.log(unique_id)
//     try{
//         const hashedPassword = await hash(password);
//         await pool.query(nativeQueries.insertPassword , [hashedPassword , NEXT_ACTIONS.PHONE_VERIFICATION, String(unique_id)]);
//         // res.locals.data = new ApiResponse(200 , true , "Password Stored");
//         next();
//     }catch(error){
//         return next(new ApiError(500 , "Internal server error" ,[error]))
//     }
// } 

export async function sendOtp(req,res,next){
    const {error} = phoneSchema.validate(req.body);
    const connection = await pool.getConnection();

    if(error){
        logger.warn({ message: "Validation error during registration", validationError: error.message });
        return next(new ApiError(400, errorMessages.validationError, [error.message]));
    }

    const{number , unique_id} = req.body;
    if(!unique_id){
        return next(new ApiError(400 , errorMessages.validationError + "unique_id is required"));
    }

    try{
        let digits = "0123456789";
        let OTP = "";
    
        for (let index = 0; index < 4; index++) {
          OTP += digits[Math.floor(Math.random() * 10)];
        }
        
        const [result] = await connection.query(nativeQueries.getOtpVerificationStatus,[unique_id]);
        
        if(result.length > 0){
            const user = result[0];
            //check if verified
            if(user.isVerified == 1){
                //if it was verified this shouldnt be called 
                const [action] = await pool.query(nativeQueries.getUser,[null, unique_id , null]);
                return next(new ApiError(409,errorMessages.numberExists, [{next_action : action[0].next_action,phone_number:action[0].phone_number}]));

            } else if(user.isVerified == 0){

                // --- RATE LIMITING LOGIC START ---

                const lastSentAt = new Date(user.last_seen_at);
                const now = new Date();
                const timeDiffSeconds = (now.getTime() - lastSentAt.getTime()) / 1000;

                if (timeDiffSeconds < 60) {
                    const waitTime = Math.ceil(60 - timeDiffSeconds);
                    // Return a 429 Too Many Requests error
                    return next(new ApiError(429, `Please wait ${waitTime} more seconds before requesting a new OTP.`));
                }
                // --- RATE LIMITING LOGIC END ---

                console.log(OTP);
                //if status is not verified , update otp and last_seen_at timestamp
                res.locals.data = await updateInOtp(unique_id, OTP , number ,connection, next);
                next();
            }
        } else {
            console.log(OTP);
            //if the user is not in otp_verifications insert in the table
            res.locals.data = await insertIntoOtp(unique_id,number , OTP, connection , next);
            next();
        }
    }catch(error){
        console.log(error);
        return next(new ApiError(500 , errorMessages.internalServerError ,[error]));
    }
}

export async function verifyOtp(req,res,next) {
    const connection = await pool.getConnection();
    const {error} = phoneSchema.validate(req.body);
    if(error){
        logger.warn({ message: "Validation error during registration", validationError: error.message });
        return next(new ApiError(400, errorMessages.validationError, [error.message]));
    }
 
    const {number , otp , unique_id} = req.body;

    if(!otp){
        return next(new ApiError(400 , errorMessages.validationError + "need otp"));
    }

    //search user 
    const [existingUser] = await connection.query(nativeQueries.getUser , [null , unique_id, null]);
    const user = existingUser[0];
    if(existingUser.length>0){
        if(user.register_complete == 1){
            return next(new ApiError(409 , errorMessages.userExists ));
        }
        if(user.next_action != NEXT_ACTIONS.PHONE_VERIFICATION){
            return next(new ApiError(400 ,"User please verify email and set password first before trying to verify phone_number",[{next_action : user.next_action}] ));
        }
        const[expiry] = await connection.query(nativeQueries.getOtpExpiry,[unique_id]);
        const expires_at = expiry[0].expires_at;
        const OTP = expiry[0].otp;
        if(new Date(expires_at)<new Date(Date.now())){
            return next(new ApiError(401 , errorMessages.expiredOtp));
        }
        if(otp != OTP){
            return next(new ApiError(401 , errorMessages.wrongOTP));
        }
        //verify otp
        res.locals.data = await verifyUserNumber(unique_id , number  , connection , next);
        next();

    }else{
        return next(new ApiError(409 , errorMessages.pendingRegistrationSteps));
    }
}

export async function createProfile(req,res,next){
    const {error} = nameSchema.validate(req.body);
    if(error){
        logger.warn({ message: "Validation error during registration", validationError: error.message });
        return next(new ApiError(400, errorMessages.validationError, [error.message]));
    }
    const {username , firstname , lastname, email} = req.body;

    try {
        const [existingUser] = await pool.query(nativeQueries.getUser,[null,null,username]);
        if(existingUser.length >0){
            return next(new ApiError(409 , errorMessages.nameExists));
        }
        const [result]= await pool.query(nativeQueries.insertName ,[username , firstname , lastname, NEXT_ACTIONS.UPLOAD_PROFILE_PHOTO, email])
        console.log(result);
        if(result.affectedRows== 0){
            return next(new ApiError(404) , errorMessages.userNotFound);
        }
        res.locals.data =new ApiResponse(200 , true, successMessages.profileCreated , [{user:{email:email , username:username , firstname:firstname , lastname:lastname , next_action:NEXT_ACTIONS.UPLOAD_PROFILE_PHOTO }}]);
        next();
    } catch (error) {
        console.error(error);
        return next(new ApiError(500 , errorMessages.internalServerError));
    }
}

export async function uploadProfilePhoto(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return next(new ApiError(400, errorMessages.validationError));
      }
  
      let imageUrl;
      imageUrl = await generateImageUrl(req, email , next);
      const [updateResult] = await pool.query(nativeQueries.updateProfileImage, [imageUrl, NEXT_ACTIONS.NONE, email]);
      const token = genTokenForVerification(email)
      res.locals.data = new ApiResponse(200 , true , "Profile uploaded" , [{user:{imageUrl:imageUrl , token:token ,  next_action: NEXT_ACTIONS.NONE}}])
      next() 
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Upload failed', error: err.message });
    }
}
  
    


