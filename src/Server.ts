import Koa from "koa";
import { Proxy } from "./Proxy";

export class Server {
  private app: Koa;

  private constructor(
    private readonly proxy: Proxy,
    private readonly port: number = 3000
  ) {
    this.app = new Koa();
    this.configureMiddleware();
  }

  private configureMiddleware(): void {
    this.app.use(async (ctx) => {
      const { method, url } = ctx.request;
      if (method === "GET" && url?.startsWith("/guess/")) {
        try {
          const pathParts = url.split("?")[0].split("/");
          const word = pathParts[2];

          if (!word) {
            ctx.status = 400;
            ctx.body = { error: "Word is required in the URL path" };
            return;
          }

          const queryParams = new URLSearchParams(ctx.request.querystring);
          const dateQuery = queryParams.get("date");
          const date = dateQuery ? new Date(dateQuery) : new Date();

          if (isNaN(date.getTime())) {
            ctx.status = 400;
            ctx.body = { error: "Invalid date format" };
            return;
          }

          const result = await this.proxy.guess(word, date);

          ctx.status = 200;
          ctx.body = result;
        } catch (error) {
          console.error("Error handling /guess/:word:", error);
          ctx.status = 500;
          ctx.body = { error: "Internal Server Error" };
        }
        return;
      }

      ctx.status = 404;
      ctx.body = { error: "Not Found" };
    });
  }

  public run(): void {
    this.app.listen(this.port, () => {
      console.log(`🚀 Server running at http://localhost:${this.port}`);
    });
  }

  public static with(proxy: Proxy, port: number = 3000): Server {
    return new Server(proxy, port);
  }
}
