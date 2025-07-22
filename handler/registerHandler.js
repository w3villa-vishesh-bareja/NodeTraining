import  pool, { genTokenForVerification } from "../config/dbService.js";
import fs from 'fs'
const nativeQueries = JSON.parse(
  fs.readFileSync(new URL('../nativequeries/nativeQueries.json', import.meta.url))
);
const errorMessages = JSON.parse(
  fs.readFileSync(new URL('../config/errorMessages.json', import.meta.url))
);
const successMessages = JSON.parse(
  fs.readFileSync(new URL('../config/successMessages.json', import.meta.url))
);
import mailer from "../utils/mailHandler.js";
import { NEXT_ACTIONS } from "../config/appConstants.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import twilio from "twilio";
import cloudinary from "../config/cloudinaryConfig.js";

const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

export async function registerNewUser( email , hashedPassword, connection , next){
    try {
        await connection.beginTransaction();
        //queries
        await connection.query(nativeQueries.insertNewUser,[email ,NEXT_ACTIONS.EMAIL_VERIFICATION]);
        const [newUser] = await connection.query(nativeQueries.getUser , [email,null ,null]);
        const token = await genTokenForVerification({email:email , password:hashedPassword})
        await connection.query(nativeQueries.InsertIntoEmailVerification , [newUser[0].unique_id , token])
        await mailer(email , token);
        await connection.commit();
        await connection.release();
        return new ApiResponse(201 , true, successMessages.emailSent , [{user:{email: email , unique_id : newUser[0].unique_id} , next_action:NEXT_ACTIONS.EMAIL_VERIFICATION}] )
    } catch (error) {
        await connection.rollback();
        await connection.release();
        console.error(error);
        return next(new ApiError(500));
    }
}
export async function verifyUser(user_id,email,password,connection){
    try {
        console.log(new Date(Date.now()));
        await connection.beginTransaction();
        await connection.query(nativeQueries.updateVerified , [true,user_id])
        //mark email_verified in users table as true and mark next_action as set Password
        await connection.query(nativeQueries.verifyUserEmail,[true , NEXT_ACTIONS.PHONE_VERIFICATION ,password , user_id ]) 
        await connection.query(nativeQueries.insertPassword,[password , user_id])
        await connection.commit();
        await connection.release();
        return new ApiResponse( 201 , true, successMessages.emailVerified , [{user:{email: email , unique_id:user_id}, next_action:NEXT_ACTIONS.PHONE_VERIFICATION}] )

    } catch (error) {
        await connection.rollback();
        await connection.release();
        console.error(error)
        return new ApiError(500);
    }
}
export async function updateToken(id, verificationToken, email, connection) {
    try {
      connection.beginTransaction();
      console.log(id , email);
      //   const token = await genTokenForVerification(email);
      console.log(verificationToken);
      await connection.query(nativeQueries.updateToken, [verificationToken, id]);
      await mailer(email, verificationToken);
      await connection.commit();
      await connection.release();
      return new ApiResponse( 200 , true , successMessages.emailSent , [{user:{email:email , unique_id : id , token : verificationToken} , next_action:NEXT_ACTIONS.EMAIL_VERIFICATION , redirect_url:"https://node-frontend-test.vercel.app//verifyEmail"}] )
    } catch (err) {
        await connection.rollback();
        await connection.release();
        console.error(err)
        return new ApiError(500);
    }
  }

export async function insertIntoOtp(uuid , number , otp , connection ,next){
    try{
        await connection.beginTransaction();
        await connection.query(nativeQueries.insertInOtp,[uuid , number , otp]);
// await client.messages
    //     .create({
    //       body: `Verification OTP for (This is a test) ${otp}`,
    //       from: process.env.TWILIO_PHONE_NUMBER,
    //       to: number,
    //     })
    //     .then(async () => {
    //       await connection.commit();
    //       await connection.release();
    //       return new ApiResponse(200 , true , successMessages.otpSent ,[{phone_number : number , unique_id: uuid}]);
    //    })
    //     .catch(async (error) => {
    //       console.error("Error sending message:", error);
    //       // res.status(500).json({ error: error.message });
    //       await connection.rollback();
    //       await connection.release();
    //       return next(new ApiError(500 , errorMessages.internalServerError , [error]));
  
    //     });
    await connection.commit();
    await connection.release();

    return new ApiResponse(200 , true ,successMessages.otpSent , [{user:{phone_number: number , unique_id:uuid} , next_action:NEXT_ACTIONS.PHONE_VERIFICATION}]);
    }catch(error){
        await connection.rollback();
        await connection.release();
        return next(new ApiError(500 , errorMessages.internalServerError , [{error:error}]));

    }
}

export async function updateInOtp(uuid ,otp , number , connection , next ) {
    try {
        await connection.beginTransaction();
        await connection.query(nativeQueries.updateOtp,[otp , number, uuid]);
        // await client.messages
        // .create({
        //   body: `Verification OTP for (This is a test) ${otp}`,
        //   from: process.env.TWILIO_PHONE_NUMBER,
        //   to: number,
        // })
        // .then(async () => {
        //   await connection.commit();
        //   await connection.release();
        // })
        // .catch(async (error) => {
        //   console.error("Error sending message:", error);
        //   // res.status(500).json({ error: error.message });
        //   await connection.rollback();
        //   await connection.release();
        //   return next(new ApiError(500 , errorMessages.internalServerError , [error]));
        // });
        await connection.commit();
        await connection.release();
        return new ApiResponse(200 ,true , successMessages.otpSent , [{user:{phone_number: number , unique_id:uuid} , next_action:NEXT_ACTIONS.PHONE_VERIFICATION}]);
    } catch (error) {
        await connection.rollback();
        await connection.release();
        return next(new ApiError(500 , errorMessages.internalServerError , [error]));
    }
}

export async function verifyUserNumber(uuid , number, connection , next){
    try {
        await connection.beginTransaction();
        await connection.query(nativeQueries.verifyUserOtp , [true , uuid]);
        await connection.query(nativeQueries.otpVerified , [true , NEXT_ACTIONS.CREATE_PROFILE , number , uuid]);
        await connection.commit();
        await connection.release();
        return new ApiResponse(200 , true , successMessages.otpVerified ,[{phone_number:number , unique_id : uuid , next_action:NEXT_ACTIONS.CREATE_PROFILE}])
    } catch (error) {
        await connection.rollback();
        await connection.release();
        console.error(error)
        return next(new ApiError(500));
    }
}

export async function generateImageUrl(req,email,next) {
   try {
    let imageUrl
    if (req.files && req.files.profilePhoto) {
        const file = req.files.profilePhoto;
        const result = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: 'profile_photos',
        });
         imageUrl = result.secure_url;
        return imageUrl
      } else {
        const [result] = await pool.query(nativeQueries.getProfile,[null , email]);
        const name = `${result[0].firstname} + ${result[0].lastname}`;
        console.log(name)
        imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
        return imageUrl;
    }
   } catch (error) {
        console.log(error)
        next(new ApiError(500, error.message));
   } 

}