import pool, { genTokenForVerification } from "../config/dbService.js";
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
import mailer from "../utils/mailHandler.js";

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
    
  } catch (err) {
    await connection.rollback();
    console.log(err);
    throw new Error("error in updation", err);
  }
}

export async function insertIntoEmailVerification(
  id,
  token,
  email,
  connection
) {
  try {
    await connection.beginTransaction();
    await connection.query(nativeQueries.InsertIntoEmailVerification, [
      id,
      token,
    ]);
    await mailer(email, token);
    await connection.commit();
    await connection.release();
  } catch (err) {
    await connection.rollback();
    await connection.release();
    console.log(err);
    throw new Error("error in inserting into verification", err);
  }
}

export const decideOtpOperation = async (
  phoneNumber,
  name = null,
  email = null,
  hashedPassword = null
) => {
  try {
    const [numberResult] = await pool.query(
      nativeQueries.getSoftUserWithNumber,
      [phoneNumber]
    );
    console.log(numberResult[0]);
    if (numberResult.length > 0) {
      const [isVerifiedResult] = await pool.query(
        nativeQueries.checkVerificationStatus,
        [phoneNumber]
      );
      console.log(isVerifiedResult);
      //if the user is found in soft_register but is not in otp , it means they started verification with email but did not complete it
      // so and trigger /send otp
      if (!isVerifiedResult.length > 0) {
        //insert in otp
        console.log("inserted");
        return {
          id: numberResult[0].id,
          number: numberResult[0].phone_number,
          Action: "INSERT",
        };
      }
      if ((isVerifiedResult[0].isVerifiereq, resd == 0)) {
        return { number: numberResult[0].phone_number, Action: "UPDATE" };
      }
    } else {
      await pool.query(nativeQueries.insertIntoSoftRegister, [
        name,
        email,
        phoneNumber,
        hashedPassword,
      ]);
      const [numberResult] = await pool.query(
        nativeQueries.getSoftUserWithNumber,
        [phoneNumber]
      );
      return {
        id: numberResult[0].id,
        number: numberResult[0].phone_number,
        Action: "INSERT",
      };
    }
  } catch (err) {
    console.error(err);
  }
};

export const decideEmailOperation = async (
  name = null,
  email,
  phoneNumber = null,
  hashedPassword = null
) => {
  try {
    const [emailResult] = await pool.query(nativeQueries.getSoftUserWithEMail, [
      email,
    ]);
    if (emailResult.length > 0) {
      const [isVerifiedResult] = await pool.query(
        nativeQueries.checkVerificationStatusForEmail,
        [email]
      );
      if (!isVerifiedResult.length > 0) {
        const token = await genTokenForVerification(email);
        return { id: emailResult[0].id, token: token, Action: "INSERT" };
      }
      console.log(isVerifiedResult[0]);
      if (isVerifiedResult[0].isVerified == 0) {
        if (new Date(isVerifiedResult[0].expires_at) > new Date(Date.now())) {
          return res.status(409).json({
            message: "Please Verify the email by clicking the link in the mail",
          });
        }
        if (new Date(isVerifiedResult[0].expires_at) < new Date(Date.now())) {
          const connection = await pool.getConnection();
          // await updateToken(isVerifiedResult[0].id, isVerifiedResult[0].email, connection);
          const token = await genTokenForVerification(email);
          return { id: emailResult[0].id, token: token, Action: "UPDATE" };
        }
      }
    } else {
      await pool.query(nativeQueries.insertIntoSoftRegister, [
        name,
        email,
        phoneNumber,
        hashedPassword,
      ]);
      const [emailResult] = await pool.query(
        nativeQueries.getSoftUserWithEMail,
        [email]
      );
      const token = await genTokenForVerification(email);
      return { id: emailResult[0].id, token: token, Action: "INSERT" };
    }
  } catch (error) {
    console.error(error);
  }
};
