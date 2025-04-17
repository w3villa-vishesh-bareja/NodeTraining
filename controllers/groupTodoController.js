import pool from "../config/dbService.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import nativeQueries from "../nativequeries/nativeQueries.json" assert { type: "json" };
import errorMessages from "../config/errorMessages.json" assert { type: "json" };
import successMessages from "../config/successMessages.json" assert { type: "json" };
import {
  createSimpleTaskSchema,
  editSimpleTaskSchema,
  getSimpleTaskSchema,
  deleteSimpleTaskSchema,
} from "../validators/simpleTask.validator.js";
import responseHandler from "../handler/responseHandler.js";

