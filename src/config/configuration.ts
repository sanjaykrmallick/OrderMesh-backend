import { StringValue } from 'ms';

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',

  port: parseInt(process.env.PORT || '4000', 10),

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ||
      '15m') as StringValue,

    refreshSecret: process.env.JWT_REFRESH_SECRET,

    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ||
      '7d') as StringValue,
  },
});
