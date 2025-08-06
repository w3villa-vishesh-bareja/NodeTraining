import express from 'express'
import {getAllUsers, upgradeTier, blockUser, unBlockUser} from '../controllers/adminController.js'
const router = express.Router()

router.get('/users', getAllUsers);
router.patch('/users/:id/tier', upgradeTier);
router.patch('/users/:id/block', blockUser);
router.patch('/users/:id/unblock', unBlockUser);

export default router;