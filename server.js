const multer = require("multer");
const cloudinary = require("./cloudinary");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const upload = multer({ dest: "uploads/" });

const express = require("express");
const cors = require("cors");
const authMiddleware = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server running");
});

app.get("/test", authMiddleware, (req, res) => {
  res.send("You are logged in");
});

app.get("/me", authMiddleware, async (req,res)=>{
  const user = await prisma.user.findUnique({
    where:{ id: req.userId }
  });

  res.json(user);
});

app.post("/me", authMiddleware, upload.single("image"), async (req,res)=>{

  let imageUrl = null;

  if(req.file){
    const uploadImg = await cloudinary.uploader.upload(req.file.path,{
      resource_type:"image"
    });
    imageUrl = uploadImg.secure_url;
  }

  const user = await prisma.user.upsert({
    where:{ id:req.userId },
    update:{
      name:req.body.name,
      ...(imageUrl && {imageUrl})
    },
    create:{
      id:req.userId,
      email:req.user.email,
      name:req.body.name,
      imageUrl
    }
  });

  res.json(user);
});

app.post("/profile", authMiddleware, async (req,res)=>{
  const { name, photo } = req.body;

  const user = await prisma.user.upsert({
    where:{ id:req.userId },
    update:{ name, photo },
    create:{ id:req.userId, name, photo }
  });

  res.json(user);
});

// download song
app.post("/download", authMiddleware, async (req,res)=>{
  const { songId } = req.body;

  // check if already downloaded
  const exists = await prisma.download.findFirst({
    where:{
      userId: req.userId,
      songId
    }
  });

  if(exists){
    return res.send("Already downloaded");
  }

  await prisma.download.create({
    data:{
      userId: req.userId,
      songId
    }
  });

  res.send("Downloaded");
});

app.get("/downloads", authMiddleware, async (req,res)=>{
  const data = await prisma.download.findMany({
    where:{ userId: req.userId },
    include:{ song:true },
    orderBy:{ id: "desc" }   // newest first
  });

  res.json(data);
});

app.post("/undownload", authMiddleware, async (req,res)=>{
  const { songId } = req.body;

  await prisma.download.deleteMany({
    where:{ userId:req.userId, songId }
  });

  res.send("removed");
});


// 🔐 GET SONGS (LOGIN REQUIRED)
app.get("/songs", authMiddleware, async (req, res) => {
  const songs = await prisma.song.findMany();
  res.json(songs);
});


// 🔐 CREATE PLAYLIST
app.post("/playlist", authMiddleware, async (req, res) => {
  const { name } = req.body;

  const playlist = await prisma.playlist.create({
    data: {
      name,
      userId: req.userId
    }
  });

  res.json(playlist);
});


// 🔐 ADD SONG TO PLAYLIST
app.post("/playlist/add", authMiddleware, async (req, res) => {
  const { playlistId, songId } = req.body;

  const item = await prisma.playlistSong.create({
    data: { playlistId, songId }
  });

  res.json(item);
});


// 🔐 GET PLAYLISTS (ONLY USER)
app.get("/playlist", authMiddleware, async (req, res) => {
  const playlists = await prisma.playlist.findMany({
    where: { userId: req.userId },
    include: { songs: { include: { song: true } } }
  });

  res.json(playlists);
});


// 🔐 DELETE PLAYLIST
app.delete("/playlist/:id", authMiddleware, async (req, res) => {
  const id = req.params.id;

  await prisma.playlistSong.deleteMany({
    where: { playlistId: id }
  });

  await prisma.playlist.delete({
    where: { id }
  });

  res.send("Playlist deleted");
});


// 🔐 REMOVE SONG
app.post("/playlist/remove", authMiddleware, async (req, res) => {
  const { playlistId, songId } = req.body;

  await prisma.playlistSong.deleteMany({
    where: { playlistId, songId }
  });

  res.send("Removed");
});


// 🔐 LIKE SONG
app.post("/like", authMiddleware, async (req, res) => {
  const { songId } = req.body;

  await prisma.likedSong.create({
    data: {
      songId,
      userId: req.userId
    }
  });

  res.send("liked");
});


// 🔐 GET LIKED
app.get("/liked", authMiddleware, async (req, res) => {
  const liked = await prisma.likedSong.findMany({
    where: { userId: req.userId },
    include: { song: true }
  });

  res.json(liked);
});


// 🔐 UNLIKE
app.post("/unlike", authMiddleware, async (req, res) => {
  const { songId } = req.body;

  await prisma.likedSong.deleteMany({
    where: {
      songId,
      userId: req.userId
    }
  });

  res.send("removed");
});


// UPLOAD SONG (ADMIN)
app.post("/upload-song", upload.fields([
  { name: "song", maxCount: 1 },
  { name: "image", maxCount: 1 }
]), async (req, res) => {

  const audioUpload = await cloudinary.uploader.upload(
    req.files.song[0].path,
    { resource_type: "video" }
  );

  const imageUpload = await cloudinary.uploader.upload(
    req.files.image[0].path,
    { resource_type: "image" }
  );

  const newSong = await prisma.song.create({
    data: {
      title: req.body.title,
      artist: req.body.artist,
      audioUrl: audioUpload.secure_url,
      imageUrl: imageUpload.secure_url,
    },
  });

  res.json(newSong);
});


app.listen(5000, () => {
  console.log("Server running on port 5000");
});
