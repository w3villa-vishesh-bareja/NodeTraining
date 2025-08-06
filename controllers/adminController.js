import pool from "../config/dbService.js";
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

const tierUpgradeSchema = joi.object({
  tier: joi.string().valid("TIER_1", "TIER_2", "TIER_3").required()
});

async function getAllUsers(req, res, next) {
  try {
    const limit = 20;
    const offset = parseInt(req.query.offset) || 0; // from frontend

    const [rows] = await pool.query(
      `SELECT * FROM users ORDER BY id LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.status(200).json({
      success: true,
      users: rows,
      nextOffset: offset + limit,
    });
  } catch (error) {
    next(error);
  }
}

 async function upgradeTier(req, res, next) {
  const { error } = tierUpgradeSchema.validate(req.body);
  if (error) {
    return next(new ApiError(400, errorMessages.validationError, [error.message]));
  }

  const { tier } = req.body;
  const userId = req.params.id;

  try {
    await pool.query(nativeQueries.updateUserSubscription, [tier, userId]);
    res.locals.data = new ApiResponse(200, true, successMessages.priofileUpdated, []);
    next();
  } catch (err) {
    console.error(err);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}

 async function blockUser(req, res, next) {
  const userId = req.params.id;
  console.log("kjahfuafkuf")
  try {
    await pool.query(nativeQueries.blockUser, [0, userId]);
    res.locals.data = new ApiResponse(200, true, "User blocked successfully.");
    next();
  } catch (err) {
    console.error(err);
    return next(new ApiError(500, errorMessages.internalServerError));
  }

}
 async function unBlockUser(req, res, next) {
  const userId = req.params.id;
  console.log("kjahfuafkuf")
  try {
    await pool.query(nativeQueries.blockUser, [1, userId]);
    res.locals.data = new ApiResponse(200, true, "User unblocked successfully.");
    next();
  } catch (err) {
    console.error(err);
    return next(new ApiError(500, errorMessages.internalServerError));
  }
}

export {
  upgradeTier,
  unBlockUser,
  blockUser,
  getAllUsers
}