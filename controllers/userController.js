import express from "express";
import pool, { hash, compare, genToken, genTokenForVerification} from "../config/db.js";
import joi from 'joi'
import nativeQueries from '../nativequeries/nativeQueries.json' assert {type : 'json'}
import errorMessages from '../config/errorMessages.json' assert {type : 'json'}
import successMessages from '../config/successMessages.json' assert {type : 'json'}
import mailer from "../utils/mailHandler.js";

const userSchema = joi.object({
    name: joi.string().min(3).required(),
    email: joi.string().email().required(),
    password: joi.string().min(6).required(),
})

export const register = async (req, res) => {
  const connection = await pool.getConnection();  
  await connection.beginTransaction();
  const { error } = userSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message:errorMessages.validationError , error: error.message });
  }
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: errorMessages.missingFields });
  }

  try {
    const [existingUsers] = await pool.query(
      nativeQueries.getUser,
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: errorMessages.userExists, user: existingUsers[0] });
    }

    const token=await genTokenForVerification(email);
    await connection.query(nativeQueries.EmailVerification,[token]);
    await mailer(token);

    // const hashedPassword = await hash(password);

    // await pool.query(nativeQueries.createUser, [
    //   name,
    //   email,
    //   hashedPassword,
    // ]);
      await connection.commit();
     return res.status(201).json({ message: successMessages.userRegistered });
  } catch (error) {
    await connection.rollback()
    connection.release();
    console.error(`${errorMessages.registrationFailed}`, error.message);
    return res.status(500).json({ message: errorMessages.internalServerError});
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: errorMessages.missingFields });
  }

  try {
    const [users] = await pool.query(
      nativeQueries.getUser,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: errorMessages.invalidCredentials });
    }

    const user = users[0];
    const isValid = await compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: errorMessages.invalidCredentials });
    }
    const token = await genToken(user.id , user.name , user.email);
    res.cookie('token2' , token);
    return res.status(200).json({
      message: successMessages.loginSuccessful,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token:token,
    });

  } catch (error) {
    console.error(`${errorMessages.loginFailed}`, error.message);
    return res.status(500).json({ message: errorMessages.internalServerError });
  }
};
