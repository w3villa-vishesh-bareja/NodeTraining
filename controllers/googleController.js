import pool, { genTokenForVerification } from "../config/dbService.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert { type: "json" };
import { hash, generateRandomString } from "../config/dbService.js";
import { NEXT_ACTIONS } from "../config/appConstants.js";
import redis from "../config/redis.js";
import { ApiError } from "../utils/ApiError.js";
import { genToken } from "../config/dbService.js";
import ApiResponse from "../utils/ApiResponse.js";

export async function findOrCreateUser(profile) {
    try {
      let result;
      let username;
      let nameSeach;
      let email = profile.emails[0].value;
      const userData = await redis.get(email);
  
      if (userData) {
        return { redirect: true, email }; // tell Passport to redirect
      }
  
      [result] = await pool.query(nativeQueries.getUser, [email, null, null]);
  
      if (result.length === 0) {
        // email not found
        [nameSeach] = await pool.query(nativeQueries.getUser, [
          null,
          null,
          profile.displayName,
        ]);
  
        const firstName = profile.name?.givenName;
        const lastName = profile.name?.familyName;
        username = profile.displayName;
        const profilePhoto = profile.photos?.[0]?.value;
  
        if (nameSeach.length > 0) {
          const userDetails = {
            firstName,
            lastName,
            profilePhoto,
          };
          await redis.setEx(`${email}`, 600, JSON.stringify(userDetails));
          return { redirect: true, email }; // again return redirect
        }

        const hashedPassword = await hash(generateRandomString());
        let imageUrl;
        if (profilePhoto) {
          imageUrl = profilePhoto;
        } else {
          const name = `${firstName} + ${lastName}`;
          imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            name
          )}&background=random&color=fff`;
        }
  
        await pool.query(nativeQueries.createUserWithSocial, [
          email,
          hashedPassword,
          1,
          username,
          firstName,
          lastName,
          imageUrl,
          1,
          NEXT_ACTIONS.NONE,
        ]);
  
        result = await pool.query(nativeQueries.getUser, [
          profile.emails[0].value,
          null,
          null,
        ]);
  
        await pool.query(nativeQueries.addSocialUser, [
          result[0][0].unique_id,
          "Google",
          profile.id,
        ]);
      }
      return result[0]; 
    } catch (err) {
      console.error("Error in findOrCreateUser:", err);
      throw err;
    }
  }

export const handleGoogleCallback = async (req, res) => {
  console.log("in callback");
  if(req.user?.redirect){
    return res.redirect(`http://localhost:5173/register/setUsername?email=${encodeURIComponent(req.user.email)}`);
  }
  const user = req.user;
  const token = await genToken(user.id, user.name, user.email);
  res
    .cookie("token", token, {
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    })
    .redirect("http://localhost:5173/dashboard");
};

export const setUsername = async (req, res, next) => {
  try {
    const { username, email } = req.body;
    if (!username || !email) {
      next(new ApiError(400, errorMessages.validationError));
    }
    console.log(username , email)
    await redis.expire(email, 600);
    const [results] = await pool.query(nativeQueries.checkName, [
      `${username}%`,
    ]);

    const matchExists = results.some((row) => row.name === username);

    if (matchExists) {
      return next(new ApiError(409, errorMessages.nameExists));
    }

    const user = JSON.parse(await redis.get(email));

    console.log(user)
    if (!user) {
      return next(new ApiError(401, errorMessages.sessionExpired));
    }
    const hashedPassword = await hash(generateRandomString());
    console.log("user:", user);
    await pool.query(nativeQueries.createUserWithSocial, [
      email,
      hashedPassword,
      1,
      username,
      user.firstName,
      user.lastName,
      user.profilePhoto,
      1,
      NEXT_ACTIONS.NONE,
    ]);
    await redis.del(email);
    const token = await genTokenForVerification(email)
    res.locals.data = new ApiResponse(
      201,
      true,
      successMessages.userRegistered,
      [{ user:user , token:token }]
    );
    return next();
  } catch (error) {
    console.log(error);
    next(new ApiError(500));
  }
};
