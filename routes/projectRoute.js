import express from "express";
import { createProject, getAllProjects, getProjectDetails, searchUsers, deleteProject,  } from "../controllers/projectController.js";
import { acceptNotification, fetchInvitations, inviteUsers, rejectNotification } from "../controllers/collaborativeTodoController.js";
import { editGroupTask , getGroupProject , deleteGroupTask } from "../controllers/groupTodoController.js";

const router = express.Router();

router.post('/createProject' , createProject);
router.post('/inviteUsers',inviteUsers);
router.post('/fetchInvitations',fetchInvitations);
router.post('/acceptInvitation',acceptNotification);
router.post('/rejectInvitation',rejectNotification);
router.post('/getAllProjects',getAllProjects);
router.post('/getProjectDetails' , getProjectDetails);
router.get('/searchUser',searchUsers);
router.delete('/deleteProject',deleteProject);

router.patch('/editGroupTask',editGroupTask);
router.post('/getGroupProject',getGroupProject);
router.delete('/deleteGroupTask',deleteGroupTask);

export default router;