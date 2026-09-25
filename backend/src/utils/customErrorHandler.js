import { validationResult } from 'express-validator';
import {  statusCode } from './statusCodes.js';

const customErrorHandler = function (req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(function (error) {
      let value;

      // Safely get the value based on the error location
      switch (error.location) {
        case 'body':
          value = req.body?.[error.param];
          break;
        case 'query':
          value = req.query?.[error.param];
          break;
        case 'params':
          value = req.params?.[error.param];
          break;
        case 'headers':
          value = req.headers?.[error.param];
          break;
        default:
          value = undefined;
      }

      return {
        type: 'field',
        value: value,
        msg: error.msg,
        path: error.param,
        location: 'body',
      };
    });

    const allErrors = formattedErrors.map((formattedError) => formattedError.msg);

    return res.status(statusCode.badRequest).json({
      data: null,
      success: false,
      errMessage: formattedErrors[0].msg,
      responseCode: statusCode.badRequest,
      additionalErr: allErrors.join(', '),
    });
  }

  next();
};

export default customErrorHandler;
