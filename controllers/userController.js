//old flow

import pool, {
  hash,
  compare,
  genToken,
  genTokenForVerification,
} from "../config/dbService.js";
import joi from "joi";
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
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import cloudinary from "../config/cloudinaryConfig.js";
import mailer from "../utils/mailHandler.js";

// import logger from "../logger/index.js";
// // const logger = bunyan.createLogger({ name: "authService" });

// const userSchema = joi.object({
//   name: joi.string().min(3).required(),
//   email: joi.string().email().required(),
//   password: joi.string().min(6).required(),
//   phoneNumber: joi.string().required(),
//   verificationMethod: joi.string().required(),
// });

// const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

// export const register = async (req, res, next) => {
//   const { error } = userSchema.validate(req.body);
//   if (error) {
//     logger.warn({ message: "Validation error during registration", validationError: error.message });
//     return next(new ApiError(400, errorMessages.validationError, [error.message]));
//   }

//   const { name, email, password, phoneNumber, verificationMethod } = req.body;

//   try {
//     const [result] = await pool.query(nativeQueries.getUser, [email]);
//     if (result.length > 0) {
//       logger.warn({ message: "Registration failed: User already exists", email });
//       return next(new ApiError(409, errorMessages.userExists));
//     }

//     const hashedPassword = await hash(password);

//     if (verificationMethod === "OTP") {
//       const typeOfOperation = await decideOtpOperation(phoneNumber, name, email, hashedPassword);
//       logger.info({ message: "OTP verification initiated for user registration", email, phoneNumber });
//       return res.status(307).json({ data: typeOfOperation });
//     }

//     if (verificationMethod === "EMAIL") {
//       const typeOfOperation = await decideEmailOperation(name, email, phoneNumber, hashedPassword);
//       logger.info({ message: "Email verification initiated for user registration", email });
//       return res.status(307).json({ data: typeOfOperation });
//     }

//     logger.info({ message: "User successfully registered without verification", email });
//     return res.status(201).json({ message: successMessages.userRegistered });

//   } catch (error) {
//     logger.error({ message: "Registration failed due to an internal error", error: error.message, stack: error.stack });
//     return next(new ApiError(500, errorMessages.internalServerError, [error.message]));
//   }
// };



export const login = async (req, res , next ) => {

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: errorMessages.missingFields });
  }

  try {
    const [users] = await pool.query(nativeQueries.getUser, [email , null , null]);
  
    if (users.length === 0) {
      return next(new ApiError(401,errorMessages.invalidCredentials))
    }
    if(users[0].email_verified == 0){
      return next(new ApiError(401,errorMessages.userNotFound));
    }
    
    if(users[0].register_complete == 0){
      const user = users[0];
      const isValid = await compare(password, user.password);
  
      if (!isValid) {
        return next(new ApiError(401,errorMessages.invalidCredentials))
      }
      const token = await genToken(user.unique_id, user.name, user.email);
      res.locals.data = new ApiResponse(200 , true , successMessages.loginSuccessful + "Additional Steps are required" , [{user:{email ,unique_id:users[0].unique_id ,next_action:users[0].next_action , token:token }}]);
      return next();
    }

    const user = users[0];
    const isValid = await compare(password, user.password);

    if (!isValid) {
      return next(new ApiError(401,errorMessages.invalidCredentials))
    }
    const token = await genToken(user.unique_id, user.name, user.email);
    res.cookie("token", token);
  
    res.locals.data = new ApiResponse(
      200,
      true,
      successMessages.loginSuccessful,
      [
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            next_action: users[0].next_action,
            unique_id: users[0].unique_id,
            isAdmin: user.isAdmin
          },
          token: token,
        },
      ]
    );
    next();
  } catch (error) {
    console.error(`${errorMessages.loginFailed}`, error.message);
    return next(new ApiError(500 , errorMessages.internalServerError , [error]));
  }
};

export async function getProfile(req,res ,next) {
  const { id } = req.user;
  try{
  const[user] = await pool.query(nativeQueries.getProfile,[id,null]);
  if(user.length <= 0){
    return next(new ApiError(404 , errorMessages.userNotFound));
  }
  const profile = user[0];
  res.locals.data = new ApiResponse(200 , true , "user found" , [profile]);
  next();
  }catch(error){
    console.error(error);
    return next(new ApiError(500));
  }
}

export async function updateProfile(req, res, next) {
  const { id } = req.user;
  const updateFields = req.body;

  const allowedFields = ['name', 'firstname', 'lastname'];

  const filteredFields = Object.entries(updateFields).filter(([key]) =>
    allowedFields.includes(key)
  );

  if (req.files && req.files.profile_image) {
    const file = req.files.profile_image;

    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'profile_photos',
    });

  let imageUrl = result.secure_url;

    // Add to fields being updated
    filteredFields.push(['profile_image_url', `/${imageUrl}`]);
  }

  if (filteredFields.length === 0) {
    return next(new ApiError(400, errorMessages.noFieldsToUpdate));
  }

  try {
    const setClauses = [];
    const values = [];

    for (const [key, value] of filteredFields) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    values.push(id); 

    const query = `UPDATE users SET ${setClauses.join(", ")} WHERE unique_id = ?`;
    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return next(new ApiError(404, errorMessages.userNotFound));
    }

    const [updatedUserRows] = await pool.query(nativeQueries.getProfile, [id , null]);
    const updatedUser = updatedUserRows[0];

    res.locals.data = new ApiResponse(200, true, successMessages.profileUpdated, [updatedUser]);
    next();
  } catch (error) {
    console.error(error);
    return next(new ApiError(500, "Error updating profile"));
  }
}

const emailSchema = joi.object({
  email: joi.string().email().required(),
})


export async function forgotPassword(req,res,next){

  const {error} = emailSchema.validate(req.body);
  if (error) {
    return next(new ApiError(400, errorMessages.validationError, [error.message]));
  }

  const [result] = await pool.query(nativeQueries.getProfile,[null,email]);
  if(result.length <=0){
    return next(new ApiError(404 , errorMessages.userNotFound))
  }

  const user = result[0];
  const token = await genTokenForVerification(email , '5m');
  await mailer(email , token);
  res.locals.data = new ApiResponse(200 , true , successMessages.passwordEmailed ,[{user:{email}}])
  next();
}

export async function getUser(req,res,next){
  let {email , unique_id} = req.user;
  if(!email && !unique_id){
    return next(new ApiError(400 , errorMessages.BadRquest));
  }
  if(!email) email = null 
  if(!unique_id) unique_id = null
  
  const [result] = await pool.query(nativeQueries.getProfile , [unique_id,email]);
  if(!result.length>0){
    return next(new ApiError(400 , errorMessages.userNotFound));
  }
  const user = result[0];
  res.locals.data  = new ApiResponse(200 , true , successMessages.userFound , [{user:user}])
  return next();
}
export async function editProfile(req, res, next) {
  const { id } = req.user;
  const updateFields = req.body;

  const allowedFields = ['name', 'firstname', 'lastname', 'phone_number'];

  const filteredFields = Object.entries(updateFields).filter(([key]) =>
    allowedFields.includes(key)
  );

  if (filteredFields.length === 0) {
    return next(new ApiError(400, errorMessages.noFieldsToUpdate));
  }

  try {
    const setClauses = [];
    const values = [];

    for (const [key, value] of filteredFields) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    values.push(id);

    const query = `UPDATE users SET ${setClauses.join(', ')} WHERE unique_id = ?`;
    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return next(new ApiError(404, errorMessages.userNotFound));
    }

    const [updatedUserRows] = await pool.query(nativeQueries.getProfile, [id, null]);
    const updatedUser = updatedUserRows[0];
    
    res.status(200).send({
      success: true,
      message: "Profile updated",
      data: [updatedUser]
  });    
  } catch (error) {
    console.error("Error editing profile:", error);
    return next(new ApiError(500, "Error editing profile"));
  }
}

// export const sendEmail = async (req, res) => {
//   const connection = await pool.getConnection();
//   const { id, Action } = req.body;
//   const { email, token } = req.user;
//   const verificationToken = token;

//   if (!Action || !["INSERT", "UPDATE"].includes(Action)) {
//     // return res
//     //   .status(400)
//     //   .json({
//     //     message: 'Invalid action. Must be either "INSERT" or "UPDATE".',
//     //   });
//     return next(new ApiError(400,errorMessages.invalidAction))
//   }

//   if (!id && !verificationToken) {
//     // return res
//     //   .status(404)
//     //   .json({ message: "Id and verification token is needed" });
//     return next(new ApiError(404 , errorMessages.missingFields + "Id or verificationToken"))
//   }

//   try {
//     if (Action == "INSERT") {
//       insertIntoEmailVerification(id, verificationToken, email, connection);
//       return res.status(200).json({ message: "email sent" });
//     }
//     if (Action == "UPDATE") {
//       updateToken(id, verificationToken, email, connection);
//       return res.status(200).json({ message: "email sent" });
//     }
//   } catch (error) {
//     console.error(err);
//     return next(new ApiError(500 , errorMessages.internalServerError , [error]));

//   }
// };
// export const verifyEmail = async (req, res) => {
//   const { email, token } = req.user;
//   const verificationToken = token;
//   const { registrationSource } = req.body;

//   if (!registrationSource) {
//     // return res
//     //   .status(400)
//     //   .json({ message: "Registeration source is required" });

//     return next(new ApiError(400,errorMessages.registerationSourceMissing));
//   }
//   if (registrationSource != "REGISTER" && registrationSource != "EXISTING") {
//     // return res.status(400).json({ message: "invalid registeration source" });
//     return next(new ApiError(400, errorMessages.invalidRegistrationSource));
//   }

//   const connection = await pool.getConnection();
//   try {
//     console.log(verificationToken);
//     //fetch expiri date , isVerified from db using token
//     const [result] = await pool.query(nativeQueries.checkFromVerification, [
//       verificationToken,
//     ]);
//     console.log(result);
//     const user = result[0];
//     if (user.isVerified == 1) {
//       // await connection.query(nativeQueries.deleteFromSoftRegister,[null,email]);
//       // return res.status(409).json({ message: errorMessages.userExists }); // if isVerified is true user must be present in users table
//       next(new ApiError(409,errorMessages.userExists))
//     } else if (
//       user.isVerified == 0 &&
//       new Date(user.expires_at) > new Date(Date.now())
//     ) {
//       await connection.beginTransaction();
//       if (registrationSource == "REGISTER") {
//         await connection.query(nativeQueries.createUser, [
//           user.name,
//           user.email,
//           user.password,
//           user.phone_number,
//           "EMAIL",
//         ]);
//         await connection.query(nativeQueries.updateVerified, [
//           true,
//           user.soft_registration_id,
//         ]);
//       } else if (registrationSource == "EXISTING") {
//         await connection.query(nativeQueries.updateUserEmail, [email]); // update user name adds the email verification status in user table
//         await connection.query(nativeQueries.updateVerified, [
//           true,
//           user.soft_registration_id,
//         ]);
//         const [userStatus] = await connection.query(
//           nativeQueries.getVerifiedMethods,
//           [email, phone_number]
//         );
//         if (
//           userStatus.length > 0 &&
//           userStatus[0].verified_methods.includes("EMAIL") &&
//           userStatus[0].verified_methods.includes("OTP")
//         ) {
//           await connection.query(nativeQueries.deleteFromSoftRegister, [
//             null,
//             email,
//           ]);
//         }
//       }
//       await connection.commit();
//       await connection.release();
//       return res.status(200).json({ message: "email verified" });
//     } else if (
//       user.isVerified == false &&
//       new Date(user.expires_at) < new Date(Date.now())
//     ) {
//       console.log(new Date(user.expires_at), new Date(Date.now()));
//       const token = await genTokenForVerification(email);
//       await updateToken(
//         user.soft_registration_id,
//         token,
//         user.email,
//         connection
//       );
//       return res.status(200).json({
//         message: "New Verification email has been sent please verify.",
//       });
//     }
//   } catch (err) {
//     await connection.rollback();
//     await connection.release();
//     console.error(err);
//     // return res
//     //   .status(500)
//     //   .send({ message: errorMessages.internalServerError, Error: err.message });
//     return next(new ApiError(500 , errorMessages.internalServerError , [error]));

//   }
// };

// export const sendOTP = async (req, res) => {
//   const connection = await pool.getConnection();
//   await connection.beginTransaction();

//   const { id, number, registrationSource } = req.body;
//   let { Action } = req.body;

//   if (!registrationSource) {
//     // return res
//     //   .status(400)
//     //   .json({ errorMessages: "please provide a registrationSource" });
//     next(new ApiError(400, errorMessages.registerationSourceMissing))
//   }
//   if (registrationSource == "REGISTER" && !Action) {
//     // return res.status(400).json({ errorMessages: "please provide a Action" });
//     next(new ApiError(400, errorMessages.actionMissing))

//   }
//   if (!number) {
//     // return res.status(400).json({ errorMessages: "please provide a number" });

//     next(new ApiError(400,errorMessages.missingFields + "phone number"))
//   }
//   try {
//     let digits = "0123456789";
//     let OTP = "";

//     for (let index = 0; index < 4; index++) {
//       OTP += digits[Math.floor(Math.random() * 10)];
//     }

//     if (registrationSource === "EXISTING") {
//       const typeOfOperation = await decideOtpOperation(number);
//       Action = typeOfOperation.Action;
//     }

//     if (Action == "INSERT") {
//       await connection.query(nativeQueries.insertInOtp, [id, number, OTP]);
//     }
//     if (Action == "UPDATE") {
//       await connection.query(nativeQueries.updateOtp, [OTP, number]);
//     }
//     await client.messages
//       .create({
//         body: `Verification OTP for (This is a test) ${OTP}`,
//         from: process.env.TWILIO_PHONE_NUMBER,
//         to: number,
//       })
//       .then(async () => {
//         await connection.commit();
//         await connection.release();
//         res
//           .status(200)
//           .json({ message: "Message sent", data: { phoneNumber: number } });
//       })
//       .catch((error) => {
//         console.error("Error sending message:", error);
//         // res.status(500).json({ error: error.message });
//         return next(new ApiError(500 , errorMessages.internalServerError , [error]));

//       });

//     console.log(OTP);
//   } catch (err) {
//     await connection.rollback();
//     connection.release();
//     // res
//     //   .status(500)
//     //   .json({ message: errorMessages.internalServerError, Error: err.message });
//     return next(new ApiError(500 , errorMessages.internalServerError , [error]));

//   }
// };

// export const verifyOTP = async (req, res) => {
//   const connection = await pool.getConnection();
//   const { phone_number, otp, registrationSource } = req.body;

//   // Validate registrationSource
//   if (!registrationSource) {
//     // return res.status(400).json({ message: "Registration source is required" });
//     return next(new ApiError(400 , errorMessages.registerationSourceMissing));
//   }

//   if (registrationSource !== "REGISTER" && registrationSource !== "EXISTING") {
//     // return res.status(400).json({ message: "Invalid registration source" });
//     return next(new ApiError(400 , errorMessages.invalidRegistrationSource));
//   }

//   try {
//     // Begin transaction
//     await connection.beginTransaction();

//     // Fetch OTP from the database for the given phone number
//     const [result] = await connection.query(nativeQueries.getOtp, [
//       phone_number,
//     ]);

//     if (!result || result.length === 0) {
//       await connection.rollback();
//       connection.release();
//       // return res
//       //   .status(404)
//       //   .json({
//       //     message:
//       //       "User not found, make sure OTP has been sent before you try to verify",
//       //   });
//     return next(new ApiError(400 ,"User not found, make sure OTP has been sent before you try to verify"))

//     }

//     const OTP = result[0].otp;

//     // Check if OTP matches
//     if (otp === OTP) {
//       // Fetch user details from soft registrations
//       const [userResult] = await connection.query(
//         nativeQueries.getSoftUserWithNumber,
//         [phone_number]
//       );

//       if (!userResult || userResult.length === 0) {
//         // return res
//         //   .status(400)
//         //   .json({ message: "User not found in soft registrations" });
//         return next(new ApiError(400 ,"User not found in soft registrations"))

//       }

//       // Handle registration based on the source
//       if (registrationSource === "REGISTER") {
//         await connection.query(nativeQueries.createUser, [
//           userResult[0].name,
//           userResult[0].email,
//           userResult[0].phone_number,
//           userResult[0].password,
//           "OTP",
//         ]);
//         await connection.query(nativeQueries.updateVerified, [
//           true,
//           userResult[0].id,
//         ]); // Mark user as verified
//       }

//       if (registrationSource === "EXISTING") {
//         await connection.query(nativeQueries.updateVerifiedMethodsWithOTP, [
//           phone_number,
//         ]);

//         // Ensure email is also included to handle correct checking
//         const [userStatus] = await connection.query(
//           nativeQueries.getVerifiedMethods,
//           [null, phone_number]
//         );

//         if (
//           userStatus.length > 0 &&
//           userStatus[0].verified_methods.includes("EMAIL") &&
//           userStatus[0].verified_methods.includes("OTP")
//         ) {
//           // Delete from soft registrations only if both methods are verified
//           await connection.query(nativeQueries.deleteFromSoftRegister, [
//             phone_number,
//             userStatus[0].email,
//           ]);
//         }
//       }

//       // Commit the transaction
//       await connection.commit();
//       connection.release();

//       return res.status(200).json({ message: "Verified" });
//     } else {
//       // If OTP doesn't match, rollback and return error
//       await connection.rollback();
//       connection.release();
//       // return res.status(400).json({ message: "Wrong OTP" });
//       return next(new ApiError(400 ,errorMessages.wrongOTP))

//     }
//   } catch (err) {
//     // Rollback and release in case of any error
//     await connection.rollback();
//     connection.release();
//     console.error("Error during OTP verification:", err);
//     // return res.status(500).json({ message: "Internal Server Error" });
//     return next(new ApiError(500 , errorMessages.internalServerError , [error]));
//   }
// };

