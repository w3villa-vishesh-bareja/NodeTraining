import pool from "../config/db.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from '../config/errorMessages.json' assert {type:'json'}
import {hash, generateRandomString} from '../config/db.js'


export async function findOrCreateUser(profile) {
  try {
    let result;
     [result] = await pool.query(nativeQueries.getUser, [
      profile.emails[0].value,
    ]);
    let user;

    if (result.length === 0) {
      try{
        const randomPassword = generateRandomString();
        const hashedPassword = await hash(randomPassword);  
        console.log(hashedPassword)

        //creating user with isSocial = 1
        console.log("creating user")
        await pool.query(
          nativeQueries.createUserWithSocial,
          [profile.displayName, profile.emails[0].value,hashedPassword,1]
        );
        console.log("getting user")
        //Fetching the same user for furthur use
        result = await pool.query(nativeQueries.getUser, [
          profile.emails[0].value,
        ]);
        console.log("adding user to social")
        await pool.query(nativeQueries.addSocialUser , [result[0].id , 'Google' , profile.id]);
      }catch(err){
        console.error(err.message)
      }
    }
    user = result[0];
    console.log("result is:",user)
    return user;
  } catch (err) {
    console.error(errorMessages.GoogleLoginError , err.message);
    throw err;
  }

}




