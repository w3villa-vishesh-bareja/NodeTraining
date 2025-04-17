import express from "express";
import { createProject, getAllProjects } from "../controllers/projectController.js";
import { acceptNotification, fetchInvitations, inviteUsers } from "../controllers/collaborativeTodoController.js";

const router = express.Router();

router.post('/createProject' , createProject);
router.post('/inviteUsers',inviteUsers);
router.get('/fetchInvitations',fetchInvitations);
router.post('/acceptInvitation',acceptNotification);
router.get('/getAllProjects',getAllProjects);
export default router;