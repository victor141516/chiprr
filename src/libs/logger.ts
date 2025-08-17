import winston from "winston";
import { parameters } from "./args";

export const logger = winston.createLogger({
  level: parameters["log-level"],
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});
