import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./lib/logger";
import { router } from "./router";

// Cria as variáveis equivalentes ao __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
const staticPath = path.resolve(__dirname, "../../../client/dist");

app.use(express.static(staticPath));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});
