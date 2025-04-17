import Joi from "joi";

// For inviting a user to a project
export const inviteUserSchema = Joi.object({
  userId: Joi.number().integer().required(),
  receiverId: Joi.number().integer().required(),
  projectId: Joi.number().integer().required()
});

// For fetching invitations
export const fetchInvitationsSchema = Joi.object({
  userId: Joi.number().integer().required()
});

// For accepting a notification/invitation
export const acceptNotificationSchema = Joi.object({
  userId: Joi.number().integer().required(),
  projectId: Joi.number().integer().required()
});
