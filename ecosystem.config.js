module.exports = {
  apps: [
    {
      name: "wwz",
      script: "./build/index.js",
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      autorestart: true,
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
