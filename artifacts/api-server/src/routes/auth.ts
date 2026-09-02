import { Router, type IRouter } from "express";
import { LoginBody, LoginResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/login", (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Preencha usuário e senha." });
    return;
  }

  const { username, password } = parsed.data;
  if (username.toLowerCase() !== "duda" || password !== "duo") {
    res.status(401).json({ error: "Usuário ou senha inválidos." });
    return;
  }

  res.json(LoginResponse.parse({ authenticated: true, displayName: "Duda" }));
});

export default router;