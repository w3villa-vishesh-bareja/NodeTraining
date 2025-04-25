import Joi from 'joi';

export const createProjectSchema = Joi.object({
  type: Joi.string().valid('group', 'collaborative').required(),
  userId: Joi.number().required(),
  name:Joi.string().required(),

  deadline: Joi.when('type', {
    is: 'collaborative',
    then: Joi.date().required(),
    otherwise: Joi.date().optional(),
  }),

  description: Joi.string().optional(),
  
});

export const createTaskSchema = Joi.object({
  userId: Joi.number().required(),
  projectId: Joi.number().required(),
  taskName: Joi.string().required(),
  description: Joi.string().optional(),
  type: Joi.string().valid('group', 'collaborative').required(),
  deadline: Joi.date().optional(),

  assigned_to: Joi.when('type',{
    is:'collaborative',
    then:Joi.array().items(Joi.number()).required(),
    otherwise:Joi.forbidden(),
  })
})