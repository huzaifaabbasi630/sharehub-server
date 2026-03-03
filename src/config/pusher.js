const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.VITE_PUSHER_APP_ID,
  key: process.env.VITE_PUSHER_KEY,
  secret: process.env.VITE_PUSHER_SECRET,
  cluster: process.env.VITE_PUSHER_CLUSTER,
  useTLS: true,
});

console.log(`Pusher Configured. AppId: ${process.env.VITE_PUSHER_APP_ID ? 'Set' : 'Missing'}, Cluster: ${process.env.VITE_PUSHER_CLUSTER}`);

module.exports = pusher;