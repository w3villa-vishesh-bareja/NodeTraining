import Joi from 'joi';

// Create Simple Task
export const createSimpleTaskSchema = Joi.object({
  title: Joi.string().required(),
  userId: Joi.number().required(),
  deadline: Joi.date().optional(),
  description: Joi.string().optional()
});

// Edit Simple Task
export const editSimpleTaskSchema = Joi.object({
  taskId: Joi.number().required(),
  userId: Joi.number().required(),
  deadline: Joi.date().allow(null).optional() ,
  description: Joi.string().optional(),
  type: Joi.string().valid('simple').required(),
  status: Joi.string().valid('todo', 'in-progress', 'completed', 'aborted', 'timed-out', 'extended').optional()
});

// Delete Simple Task
export const deleteSimpleTaskSchema = Joi.object({
  taskId: Joi.number().required(),
  type: Joi.string().valid('simple').required(),
  userId: Joi.number().required()
});

// Get Simple Task
export const getSimpleTaskSchema = Joi.object({
  userId: Joi.number().required(),
  type: Joi.string().valid('simple').required()
});
