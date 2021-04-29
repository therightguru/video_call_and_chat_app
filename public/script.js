const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const myPeer = new Peer({
  secure: true,
  host: 'peerjs-server.herokuapp.com',
  port: '443',
  config: { 'iceServers': [
    { 'urls': 'stun:stun.therightguru.com:3478' },
    { 'urls': 'turn:turn.therightguru.com:3478', 'username': 'admin', 'credential': 'therightguru' }
  ],'sdpSemantics': 'unified-plan' }
})

// let django_socket = new WebSocket(`ws://localhost:8000/ws/video_call/edustart/`)
const myVideo = document.createElement('video')
myVideo.muted = true
const peers = {}
let callStream
var audioEnabled = true
var videoEnabled = true
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  callStream = stream
  addVideoStream(myVideo, stream)

  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })

    peers[call.peer] = call
  })

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  })
})

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close()
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}

// Toggle audio
document.getElementById("muteButton")
  .addEventListener("click", function() {
    if(callStream){
      audioEnabled = !audioEnabled
      callStream.getAudioTracks()[0].enabled = audioEnabled
      console.info("Mute Button running")
    }
  })

// Toggle video
document.getElementById("videoButton")
  .addEventListener("click", function() {
    if(callStream){
      videoEnabled = !videoEnabled
      callStream.getVideoTracks()[0].enabled = videoEnabled
      console.info("Video Button running")
    }
})

// Share screen
document.getElementById("shareScreen")
  .addEventListener("click", function() {
    navigator.mediaDevices.getDisplayMedia({cursor:true})
    .then(screenStream=>{
      Object.values(peers).map(peer => {
        peer.peerConnection?.getSenders().map(sender => {
            if(sender.track.kind == "video") {
              sender.replaceTrack(screenStream.getVideoTracks()[0])
              .then(res => console.log(res));
            }
        })
      });
      myVideo.srcObject=screenStream
      screenStream.getTracks()[0].onended = () => {
        Object.values(peers).map(peer => {
          peer.peerConnection?.getSenders().map(sender => {
              if(sender.track.kind == "video") {
                      sender.replaceTrack(callStream.getVideoTracks()[0]);
              }
          })
        });
        myVideo.srcObject=callStream
      }
  })
})

// End Call
document.getElementById("endCall")
  .addEventListener("click", function() {
    myPeer.destroy()
    if (JOINED_USER.includes("ES")){
      window.location.replace("localhost:3000/student-dashboard")
    } else if (JOINED_USER.includes("TC")) {
      window.location.replace("localhost:3000/teacher-dashboard")
    } else {
      window.location.replace("localhost:3000")
    }
    
    // socket.current.emit('close',{to:caller})
  })


// JavaScript fro chat functionality 

function scrollToBottom(){
  var messages = jQuery('#messages');
  var newMessage = messages.children('li:last-child');

  var clientHeight = messages.prop('clientHeight');
  var scrollTop = messages.prop('scrollTop');
  var scrollHeight = messages.prop('scrollHeight');
  var newMessageHeight = newMessage.innerHeight();
  var lastMessageHeight = newMessage.prev().innerHeight();

  if(clientHeight + scrollTop + newMessageHeight + lastMessageHeight >= scrollHeight){
      messages.scrollTop(scrollHeight);
  }
}

socket.on('connect', function(){
  var params = jQuery.deparam(window.location.search);
  socket.emit('join', {name: JOINED_USER, room: ROOM_ID}, function(err){
      if(err){
          alert(err);
          window.location.href = '/';
      }else{
          console.log('No error');
      }
  })
});

socket.on('disconnect', function(){
  console.log('Disconnected from the server!!'); 
});

socket.on('updateUserList', function(users){
  var ol = jQuery('<ol></ol>');
  users.forEach(function(user){
      ol.append(jQuery('<li></li>').text(user));
  }); 

  jQuery('#users').html(ol);
});     

socket.on('newMessage', function(message){

  var formattedTime = moment(message.createdAt).format('h:mm a');
  var template = jQuery('#message-template').html();
  var html = Mustache.render(template, {
      text: message.text,
      from: message.from,
      createdAt: formattedTime
  });
  jQuery('#messages').append(html);
  scrollToBottom(); 
});

socket.on('newLocationMessage', function(message){
  var formattedTime = moment(message.createdAt).format('h:mm a');
  var template = jQuery('#location-template').html();
  var html = Mustache.render(template, {
      from: message.from,
      url: message.url,
      createdAt: formattedTime
  });
  jQuery('#messages').append(html);
  scrollToBottom();
});

jQuery('#message-form').on('submit', function(e){
  e.preventDefault();

  var messageTextbox = jQuery('[name=message]');

  socket.emit('createMessage', {  
      text: messageTextbox.val()
  }, function(){
       messageTextbox.val('')
  }); 
});

var locationButton = jQuery('#send-location');
locationButton.on('click', function(e){
  e.preventDefault();
  if(!navigator.geolocation){
      return alert('Geolocation not supported by your browser!!');
  }

  locationButton.attr('disabled', 'disabled').text('Sending...');

  navigator.geolocation.getCurrentPosition(function(position){
      locationButton.removeAttr('disabled').text('Send Location');
      socket.emit('createLocationMessage', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
      });
  }, function(){
      locationButton.removeAttr('disabled').text('Send Location');
      alert('Unable to fetch location.');
  })
});