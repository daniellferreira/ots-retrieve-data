const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const OTSController = require("./controllers/ots");

const morganMiddleware = morgan(
  ":method :url :status :res[content-length] - :response-time ms",
  {
    stream: {
      // Configure Morgan to use our custom logger with the http severity
      write: (message) => log.info(message.trim()),
    },
  }
);

class App {
  constructor() {
    this.server = express();
    this.server.use(cors());
    this.server.use(express.json());
    this.server.use(morganMiddleware);
  }

  async init() {
    this.registerRoutes();
  }

  async close() {
  }

  registerRoutes() {
    this.server.get("/retrieve-data/ping", (req, res) => {
      res.send(`pong`);
    });

    this.server.get("/retrieve-data", (req, res, next) => {
      if ([null, undefined, ""].includes(req.query.user, req.query.connected_from, req.query.connected_to)) {
        return res.status(401).json({
          message:
            "user, connected_from and connected_to are required query string params",
        });
      }
      next()
    }, OTSController.retrieveData);
  }
}

module.exports = App;
