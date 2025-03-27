import pool, {
  hash,
  compare,
  genToken,
} from "../config/db.js";
import joi from "joi";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert { type: "json" };
import { insertIntoVerification, updateToken } from "../handler/userHandler.js";

const userSchema = joi.object({
  name: joi.string().min(3).required(),
  email: joi.string().email().required(),
  password: joi.string().min(6).required(),
});

export const register = async (req, res) => {
  const connection = await pool.getConnection();
  // await connection.beginTransaction();

  const { error } = userSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ message: errorMessages.validationError, error: error.message });
  }
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: errorMessages.missingFields });
  }

  try {
    const [existingUsers] = await pool.query(nativeQueries.getUser, [email]);

    if (existingUsers.length > 0) {
      return res
        .status(409)
        .json({ message: errorMessages.userExists, user: existingUsers[0] });
    }

    const [verificationUser] = await pool.query(
      nativeQueries.checkFromVerification,
      [email]
    );

    console.log(verificationUser[0]);

    if (verificationUser.length > 0) {
      const user = verificationUser[0];
      if (user.isVerified == true) {
        return res.status(409).json({ message: errorMessages.userExists }); // if isVerified is true user must be present in users table
      } else if (
        user.isVerified == false &&
        new Date(user.expires_at) > new Date(Date.now())
      ) {
        return res
          .status(409)
          .json({
            message: "Please Verify the email by clicking the link in the mail",
          });
      } else if (
        user.isVerified == false &&
        new Date(user.expires_at) < new Date(Date.now())
      ) {
        console.log(new Date(user.expires_at), new Date(Date.now()));
        //to be made into a function
        await updateToken(user.id, user.email, connection);
        return res.status(200).json({
          message: "New Verification email has been sent please verify.",
        });
      }
    }

    const hashedPassword = await hash(password);
    await insertIntoVerification(name, email, hashedPassword);
    // await connection.commit();
    return res.status(201).json({ message: successMessages.userRegistered });
  } catch (error) {
    // await connection.rollback()
    connection.release();
    console.error(`${errorMessages.registrationFailed}`, error.message);
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
      await connection.query(nativeQueries.updateVerified,[true]); //update isVerified field
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