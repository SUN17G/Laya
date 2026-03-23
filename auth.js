const admin = require("./firebase");

async function authMiddleware(req, res, next) {

  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).send("No token");
  }

  const token = header.split("Bearer ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    req.user = decoded;
    req.userId = decoded.uid;   // ⭐ IMPORTANT

    next();

  } catch (err) {
    res.status(401).send("Invalid token");
  }
}

module.exports = authMiddleware;
