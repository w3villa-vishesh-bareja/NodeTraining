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
import {
  decideEmailOperation,
  decideOtpOperation,
  insertIntoEmailVerification,
  updateToken,
} from "../handler/userHandler.js";
import twilio from "twilio";

const userSchema = joi.object({
  name: joi.string().min(3).required(),
  email: joi.string().email().required(),
  password: joi.string().min(6).required(),
  phoneNumber: joi.string().required(),
  verificationMethod: joi.string().required(),
});

const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

export const register = async (req, res) => {
  const { error } = userSchema.validate(req.body);
  if (error) {
    return res
      .status(400)
      .json({ message: errorMessages.validationError, error: error.message });
  }
  const { name, email, password, phoneNumber, verificationMethod } = req.body;

  if (!name || !email || !password || !phoneNumber) {
    return res.status(400).json({ message: errorMessages.missingFields });
  }

  if (!verificationMethod) {
    return res
      .status(400)
      .json({ message: errorMessages.selectVerificationMethod });
  } else if (verificationMethod != "EMAIL" && verificationMethod != "OTP") {
    return res
      .status(400)
      .json({ message: errorMessages.incorrectVerificationMethod });
  }

  try {
    const [result] = await pool.query(nativeQueries.getUser, [email]);
    if (result.length > 0) {
      return res
        .status(409)
        .json({ message: "user with this email already exists" });
    }
    const hashedPassword = await hash(password);
    if (verificationMethod == "OTP") {
      const typeOfOperation = await decideOtpOperation(
        phoneNumber,
        name,
        email,
        hashedPassword
      );
      return res.status(307).json({ data: typeOfOperation });
    }

    if (verificationMethod == "EMAIL") {
      const typeOfOperation = await decideEmailOperation(
        name,
        email,
        phoneNumber,
        hashedPassword
      );
      return res.status(307).json({ data: typeOfOperation });
    }
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

export const sendEmail = async (req, res) => {
  const connection = await pool.getConnection();
  const { id, Action } = req.body;
  const { email, token } = req.user;
  const verificationToken = token;

  if (!Action || !["INSERT", "UPDATE"].includes(Action)) {
    return res
      .status(400)
      .json({
        message: 'Invalid action. Must be either "INSERT" or "UPDATE".',
      });
  }

  if (!id && !verificationToken) {
    return res
      .status(404)
      .json({ message: "id and verification token is needed" });
  }

  try {
    if (Action == "INSERT") {
      insertIntoEmailVerification(id, verificationToken, email, connection);
      return res.status(200).json({ message: "email sent" });
    }
    if (Action == "UPDATE") {
      updateToken(id, verificationToken, email, connection);
      return res.status(200).json({ message: "email sent" });
    }
  } catch (error) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};
export const verifyEmail = async (req, res) => {
  const { email, token } = req.user;
  const verificationToken = token;
  const { registrationSource } = req.body;

  if (!registrationSource) {
    return res
      .status(400)
      .json({ message: "registeration source is required" });
  }
  if (registrationSource != "REGISTER" && registrationSource != "EXISTING") {
    return res.status(400).json({ message: "invalid registeration source" });
  }

  const connection = await pool.getConnection();
  try {
    console.log(verificationToken);
    //fetch expiri date , isVerified from db using token
    const [result] = await pool.query(nativeQueries.checkFromVerification, [
      verificationToken,
    ]);
    console.log(result);
    const user = result[0];
    if (user.isVerified == 1) {
      // await connection.query(nativeQueries.deleteFromSoftRegister,[null,email]);
      return res.status(409).json({ message: errorMessages.userExists }); // if isVerified is true user must be present in users table
    } else if (
      user.isVerified == 0 &&
      new Date(user.expires_at) > new Date(Date.now())
    ) {
      await connection.beginTransaction();
      if (registrationSource == "REGISTER") {
        await connection.query(nativeQueries.createUser, [
          user.name,
          user.email,
          user.password,
          user.phone_number,
          "EMAIL",
        ]);
        await connection.query(nativeQueries.updateVerified, [
          true,
          user.soft_registration_id,
        ]);
      } else if (registrationSource == "EXISTING") {
        await connection.query(nativeQueries.updateUserEmail, [email]); // update user name adds the email verification status in user table
        await connection.query(nativeQueries.updateVerified, [
          true,
          user.soft_registration_id,
        ]);
        const [userStatus] = await connection.query(
          nativeQueries.getVerifiedMethods,
          [email, phone_number]
        );
        if (
          userStatus.length > 0 &&
          userStatus[0].verified_methods.includes("EMAIL") &&
          userStatus[0].verified_methods.includes("OTP")
        ) {
          await connection.query(nativeQueries.deleteFromSoftRegister, [
            null,
            email,
          ]);
        }
      }
      await connection.commit();
      await connection.release();
      return res.status(200).json({ message: "email verified" });
    } else if (
      user.isVerified == false &&
      new Date(user.expires_at) < new Date(Date.now())
    ) {
      console.log(new Date(user.expires_at), new Date(Date.now()));
      const token = await genTokenForVerification(email);
      await updateToken(
        user.soft_registration_id,
        token,
        user.email,
        connection
      );
      return res.status(200).json({
        message: "New Verification email has been sent please verify.",
      });
    }
  } catch (err) {
    await connection.rollback();
    await connection.release();
    console.error(err);
    return res
      .status(500)
      .send({ message: errorMessages.internalServerError, Error: err.message });
  }
};

export const sendOTP = async (req, res) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  const { id, number, registrationSource } = req.body;
  let { Action } = req.body;

  if (!registrationSource) {
    return res
      .status(400)
      .json({ errorMessages: "please provide a registrationSource" });
  }
  if (registrationSource == "REGISTER" && !Action) {
    return res.status(400).json({ errorMessages: "please provide a Action" });
  }
  if (!number) {
    return res.status(400).json({ errorMessages: "please provide a number" });
  }
  try {
    let digits = "0123456789";
    let OTP = "";

    for (let index = 0; index < 4; index++) {
      OTP += digits[Math.floor(Math.random() * 10)];
    }

    if (registrationSource === "EXISTING") {
      const typeOfOperation = await decideOtpOperation(number);
      Action = typeOfOperation.Action;
    }

    if (Action == "INSERT") {
      await connection.query(nativeQueries.insertInOtp, [id, number, OTP]);
    }
    if (Action == "UPDATE") {
      await connection.query(nativeQueries.updateOtp, [OTP, number]);
    }
    await client.messages
      .create({
        body: `Verification OTP for (This is a test) ${OTP}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: number,
      })
      .then(async () => {
        await connection.commit();
        await connection.release();
        res
          .status(200)
          .json({ message: "Message sent", data: { phoneNumber: number } });
      })
      .catch((error) => {
        console.error("Error sending message:", error);
        res.status(500).json({ error: error.message });
      });

    console.log(OTP);
  } catch (err) {
    await connection.rollback();
    connection.release();
    res
      .status(500)
      .json({ message: errorMessages.internalServerError, Error: err.message });
  }
};

export const verifyOTP = async (req, res) => {
  const connection = await pool.getConnection();
  const { phone_number, otp, registrationSource } = req.body;

  // Validate registrationSource
  if (!registrationSource) {
    return res.status(400).json({ message: "Registration source is required" });
  }

  if (registrationSource !== "REGISTER" && registrationSource !== "EXISTING") {
    return res.status(400).json({ message: "Invalid registration source" });
  }

  try {
    // Begin transaction
    await connection.beginTransaction();

    // Fetch OTP from the database for the given phone number
    const [result] = await connection.query(nativeQueries.getOtp, [
      phone_number,
    ]);

    if (!result || result.length === 0) {
      await connection.rollback();
      connection.release();
      return res
        .status(404)
        .json({
          message:
            "User not found, make sure OTP has been sent before you try to verify",
        });
    }

    const OTP = result[0].otp;

    // Check if OTP matches
    if (otp === OTP) {
      // Fetch user details from soft registrations
      const [userResult] = await connection.query(
        nativeQueries.getSoftUserWithNumber,
        [phone_number]
      );

      if (!userResult || userResult.length === 0) {
        return res
          .status(400)
          .json({ message: "User not found in soft registrations" });
      }

      // Handle registration based on the source
      if (registrationSource === "REGISTER") {
        await connection.query(nativeQueries.createUser, [
          userResult[0].name,
          userResult[0].email,
          userResult[0].phone_number,
          userResult[0].password,
          "OTP",
        ]);
        await connection.query(nativeQueries.updateVerified, [
          true,
          userResult[0].id,
        ]); // Mark user as verified
      }

      if (registrationSource === "EXISTING") {
        await connection.query(nativeQueries.updateVerifiedMethodsWithOTP, [
          phone_number,
        ]);

        // Ensure email is also included to handle correct checking
        const [userStatus] = await connection.query(
          nativeQueries.getVerifiedMethods,
          [null, phone_number]
        );

        if (
          userStatus.length > 0 &&
          userStatus[0].verified_methods.includes("EMAIL") &&
          userStatus[0].verified_methods.includes("OTP")
        ) {
          // Delete from soft registrations only if both methods are verified
          await connection.query(nativeQueries.deleteFromSoftRegister, [
            phone_number,
            userStatus[0].email,
          ]);
        }
      }

      // Commit the transaction
      await connection.commit();
      connection.release();

      return res.status(200).json({ message: "Verified" });
    } else {
      // If OTP doesn't match, rollback and return error
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: "Wrong OTP" });
    }
  } catch (err) {
    // Rollback and release in case of any error
    await connection.rollback();
    connection.release();
    console.error("Error during OTP verification:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
