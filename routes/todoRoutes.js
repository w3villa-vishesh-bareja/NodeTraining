import express from "express";
import { createSimpleTask, deleteSimpleTaskSingle, editSimpleTask, getSimpleTasks } from "../controllers/simpleTodoController.js";
const router = express.Router();


router.post("/createSimpleTask", createSimpleTask);
router.put("/editSimpleTask", editSimpleTask);
router.delete("/deleteSimpleTaskSingle", deleteSimpleTaskSingle);
router.post("/getSimpleTasks", getSimpleTasks);

export default router;
