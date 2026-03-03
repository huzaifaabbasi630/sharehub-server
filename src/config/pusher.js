const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

console.log(`Pusher Configured. AppId: ${process.env.PUSHER_APP_ID ? 'Set' : 'Missing'}, Cluster: ${process.env.PUSHER_CLUSTER}`);

module.exports = pusher;