import { app } from "./app.js";
import { config } from "./config.js";

app.listen(config.PORT, () => {
  console.log(`Backend running on http://localhost:${config.PORT}`);
});
