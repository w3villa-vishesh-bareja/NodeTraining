import express from "express";
import { createProject, getAllProjects, getProjectDetails, searchUsers } from "../controllers/projectController.js";
import { acceptNotification, fetchInvitations, inviteUsers } from "../controllers/collaborativeTodoController.js";

const router = express.Router();

router.post('/createProject' , createProject);
router.post('/inviteUsers',inviteUsers);
router.get('/fetchInvitations',fetchInvitations);
router.post('/acceptInvitation',acceptNotification);
router.post('/getAllProjects',getAllProjects);
router.post('/getProjectDetails' , getProjectDetails);
router.get('/searchUser',searchUsers);
export default router;