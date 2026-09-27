import { notFound } from "../utils/AppError.js";

export const notFoundHandler = (req, res, next) => {
  next(notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
};

export default notFoundHandler;
