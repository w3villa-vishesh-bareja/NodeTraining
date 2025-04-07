import  { genTokenForVerification } from "../config/db.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert {type :"json"}
import errorMessages from "../config/errorMessages.json" assert {type:"json"}
import mailer from "../utils/mailHandler.js";
import { NEXT_ACTIONS } from "../config/appConstants.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import twilio from "twilio";

// import { date } from "joi";


const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

export async function registerNewUser( email , connection , next){
    try {
        await connection.beginTransaction();
        //queries
        await connection.query(nativeQueries.insertNewUser,[email ,NEXT_ACTIONS.EMAIL_VERIFICATION]);
        const [newUser] = await connection.query(nativeQueries.getUser , [email,null ,null]);
        const token = await genTokenForVerification(email)
        await connection.query(nativeQueries.InsertIntoEmailVerification , [newUser[0].unique_id , token])
        await mailer(email , token);
        await connection.commit();
        await connection.release();
        return new ApiResponse(201 , true, "email sent , please verify the email and then the password" , [{user:{email: email , unique_id : newUser[0].unique_id}}] )
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
        return new ApiResponse( 200 , true, successMessages.emailVerified , [{user:{email: email , unique_id:user_id}, next_action:NEXT_ACTIONS.PHONE_VERIFICATION}] )

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
      return new ApiResponse( 200 , true , successMessages.emailSent , [{user:{email:email , unique_id : id , token : verificationToken}}] )
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
        await client.messages
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
    return new ApiResponse(200 , successMessages.otpSent , [{user:{phone_number: number , unique_id:uuid}}]);
    }catch(error){
        await connection.rollback();
        await connection.release();
        return next(new ApiError(500 , errorMessages.internalServerError , [{error:error}]));

    }
}

export async function updateInOtp(uuid ,otp , number , connection , next ) {
    try {
        await connection.beginTransaction();
        await connection.query(nativeQueries.updateOtp,[otp , uuid]);
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
        return new ApiResponse(200 , successMessages.otpSent , [{user:{phone_number: number , unique_id:uuid}}]);
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
        return new ApiResponse(200 , successMessages.otpVerified ,[{phone_number:number , unique_id : uuid , next_action:NEXT_ACTIONS.CREATE_PROFILE}])
    } catch (error) {
        await connection.rollback();
        await connection.release();
        console.error(error)
        return next(new ApiError(500));
    }
}