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
import { insertIntoVerification, updateToken } from "../handler/userHandler.js";
import twilio from 'twilio';

const userSchema = joi.object({
  name: joi.string().min(3).required(),
  email: joi.string().email().required(),
  password: joi.string().min(6).required(),
  phoneNumber: joi.string().required(),
  verificationMethod: joi.string().required()
});

const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
// const client = twilio("AC59cc0cb55f5c625729edf0278410a7a", "094396964fd461f033473de6c59c16dc");

export const register = async (req, res) => {

  // const connection = await pool.getConnection();
  // await connection.beginTransaction();

  const { error } = userSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ message: errorMessages.validationError, error: error.message });
  }
  const { name, email, password, phoneNumber, verificationMethod} = req.body;


  if (!name || !email || !password || !phoneNumber) {
    return res.status(400).json({ message: errorMessages.missingFields });
  }

  if(!verificationMethod){
    return res.status(400).json({ message: errorMessages.selectVerificationMethod });
  }else if (verificationMethod != "EMAIL" && verificationMethod != "OTP"){
    return res.status(400).json({ message: errorMessages.incorrectVerificationMethod });
  }
  
  try {
  const hashedPassword = await hash(password);

  if(verificationMethod == "OTP"){

    const [numberResult] = await pool.query(nativeQueries.getSoftUserWithNumber, [phoneNumber]) 
    console.log(numberResult[0]);
    if(numberResult.length > 0){
     const [isVerifiedResult] = await pool.query(nativeQueries.checkVerificationStatus,[ phoneNumber])
      console.log(isVerifiedResult);
     //if the user is found in soft_register but is not in otp , it means they started verification with email but did not complete it
     // so and trigger /send otp 
     if(!isVerifiedResult.length>0){
      //insert in otp
      console.log("inserted")
      return res.status(307).json({ id: numberResult[0].id , number:numberResult[0].phone_number , Action:"INSERT"});
     }
     if(isVerifiedResult[0].isVerified==0){
      //trigger send otp it will handle resending otp
      return res.status(307).json({ number:numberResult[0].phone_number , Action : "UPDATE" });
     }
     if(isVerifiedResult[0].isVerified==1){
      //delete record from soft_register write function in handler
     }
    }else{
      await pool.query(nativeQueries.insertIntoSoftRegister,[name , email , phoneNumber , hashedPassword ]);
      const [numberResult] = await pool.query(nativeQueries.getSoftUserWithNumber, [phoneNumber]) 
      return res.status(307).json({ id: numberResult[0].id , number:numberResult[0].phone_number , Action:"INSERT"});
    }

  }

  if(verificationMethod == "EMAIL"){
    const [emailResult] = await pool.query(nativeQueries.getSoftUserWithEMail, [email]) 
    if(emailResult.length > 0){
      const [isVerifiedResult] = await pool.query(nativeQueries.getSoftUserWithEMail , [email]);

      if(!isVerifiedResult.length>0){
        const token = await genTokenForVerification(email);
        return res.status(307).json({ id: numberResult[0].id , token: token, Action:"INSERT"});
      }
      if(isVerifiedResult[0].isVerified==0){
        if(new Date(isVerifiedResult[0].expires_at) > new Date(Date.now())){
          return res
          .status(409)
          .json({
            message: "Please Verify the email by clicking the link in the mail",
          });
        }
        if(new Date(user.expires_at) < new Date(Date.now())){
          const connection = await pool.getConnection();
          await updateToken(isVerifiedResult[0].id, isVerifiedResult[0].email, connection);
        }
        return res.status(307).json({ id:emailResult[0].id, token:token,  Action : "UPDATE" });
      }
    }
    return res.status(307).json({redirectURL : "http://locahost:5173/verifyEmail" , user:{
      name:name,
      email:email,
      number:phoneNumber,
      password:hashedPassword
    }});
  }
    // do i send the details of user in this query ? 
  
    // const [existingUsers] = await pool.query(nativeQueries.getUser, [email]);

    // if (existingUsers.length > 0) {
    //   return res
    //     .status(409)
    //     .json({ message: errorMessages.userExists, user: existingUsers[0] });
    // }

    // const [verificationUser] = await pool.query(
    //   nativeQueries.checkFromVerification,
    //   [email]
    // );

    // console.log(verificationUser[0]);

    // if (verificationUser.length > 0) {
    //   const user = verificationUser[0];
    //   if (user.isVerified == true) {
    //     return res.status(409).json({ message: errorMessages.userExists }); // if isVerified is true user must be present in users table
    //   } else if (
    //     user.isVerified == false &&
    //     new Date(user.expires_at) > new Date(Date.now())
    //   ) {
    //     return res
    //       .status(409)
    //       .json({
    //         message: "Please Verify the email by clicking the link in the mail",
    //       });
    //   } else if (
    //     user.isVerified == false &&
    //     new Date(user.expires_at) < new Date(Date.now())
    //   ) {
    //     console.log(new Date(user.expires_at), new Date(Date.now()));
    //     //to be made into a function
    //     await updateToken(user.id, user.email, connection);
    //     return res.status(200).json({
    //       message: "New Verification email has been sent please verify.",
    //     });
    //   }
    // }

    // await insertIntoVerification(name, email, hashedPassword);
    // await connection.commit();
    return res.status(201).json({ message: successMessages.userRegistered });
  } catch (error) {
    // await connection.rollback()
    // connection.release();
    console.error(`${errorMessages.registrationFailed}`, error);
    return res.status(500).json({ message: errorMessages.internalServerError });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: errorMessages.missingFields });
  }

  try {
    const [users] = await pool.query(nativeQueries.getUser, [email]);

    if (users.length === 0) {
      return res
        .status(401)
        .json({ message: errorMessages.invalidCredentials });
    }

    const user = users[0];
    const isValid = await compare(password, user.password);

    if (!isValid) {
      return res
        .status(401)
        .json({ message: errorMessages.invalidCredentials });
    }
    const token = await genToken(user.id, user.name, user.email);
    res.cookie("token2", token);
    return res.status(200).json({
      message: successMessages.loginSuccessful,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token: token,
    });
  } catch (error) {
    console.error(`${errorMessages.loginFailed}`, error.message);
    return res.status(500).json({ message: errorMessages.internalServerError });
  }
};

export const verifyEmail = async (req,res)=>{
  const {email} = req.user;
  
  const connection = await pool.getConnection();
  try{
  
    //fetch expiri date , isVerified from db using token
    const [result] = await pool.query(nativeQueries.checkFromVerification,[email]);
    const user = result[0];
    if (user.isVerified == 1) {
      return res.status(409).json({ message: errorMessages.userExists }); // if isVerified is true user must be present in users table
    } else if (
      user.isVerified == 0 &&
      new Date(user.expires_at) > new Date(Date.now())
    ) {


      await connection.beginTransaction()
      await connection.query(nativeQueries.createUser,[user.name , user.email , user.password]); // insert in user table
      await connection.query(nativeQueries.updateVerified,[true]);//update isVerified field
      await connection.commit();
      await connection.release();
      return res.status(200).json({message : "email verified"});


    } else if (
      user.isVerified == false &&
      new Date(user.expires_at) < new Date(Date.now())
    ) {
      console.log(new Date(user.expires_at), new Date(Date.now()));
      await updateToken(user.id, user.email, connection);
      return res.status(200).json({
        message: "New Verification email has been sent please verify.",
      });
    }
  }catch(err){
    (await connection).rollback;
    (await connection).release;
    return res.status(500).send({message:errorMessages.internalServerError ,Error: err.message})
  }
  

}

export const sendOTP = async (req,res)=>{
  const connection =await pool.getConnection();
  await connection.beginTransaction();

  const { id , number , Action } = req.body;
  
  if(!number){
    return res.status(400).json({errorMessages :"please provide a number"});
  }
   try{
    let digits = '0123456789';
    let OTP ="";

    for (let index = 0; index < 4; index++) {
      OTP+= digits[Math.floor(Math.random()*10)];
    }
    if(Action == "INSERT"){
      await connection.query(nativeQueries.insertInOtp, [id, number , OTP]);
    }
    if(Action == "UPDATE"){
      await connection.query(nativeQueries.updateOtp, [OTP , number]);
    }
    await client.messages.create({
      body: `Verification OTP for (This is a test) ${OTP}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: number
    })
    .then(async () => {
      await connection.commit();
      await connection.release(); 
      res.status(200).json({ message: "Message sent" , data :{ phoneNumber : number}})})
    .catch((error) => {
      console.error("Error sending message:", error);
      res.status(500).json({ error: error.message });
    });

    console.log(OTP);

  }catch(err){
      await connection.rollback();
      connection.release();
      res.status(500).json({message: errorMessages.internalServerError ,Error: err.message});
   }
}

export const verifyOTP = async (req, res) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  const { phone_number, otp } = req.body;

  try {
    // Correct use of connection.query
    const [result] = await connection.query(nativeQueries.getOtp, [phone_number]);
    
    if (!result || result.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: "User not found, make sure OTP has been sent before you try to verify" });
    }
    
    const OTP = result[0].otp;

    if (otp == OTP) {
      // Mark the user as verified
      await connection.query(nativeQueries.verifyUser, [true, phone_number]);

      // Fetch user details
      const [userResult] = await connection.query(nativeQueries.getSoftUserWithNumber, [phone_number]);

      if (!userResult || userResult.length === 0) {
        throw new Error("User data not found in soft registrations.");
      }

      // Insert into users table
      await connection.query(nativeQueries.insertInUsers, [
        userResult[0].name,
        userResult[0].email,
        userResult[0].phone_number,
        userResult[0].password
      ]);

      // Delete from soft registrations
      await connection.query(nativeQueries.deleteFromSoftRegister, [phone_number]);

      await connection.commit();
      connection.release();

      return res.status(200).json({ message: "Verified" });
    }

    // If OTP doesn't match
    await connection.rollback();
    connection.release();
    return res.status(400).json({ message: "Wrong OTP" });

  } catch (err) {
    // Error handling
    await connection.rollback();
    connection.release();
    console.error("Error during OTP verification:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
