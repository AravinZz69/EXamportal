require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();

// --------------------- Middleware ---------------------
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Serve Frontend
app.use(express.static(__dirname));

// --------------------- MongoDB ---------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log(err));

// --------------------- Schemas ---------------------
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: {
      type: String,
      enum: ["teacher", "student"],
    },
  })
);

const Question = mongoose.model(
  "Question",
  new mongoose.Schema({
    question: String,
    options: [String],
    answer: String,
  })
);

const Result = mongoose.model(
  "Result",
  new mongoose.Schema({
    student: String,
    score: Number,
    total: Number,
    date: {
      type: Date,
      default: Date.now,
    },
  })
);

// --------------------- Authentication ---------------------

// Register
app.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });

    if (exists)
      return res.json({
        success: false,
        message: "User already exists",
      });

    const hash = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hash,
      role,
    });

    res.json({
      success: true,
      message: "Registered Successfully",
    });
  } catch (err) {
    res.json({
      success: false,
      message: err.message,
    });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user)
      return res.json({
        success: false,
        message: "User not found",
      });

    const ok = await bcrypt.compare(password, user.password);

    if (!ok)
      return res.json({
        success: false,
        message: "Wrong Password",
      });

    req.session.user = {
      id: user._id,
      name: user.name,
      role: user.role,
    };

    res.json({
      success: true,
      user: req.session.user,
    });
  } catch (err) {
    res.json({
      success: false,
      message: err.message,
    });
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true,
      message: "Logged Out",
    });
  });
});

// --------------------- Teacher ---------------------

// Add Question
app.post("/add-question", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "teacher") {
      return res.json({
        success: false,
        message: "Teacher Login Required",
      });
    }

    const { question, options, answer } = req.body;

    await Question.create({
      question,
      options,
      answer,
    });

    res.json({
      success: true,
      message: "Question Added",
    });
  } catch (err) {
    res.json({
      success: false,
      message: err.message,
    });
  }
});

// --------------------- Student ---------------------

// Get Questions
app.get("/questions", async (req, res) => {
  try {
    const questions = await Question.find({}, "-answer");

    res.json(questions);
  } catch (err) {
    res.json([]);
  }
});

// Submit Exam
app.post("/submit", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({
        success: false,
        message: "Login Required",
      });
    }

    const { answers } = req.body;

    const questions = await Question.find();

    let score = 0;

    questions.forEach((q, index) => {
      if (answers[index] === q.answer) {
        score++;
      }
    });

    await Result.create({
      student: req.session.user.name,
      score,
      total: questions.length,
    });

    res.json({
      success: true,
      score,
      total: questions.length,
    });
  } catch (err) {
    res.json({
      success: false,
      message: err.message,
    });
  }
});

// --------------------- Results ---------------------

app.get("/results", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json([]);
    }

    if (req.session.user.role === "teacher") {
      const results = await Result.find().sort({ date: -1 });
      return res.json(results);
    }

    const results = await Result.find({
      student: req.session.user.name,
    }).sort({ date: -1 });

    res.json(results);
  } catch (err) {
    res.json([]);
  }
});

// --------------------- Default Route ---------------------

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// --------------------- Start Server ---------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server Running at http://localhost:${PORT}`);
});
