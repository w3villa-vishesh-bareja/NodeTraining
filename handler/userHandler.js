import pool, { genTokenForVerification } from "../config/db.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import mailer from "../utils/mailHandler.js";

export async function updateToken(id, email , connection) {
    try {
      connection.beginTransaction();

      const token = await genTokenForVerification(email);
      console.log(token);
      await connection.query(nativeQueries.updateToken, [token, id , Date.now()]);
      await mailer(email, token);

      await connection.commit();
      connection.release();

    } catch (err) {
      await connection.rollback();
      console.log(err)
      throw new Error("error in updation",err);
    }
  
}

export async function insertIntoVerification(name,email,password){
    try{
        const connection = await pool.getConnection();
        try{
            connection.beginTransaction();
            
            const token = await genTokenForVerification(email);
            await pool.query(nativeQueries.EmailVerification , [name,email,password,token]);
            await mailer(email,token)

            connection.commit();
            connection.release();
        }catch(err){
            connection.rollback();
            connection.release();
            throw new Error("error in inserting into verification",err.message);
            
        }

    }catch(err){
        throw new Error("error in creating connection insert",err.message)
    }
} 
