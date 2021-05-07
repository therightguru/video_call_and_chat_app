const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { v4: uuidV4 } = require('uuid')

const {generateMessage, generateLocationMessage} = require('./utils/message');
const {isRealString} = require('./utils/validation');
const {Users} = require('./utils/users');

var users = new Users();

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}&kunal`)
})

app.get('/:room&:joinedUser', (req, res) => {
  res.render('room', { data: { roomId: req.params.room, joinedUser: req.params.joinedUser }})
})

io.on('connection', socket => {
  // For chat
  socket.on('join', (params, callback) => {
    if(!isRealString(params.name) || !isRealString(params.room)){
        return callback('Name and room name are required.');
    }
    
    socket.join(params.room);
    users.removeUser(socket.id); 
    users.addUser(socket.id, params.name, params.room);

    io.to(params.room).emit('updateUserList', users.getUserList(params.room));

    //emit from admin text welcome to the chat app
    socket.emit('newMessage', generateMessage('Admin', 'Welcome to the Chat App'));
    //socket.broadcast.emit from Admin text New user joined
    socket.broadcast.to(params.room).emit('newMessage', generateMessage('Admin', `${params.name} has joined!!`));
    callback();
  });

  socket.on('createMessage', (message, callback) => {
    var user = users.getUser(socket.id);

    if(user && isRealString(message.text)){
        io.to(user.room).emit('newMessage', generateMessage(user.name, message.text));//emits an event to every connectione
    }

    callback();
  });

  socket.on('raiseHand', (message) => {
    var user = users.getUser(socket.id);

    if(user && isRealString(message.text)) {
      io.to(user.room).emit('handRaised', `Hand raised by ${message.raisedBy}`);//emits an event to every connectione
    }
  })

  socket.on('createLocationMessage', (coords) => {
      var user = users.getUser(socket.id);
      
      if(user && isRealString(message.text)){
          io.to(user.room).emit('newLocationMessage', generateLocationMessage(user.name, coords.latitude, coords.longitude));
      }
      
  });

  socket.on('disconnect', () => {
    var user = users.removeUser(socket.id);
    if(user){
        io.to(user.room).emit('updateUserList', users.getUserList(user.room));
        io.to(user.room).emit('newMessage', generateMessage('Admin', `${user.name} has left the chat room!!`));
    }
    console.log("Disconnected from the server");
  });

  // For webRTC
  socket.on('join-room', (roomId, joinedUser, userId) => {
    socket.join(roomId)
    socket.to(roomId).broadcast.emit('user-connected', joinedUser, userId)

    // socket.on('close', (data)=>{
    //   io.to(users[data.to]).emit('close')
    // })

    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    })
  })
})

server.listen(process.env.PORT || 5050)