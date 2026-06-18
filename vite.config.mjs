const launch =
  "/play/#template=http://127.0.0.1:9208/dist/&sync=wss://sync.probability.nz&plugin=http://127.0.0.1:9208/";

export default {
  plugins: [
    {
      name: "prob-template",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method === "OPTIONS") return res.end();
          if (req.url === "/" || req.url === "/dist") {
            res.statusCode = req.url === "/" ? 307 : 308;
            res.setHeader("Location", req.url === "/" ? launch : "/dist/");
            return res.end();
          }
          next();
        });
      },
    },
  ],
  server: {
    proxy: {
      "/play": {
        target: "https://prob.nz",
        changeOrigin: true,
      },
    },
  },
};
