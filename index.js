// The entire LiemComputing source code.

const http = require("http");
const https = require("https");
const express = require("express");
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const compression = require("compression");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const mysql = require("mysql");
const fs = require("fs");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const e = require("cors");
const WebSocket = require('ws');
var exec = require('child_process').exec;
const exerciseScripts = require("./scripts/criteria.js");
const libre = require('libreoffice-convert');

let token;
let activeTest = [];
let sus = [];
let alert = "";

dotenv.config({
  path: "./.env",
});

const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
});

const wss = new WebSocket.Server({ port: 6969 })


http.globalAgent.maxSockets = Infinity;
https.globalAgent.maxSockets = Infinity;
app.use(compression());
app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));
app.set("view engine", "hbs");
app.set("views", __dirname + "/views/");

require("hbs").registerPartials(__dirname + "/views/partials/");
require("hbs").registerHelper("ifeq", function (a, b, options) {
  if (a == b) {
    return options.fn(this);
  }
  return options.inverse(this);
});

db.connect((error) => {
  if (error) {
    console.log(error);
  } else {
    console.log("🌐 MYSQL Connected...");
  }
});

var walk = function (dir) {
  var results = [];
  var list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = dir + "/" + file;
    var stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(walk(file));
    } else {
      /* Is a file */
      results.push(file);
    }
  });
  return results;
};

let webcontent;
let web;
let pycontent;
let py;
let javacontent;
let jc;
let cppcontent;
let cppc;
let scratchcontent;
let scratchc;

function scandir() {
  webcontent = walk("./public/topics/Web");
  web = "";
  fs.readdir("./public/topics/Web", (err, files) => {
    web = files;
  });
  pycontent = walk("./public/topics/Python");
  py = "";
  fs.readdir("./public/topics/Python", (err, files) => {
    py = files;
  });
  javacontent = walk("./public/topics/Java");
  jc = "";
  fs.readdir("./public/topics/Java", (err, files) => {
    jc = files;
  });
  cppcontent = walk("./public/topics/Cpp");
  cppc = "";
  fs.readdir("./public/topics/Cpp", (err, files) => {
    cppc = files;
  });
  scratchcontent = walk("./public/topics/Scratch");
  scratchc = "";
  fs.readdir("./public/topics/Scratch", (err, files) => {
    scratchc = files;
  });
}

scandir();


wss.on('connection', function connection(ws) {

  console.log('Client connected')

  function sendToPJ(user, file, naam) {
    ws.send(JSON.stringify({
      name: user,
      data: file,
      filename: naam
    }))

    console.log({
      name: user,
      data: file
    })
  }
  wss.myFunction = sendToPJ

  ws.on('message', function incoming(message) {

    let msg = JSON.parse(message)
    //  io.logExercise(msg[0].username, msg[0].msg)
    console.log(JSON.parse(message))

  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
  ws.onerror = function () {
    console.log("Some Error occurred");
  }
});

io.on("connection", async function (socket) {

  function logEx(user, msg) {
    socket.broadcast.emit("exLog", user, msg);
  }

  io.logExercise = logEx

  socket.on("requestAlert", function () {
    if (alert != "null") {
      socket.emit("gotAlert", alert);
    }
  });
  socket.on("restore", function (pw, callback) {
    let pww = "12345";
    if (pw == pww) {
      callback("correct");
    }
  });
  socket.on("resetpw", function (password, passwordconfirm, user, callback) {
    let returnc;

    const saltPasswordAsync = (Password) =>
      new Promise((resolve, reject) => {
        bcrypt.hash(password, 8, (err, hash) => {
          if (err) reject(err);
          else resolve(hash);
        });
      });

    async function getHash() {
      try {
        const hash = await saltPasswordAsync(password);
        db.query(
          {
            sql: "UPDATE users SET password = ? WHERE name = ?",
            values: [hash, user],
          },
          function (err, results) {
            if (err) throw err;
            console.error("There was an error ", err);
            returnc = "Password reset!";
            socket.emit("returncommandd", returnc);
          }
        );
      } catch (err) {
        console.error("There was an error ", err);
        socket.emit("returncommandd", err);
      }
    }

    if (password.length === 0 && passwordconfirm.length === 0) {
      returnc = "Password cannot be blank";
      socket.emit("returncommandd", returnc);
    } else if (password.length === 0 || passwordconfirm.length === 0) {
      returnc = "Password cannot be blank";
      socket.emit("returncommandd", returnc);
    } else if (password !== passwordconfirm) {
      returnc = `Passwords do not match :(`;
      socket.emit("returncommandd", returnc);
    } else if (password.length < 6 && passwordconfirm.length < 6) {
      returnc = "Password must be more than 6 charectors!";
      socket.emit("returncommandd", returnc);
    } else if (password.length < 6 || passwordconfirm.length < 6) {
      returnc = "Password must be more than 6 charectors!";
      socket.emit("returncommandd", returnc);
    } else if (password.length >= 6 && password == passwordconfirm) {
      hash = getHash();
      returnc = "Password reset!";
      socket.emit("returncommandd", returnc);
    }
  });

  socket.on("fetchReport", function () {
    try {
      db.query(
        {
          sql: "SELECT name, AdminTestWrong, AdminExerciseWrong FROM users",
        },
        function (err, results) {
          if (err) throw err;

          let result = Object.values(JSON.parse(JSON.stringify(results)));
          socket.emit("returnReport", result);
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  });

  socket.on("getcourse", function (data, callback) {
    if (data == "web") {
      callback(webcontent, web);
    } else if (data == "python") {
      callback(pycontent, py);
    } else if (data == "java") {
      callback(javacontent, jc);
    } else if (data == "cpp") {
      callback(cppcontent, cppc);
    } else if (data == "scratch") {
      callback(scratchcontent, scratchc);
    }
  });
  socket.on("getExercise", function(callback) {
    try {
      db.query(
        {
          sql:
            "SELECT exercise, script FROM exerciseScript"
        },
        function (err, results) {
          let data = [];
          results.forEach((element) => {
            let exercise = [];
            exercise.push(element.exercise);
            exercise.push(element.script);
            data.push(exercise);
          });
          callback(data);
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  });

  socket.on("mark", function (data) {
    total = 0;

    try {
      db.query(
        {
          sql: "SELECT a FROM " + data,
        },
        function (err, results) {
          if (err) throw err;
          marksbe4 = Object.values(JSON.parse(JSON.stringify(results)));
          marksbe4.forEach((element) => {
            var poopitypoop = JSON.stringify(element)
              .substring(5)
              .slice(0, -1)
              .substring(1)
              .slice(0, -1)
              .replace(/\D/g, "");

            if (poopitypoop == "") {
              total = total + 1;
            } else {
              total = total + parseInt(poopitypoop);
            }
          });
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  });

  socket.on("getgrades", function (data) {
    try {
      db.query(
        {
          sql: "SELECT grades FROM users WHERE name=?",
          values: [data],
        },
        function (err, results) {
          if (err) throw err;
          if (results[0]) {
            socket.emit("returngrades", results[0].grades);
          }
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  });

  socket.on("test#q", function (testinfo) {
    try {
      var query3 = db.query(
        {
          sql: "SELECT MAX(q) as max_items FROM " + testinfo,
        },
        function (err, results) {
          if (err) throw err;
          socket.emit("return#q", results[0].max_items);
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }

    query3
      .on("error", function (err) {
        if (err) {
          console.log(err.code);
          // Do anything you want whenever there is an error.
          // throw err;
        }
      })
      .on("result", function (row) {
        //Do something with your result.
      });
  });

  socket.on("command", async function (command) {
    let icommand = "";
    let answer = "";
    let user = "";
    let test = "";
    let value = "";
    let password = "";
    let passwordconfirm = "";
    let courseac = "";

    icommand = command.split(/\s+/);

    if (icommand[0] == "gt") {
      user = icommand[1];
      test = icommand[2];

      if (test == undefined || test == "") {
        value = "Invalid Test Name!";
        socket.emit("returncommand", value);
      } else {
        try {
          db.query(
            {
              sql: "SELECT * FROM users WHERE name=?",

              values: [user],
            },
            function (err, results) {
              if (err) throw err;

              if (JSON.stringify(results) == "[]") {
                value = "User does not Exist!";
                socket.emit("returncommand", value);
              } else {
                try {
                  var query2 = db.query({
                    sql:
                      "UPDATE users SET accessTest='" +
                      test +
                      "' WHERE name='" +
                      user +
                      "'",
                  });

                  query2
                    .on("error", function (err) {
                      if (err) {
                        console.log(err.code);
                      }
                    })
                    .on("result", function (row) {
                      //Do something with your result.
                      value =
                        "Test: " +
                        test +
                        " Succesfully granted to " +
                        user +
                        ".";
                      socket.emit("returncommand", value);
                    });
                } catch (err) {
                  console.error("There was an error ", err);
                }
              }
            }
          );
        } catch (err) {
          console.error("There was an error ", err);
        }
      }
    } else if (icommand[0] == "rt") {
      user = icommand[1];
      try {
        db.query(
          {
            sql: "SELECT * FROM users WHERE name=?",

            values: [user],
          },
          function (err, results) {
            if (err) throw err;
            if (JSON.stringify(results) == "[]") {
              value = "User does not Exist!";
              socket.emit("returncommand", value);
            } else {
              try {
                var query = db.query({
                  sql:
                    "UPDATE users SET accessTest =" +
                    "''" +
                    ` WHERE name = '` +
                    user +
                    `'`,
                });

                query
                  .on("error", function (err) {
                    if (err) {
                      console.log(err.code);
                      // Do anything you want whenever there is an error.
                      // throw err;
                      //  value = "Test does not Exist!"
                      socket.emit("returncommand", value);
                    }
                  })
                  .on("result", function (row) {
                    //Do something with your result.

                    var query2 = db.query({
                      sql:
                        "UPDATE users SET canDoLessons =" +
                        "'true'" +
                        ` WHERE name = '` +
                        user +
                        `'`,
                    });

                    query2.on("error", function (err) {
                      if (err) {
                        console.log(err.code);
                        // Do anything you want whenever there is an error.
                        // throw err;
                        //  value = "Test does not Exist!"
                        socket.emit("returncommand", value);
                      }
                    });
                    query2.on("result", function (row) {
                      var query3 = db.query({
                        sql:
                          "UPDATE users SET canDoTests =" +
                          "'false'" +
                          ` WHERE name = '` +
                          user +
                          `'`,
                      });

                      query3.on("error", function (err) {
                        if (err) {
                          console.log(err.code);
                          // Do anything you want whenever there is an error.
                          // throw err;
                          //  value = "Test does not Exist!"
                          socket.emit("returncommand", value);
                        }
                      });

                      query3.on("result", function (row) {
                        value = "Succesfully removed test access to: " + user;
                        socket.emit("returncommand", value);
                      });
                    });
                  });
              } catch (err) {
                console.error("There was an error ", err);
              }
            }
          }
        );
      } catch (err) {
        console.error("There was an error ", err);
      }
    } else if (icommand[0] == "rp") {
      user = icommand[1];
      password = "12345";
      passwordconfirm = "12345";
      var returnc = "";

      const saltPasswordAsync = (Password) =>
        new Promise((resolve, reject) => {
          bcrypt.hash(password, 8, (err, hash) => {
            if (err) reject(err);
            else resolve(hash);
          });
        });

      async function getHash() {
        try {
          const hash = await saltPasswordAsync(password);
          db.query(
            {
              sql: "UPDATE users SET password = ? WHERE name = ?",
              values: [hash, user],
            },
            function (err, results) {
              if (err) throw err;
              console.error("There was an error ", err);
              returnc = `Password for ${user} is now ${password}`;
              socket.emit("returncommand", returnc);
            }
          );
        } catch (err) {
          console.error("There was an error ", err);
          socket.emit("returncommand", err);
        }
      }

      if (password.length === 0 && passwordconfirm.length === 0) {
        returnc = "Password cannot be blank";
        socket.emit("returncommand", returnc);
      } else if (password.length === 0 || passwordconfirm.length === 0) {
        returnc = "Password cannot be blank";
        socket.emit("returncommand", returnc);
      } else if (password !== passwordconfirm) {
        returnc = `Passwords do not match :(`;
        socket.emit("returncommand", returnc);
      } else if (password.length < 5 && passwordconfirm.length < 5) {
        returnc = "Password must be more than 6 charectors!";
        socket.emit("returncommand", returnc);
      } else if (password.length < 5 || passwordconfirm.length < 5) {
        returnc = "Password must be more than 6 charectors!";
        socket.emit("returncommand", returnc);
      } else if (password.length >= 5 && password == passwordconfirm) {
        hash = getHash();
        returnc = "Password reset!";
        //  socket.emit('returncommand', returnc)
      }
    } else if (icommand[0] == "mu") {
      user = icommand[1];
      courseac = icommand[2];

      let hashedPassword = await bcrypt.hash("12345", 8);
      try {
        db.query(
          "SELECT * FROM users WHERE name = ?",
          [user],
          (error, result) => {
            if (!result[0]) {
              if (courseac.includes(",") == false) {
                db.query(
                  `INSERT INTO users SET ?`,
                  {
                    name: user,
                    password: hashedPassword,
                    accessCourse: courseac,
                    accessUnit: `${courseac[0].slice(0, 1)}01`,
                    grades: "[]",
                    AdminTestWrong: "[]",
                    canDoTests: "false",
                    canDoLessons: "true",
                  },
                  (error, result) => {
                    let dir = `./public/users/${user}`;
                    if (!fs.existsSync(dir)) {
                      fs.mkdirSync(dir);
                    }
                    returnc = "User created.";
                    socket.emit("returncommand", returnc);
                  }
                );
              } else if (courseac.includes(",") == true) {
                let courseSplited = courseac.split(/(?:,| )+/);
                let accessUnits = "";
                courseSplited.forEach((x) => {
                  if (!accessUnits) {
                    accessUnits += `${x.slice(0, 1)}01`;
                  } else {
                    accessUnits += `,${x.slice(0, 1)}01`;
                  }
                });
                db.query(
                  `INSERT INTO users SET ?`,
                  {
                    name: user,
                    password: hashedPassword,
                    accessCourse: courseac,
                    accessUnit: `${accessUnits}`,
                    grades: "[]",
                    AdminTestWrong: "[]",
                    canDoTests: "false",
                    canDoLessons: "true",
                  },
                  (error, result) => {
                    let dir = `./public/users/${user}`;
                    if (!fs.existsSync(dir)) {
                      fs.mkdirSync(dir);
                    }
                    returnc = "User created.";
                    socket.emit("returncommand", returnc);
                  }
                );
              }
            } else {
              returnc = `User already exists. Username:${result[0].name} AccessCourse: ${result[0].accessCourse} Lesson: ${result[0].accessUnit}`;
              socket.emit("returncommand", returnc);
            }
          }
        );
      } catch (err) {
        console.log(err);
      }
    } else if (icommand[0] == "du") {
      user = icommand[1];
      try {
        var du = db.query(`DELETE FROM users where name = '${user}'`);
        try {
          fs.rmSync(`./public/users/${user}`, { recursive: true }, (err) => {
            if (err) {
              throw err;
            }
          });
        } catch (err) {
          console.log(err);
        }
        du.on("error", function (err) {
          console.log("Query error: " + err);
        });
        du.on("result", function (row) {
          returnc = "User deleted.";
          socket.emit("returncommand", returnc);
        });
      } catch (err) {
        console.log(err);
      }
    } else if (icommand[0] == "al") {
      user = icommand[1];
      lesson = icommand[2];
      if (lesson == undefined || lesson == "") {
        value = "Invalid Test Name!";
        socket.emit("returncommand", value);
      } else {
        try {
          db.query(
            {
              sql: "SELECT * FROM users WHERE name=?",
              values: [user],
            },
            function (err, results) {
              if (err) throw err;
              if (JSON.stringify(results) == "[]") {
                value = "User does not Exist!";
                socket.emit("returncommand", value);
              } else {
                try {
                  if (
                    lesson.includes("w") == true ||
                    lesson.includes("j") == true ||
                    lesson.includes("s") == true ||
                    lesson.includes("c") == true ||
                    lesson.includes("p") == true
                  ) {
                    try {
                      var query7 = db.query({
                        sql:
                          "UPDATE users SET accessUnit='" +
                          lesson +
                          "' WHERE name='" +
                          user +
                          "'",
                      });
                      query7
                        .on("error", function (err) {
                          if (err) {
                            console.log(err.code);
                            // Do anything you want whenever there is an error.
                            // throw err;
                            value = "Error.";
                            socket.emit("returncommand", value);
                          }
                        })
                        .on("result", function (row) {
                          value = `Lesson access for ${user} is now: ${lesson}`;
                          socket.emit("returncommand", value);
                        });
                    } catch (err) {
                      console.error("There was an error ", err);
                    }
                  } else {
                    value = `Lesson format is invalid: ${lesson}. `;
                    socket.emit("returncommand", value);
                  }
                } catch (err) {
                  console.error("There was an error ", err);
                }
              }
            }
          );
        } catch (err) {
          console.error("There was an error ", err);
        }
      }
    } else if (icommand[0] == "ale") {
      user = icommand[1];
      lesson = icommand[2];

      try {
        var query5 = db.query({
          sql: "SELECT accessUnit FROM users WHERE name = " + `'${user}'`,
        });
        query5
          .on("error", function (err) {
            if (err) {
              console.log(err.code);
              // Do anything you want whenever there is an error.
              // throw err;
              value = "Test does not Exist!";
              socket.emit("returncommand", value);
            }
          })
          .on("result", function (row) {
            let oldunit = row.accessUnit;
            if (
              lesson.includes("w") == true ||
              lesson.includes("j") == true ||
              lesson.includes("s") == true ||
              lesson.includes("c") == true ||
              lesson.includes("p") == true
            ) {
              let newunit = oldunit + `,${lesson}`;
              try {
                var query7 = db.query({
                  sql:
                    "UPDATE users SET accessUnit='" +
                    newunit +
                    "' WHERE name='" +
                    user +
                    "'",
                });
                query7
                  .on("error", function (err) {
                    if (err) {
                      console.log(err.code);
                      // Do anything you want whenever there is an error.
                      // throw err;
                      value = "Error.";
                      socket.emit("returncommand", value);
                    }
                  })
                  .on("result", function (row) {
                    value = `Lesson access for ${user} is now: ${newunit}`;
                    socket.emit("returncommand", value);
                  });
              } catch (err) {
                console.error("There was an error ", err);
              }
            } else {
              value = `Lesson format is invalid: ${lesson}. `;
              socket.emit("returncommand", value);
            }
          });
      } catch (err) {
        console.error("There was an error ", err);
      }
    } else if (icommand[0] == "bc") {
      let message;
      if (icommand[1] == undefined || icommand[1] == "") {
        value = "Error broadcasting requires a message!";
        socket.emit("returncommand", value);
      }
      if (icommand[1] == "clear") {
        alert = "";
        value = "Cleared message on homepage.";
        socket.emit("returncommand", value);
      } else {
        message = `<h3>${command.slice(icommand[0].length)}</h3>`;
        alert = message;
        value = `Message: ${alert} is now live on the homepage.`;
        socket.emit("returncommand", value);
      }
      socket.emit("gotAlert", alert);
    } else if (icommand[0] == "cta") {
      test = icommand[1];
      question = icommand[2];
      newans = icommand[3].toUpperCase();
      let newAA;
      db.query({
        sql: `SELECT * FROM ${test} WHERE q = ${question} `,
      }).on("result", function (row) {


        let numberPortion
        let bruh = /\d/.test(row.a);

        if (bruh === true) {
          numberPortion = row.a.match(/\d+/)[0];
          newAA = newans + numberPortion
        } else {
          newAA = newans
        }


        try {
          db.query({
            sql: `UPDATE ${test} SET a = '${newAA}' WHERE q = ${question}`,
          }).on("result", function () {
            socket.emit(
              "returncommand",
              `Updated the answer for ${test}'s question ${question} to ${newAA}.`
            );
          });
        } catch (err) {
          console.log(err);
        }
      });
    } else if (icommand[0] == "cc") {
      let user = icommand[1];
      let course = icommand[2];
      if (
        course == "web" ||
        course == "python" ||
        course == "java" ||
        course == "cpp" ||
        course == "scratch" ||
        course == "root"
      ) {
        try {
          db.query(
            {
              sql: "SELECT * FROM users WHERE name=?",

              values: [user],
            },
            function (err, results) {
              if (err) throw err;

              if (JSON.stringify(results) == "[]") {
                value = "User does not Exist!";
                socket.emit("returncommand", value);
              } else {
                try {
                  var query2 = db.query({
                    sql:
                      "UPDATE users SET accessCourse='" +
                      course +
                      "' WHERE name='" +
                      user +
                      "'",
                  });

                  query2
                    .on("error", function (err) {
                      if (err) {
                        console.log(err.code);
                      }
                    })
                    .on("result", function (row) {
                      //Do something with your result.
                      value =
                        "Course: " +
                        course +
                        " Succesfully granted to " +
                        user +
                        ".";
                      socket.emit("returncommand", value);
                    });
                } catch (err) {
                  console.error("There was an error ", err);
                }
              }
            }
          );
        } catch (err) {
          console.error("There was an error ", err);
        }
      } else {
        value = `Course doesn't exist!`;
        socket.emit("returncommand", value);
      }
    } else if (icommand[0] == "ac") {
      let course = icommand[2];
      let user = icommand[1];
      let newc;
      if (
        course == "web" ||
        course == "python" ||
        course == "java" ||
        course == "cpp" ||
        course == "scratch" ||
        course == "root"
      ) {
        try {
          db.query(
            {
              sql: "SELECT * FROM users WHERE name=?",

              values: [user],
            },
            function (err, results) {
              if (err) throw err;

              if (JSON.stringify(results) == "[]") {
                value = "User does not Exist!";
                socket.emit("returncommand", value);
              } else {
                newc = results[0].accessCourse;
                try {
                  var query2 = db.query({
                    sql:
                      "UPDATE users SET accessCourse='" +
                      `${newc},${course}` +
                      "' WHERE name='" +
                      user +
                      "'",
                  });

                  query2
                    .on("error", function (err) {
                      if (err) {
                        console.log(err.code);
                      }
                    })
                    .on("result", function (row) {
                      //Do something with your result.
                      value =
                        "Course: " +
                        `${newc},${course}` +
                        " Succesfully granted to " +
                        user +
                        ".";
                      socket.emit("returncommand", value);
                    });
                } catch (err) {
                  console.error("There was an error ", err);
                }
              }
            }
          );
        } catch (err) {
          console.error("There was an error ", err);
        }
      } else {
        value = `Course doesn't exist!`;
        socket.emit("returncommand", value);
      }
    } else if (icommand[0] == "rc") {
      let user = icommand[1];
      let c = icommand[2];
      let newc = "";
      if (
        c == "web" ||
        c == "java" ||
        c == "cpp" ||
        c == "python" ||
        c == "scratch"
      ) {
        try {
          db.query(
            {
              sql: "SELECT * FROM users WHERE name=?",

              values: [user],
            },
            function (err, results) {
              if (err) throw err;

              if (JSON.stringify(results) == "[]") {
                value = "User does not Exist!";
                socket.emit("returncommand", value);
              } else {
                let javascriptIsStupid = results[0].accessCourse;
                if (javascriptIsStupid.includes(",")) {
                  let lol = results[0].accessCourse;

                  lol = lol.split(",");

                  lol.forEach((e) => {
                    if (e != c) {
                      newc = newc + "," + e;
                    }
                  });
                  newc = newc.slice(1);
                } else if (results[0].accessCourse == c) {
                  newc = "";
                }

                try {
                  var query2 = db.query({
                    sql:
                      "UPDATE users SET accessCourse='" +
                      `${newc}` +
                      "' WHERE name='" +
                      user +
                      "'",
                  });

                  query2
                    .on("error", function (err) {
                      if (err) {
                        console.log(err.code);
                      }
                    })
                    .on("result", function (row) {
                      //Do something with your result.
                      value =
                        "Course Access Succesfully changed to: " +
                        `${newc}` +
                        " for " +
                        user +
                        ".";
                      socket.emit("returncommand", value);
                    });
                } catch (err) {
                  console.error("There was an error ", err);
                }
              }
            }
          );
        } catch (err) {
          console.error("There was an error ", err);
        }
      } else {
        value = `ERROR: Cannot Remove Unkown Course: ${c}`;
        socket.emit("returncommand", value);
      }
    } else if (icommand[0] == "rl") {
    } else if (icommand[0] == "ctv") {

      test = icommand[1];
      question = icommand[2];
      newPoint = icommand[3];
      let oldQ;
      let newA;
      let parsedInt = parseInt(newPoint);

      // Checking if the parsing was successful
      if (!isNaN(parsedInt)) {
        try {

          db.query({
            sql: `SELECT * FROM ${test} WHERE q = ${question} `,
          }).on("result", function (row) {
            oldQ = row.a

            let hasNumber = /\d/.test(row.a);
            // Extracting letter portion
            let letterPortion = oldQ.match(/[A-Za-z]+/)[0];

            // Extracting number portion
            let bruh = /\d/.test(oldQ);
            let np;
            if (bruh === true) {
              np = oldQ.match(/\d+/)[0];
            } else {
              np = 1
            }

            if (newPoint != "1") {
              newA = letterPortion + newPoint
            } else {
              newA = letterPortion
            }

            try {
              db.query({
                sql: `UPDATE ${test} SET a = '${newA}' WHERE q = ${question}`,
              }).on("result", function () {
                socket.emit(
                  "returncommand",
                  `Updated the points for ${test}'s question ${question} from ${np} to ${newA}.`
                );
              });
            } catch (err) {
              console.log(err);
            }

          });

        } catch (err) {
          console.log(err)
        }
      } else {
        socket.emit("returncommand", `Error: ${newPoint} is not a valid int!`)
      }
    } else if (icommand[0] == "mtg") {
      userr = icommand[1];
      test = icommand[2];
      newPoint = icommand[3];
      let newg;
      let newgAdmin;
      if (userr && test && newPoint) {
        try {
          db.query({
            sql: `SELECT grades,AdminTestWrong FROM users WHERE ` + "name='" + userr + "'"
          }).on("result", function (row) {

            newg = JSON.parse(row.grades)
            newgAdmin = JSON.parse(row.AdminTestWrong)
            for (var i = 0; i < newg.length; i++) {
              if (newg[i].Test == test) {
                newg[i].Mark = newPoint;
                break;
              }
            }
            for (var i = 0; i < newgAdmin.length; i++) {
              if (newgAdmin[i].Test == test) {
                newgAdmin[i].Mark = newPoint;
                newgAdmin[i].Percent = ((newPoint / newgAdmin[i].Possible) * "100").toFixed(1) + "%";
                break;
              }
            }
            try {
              db.query({
                sql: `UPDATE users SET grades = '${JSON.stringify(newg)}' WHERE ` + "name='" + userr + "'",
              }).on("result", function () {
                try {
                  db.query({
                    sql: `UPDATE users SET AdminTestWrong = '${JSON.stringify(newgAdmin)}' WHERE ` + "name='" + userr + "'",
                  }).on("result", function () {
                    socket.emit(
                      "returncommand", `Updated mark for ${userr}'s ${test} test to ${newPoint}.`);
                  });
                } catch (err) {
                  console.log(err);
                }
              });
            } catch (err) {
              console.log(err);
            }
          });
        } catch (err) {
          console.log(err);
        }
      } else socket.emit("returncommand", "Error: One of the command arguments are missing!");
    } else if (icommand[0] == "cpn") {
      if (!icommand[1] || !icommand[2] || !icommand[3]) {
        socket.emit("returncommand", "Missing parameters");
      } else {
        let dirunit = icommand[1];
        let firstletter = dirunit.split("")[0];
        let alldir = fs.readdirSync(`./public/topics/`);
        let dir = alldir.find(element => element.includes(firstletter.toUpperCase()));
        if (
          dir == "Web" ||
          dir == "Java" ||
          dir == "Cpp" ||
          dir == "Scratch" ||
          dir == "Python"
          ) {
            try {
              let index = dirunit.split("").slice(1, 3).join("");
              let allunit = fs.readdirSync(`./public/topics/${dir}`);
              let unit = allunit.find(element => element.includes(index));
              let filesss = walk(`./public/topics/${dir}/${unit}`);
              let end = icommand.findIndex(element => element.includes(".pdf"));
              let includes = icommand.slice(2, end + 1).join(" ");
              let foundIndex = filesss.findIndex(element => element.includes(includes));
              let found = filesss[foundIndex];
              let endd = found.split("/");
              endd[endd.length - 1] = icommand.slice(end + 1).join(" ");
              let changed = endd.join("/");
              fs.renameSync(found, changed, function(err) {
                if (err) console.log('ERROR');
              });
              socket.emit("returncommand", changed);
            } catch(err) {
              socket.emit("returncommand", "Invalid file name");
            }
        } else {
          socket.emit("returncommand", "Invalid course");
        }
      }
    } else if (icommand[0] == "uce") {
      try {
        socket.emit("fileselection");
        let dirunit = icommand[1];
        let firstletter = dirunit.split("")[0];
        let alldir = fs.readdirSync(`./public/topics/`);
        let dir = alldir.find(element => element.includes(firstletter.toUpperCase()));
        let index = dirunit.split("").slice(1, 3).join("");
        let allunit = fs.readdirSync(`./public/topics/${dir}`);
        let unit = allunit.find(element => element.includes(index));
        let path = `./public/topics/${dir}/${unit}`;
        socket.emit("returncommand", path);
      } catch(err) {
        socket.emit("returncommand", err);
      }
    } else if (icommand[0] == "rf") {
      try {
        let dirunit = icommand[1];
        let firstletter = dirunit.split("")[0];
        let alldir = fs.readdirSync(`./public/topics/`);
        let dir = alldir.find(element => element.includes(firstletter.toUpperCase()));
        let index = dirunit.split("").slice(1, 3).join("");
        let allunit = fs.readdirSync(`./public/topics/${dir}`);
        let unit = allunit.find(element => element.includes(index));

        let filesss = walk(`./public/topics/${dir}/${unit}`);
        let end = icommand.length;
        let includes = icommand.slice(2, end).join(" ");
        let foundIndex = filesss.findIndex(element => element.includes(includes));
        
        let enterpath = filesss[foundIndex];

        fs.unlinkSync(enterpath);
        let filename = enterpath.slice(enterpath.lastIndexOf("/") + 1);
        socket.emit("returncommand", "\"" + filename + "\"" + " is deleted.");
      } catch (err) {
        socket.emit("returncommand", "Invalid input");
      }
      
    } else if (icommand[0] == "rep") {
      socket.emit("returncommand", "Loading...");
      let dir = icommand[1];
      let newpassword = icommand[2];
      
      if (dir == "web" || dir == "cpp" || dir == "scratch" || dir == "python" || dir == "java") {
        if (newpassword != "" && newpassword.length < 9) {
          db.query(
            "SELECT `password` FROM `pdfPassword` WHERE `topics` = '" + dir + "'",
            (error, result) => {
              if (error) {
                console.error("Database error:", error);
              } else {
                if (result.length > 0) {
                  let dir = icommand[1];
                  dir = dir[0].toUpperCase() + dir.slice(1);
                  let arr = walk(`./public/topics/${dir}`);
                  arr = arr.filter((element) => element.endsWith("pdf"));
                  let password = result[0].password;
                  function executeQpdf1Async(password, inputPath, outputPath) {
                    return new Promise((resolve, reject) => {
                      let cmd = `qpdf --decrypt --password=${password} "${inputPath}" "${outputPath}"`;
                     
                      exec(cmd, (err) => {
                        if (err) {
                          reject(err);
                        } else {
                          resolve();
                        }
                      });
                    });
                  }
                  function executeQpdf2Async(inputPath, outputPath) {
                    return new Promise((resolve, reject) => {
                      let cmd = `qpdf --encrypt ${newpassword} ${newpassword} 40 -- "${inputPath}" "${outputPath}"`;
                     
                      exec(cmd, (err) => {
                        if (err) {
                          reject(err);
                        } else {
                          resolve();
                        }
                      });
                    });
                  }
    
                  for (let i = 0; arr[i]; i++) {
                    let parts = arr[i].split("/");
                    let fileName = parts[parts.length - 1];
                    let unit = parts[4];
                    let enterpath = `./public/topics/${dir}/${unit}/${fileName}`;
                    let decpdf = `./public/topics/${dir}/${unit}/decrypted${i}.pdf`;
                    let encpdf = `./public/topics/${dir}/${unit}/encrypted${i}.pdf`;
                    
                    executeQpdf1Async(password, enterpath, decpdf)
                    .then(() => {
                      return fs.promises.unlink(enterpath);
                    })
                    .then(() => {
                      return executeQpdf2Async(decpdf, encpdf);
                    })
                    .then(() => {
                      return fs.promises.unlink(decpdf);
                    })
                    .then(() => {
                      return fs.promises.rename(encpdf, enterpath);
                    })
                    .then(() => {
                      socket.emit("returncommand", i);
                    })
                    .catch((err) => {
                      socket.emit("returncommand", `${enterpath}`);
                      console.log(err);
                    })
                  }
                }
                
              }
              
            }
          );
        } else {
          socket.emit("returncommand", "Length muse be less than nine characters and more than zero characters");
        }
      } else {
        socket.emit("returncommand", "Invalid topic");
      }
      if (dir == "web" || dir == "cpp" || dir == "scratch" || dir == "python" || dir == "java") {
        if (newpassword != "" && newpassword.length < 9) {
          db.query({
            sql: "UPDATE `pdfPassword` SET `password`='"+ newpassword +"' WHERE topics='" + dir +"'",
          });
          scandir();
        } else {
          socket.emit("returncommand", "Length muse be less than nine characters and more than zero characters");
        }
      } else {
        socket.emit("returncommand", "Invalid topic");
      }
    } else {
      value = `Unknown Command!`;
      socket.emit("returncommand", value);
    }
  });
  
  db.query(
    "SELECT `password` FROM `pdfPassword`",
    (error, result) => {
      if (error) {
        console.error("Database error:", error);
      } else {
        if (result.length > 0) {
          socket.emit("gibPDFPass", {web: result[0].password, scratch: result[1].password, python: result[2].password, cpp: result[3].password, java: result[4].password});
        }
      }
    }
  );

  try {
    if (token) {
      db.query(
        "SELECT `accessCourse` FROM users WHERE id = ?",
        [token.id],
        (error, result) => {
          if (result[0]) {
            socket.emit("hasAccessCourse", result[0].accessCourse);
          }
        }
      );
      db.query(
        "SELECT `accessUnit` FROM users WHERE id = ?",
        [token.id],
        (error, result) => {
          if (result[0]) {
            socket.emit("hasAccessUnit", result[0].accessUnit);
          }
        }
      );
      db.query(
        "SELECT `accessTest` FROM users WHERE id = ?",
        [token.id],
        (error, result) => {
          if (result[0]) {
            socket.emit("hasAccessTest", result[0].accessTest);
          }
        }
      );
    }
  } catch (err) {
    console.log(err);
  }

  socket.on("csvPush", async function (name, courses, callback) {
    let hashedPassword = await bcrypt.hash("12345", 8);
    try {
      db.query(
        `SELECT name FROM users WHERE name = ${name}`,
        (error, result) => {
          if (!result) {
            let courseSplited = courses.split(/(?:,| )+/);
            if (courseSplited.length == 1) {
              db.query(
                `INSERT INTO users SET ?`,
                {
                  name: name,
                  password: hashedPassword,
                  accessCourse: courses,
                  accessUnit: `${courses[0].slice(0, 1)}01`,
                  grades: "[]",
                  AdminTestWrong: "[]",
                  canDoTests: "false",
                  canDoLessons: "true",
                },
                (error, result) => {
                  let dir = `./public/users/${name}`;
                  if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                  }
                  callback(`Userbase Updated!`);
                }
              );
            } else {
              let accessUnits = "";
              courseSplited.forEach((x) => {
                if (!accessUnits) {
                  accessUnits += `${x.slice(0, 1)}01`;
                } else {
                  accessUnits += `,${x.slice(0, 1)}01`;
                }
              });
              db.query(
                `INSERT INTO users SET ?`,
                {
                  name: name,
                  password: hashedPassword,
                  accessCourse: courses,
                  accessUnit: `${accessUnits}`,
                  grades: "[]",
                  AdminTestWrong: "[]",
                },
                (error, result) => {
                  let dir = `./public/users/${name}`;
                  if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                  }
                  callback(`Userbase Updated!`);
                }
              );
            }
          }
        }
      );
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("csvDeleteStudents", async function (data) {
    if (data) {
      let dbFilterList = "";
      for (let i = 0; i < data.length; i++) {
        if (i === data.length - 1) {
          dbFilterList += `'${data[i]}'`;
        } else {
          dbFilterList += `'${data[i]}',`;
        }
      }
      try {
        db.query(
          `DELETE FROM users where name NOT IN ('wliem',${dbFilterList})`
        );

        fs.readdir("./public/users", (err, files) => {
          if (!err) {
            let folderFilterList = [];
            folderFilterList.push("wliem");
            for (let i = 0; i < data.length; i++) {
              folderFilterList.push(data[i]);
            }
            var filtered = files.filter(
              (item) => !folderFilterList.includes(item)
            );
            filtered.forEach(function (e) {
              fs.rmSync(`./public/users/${e}`, {
                recursive: true,
                force: true,
              });
            });
          } else {
            console.log("Failed to init readdir.", err);
          }
        });
      } catch (err) {
        console.log(err);
      }
    } else {
      try {
        db.query(`DELETE FROM users where name NOT IN ('wliem')`);

        fs.readdir("./public/users", (err, files) => {
          if (!err) {
            let folderFilterList = [];
            folderFilterList.push("wliem");
            var filtered = files.filter(
              (item) => !folderFilterList.includes(item)
            );
            filtered.forEach(function (e) {
              fs.rmSync(`./public/users/${e}`, {
                recursive: true,
                force: true,
              });
            });
          } else {
            console.log("Failed to init readdir.", err);
          }
        });
      } catch (err) {
        console.log(err);
      }
    }
  });

  socket.on("getfile", function (path) {
    try {
      if (fs.lstatSync(path).isDirectory() === true) {
        fs.readdir(path, (err, files) => {
          if (err) console.log(err);
          else {
            // callback(files)
            socket.emit("returnvalues", files);
          }
        });
      } else if (fs.lstatSync(path).isDirectory() === false) {
        let data = fs.readFileSync(path, { encoding: "utf8", flag: "r" });
        // callback(data);
        socket.emit("returnvaluestext", data);
      }
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("savefile", function ({ data, path }) {
    if (path.includes(".js")) {
      if (
        data.includes("socket".toLowerCase()) ||
        data.includes("socket.io".toLowerCase())
      ) {
      } else {
        fs.writeFile(path, data, (err) => {
          if (err) {
            console.log(err);
          }
        });
      }
    } else {
      fs.writeFile(path, data, (err) => {
        if (err) {
          console.log(err);
        }
      });
    }
  });

  socket.on("binary-upload", function (message) {
    var writer = fs.createWriteStream(message.path, {
      encoding: "base64",
    });

    writer.write(message.data);
    writer.end();

    writer.on("finish", function () {
      socket.emit("refresh");
    });
  });

  socket.on("binary-upload-pdf", function (message) {
    var writer = fs.createWriteStream(message.path, {
      encoding: "base64",
    });

    writer.write(message.data);
    writer.end();

    writer.on("finish", function () {
      socket.emit("refresh");
      scandir();
    });
  });

  let receivedChunks = [];

  socket.on('dataChunk', ({data, path}) => {
    receivedChunks.push(data);
    if (receivedChunks.length == 30) {
      if (fs.existsSync(path) === false) {
        socket.emit("returncommand", "Loading...");
        let data = Buffer.concat(receivedChunks);
        receivedChunks = [];
        let spath = path.split("/");
        let dir = spath[3];
        let unit = spath[4];
        let ipath = path;
        let cpath = path.replace(".docx", ".pdf");
        let epath = `./public/topics/${dir}/${unit}/encrypted.pdf`;
        function writeFileAsync(path, data) {
          return new Promise((resolve, reject) => {
            fs.writeFile(path, data, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }
        function convertAsync(inputPath, outputPath) {
          return fs.promises.readFile(inputPath)
            .then(docxBuf => {
              return new Promise((resolve, reject) => {
                libre.convert(docxBuf, ".pdf", undefined, (err, pdfBuf) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve(pdfBuf);
                  }
                });
              });
            })
            .then(pdfBuf => {
              return fs.promises.writeFile(outputPath, pdfBuf);
            });
        }
        function executeQpdfAsync(inputPath, outputPath) {
          return new Promise((resolve, reject) => {
            const cmd = `qpdf --encrypt ${process.env.PDF_PASSWORD} ${process.env.PDF_PASSWORD} 40 -- "${inputPath}" "${outputPath}"`;
           
            exec(cmd, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }
        writeFileAsync(ipath, data)
          .then(() => {
            return convertAsync(ipath, cpath);
          })
          .then(() => {
            return fs.promises.unlink(ipath);
          })
          .then(() => {
            return executeQpdfAsync(cpath, epath);
          })
          .then(() => {
            return fs.promises.unlink(cpath);
          })
          .then(() => {
            return fs.promises.rename(epath, cpath);
          })
          .then(() => {
            socket.emit("returncommand", "File encrypted");
            scandir();
          })
          .catch((err) => {
            socket.emit("returncommand", err);
          });
      }
    }
  });

  socket.on("uploadfile", function ({ data, path }) {
    //https://subscription.packtpub.com/book/web-development/9781785880865/7/ch07lvl1sec48/uploading-an-image-to-the-filesystem -- gonna immplement this instead of current way of uploading stuff

    // current way can only handle plain text files

    let filetype = path.substring(path.lastIndexOf("."));

    if (
      filetype == ".html" ||
      filetype == ".js" ||
      filetype == ".css" ||
      filetype == ".py" ||
      filetype == ".java" ||
      filetype == ".cpp" ||
      filetype == ".png" ||
      filetype == ".jpeg" ||
      filetype == ".gif" ||
      filetype == ".svg" ||
      filetype == ".h"
    ) {
      try {
        if (fs.existsSync(path) === false) {
          if (path.includes(".js")) {
            if (
              data.includes("socket".toLowerCase()) ||
              data.includes("io".toLowerCase()) ||
              data.includes("socket.io".toLowerCase())
            ) {
            }
          } else {
            fs.writeFile(path, data, function (err) {
              if (err) throw err;
            });
          }

          socket.emit("refresh");
        }
      } catch (err) {
        console.error(err);
      }
    }
  });
  socket.on("delete", function (path) {
    if (path.endsWith(".java")) {
      let classpath = path.slice(0, -4) + "class";
      if (fs.existsSync(classpath)) {
        fs.rm(classpath, { recursive: true }, (err) => {
          if (err) {
            throw err;
          } else {
            socket.emit("refresh");
          }
        });
      }
    }
    if (fs.existsSync(path)) {
      fs.rm(path, { recursive: true }, (err) => {
        if (err) {
          throw err;
        } else {
          socket.emit("refresh");
        }
      });
    }
  });

  socket.on("delete-pdf", function (path) {
    if (fs.existsSync(path)) {
      fs.rm(path, { recursive: true }, (err) => {
        if (err) {
          throw err;
        } else {
          socket.emit("refresh");
          scandir();
        }
      });
    }
  });

  socket.on("scandir", function (callback) {
    scandir();
    callback("Rescanned PDF directories, Courses should be refreshed now.");
  });
  
  socket.on("makedir", function (dir, callback) {
    let check = dir.substring(1);
    if (fs.existsSync(dir) === true) {
      callback("Error: Directory or File already exists!");
    } else if (check.includes(".") === true) {
      let filetype = dir.substring(dir.lastIndexOf("."));
      if (
        filetype == ".html" ||
        filetype == ".js" ||
        filetype == ".css" ||
        filetype == ".py" ||
        filetype == ".java" ||
        filetype == ".cpp" ||
        filetype == ".h"
      ) {
        if (filetype == ".java") {
          let classname = /[^/]*$/.exec(dir)[0].slice(0, -5);
          let content = `public class ${classname} {\n\n\n}`;
          fs.writeFile(dir, content, function (err) {
            if (err) throw err;
          });
        } else {
          fs.writeFile(dir, "", function (err) {
            if (err) throw err;
          });
        }
        socket.emit("refresh");
      }
    } else {
      fs.mkdirSync(dir, { recursive: true });
      socket.emit("refresh");
    }
  });

  socket.on("python", function (filepath, user) {
    const { spawn } = require("child_process");

    let thingy = 0;
    let parts = filepath.split("/");
    let namee = parts[parts.length - 1];

    function shield() {
      return new Promise((resolve) => {
        let shield;
        let code;
        let script;
        fs.readFile("./shield/shield.py", "utf8", function (err, data) {
          shield = data;
          fs.readFile(filepath, "utf8", function (err, data) {
            code = data;
            script = shield + "\n\n" + code;
            fs.writeFile(`./temp/${user}${namee}`, script, (err) => {
              if (err) {
                console.log(err);
              }
              resolve("resolved");
            });
          });
        });
      });
    }
    async function asyncCall() {
      const result = await shield();
      const python = spawn("python3 " + `./temp/${user}${namee}`, {
        shell: true,
      });
      socket.emit("Program Status", "active");
      socket.on("userinput", function (input) {
        python.stdin.setEncoding("utf-8");
        python.stdin.write(input + "\n");
        python.stdout.pipe(process.stdout);
      });
      socket.on("kill", function (callback) {
        python.kill();
        thingy = 1;
        callback("lol");
      });
      python.stdout.on("data", function (data) {
        socket.emit("output", data.toString());
      });
      python.stderr.on("data", (data) => {
        if (thingy != 1) {
          socket.emit("output", data.toString());
        }
      });
      python.on("error", (error) => {
        socket.emit("output", error.toString());
      });
      python.on("close", (code) => {
        if (thingy != 1) {
          socket.emit("output", "[Exit Code 0]");
        }
        fs.rmSync(`./temp/${user}${namee}`, { recursive: true }, (err) => {
          if (err) {
            throw err;
          }
        });
      });
    }
    asyncCall();
  });

  socket.on("java", function (filepath) {
    const { spawn } = require("child_process");

    function javac() {
      return new Promise((resolve) => {
        const javac = spawn("javac " + filepath, { shell: true });

        javac.stdout.on("data", function (data) {
          socket.emit("output", data.toString());
        });

        javac.stderr.on("data", (data) => {
          socket.emit("output", data.toString());
        });

        javac.on("error", (error) => {
          console.log(`error: ${error.message}`);
          socket.emit("output", error.toString());
        });

        javac.on("close", (code) => {
          resolve("resolved");
        });
      });
    }

    async function asyncCall() {
      const result = await javac();
      lastIndex = filepath.lastIndexOf("/");
      var clas = filepath.slice(lastIndex + 1);
      before = filepath.slice(0, lastIndex).substring(2);
      clas = clas.slice(0, -5);

      let lol = `./${before}`;
      const java = spawn("java -ea " + clas, { shell: true, cwd: lol });
      let thingy = 0;
      socket.on("userinput", function (input) {
        java.stdin.setEncoding("utf-8");
        java.stdin.write(input + "\n");
        java.stdout.pipe(process.stdout);
      });

      socket.on("kill", function (callback) {
        java.kill();
        thingy = 1;
        callback("lol");
      });

      java.stdout.on("data", function (data) {
        socket.emit("output", data.toString());
      });

      java.stderr.on("data", (data) => {
        if (thingy != 1) {
          socket.emit("output", data.toString());
        }
      });

      java.on("error", (error) => {
        console.log(`error: ${error.message}`);
        socket.emit("output", error.toString());
      });

      java.on("close", (code) => {
        if (thingy != 1) {
          socket.emit("output", "[Exit Code 0]");
        }
      });
    }

    asyncCall();
  });

  socket.on("cpp", function (filepath) {
    const { spawn } = require("child_process");

    var gpp = filepath.slice(0, -4);
    function gcc() {
      return new Promise((resolve) => {
        const gcc = spawn("g++ -o " + gpp + " " + filepath, { shell: "/bin/bash" });
        let dontrun = false;
        gcc.stdout.on("data", function (data) {
          socket.emit("output", data.toString());
        });

        gcc.stderr.on("data", (data) => {
          socket.emit("output", data.toString());
          if (data.toString().includes("error: ")) dontrun = true;
        });

        gcc.on("error", (error) => {
          console.log(`error: ${error.message}`);
          socket.emit("output", error.toString());
          dontrun = true
        });

        gcc.on("close", (code) => {
          socket.emit("addCode");
          socket.emit("dontRun")
          if (dontrun == false) resolve("resolved");
        });
      });
    }

    async function asyncCall() {
      const result = await gcc();
      let thingy = 0;
      lastIndex = filepath.lastIndexOf("/");
      var fileee = filepath.slice(lastIndex + 1).slice(0, -4);
      before = filepath.slice(0, lastIndex);

      const cpp = spawn("LD_PRELOAD=/home/liemcomputing/EasySandbox/EasySandbox.so ./" + fileee, { shell: "/bin/bash", cwd: before });

      socket.on("userinput", function (input) {
        cpp.stdin.setEncoding("utf-8");
        cpp.stdin.write(input + "\n");
        cpp.stdout.pipe(process.stdout);
      });
      socket.on("kill", function (callback) {
        cpp.kill();
        thingy = 1;
        callback("lol");
      });
      cpp.stdout.on("data", function (data) {
        socket.emit("output", data.toString());
      });

      cpp.stderr.on("data", (data) => {
        if (thingy != 1) {
          socket.emit("output", data.toString());
        }
      });

      cpp.on("error", (error) => {
        console.log(`error: ${error.message}`);
        socket.emit("output", error.toString());
      });

      cpp.on("close", (code) => {
        socket.emit("output", "[Exit Code 0]");
        socket.emit("closed");
      });
    }

    asyncCall();
  });

  socket.on(
    "marktest",
    function (testName, studentResponse, student, unit, check, callback) {
      let usernamee = student;
      let unittt = unit;
      let tests = testName;
      let obj = studentResponse;
      let marksbe4 = "";
      let total = 0;
      let wrong = "";
      let checking = undefined;
      let score = 0;
      let objgrades = "";
      let objgradesAdmin = "";
      let retest = false;






      try {
        db.query(
          {
            sql: "SELECT * FROM users" + ` WHERE name = '` + usernamee + `'`,
          },
          function (err, results) {
            if (err) throw err;

            console.log(results[0].accessTest, testName, check)

            if (results[0].accessTest == check) {




              try {
                db.query(
                  {
                    sql: "SELECT * FROM " + tests,
                  },
                  function (err, results) {
                    if (err) throw err;
                  }
                );
              } catch (err) {
                console.error("There was an error ", err);
              }

              try {
                db.query(
                  {
                    sql: "SELECT * FROM " + tests,
                  },
                  function (err, results) {
                    if (err) throw err;

                    marksbe4 = Object.values(JSON.parse(JSON.stringify(results)));
                    for (let i = 0; i < marksbe4.length; i++) {
                      checking = marksbe4[i].a
                        .toLowerCase()
                        .replace(/[0-9]/g, "")
                        .replace(/\s/g, "");
                      if (obj[i]) {
                        answer = obj[i].a;
                      } else {
                        answer = undefined;
                      }

                      let anothaObj = {
                        q: marksbe4[i].a,
                      };
                      var poopitypoop = JSON.stringify(anothaObj)
                        .substring(5)
                        .slice(0, -1)
                        .substring(1)
                        .slice(0, -1)
                        .replace(/\D/g, "");
                      if (poopitypoop == "") {
                        total = total + 1;

                        if (answer == checking) {
                          score = score + 1;
                        } else if (answer != checking) {
                          wrong = wrong + " " + marksbe4[i].q + ":[" + answer + "]";
                        }
                      } else {
                        total = total + parseInt(poopitypoop);
                        if (answer == checking) {
                          score = score + parseInt(poopitypoop);
                        } else if (answer != checking) {
                          wrong = wrong + " " + marksbe4[i].q + ":[" + answer + "]";
                        }
                      }
                    }

                    callback(`${score}/${total}`);
                  }
                );
              } catch (err) {
                console.error("There was an error ", err);
              }
              let wrong2 = wrong.slice(1);
              wrong = wrong2;
              try {
                db.query(
                  {
                    sql:
                      "SELECT grades FROM users" + ` WHERE name = '` + usernamee + `'`,
                  },
                  function (err, results) {
                    if (err) throw err;

                    let newgrade = JSON.parse(results[0].grades);
                    for (let i = 0; i < newgrade.length; i++) {
                      if (newgrade[i].Test == tests) {
                        newgrade[i].Mark = score;
                        retest = true;
                      }
                    }

                    if (!retest) {
                      if (results[0].grades.length == 2 ) {
                        objgrades =
                          results[0].grades.slice(0, -1) +
                          '{"Test":' +
                          '"' +
                          tests +
                          '"' +
                          ',"Mark":' +
                          score +
                          ',"Possible":' +
                          total +
                          "}]";
                      } else {
                        objgrades =
                          results[0].grades.slice(0, -1) +
                          ',{"Test":' +
                          '"' +
                          tests +
                          '"' +
                          ',"Mark":' +
                          score +
                          ',"Possible":' +
                          total +
                          "}]";
                      }
                    } else {
                      objgrades = JSON.stringify(newgrade);
                    }

                    try {
                      db.query(
                        {
                          sql:
                            "UPDATE users SET grades =" +
                            "'" +
                            objgrades +
                            "'" +
                            ` WHERE name = '` +
                            usernamee +
                            `'`,
                        },
                        function (err, results) {
                          if (err) throw err;
                        }
                      );
                    } catch (err) {
                      console.error("There was an error ", err);
                    }

                    try {
                      db.query(
                        {
                          sql:
                            "UPDATE users SET accessTest =" +
                            "'" +
                            "'" +
                            ` WHERE name = '` +
                            usernamee +
                            `'`,
                        },
                        function (err, results) {
                          if (err) throw err;
                        }
                      );
                    } catch (err) {
                      console.error("There was an error ", err);
                    }

                    try {
                      db.query(
                        {
                          sql:
                            "SELECT AdminTestWrong FROM users" +
                            ` WHERE name = '` +
                            usernamee +
                            `'`,
                        },
                        function (err, results) {
                          if (err) throw err;
                          let percent = ((score / total) * "100").toFixed(1) + "%";

                          let newAdmin = JSON.parse(results[0].AdminTestWrong);
                          for (let i = 0; i < newAdmin.length; i++) {
                            if (newAdmin[i].Test == tests) {
                              newAdmin[i].Mark = score;
                              newAdmin[i].Percent = percent;
                              newAdmin[i].Wrong = wrong;
                              retest = true;
                            }
                          }

                          if (!retest) {
                            if (results[0].AdminTestWrong.length == 2 && !retest) {
                              objgradesAdmin =
                                results[0].AdminTestWrong.slice(0, -1) +
                                '{"Test":' +
                                '"' +
                                tests +
                                '"' +
                                ',"Mark":' +
                                score +
                                ',"Possible":' +
                                total +
                                ',"Percent":"' +
                                percent +
                                '","Wrong":"' +
                                wrong +
                                '"}]';
                            } else {
                              objgradesAdmin =
                                results[0].AdminTestWrong.slice(0, -1) +
                                ',{"Test":' +
                                '"' +
                                tests +
                                '"' +
                                ',"Mark":' +
                                score +
                                ',"Possible":' +
                                total +
                                ',"Percent":"' +
                                percent +
                                '","Wrong":"' +
                                wrong +
                                '"}]';
                            }
                          } else {
                            objgradesAdmin = JSON.stringify(newAdmin);
                          }

                          try {
                            db.query(
                              {
                                sql:
                                  "UPDATE users SET AdminTestWrong =" +
                                  "'" +
                                  objgradesAdmin +
                                  "'" +
                                  ` WHERE name = '` +
                                  usernamee +
                                  `'`,
                              },
                              function (err, results) {
                                if (err) throw err;
                              }
                            );
                          } catch (err) {
                            console.error("There was an error ", err);
                          }
                        }
                      );
                    } catch (err) {
                      console.error("There was an error ", err);
                    }

                    if (unit != "root") {
                      let detect = tests.substring(0, 1);
                      let position = unittt.search(detect);
                      let nextunittt = unittt
                        .substring(position, position + 3)
                        .slice(-2);
                      parseInt(nextunittt);

                      nextunittt++;

                      if (nextunittt < 10) {
                        nextunittt = "0" + nextunittt.toString();
                      } else {
                        nextunittt.toString();
                      }

                      unittt =
                        unittt.substring(0, position) +
                        detect +
                        nextunittt +
                        unittt.substring(position + 3, unittt.length);
                    } else {
                      unittt = "root";
                    }

                    db.query(
                      `SELECT accessUnit FROM users WHERE name = '${usernamee}'`,
                      (error, result) => {
                        if (result[0]) {
                          if (result[0].accessUnit.slice(-2) == tests.slice(-2)) {
                            try {
                              db.query(
                                {
                                  sql:
                                    "UPDATE users SET accessUnit =" +
                                    "'" +
                                    unittt +
                                    "'" +
                                    ` WHERE name = '` +
                                    usernamee +
                                    `'`,
                                },
                                function (err, results) {
                                  if (err) throw err;
                                }
                              );
                            } catch (err) {
                              console.error("There was an error ", err);
                            }
                          }
                        }
                      }
                    );
                  }
                );
              } catch (err) {
                console.error("There was an error ", err);
              }
            }
          }
        );
      } catch (err) {
        console.error("There was an error ", err);
      }
    }
  );

  socket.on("sendSusTest", function (user) {
    socket.broadcast.emit("adminSusMessage", user);
  });

  socket.on("studentActivity", function (msg) {
    socket.broadcast.emit("adminStudentActivity", msg);
  });

  socket.on("tempAnswer", function (data) {
    let user = data.user;
    let answer = data.answer;
    try {
      db.query(
        {
          sql:
            "UPDATE users SET tempAnswer =" +
            "'" +
            answer +
            "'" +
            ` WHERE name = '` +
            user +
            `'`,
        },
        function (err, results) {
          if (err) throw err;
        }
      );
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("getAnswers", function (user, callback) {
    try {
      db.query(
        {
          sql: "SELECT tempAnswer FROM users" + ` WHERE name = '` + user + `'`,
        },
        function (err, results) {
          if (results[0]) {
            callback(results[0].tempAnswer);
          }
          
        }
      );
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("renamefile", function (filepath, newpath) {
    if (filepath.endsWith(".java")) {
      let classpath = filepath.slice(0, -4) + "class";
      if (fs.existsSync(classpath)) {
        fs.rm(classpath, { recursive: true }, (err) => {
          if (err) {
            throw err;
          }
        });
      }
    }
    fs.rename(filepath, newpath, function (err) {
      if (err) console.log("ERROR: " + err);
    });
    socket.emit("refresh");
  });

  socket.on("checkTest", function (user, callback) {
    try {
      db.query(
        {
          sql: "SELECT accessTest FROM users" + ` WHERE name = '` + user + `'`,
        },
        function (err, results) {
          if (err) throw err;
          if (results[0]) {
            if (results[0].accessTest == undefined) {
              callback("blank");
            } else if (results[0].accessTest == "") {
              callback("blank");
            } else {
              callback(results[0].accessTest);
            }
          } else {
            callback("blank");
          }
        }
      );
    } catch (err) {
      console.log(err);
    }
  });
  socket.on("lesson", function (user, path, callback) {
    var str = path.substring(0, path.length - 4);
    var n = str.lastIndexOf(".");
    var title = path.slice(n - 2, n);

    try {
      db.query(
        {
          sql: "SELECT accessUnit FROM users" + ` WHERE name = '` + user + `'`,
        },
        function (err, results) {
          if (err) throw err;
          if (results[0]) {
            let lesson = results[0].accessUnit;

            if (
              lesson.includes(title) ||
              user == "wliem" ||
              path.includes("00")
            ) {
              callback("good");
            } else {
              callback("bad");
            }
          }
        }
      );
    } catch (err) {
      console.log(err);
    }
  });
  socket.on("removeTestAccess", function (user) {
    try {
      db.query(
        {
          sql:
            "UPDATE users SET accessTest =" +
            "'" +
            "'" +
            ` WHERE name = '` +
            user +
            `'`,
        },
        function (err, results) {
          if (err) throw err;
        }
      );
    } catch (err) {
      console.log(err);
    }

    try {
      var query3 = db.query({
        sql:
          "UPDATE users SET canDoTests =" +
          "'false'" +
          ` WHERE name = '` +
          user +
          `'`,
      });

      query3.on("error", function (err) {
        if (err) {
          console.log(err.code);
        }
      });

      query3.on("result", function (row) { });
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("getCanDoTests", async function (user, callback) {
    if (!user) {
      try {
        db.query(
          {
            sql:
              "SELECT canDoTests FROM users" +
              ` WHERE name = '` +
              token.name +
              `'`,
          },
          function (err, results) {
            if (err) throw err;
            if (results[0]) {
              callback(results[0].canDoTests);
            }
          }
        );
      } catch (err) {
        console.log(err);
      }
    } else if (user) {
      try {
        db.query(
          {
            sql:
              "SELECT canDoTests FROM users" + ` WHERE name = '` + user + `'`,
          },
          function (err, results) {
            if (err) throw err;
            if (results[0]) {
              callback(results[0].canDoTests);
            }
          }
        );
      } catch (err) {
        console.log(err);
      }
    }
  });

  socket.on("getCanDoLessons", async function (user, callback) {
    if (!user) {
      try {
        db.query(
          {
            sql:
              "SELECT canDoLessons FROM users" +
              ` WHERE name = '` +
              token.name +
              `'`,
          },
          function (err, results) {
            if (err) throw err;
            if (results[0]) {
              callback(results[0].canDoLessons);
            }
          }
        );
      } catch (err) {
        console.log(err);
      }
    } else if (user) {
      try {
        db.query(
          {
            sql:
              "SELECT canDoLessons FROM users" + ` WHERE name = '` + user + `'`,
          },
          function (err, results) {
            if (err) throw err;
            if (results[0]) {
              callback(results[0].canDoLessons);
            }
          }
        );
      } catch (err) {
        console.log(err);
      }
    }
  });

  socket.on("sql", function (data) {
    if (data != "") {
      var query = db.query(
        {
          sql: data,
        },
        function (err, results) {
          try {
            if (err) throw err;
            if (results[0]) {
              socket.emit("sql-response", results);
            }
          } catch (err) { }
        }
      );

      query
        .on("error", function (err) {
          if (err) {
            console.log(err.code);
            socket.emit("sql-response", err.code);
            // Do anything you want whenever there is an error.
            // throw err;
          }
        })
        .on("result", function (results) {
          //Do something with your result.
          // console.log(results)
          // let result = Object.values(JSON.parse(JSON.stringify(results)));
          //  console.log(result)
        });
    }
  });

  socket.on("getusers", function (data) {
    var query = db.query(
      {
        sql: `SELECT * FROM` + " `users`",
      },
      function (err, results) {
        try {
          if (err) throw err;
          if (results[0]) {
            socket.emit("gotUsers", results);
          }
        } catch (err) { }
      }
    );

    query.on("error", function (err) {
      if (err) {
        console.log(err.code);
        socket.emit("sql-response", err.code);
        // Do anything you want whenever there is an error.
        // throw err;
      }
    });
  });

  socket.on("setCanDoTests", function (user, boolean) {
    if (!user) {
      try {
        db.query(
          {
            sql:
              "UPDATE users SET canDoTests =" +
              "'" +
              boolean +
              "'" +
              ` WHERE name = '` +
              token.name +
              `'`,
          },
          function (err, results) {
            if (err) throw err;
          }
        );
      } catch (err) {
        console.log(err);
      }
    } else if (user) {
      try {
        db.query(
          {
            sql:
              "UPDATE users SET canDoTests =" +
              "'" +
              boolean +
              "'" +
              ` WHERE name = '` +
              user +
              `'`,
          },
          function (err, results) {
            if (err) throw err;
          }
        );
      } catch (err) {
        console.log(err);
      }
    }
  });

  socket.on("setCanDoLessons", function (user, boolean) {
    if (!user) {
      try {
        db.query(
          {
            sql:
              "UPDATE users SET canDoLessons =" +
              "'" +
              boolean +
              "'" +
              ` WHERE name = '` +
              token.name +
              `'`,
          },
          function (err, results) {
            if (err) throw err;
          }
        );
      } catch (err) {
        console.log(err);
      }
    } else if (user) {
      try {
        db.query(
          {
            sql:
              "UPDATE users SET canDoLessons =" +
              "'" +
              boolean +
              "'" +
              ` WHERE name = '` +
              user +
              `'`,
          },
          function (err, results) {
            if (err) throw err;
          }
        );
      } catch (err) {
        console.log(err);
      }
    }
  });

  socket.on("getChecked", (data, student, exercise, callback) => {
         
    try {
      db.query(
        {
          sql:
            "SELECT script FROM exerciseScript" +
            ` WHERE exercise = '` +
            exercise +
            `'`,
        },
        function (err, results) {
          try {
            let script = `
            window.onload = async function () {
              let socket = io();
                
              let scores = [];
              let criteria = [];\n`;
            
            let scripts = JSON.parse(results[0].script);
            
            for (let i = 0; i < scripts.length; i++) {
              
              let required = scripts[i].Number + "<" + scripts[i].Tag + ">";
              let optional = (scripts[i].Attribute != "*") ? " with " + scripts[i].Attribute + " == " + scripts[i].Value : "";
              let criteria = required + optional;
              
              script += `\tcriteria.push("${criteria}");\n`;
              script += exerciseScripts.ultimate(scripts[i]);
              
            }

            script += `\n\tsocket.emit("getScore", "${student}", "${exercise}", scores, criteria);\n}`;
      
            fs.writeFile("./public/exercises/temp.js", script, (err) => {
              if (err) {
                console.log(err);
              }
              fs.writeFile("./public/exercises/temp.html", data, (err) => {
                if (err) {
                  console.log(err);
                }
                callback();
              });
            });
            
            console.log(script);
          } catch (err) {
            callback("error");
          }
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  })

  socket.on("getScore", (user, exercise, scores, criteria) => {
    let possible = criteria.length;
    let sum = 0;
    let msg = "";
    let wrong = [];
    let percent;
    let reCheck = false;

    scores.forEach(score => {
      sum += score;
    })

    msg = `Marking Criteria(${exercise})\n`;
    for (let i = 0; i < possible; i++) {
      msg += criteria[i] + ": " + scores[i] + "/1" + "\n";
    }
    msg += `Total score: ${sum}/${possible}`;
    
    for (let i = 0; i < possible; i++) {
      if (scores[i] == 0) {
        wrong.push(criteria[i]);
      }
    }
    if (wrong.length == 0) {
      wrong.push("N/A");
    }

    percent = ((sum / possible) * "100").toFixed(1) + "%";

    try {
      db.query(
        {
          sql:
            "SELECT AdminExerciseWrong FROM users" +
            ` WHERE name = '` +
            user +
            `'`,
        },
        function (err, results) {

          let grade = JSON.parse(results[0].AdminExerciseWrong);
          for (let i = 0; i < grade.length; i++) {
            if (grade[i].Exercise == exercise) {
              grade[i].Mark = sum;
              grade[i].Percent = percent;
              grade[i].Wrong = wrong;
              reCheck = true;
              console.log("yes");
            }
          }
          if (reCheck) {
            objgradesAdmin = JSON.stringify(grade);
          } else {
            if (results[0].AdminExerciseWrong.length == 2) {
              objgradesAdmin =
              results[0].AdminExerciseWrong.slice(0, -1) +
              '{"Exercise":' +
              '"' +
              exercise +
              '"' +
              ',"Mark":' +
              sum +
              ',"Possible":' +
              possible +
              ',"Percent":"' +
              percent +
              '","Wrong":"' +
              wrong +
              '"}]';
            } else {
              objgradesAdmin =
              results[0].AdminExerciseWrong.slice(0, -1) +
              ',{"Exercise":' +
              '"' +
              exercise +
              '"' +
              ',"Mark":' +
              sum +
              ',"Possible":' +
              possible +
              ',"Percent":"' +
              percent +
              '","Wrong":"' +
              wrong +
              '"}]';
            }
          }
          console.log(objgradesAdmin);
          try {
            db.query(
              {
                sql:
                  "UPDATE users SET AdminExerciseWrong =" +
                  "'" +
                  objgradesAdmin +
                  "'" +
                  ` WHERE name = '` +
                  user +
                  `'`,
              },
              function (err, results) {
                if (err) throw err;
              }
            );
          } catch (err) {
            console.error("There was an error ", err);
          }
          
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
    
    socket.broadcast.emit("showScore", msg);
  });
  socket.on("setScript", function (exercise, tag, number, attribute, value) {
    try {
      db.query(
        {
          sql:
            "SELECT exercise, script FROM exerciseScript" +
            ` WHERE exercise = '` +
            exercise +
            `'`,
        },
        function (err, results) {
          let exercise = results[0].exercise;
          let scripts = JSON.parse(results[0].script);
          let instruction = {
            Tag: tag,
            Number: number,
            Attribute: attribute,
            Value: value
          }
          scripts.push(instruction);
          let final = JSON.stringify(scripts);
          try {
            db.query(
              {
                sql:
                  "UPDATE exerciseScript SET script =" +
                  "'" +
                  final +
                  "'" +
                  ` WHERE exercise = '` +
                  exercise +
                  `'`,
              },
              function (err, results) {
                if (err) throw err;
              }
            );
          } catch (err) {
            console.error("There was an error ", err);
          }
          
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  });

  socket.on("delScript", (exercise, todel) => {
    try {
      db.query(
        {
          sql:
            "SELECT script FROM exerciseScript" +
            ` WHERE exercise = '` +
            exercise +
            `'`,
        },
        function (err, results) {
          let scripts = JSON.parse(results[0].script);
          for (let i = 0; i < scripts.length; i++) {
            for (let j = 0; j < todel.length; j++) {
              if (
                scripts[i].Tag == todel[j].Tag &&
                scripts[i].Number == todel[j].Number &&
                scripts[i].Attribute == todel[j].Attribute &&
                scripts[i].Value == todel[j].Value
              ) {
                let fscripts = scripts.slice(0, i);
                let lscripts = scripts.slice(i + 1);
                scripts = fscripts.concat(lscripts);
              }
            }
          }
          let final = JSON.stringify(scripts);
          try {
            db.query(
              {
                sql:
                  "UPDATE exerciseScript SET script =" +
                  "'" +
                  final +
                  "'" +
                  ` WHERE exercise = '` +
                  exercise +
                  `'`,
              },
              function (err, results) {
                if (err) throw err;
              }
            );
          } catch (err) {
            console.error("There was an error ", err);
          }
          
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  })
  socket.on("addLesson", (exercise) => {
    console.log(exercise);
    try {
      db.query(
        {
          sql:
            "INSERT INTO exerciseScript (exercise, script)" +
            "VALUES (" +
            "'" +
            exercise +
            "', '" +
            "[]" +
            `')`,
        },
        function (err, results) {
          if (err) throw err;
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  })

  socket.on("delExercise", (exercise) => {
    console.log(exercise);
    try {
      db.query(
        {
          sql:
            "DELETE FROM exerciseScript WHERE exercise =" +
            "'" +
            exercise +
            `'`,
        },
        function (err, results) {
          if (err) throw err;
        }
      );
    } catch (err) {
      console.error("There was an error ", err);
    }
  })

  socket.on("markExercise", function (user, file, name) {
    wss.myFunction(user, file, name)
  })

});

app.use(
  express.urlencoded({
    extended: false,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/", require("./routes/pages"));
app.use("/auth", require("./routes/auth"));
app.use("/content", async function (req, res) {
  require("serve-static")("public/topics")(
    req,
    res,
    async function onNext(err) {
      require("serve-index")("public/topics", {
        icons: true,
        stylesheet: "public/css/style.css",
        template: "./views/content.hbs",
      })(req, res);
    }
  );
  try {
    const decoded = await promisify(jwt.verify)(
      req.cookies.jwt,
      process.env.JWT_SECRET
    );
    token = decoded;
  } catch (err) {
    console.error("There was an error ", err);
  }
});


const port = 8080;
server.listen(port);
console.debug("🌎 Server listening on port " + port);
