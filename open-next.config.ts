const config = {
  default: {
    minify: true,
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
  functions: {
    studio: {
      minify: true,
      routes: ["app/studio/page"],
      patterns: ["/studio"],
      override: {
        wrapper: "cloudflare-node",
        converter: "edge",
        proxyExternalRequest: "fetch",
        incrementalCache: "dummy",
        tagCache: "dummy",
        queue: "dummy",
      },
    }
  },
  cloudflare: {
    useWorkerdCondition: true,
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
};

export default config;
