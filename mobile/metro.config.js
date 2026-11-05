const http = require("http");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Safe resolution for expo-av in Expo Go (where ExponentAV native binary is absent)
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "expo-av") {
    return {
      filePath: path.resolve(__dirname, "src/services/expo-av-safe.js"),
      type: "sourceFile",
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Proxy /api/ requests to local Caddy API Gateway (Docker port 80)
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (req.url && (req.url.startsWith("/api/") || req.url.startsWith("/health"))) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[PROXY IN] ${req.method} ${req.url}`);
        }
        const options = {
          hostname: "127.0.0.1",
          port: 80,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: "127.0.0.1:80",
          },
        };

        const proxyReq = http.request(options, (proxyRes) => {
          if (process.env.NODE_ENV !== "production") {
            console.log(`[PROXY OUT] ${proxyRes.statusCode} for ${req.url}`);
          }
          delete proxyRes.headers["transfer-encoding"];
          if (!res.headersSent) {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        });

        proxyReq.on("error", (err) => {
          if (process.env.NODE_ENV !== "production") {
            console.error(`[PROXY ERR] ${req.url} ->`, err.message);
          }
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Proxy Gateway Error",
                detail: err.message,
              })
            );
          }
        });

        req.pipe(proxyReq, { end: true });
        return;
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
