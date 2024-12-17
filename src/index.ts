import { Server } from "./Server";
import { Proxy } from "./Proxy";

const proxy = Proxy.with(fetch);

const server = Server.with(
  proxy,
  process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
);
server.run();
