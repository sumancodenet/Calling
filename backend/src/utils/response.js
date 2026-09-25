export class ApiResponse {
  constructor(statusCode, message, data = null, meta = null) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }
}

export const sendSuccess = (res, { statusCode = 200, message = "Success", data = null, meta = null } = {}) => {
  const response = new ApiResponse(statusCode, message, data, meta);
  return res.status(response.statusCode).json(response);
};

export const sendCreated = (res, { message = "Created successfully", data = null, meta = null } = {}) =>
  sendSuccess(res, { statusCode: 201, message, data, meta });

export const sendError = (res, { statusCode = 500, message = "Something went wrong", data = null } = {}) => {
  const response = new ApiResponse(statusCode, message, data);
  return res.status(response.statusCode).json(response);
};

export const sendNotFound = (res, { message = "Resource not found" } = {}) =>
  sendError(res, { statusCode: 404, message });

export const sendValidationError = (res, { message = "Validation failed", errors = null } = {}) =>
  sendError(res, { statusCode: 422, message, data: errors });
