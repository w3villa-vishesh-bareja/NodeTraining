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
