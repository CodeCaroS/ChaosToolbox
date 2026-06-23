import { createApp } from "./app";
const app = createApp();
const port = Number(process.env.PORT ?? 4174);
const host = process.env.HOST ?? "127.0.0.1";
app.listen(port, host, () => {
  console.log(`ChaosToolbox listening on http://${host}:${port}`);
});
