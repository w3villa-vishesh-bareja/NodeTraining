import express from "express";
import { createSimpleTask, deleteSimpleTaskSingle, editSimpleTask, getSimpleTasks, deleteMultipleSimpleTasks } from "../controllers/simpleTodoController.js";
import { changeStatus, createTask, getTask, changeAssignedTo, deleteTask } from "../controllers/collaborativeTodoController.js";
const router = express.Router();


router.post("/createSimpleTask", createSimpleTask);
router.patch("/editSimpleTask", editSimpleTask);
router.delete("/deleteSimpleTaskSingle", deleteSimpleTaskSingle);
router.post("/getSimpleTasks", getSimpleTasks);
router.post('/createTask', createTask);
router.patch('/changeStatus',changeStatus);
router.patch('/changeGroupTaskStatus')
router.post('/getTasks',getTask);
router.post('/changeAssignedTo',changeAssignedTo);
router.delete('/deleteTask',deleteTask);
router.delete('/deleteMultipleSimpleTasks', deleteMultipleSimpleTasks);

export default router;
