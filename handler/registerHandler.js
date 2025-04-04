import  { genTokenForVerification } from "../config/db.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert {type :"json"}
import errorMessages from "../config/errorMessages.json" assert {type:"json"}
import mailer from "../utils/mailHandler.js";
import { NEXT_ACTIONS } from "../config/appConstants.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
// import { date } from "joi";



export async function registerNewUser( email , connection){
    try {
        await connection.beginTransaction();
        //queries
        await connection.query(nativeQueries.insertNewUser,[email ,NEXT_ACTIONS.EMAIL_VERIFICATION]);
        const [newUser] = await connection.query(nativeQueries.getUser , [email]);
        const token = await genTokenForVerification(email)
        await connection.query(nativeQueries.InsertIntoEmailVerification , [newUser[0].id , token])
        await mailer(email , token);
        await connection.commit();
        await connection.release();
        return new ApiResponse(201 , true, successMessages.emailSent , [{email: email}] )
    } catch (error) {
        await connection.rollback();
        await connection.release();
        console.error(error)
        return next(new ApiError(500));
    }
}

export async function verifyUser(user_id,email,connection){
    try {
        console.log(new Date(Date.now()));
        await connection.beginTransaction();
        await connection.query(nativeQueries.updateVerified , [true,user_id])
        //mark email_verified in users table as true and mark next_action as set Password
        await connection.query(nativeQueries.verifyUserEmail,[true , NEXT_ACTIONS.SET_PASSWORD , user_id ]) 
        await connection.commit();
        await connection.release();
        return new ApiResponse( 200 , true, successMessages.emailVerified , [{email: email}] )

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
      console.log(id);
      //   const token = await genTokenForVerification(email);
      console.log(verificationToken);
      await connection.query(nativeQueries.updateToken, [verificationToken, id]);
      await mailer(email, verificationToken);
      await connection.commit();
      await connection.release();
      return next(new ApiError( 410 , errorMessages.expiredLink ))
    } catch (err) {
        await connection.rollback();
        await connection.release();
        console.error(err)
        return new ApiError(500);
    }
  }

