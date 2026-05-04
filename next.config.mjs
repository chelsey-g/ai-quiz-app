const nextConfig = {
  async redirects() {
    return [
      { source: "/generate", destination: "/create?tab=topic", permanent: false },
      { source: "/notes",    destination: "/create?tab=notes",  permanent: false },
      { source: "/import",   destination: "/create?tab=import", permanent: false },
    ];
  },
};

export default nextConfig;
