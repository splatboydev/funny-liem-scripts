// Want to change your courses?
// Simply run this command:
socket.emit("command", "al <user> <lessons>");
// , where <user> is the target user, and
// <lessons> is a list of lessons that begin 
// with the 1st letter of the course and followed
// by commas.
// Example:                  (my user) (my lessons) 
// socket.emit("command", "al lucasm w29,w30,w31");
